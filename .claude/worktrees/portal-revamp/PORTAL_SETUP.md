# Sync Agency Portal — Go-Live Checklist

The portal is fully built and the Supabase backend (project **Sync Client Portal**,
`whuqfxdzopyucebtnbkx`) is deployed: schema, RLS, storage, seeded pathway/achievements,
and 4 Edge Functions. What remains are the manual steps below — SMTP, Stripe keys,
and the SiteGround upload. Work top to bottom.

Admin login: **dexter@teambell.net** / the password you chose. **Change it after first
login** (it was shared in chat).

---

## 1. SMTP (email confirmation) — Supabase Dashboard

Dashboard → Project Settings → **Authentication** → SMTP Settings → Enable Custom SMTP:

| Field | Value |
|---|---|
| Sender name | `Sync Agency` |
| Sender email | `confirmation@syncagency.org` |
| Host | `mail.syncagency.org` |
| Port | `465` |
| Username | `confirmation@syncagency.org` |
| Password | *paste it here yourself — never in code/repo* |

Then confirm it works: Authentication → Users → invite yourself at a test address, or
sign up at `https://syncagency.org/signup` and check the mail arrives. If port 465 is
rejected by Supabase, switch to `587` (STARTTLS).

### Auth URLs (same dashboard, Authentication → URL Configuration)
- **Site URL:** `https://syncagency.org`
- **Redirect URLs:** add `https://syncagency.org/auth/confirmed`

### Confirm-email setting (Authentication → Sign In / Providers → Email)
- **"Confirm email" must be ON** (it is on by default) — accounts only activate after
  the link is clicked, which is also what triggers purchase→tier linking.

### Email template (Authentication → Email Templates → Confirm signup)
Suggested branded template (gold on black, from "Sync Agency"):

```html
<div style="background:#080808;padding:48px 24px;font-family:Georgia,serif;color:#F0EDE6;text-align:center">
  <h1 style="color:#C9A84C;font-size:28px;letter-spacing:0.06em;margin-bottom:8px">SYNC AGENCY</h1>
  <p style="color:#B8B0A0;font-size:15px;max-width:420px;margin:0 auto 32px">
    Your account is one click away. Confirm your email to unlock your member portal.
  </p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;background:#C9A84C;color:#080808;padding:14px 40px;
            font-weight:bold;letter-spacing:0.12em;text-transform:uppercase;font-size:13px;
            text-decoration:none;border-radius:2px">Confirm my account</a>
  <p style="color:#6A6258;font-size:12px;margin-top:32px">
    Didn't create a Sync Agency account? You can ignore this email.
  </p>
</div>
```

---

## 2. Stripe — replace ALL placeholders

### 2a. Secrets (Supabase Dashboard → Edge Functions → Secrets)
Add:
```
STRIPE_SECRET_KEY   = sk_live_...        (your live secret key)
STRIPE_WEBHOOK_SECRET = whsec_...        (from step 2c)
SITE_URL            = https://syncagency.org
```

### 2b. Course Price IDs (in code — 2 files)
In Stripe you have (or will create) a Product+Price per course tier & billing type.
Copy each **Price ID** (`price_...`) and replace the placeholders in **both**:

- `supabase/functions/stripe-webhook/index.ts` → `COURSE_PRICE_MAP`
- `supabase/functions/create-checkout-session/index.ts` → `MONTHLY_PRICE_IDS`

| Placeholder | Replace with Price ID for |
|---|---|
| `price_PLACEHOLDER_PRO_LIFETIME` | Pro Accelerator lifetime ($189) |
| `price_PLACEHOLDER_PRO_MONTHLY` | Pro Accelerator monthly ($79/mo) |
| `price_PLACEHOLDER_ELITE_LIFETIME` | Elite Scale lifetime ($397) |
| `price_PLACEHOLDER_ELITE_MONTHLY` | Elite Scale monthly ($127/mo) |
| `price_PLACEHOLDER_VIP_LIFETIME` | VIP Inner Circle lifetime ($739) |
| `price_PLACEHOLDER_VIP_MONTHLY` | VIP Inner Circle monthly ($349/mo) |

