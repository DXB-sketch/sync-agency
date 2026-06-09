Read DESIGN.md in the project root before writing any UI code. Every component, style, and animation must conform to it exactly.
You are updating the Sync Agency website. The task is to replace the existing Stripe buy button system on the Pricing section with a custom dual-option checkout flow — monthly subscription (with 3-day free trial) vs 3-year one-time payment — using a PHP backend on SiteGround and a custom checkout drawer UI.

---

## CONTEXT

The site is a React + Vite static site. There is no existing backend. Payments currently use Stripe's <stripe-buy-button> web component. The site is deployed to SiteGround shared hosting which supports PHP.

The publishable key used throughout is:
pk_live_51TKIROPDABwVk3W5w51MmfawDKkAMsyEjGoK6ZA5PZeBalPsJc36lz8gcPkpXKqqROKuve95rUmS1JclAIwTpzZ900qOf5I2Ne

---

## STEP 1 — Update src/data/pricing.js

Replace the entire TIERS array with the following updated data. Do not change COMPARE_ROWS.

The new TIERS array must have this structure for each tier:
- id, tier, name, tagline, outcome, features, spotsBase, spotsResetMin, spotsResetMax, featured (unchanged fields)
- price: monthly price as a string (no $ sign)
- priceYearly: 3-year one-time price as a string (no $ sign)
- monthlyTotal36: total cost if paid monthly for 36 months as a string (no $ sign)
- savingsPct: percentage saving of 3-year vs 36 months of monthly (as integer)
- stripeMonthlyPriceId: placeholder string "MONTHLY_PRICE_ID_PRO" (etc.) — to be filled in manually
- stripeYearlyPriceId: placeholder string "YEARLY_PRICE_ID_PRO" (etc.) — to be filled in manually

Use these values:

Pro Accelerator:
- price: "79"
- priceYearly: "189"
- monthlyTotal36: "2,844"
- savingsPct: 93
- stripeMonthlyPriceId: "MONTHLY_PRICE_ID_PRO"
- stripeYearlyPriceId: "YEARLY_PRICE_ID_PRO"
- spotsBase: 87, spotsResetMin: 78, spotsResetMax: 94
- featured: false

Elite Scale:
- price: "127"
- priceYearly: "397"
- monthlyTotal36: "4,572"
- savingsPct: 91
- stripeMonthlyPriceId: "MONTHLY_PRICE_ID_ELITE"
- stripeYearlyPriceId: "YEARLY_PRICE_ID_ELITE"
- spotsBase: 61, spotsResetMin: 52, spotsResetMax: 68
- featured: true

VIP Inner Circle:
- price: "349"
- priceYearly: "739"
- monthlyTotal36: "12,564"
- savingsPct: 94
- stripeMonthlyPriceId: "MONTHLY_PRICE_ID_VIP"
- stripeYearlyPriceId: "YEARLY_PRICE_ID_VIP"
- spotsBase: 34, spotsResetMin: 28, spotsResetMax: 42
- featured: false

Keep all existing feature arrays and other fields exactly as they are.

---

## STEP 2 — Create public/checkout.php

This PHP file will be deployed to SiteGround alongside the React build. It creates a Stripe Checkout Session and returns the session URL as JSON.

Requirements:
- Read STRIPE_SECRET_KEY from an environment variable using getenv('STRIPE_SECRET_KEY'). Do NOT hardcode the secret key.
- Accept POST requests with JSON body: { "priceId": "price_xxx", "mode": "subscription" | "payment", "tierName": "Pro Accelerator" }
- Use the Stripe PHP SDK via composer autoload at __DIR__ . '/vendor/autoload.php'
- For mode "subscription": create a checkout session with allow_promotion_codes: true, subscription_data.trial_period_days: 3
- For mode "payment": create a checkout session with no trial
- Set success_url to the origin of the request + "/?checkout=success&tier=" + urlencode(tierName)
- Set cancel_url to the origin of the request + "/#pricing"
- Set CORS headers to allow requests from the same origin
- Return JSON: { "url": "https://checkout.stripe.com/..." } on success
- Return JSON: { "error": "message" } with HTTP 500 on failure
- Add a comment at the top: "Deploy this file to your SiteGround public_html root alongside the built React app. Run: composer require stripe/stripe-php in that same directory."

---

## STEP 3 — Create src/components/CheckoutDrawer.jsx

This is the custom checkout UI. It must match the site's existing design language (dark theme, gold accents, Cormorant Garamond display font, Syne body font, CSS variables from global.css).