Then redeploy the two functions (ask Claude, or `supabase functions deploy stripe-webhook`
and `supabase functions deploy create-checkout-session` with the Supabase CLI).
**Important:** these must be the same Prices used by the marketing site's checkout,
otherwise the webhook won't recognise course purchases.

### 2c. Register the webhook (Stripe Dashboard → Developers → Webhooks)
- Endpoint URL: `https://whuqfxdzopyucebtnbkx.supabase.co/functions/v1/stripe-webhook`
- Events to send:
  - `checkout.session.completed`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
  - `invoice.paid`
- Copy the endpoint's **Signing secret** → that's `STRIPE_WEBHOOK_SECRET` in step 2a.

### 2d. Course checkout redirect
Point the marketing site's Stripe checkout success back to
`https://syncagency.org/signup` (Checkout Session `success_url`, or the Payment Link /
Buy Button "after payment" redirect) so buyers land on account creation.

### 2e. Frontend key (`.env`)
Replace `VITE_STRIPE_PUBLISHABLE_KEY=pk_live_PLACEHOLDER` in `.env` with your live
publishable key, then rebuild (step 3).

---

## 3. Deploy to SiteGround (File Manager)

1. `npm run build` → produces `dist/`.
2. In Site Tools → File Manager, upload the **contents of `dist/`** into `public_html`
   (index.html, assets/, .htaccess, etc. — the same place the current site lives; this
   build contains the whole site, marketing pages included).
3. The `.htaccess` is included in the build automatically (from `public/.htaccess`) —
   it makes SPA routes like `/portal/pathway` resolve. Make sure hidden files are
   visible in File Manager so it actually uploads.

---

## 4. End-to-end test (after 1–3)

1. Buy the cheapest course with a real card (refund after) or use Stripe test mode first.
2. You're redirected to `/signup` — sign up with the same email.
3. Confirmation email arrives from confirmation@syncagency.org → click → `/auth/confirmed`
   → lands in `/portal` with the right tier badge.
4. As admin (`/admin`): open the client, add a product with an image and price.
5. As the member: add it to the order, enter a shipping address, pay → order shows
   **paid** in `/portal/orders` and appears in the admin Orders queue with the address.
6. Advance the order (sourcing → shipped with tracking → delivered) and confirm the
   member sees each step.
7. Upload an achievement proof as the member; approve it in `/admin/achievements`.
8. Monthly-plan test: cancel the test subscription in Stripe → member gets locked to
   the "Your access is paused" screen; reactivate → access restored.

---

## Placeholder inventory (everything that must be replaced)

| Where | Placeholder | Replace with |
|---|---|---|
| Supabase Edge Function secrets | `STRIPE_SECRET_KEY` (unset) | live secret key |
| Supabase Edge Function secrets | `STRIPE_WEBHOOK_SECRET` (unset) | webhook signing secret |
| Supabase Edge Function secrets | `SITE_URL` (unset, defaults ok) | `https://syncagency.org` |
| `supabase/functions/stripe-webhook/index.ts` | 6 × `price_PLACEHOLDER_*` | course Price IDs |
| `supabase/functions/create-checkout-session/index.ts` | 3 × `price_PLACEHOLDER_*_MONTHLY` | monthly Price IDs |
| `.env` | `pk_live_PLACEHOLDER` | live publishable key |
| Supabase Auth SMTP | password (unset) | mailbox password |

## Notes
- Recommended: enable **leaked password protection** (Dashboard → Authentication →
  Sign In / Providers → Password security) — blocks passwords found in known breaches.
- Elite/VIP pathway node copy was drafted by Claude and is pending your approval — it's
  editable in the `pathway_nodes` table (Supabase Dashboard → Table Editor) any time.
- Prices members pay for products are **admin-set only** and enforced by RLS, not just UI.
- A lapsed monthly subscription blocks all portal data at the database level (RLS),
  not just the interface.