Props: { open, onClose, tier }
Where tier is the full tier object from pricing.js, or null.

Behaviour:
- When open is false, the drawer is hidden (not rendered in DOM)
- When open is true:
  - On mobile (≤768px): slides up from the bottom, covers full screen, leaves ~60px of darkened page visible at the top
  - On desktop (>768px): slides in from the right as a sidebar ~480px wide, rest of screen gets a dark overlay
  - Overlay behind drawer: rgba(0,0,0,0.72) with backdrop-filter: blur(4px), same as exit-overlay in global.css
  - Drawer itself: background var(--card), border-left (desktop) or border-top (mobile) 1px solid var(--border-md)
  - Animation: translateX(100%) → translateX(0) on desktop, translateY(100%) → translateY(0) on mobile
  - Transition: 0.45s cubic-bezier(0.16, 1, 0.3, 1) — same easing used throughout the site

Inside the drawer:
1. Close button top-right (✕), matching .exit-close style
2. Eyebrow label (matching .exit-eyebrow style): "Choose Your Plan"
3. Tier name as heading (Cormorant Garamond, gold italic)
4. A toggle: two pill buttons side by side — "Monthly" and "3-Year Access"
   - Selected pill: gold background (#C9A84C), black text
   - Unselected: transparent, gold border, gold text
   - Default selected: Monthly
5. Pricing display section:
   - When Monthly selected:
     - Show "$[price]/mo" in large display
     - Show "AUD · billed monthly · cancel anytime"
     - Show a gold badge: "3-Day Free Trial Included"
   - When 3-Year selected:
     - Show "$[priceYearly] one-time" in large display
     - Show "AUD · 3 years access · renew after 3 years"
     - Show a gold badge: "Save [savingsPct]% vs monthly — $[monthlyTotal36] over 3 years"
6. A CTA button (full width, matching .btn-gold style):
   - Monthly: "Start Free Trial →"
   - 3-Year: "Get 3-Year Access →"
7. Under the button, small print (var(--text-dim), 12px):
   - Monthly: "3-day free trial. Card required. Cancel any time before trial ends."
   - 3-Year: "One-time payment. Access valid for 3 years from purchase date."
8. A "Secure checkout via Stripe" note with a lock icon at the bottom

On CTA button click:
- Show a loading state on the button (spinner or "Processing...")
- POST to /checkout.php with:
  { "priceId": selected priceId from tier data, "mode": "subscription" or "payment", "tierName": tier.name }
- On success: redirect window.location.href to the returned session URL
- On error: show an inline error message below the button in var(--urgent) colour
- Track the event: trackEvent("checkout_initiated", { tier: tier.name, plan: "monthly" | "yearly" })

Body scroll lock: when drawer is open, set document.body.style.overflow = "hidden". Restore on close.

---

## STEP 4 — Create src/components/CheckoutSuccessNotification.jsx

This notification appears after a successful Stripe checkout (when URL contains ?checkout=success).

It must look and behave identically in style to the ExitIntentPopup (same overlay, same centred card, same animation), but with different content:

Content:
- Eyebrow: "Payment Confirmed"
- Heading: "You're in. Welcome to <em>Sync Agency.</em>"
- Subtext: "Check your email for access details. If you don't see it within 5 minutes, check your spam folder."
- If URL has &tier=Pro%20Accelerator (etc.), show: "Tier: [tier name]" in gold beneath the subtext
- A single button: "Got it →" which closes the notification
- The notification auto-closes after 12 seconds if not dismissed

On mount, remove the ?checkout=success and &tier=... params from the URL using window.history.replaceState so refreshing doesn't re-show it.

---

## STEP 5 — Update src/sections/Pricing.jsx

Remove all imports and usage of StripeBuyButton.

Add these imports:
- CheckoutDrawer from "../components/CheckoutDrawer"
- CheckoutSuccessNotification from "../components/CheckoutSuccessNotification"

Add state:
- drawerOpen: boolean, default false
- drawerTier: object | null, default null

Replace the StripeBuyButton block (inside the tier map, where it currently renders <div onClick=...><StripeBuyButton .../></div>) with:

  <button
    className="btn-gold price-cta-btn"
    onClick={() => { setDrawerTier(tier); setDrawerOpen(true); trackEvent("pricing_cta_click", { tier: tier.name }); }}
  >
    Choose Plan →
  </button>

At the bottom of the returned JSX (before the closing </section> tag), add:
  <CheckoutDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} tier={drawerTier} />
  <CheckoutSuccessNotification />

Also update the compare table headers to show the new prices:
  Pro Accelerator — $79/mo
  Elite Scale — $127/mo
  VIP Inner Circle — $349/mo

Also update price-period text in the card from "AUD — one-time payment" to "AUD — per month · 3-day free trial"

---

## STEP 6 — Add CSS to src/styles/global.css

Append at the end of the file:

/* ── CHECKOUT DRAWER ── */
.checkout-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(4px); z-index: 8000; opacity: 0; pointer-events: none; transition: opacity .35s ease; }
.checkout-overlay.open { opacity: 1; pointer-events: auto; }

.checkout-drawer { position: fixed; top: 0; right: 0; height: 100%; width: 480px; max-width: 100%; background: var(--card); border-left: 1px solid var(--border-md); z-index: 8001; transform: translateX(100%); transition: transform .45s cubic-bezier(.16,1,.3,1); overflow-y: auto; padding: 48px 40px 60px; display: flex; flex-direction: column; gap: 24px; }
.checkout-drawer.open { transform: translateX(0); }

@media (max-width: 768px) {
  .checkout-drawer { top: 60px; width: 100%; height: calc(100% - 60px); border-left: none; border-top: 1px solid var(--border-md); transform: translateY(100%); border-radius: 12px 12px 0 0; padding: 32px 24px 48px; }
  .checkout-drawer.open { transform: translateY(0); }
}

.checkout-plan-toggle { display: flex; gap: 8px; background: var(--card2); border-radius: 100px; padding: 4px; }
.checkout-plan-btn { flex: 1; padding: 10px 16px; border-radius: 100px; border: none; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: 0.06em; cursor: pointer; transition: all .2s; background: transparent; color: var(--text-dim); }
.checkout-plan-btn.active { background: var(--gold); color: var(--black); }

.checkout-price-display { font-family: var(--font-display); font-size: 56px; font-weight: 700; color: var(--text); line-height: 1; }
.checkout-price-period { font-size: 13px; color: var(--text-dim); margin-top: 6px; }
.checkout-savings-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--gold-subtle); border: 1px solid var(--border-md); border-radius: 100px; padding: 6px 14px; font-size: 12px; font-weight: 600; color: var(--gold); letter-spacing: 0.06em; margin-top: 12px; }
.checkout-trial-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--gold-subtle); border: 1px solid var(--border-md); border-radius: 100px; padding: 6px 14px; font-size: 12px; font-weight: 600; color: var(--gold); letter-spacing: 0.06em; margin-top: 12px; }

.checkout-cta-btn { width: 100%; padding: 16px; background: var(--gold); color: var(--black); border: none; border-radius: 2px; font-family: var(--font-body); font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: background .2s, opacity .2s; margin-top: 8px; }
.checkout-cta-btn:hover { background: var(--gold-lt); }
.checkout-cta-btn:disabled { opacity: 0.6; cursor: not-allowed; }

.checkout-smallprint { font-size: 12px; color: var(--text-dim); line-height: 1.6; text-align: center; }
.checkout-secure { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; color: var(--text-dim); margin-top: auto; padding-top: 24px; border-top: 1px solid var(--border); }
.checkout-error { font-size: 13px; color: var(--urgent); text-align: center; padding: 10px; background: var(--urgent-bg); border-radius: 2px; }

/* ── PRICE CTA BUTTON ── */
.price-cta-btn { width: 100%; margin-bottom: 12px; }

---

## IMPORTANT NOTES FOR CLAUDE CODE

1. Do NOT remove or modify StripeBuyButton.jsx — it is still used by RepListPage.jsx
2. Do NOT modify RepListPage.jsx at all
3. The checkout.php file goes in the /public directory so Vite includes it in the build output
4. After completing all changes, output a checklist of manual steps:
   - "Create 3 one-time Stripe Prices (one per tier) in Stripe Dashboard and update stripeYearlyPriceId values in src/data/pricing.js"
   - "Confirm the 3 monthly subscription Price IDs and update stripeMonthlyPriceId values in src/data/pricing.js"
   - "On SiteGround: navigate to public_html, run: composer require stripe/stripe-php"
   - "On SiteGround: set environment variable STRIPE_SECRET_KEY in Site Tools → Devs → PHP Config or via .htpasswd SetEnv"
   - "Run npm run build and upload the dist/ folder contents to public_html"
5. Do not install any new npm packages — the drawer is pure React + CSS