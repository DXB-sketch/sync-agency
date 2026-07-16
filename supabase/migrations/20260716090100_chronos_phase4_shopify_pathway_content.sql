-- Phase 4 content seed: Shopify Dropshipping pathway node copy.
-- Founder-reviewable draft — see docs/PHASE4_COURSE_CONTENT_BRIEF.md sign-off notes
-- recorded in docs/FOUNDER_DECISIONS_REQUIRED.md. Zero [FOUNDER-DATA]/[VERIFY-UI]
-- tokens per plan §1.8 (unresolved claims were reworded to verifiable process
-- statements rather than tokened, see report).

insert into public.pathway_nodes (id, pathway_id, phase, order_in_phase, title, body, icon, min_tier, depends_on)
values

('sh1_create_store', (select id from public.pathways where slug='shopify'), 1, 1,
 'Create Your Shopify Account',
$body$Your storefront starts here. Shopify runs the checkout and the storefront; Sync runs the sourcing and shipping behind it — set this half up once, properly, and everything after gets easier.

1. Go to shopify.com and start a free trial, then pick a plan once you're ready to sell (the **Basic** plan covers everything this course needs).
2. Name your store — something that fits the niche you're building, not your own name.
3. Spend ten minutes in the **Home** screen tour Shopify shows new stores. You'll recognise **Settings**, **Products**, and **Orders** for the rest of this pathway.

Mark complete once your Shopify account exists and you've picked a plan.$body$,
 'storefront', null, '{}'),

('sh1_theme_pages', (select id from public.pathways where slug='shopify'), 1, 2,
 'Install a Theme and Publish Your Trust Pages',
$body$A store with no policies looks unfinished to a buyer and to Shopify Payments. Four pages fix that in one sitting.

1. In **Online Store → Themes**, install a free theme from the Shopify Theme Store — any clean, simple one works for this course.
2. In **Online Store → Pages**, create four pages:

```copy
Refund Policy
Privacy Policy
Terms of Service
Shipping & Delivery Times
```

3. Use Shopify's built-in policy generator (**Settings → Policies**) for the first three. Write the delivery-times page yourself — state the real shipping window you can back up, not a guess.

Mark complete once your theme is live and all four pages are published.$body$,
 'check-seal', null, '{sh1_create_store}'),

('sh1_domain_payments', (select id from public.pathways where slug='shopify'), 1, 3,
 'Connect a Domain and Turn On Payments',
$body$Two settings turn a preview store into one that can actually take money.

1. In **Settings → Domains**, connect a custom domain, or keep the free myshopify.com address while you're testing.
2. In **Settings → Payments**, activate **Shopify Payments** (or PayPal if Shopify Payments isn't available in your country) and complete the identity details it asks for.
3. Place a test order using Shopify's **Bogus Gateway** (visible while Payments isn't fully verified yet) to confirm checkout works end to end.

This is mechanics only — no revenue projections belong here. A working checkout is what you're proving, not a sales number.

Mark complete once payments are activated and a test order completes.$body$,
 'sliders', null, '{sh1_theme_pages}'),

('sh2_how_sourcing_works', (select id from public.pathways where slug='shopify'), 2, 1,
 'How Sourcing Through Sync Works',
$body$Every product in your **Products** tab is real stock — here's exactly how it gets to your customer, and what it costs you.

1. **Sync is your supplier.** The catalogue assigned to you is sourced and held by Sync. When your store sells an item, Sync ships it directly to your customer — you never touch the product yourself.
2. **What it costs you:** the cost shown against each product — covering the item and its shipping — is charged automatically from your **Wallet** balance the moment a store order lands. That figure is visible on every product before you ever list it.
3. **What Sync keeps:** Sync earns a margin on every unit it ships for you. Said plainly, that's the business model — you get sourcing, stock handling, and direct-to-customer shipping with no inventory of your own; Sync earns for making that possible.
4. **What you control:** your sell price. Your profit is the gap between what your customer pays you and what you pay Sync:

```copy
Your profit = your sell price − your Sync product cost
```

Mark complete once you understand where every dollar of a sale goes before you list your first product.$body$,
 'handshake', null, '{sh1_domain_payments}'),

('sh2_choose_products', (select id from public.pathways where slug='shopify'), 2, 2,
 'Choose Your Products',
$body$Your assigned catalogue in the **Products** tab is where every listing you build starts. Choosing well here saves rework later.

1. Stay inside one or two related categories at first — a coherent store converts better than a scattered one.
2. Check the price band: items with a healthy gap between what you pay and what similar stores charge give you room to price competitively and still profit.
3. Check weight and size before you commit — bulky or heavy items cost more to ship and eat into your margin faster than small ones.
4. Need something your catalogue doesn't have? Request an assignment change through **Support** rather than sourcing it yourself — everything in your store has to run through Sync to ship correctly.

Mark complete once you've shortlisted the products you're building your first listings around.$body$,
 'listing-card', null, '{sh2_how_sourcing_works}'),

('sh3_product_pages', (select id from public.pathways where slug='shopify'), 3, 1,
 'Build Your Product Pages',
$body$A product page has seconds to answer three questions: what is this, is it real, and can I trust this store. Structure does the work.

1. **Title:** lead with the product, not adjectives — buyers search for the thing, not your opinion of it.
2. **Photos:** use every image your catalogue item provides, in order — the first is the one shown in search.
3. **Description:** use this structure for every listing:

```copy
[What it is — one line]
[Key details: size / material / what's included]
[Why it's useful — one line]
```

That order matters — buyers who bail after line one still saw the essentials.

Mark complete once your first product page is published with all three sections in place.$body$,
 'listing-card', null, '{sh2_choose_products}'),

('sh3_pricing', (select id from public.pathways where slug='shopify'), 3, 2,
 'Price to Convert: Compare-at Pricing',
$body$Anchor high, then discount. The same psychology that works on Depop's crossed-out price works here through Shopify's **compare-at price** — buyers see the saving, not just the price.

1. In each product's **Pricing** section, set **Price** to your assigned **discount price** — this is what the customer actually pays.
2. Set **Compare-at price** to your assigned **listing price** — Shopify automatically shows it crossed out next to your real price.
3. Keep both numbers matched to what's shown in your **Products** tab — they're calculated to leave you a margin after your Sync cost.

**Speed tip: set compare-at pricing for every product before you publish it, not after — a listing with no visible discount converts noticeably worse.**

Mark complete once every published listing shows a crossed-out compare-at price.$body$,
 'price-tag', null, '{sh3_product_pages}'),

('sh3_trust', (select id from public.pathways where slug='shopify'), 3, 3,
 'Add Trust Elements Honestly',
$body$Trust that's earned converts; trust that's faked gets your account flagged and your customers burned. Build only the real kind.

1. Link your **Refund Policy**, **Privacy Policy**, and **Terms of Service** pages in your theme's footer — Shopify pulls these in automatically once they're published (Module 1).
2. State your real delivery window on the shipping page — not the fastest case, the typical one.
3. Offer guarantees you can actually honour, and nothing more.

Do not add: fake reviews, countdown timers with no real deadline, or "X people are viewing this" widgets. None of them are real, and urgency should only ever come from a real constraint — a genuine low-stock count, a genuine sale end date.

Mark complete once your footer links all three policies and nothing on your store fakes urgency.$body$,
 'check-seal', null, '{sh3_pricing}'),

('sh4_create_app', (select id from public.pathways where slug='shopify'), 4, 1,
 'Create Your Custom App in Shopify',
$body$Sync connects to your store through a custom app you create yourself — Shopify's most direct connection method, and one only you control.

1. In your Shopify admin, go to **Settings → Apps and sales channels → Develop apps**.
2. Click **Create an app** and name it something recognisable, like "Sync Fulfilment".
3. Under **Configuration → Admin API scopes**, enable exactly these three:

```copy
read_orders
write_fulfillments
read_products
```

4. Click **Install app**, then reveal and copy the **Admin API access token** — Shopify shows it once, so copy it now.

These three scopes are the minimum Sync needs: reading orders to fulfil them, marking them fulfilled, and reading your product list to link it. Nothing more is requested.

Mark complete once your app is installed and you're holding its access token.$body$,
 'sliders', null, '{sh3_trust}'),

('sh4_paste_token', (select id from public.pathways where slug='shopify'), 4, 2,
 'Connect Your Store to Sync',
$body$With your token copied, the last setup step happens on Sync's side, not Shopify's.

1. Open **Connect your Shopify store** in the portal.
2. Paste your store's domain (the .myshopify.com address) and the **Admin API access token** you just copied.
3. Click **Connect store**. Sync verifies the token immediately against your store.

A verified connection shows your store's status as **Connected**. If it instead shows **Needs reconnecting**, Shopify rejected the token on a check — go back to your custom app, confirm the three scopes are enabled, generate a fresh token, and reconnect.

Once connected, your daily health check runs automatically overnight — you don't need to do anything to keep it current.

Mark complete once your store's status shows **Connected**.$body$,
 'handshake', null, '{sh4_create_app}'),

('sh4_link_products', (select id from public.pathways where slug='shopify'), 4, 3,
 'Link Your Products to the Sync Catalogue',
$body$Shopify doesn't know which of your listings map to which Sync product — this screen is where you tell it, once per product.

1. Open **Link your products** in the portal.
2. For each Shopify product variant, choose the matching **Sync product** from the dropdown and click **Link**.
3. Repeat for every variant you've listed. Linked variants show a **Linked →** confirmation.

**Why this matters:** an order for an unlinked variant can't be sourced automatically — it exceptions instead, and you're notified so you can link it and let it proceed. Linking everything before you drive traffic avoids that entirely.

Mark complete once every product variant in your store shows as linked.$body$,
 'listing-card', null, '{sh4_paste_token}'),

('sh5_organic_system', (select id from public.pathways where slug='shopify'), 5, 1,
 'Build a Repeatable Content System',
$body$One good video gets you one good day. A system gets you a growing store. Build the system before you chase a single viral hit.

1. Pick two formats you can repeat weekly — product-in-use and unboxing/first-impression both work for most niches.
2. Set a cadence you can actually sustain:

```copy
3x per week minimum
1 product-in-use post
1 unboxing or first-impression post
1 behind-the-scenes or restock post
```

3. Build hooks from your niche, not generic templates — the first line should name the exact problem your product solves.

Consistency beats intensity here — a smaller store posting three times a week for months outperforms one that posts daily for a fortnight and stops.

Mark complete once you've posted on this cadence for one full week.$body$,
 'growth-arrow', null, '{sh4_link_products}'),

('sh5_content_that_converts', (select id from public.pathways where slug='shopify'), 5, 2,
 'What Actually Converts Browsers',
$body$Views don't pay the bills — the content that turns a scroll into a sale has a specific shape.

1. **Show the product in use**, not just sitting still — motion and context sell harder than a clean studio shot.
2. **Use real social proof** — an actual customer photo or comment, screenshotted with permission. Never a fabricated one.
3. **Frame the offer plainly** in your caption or on-screen text: what it is, why it's useful, where to buy it (your store link, always in bio).

The pattern that works: show the product doing its job, then get out of the way — over-explaining loses attention faster than it builds trust.

Mark complete once you've published content using at least one real product-in-use clip and one real proof point.$body$,
 'growth-arrow', null, '{sh5_organic_system}'),

('sh5_starter_ads', (select id from public.pathways where slug='shopify'), 5, 3,
 'Run a Starter Ad Test',
$body$Paid traffic is a test you run, not a bet you place. Start small, structure it to tell you something, then act on what it tells you.

1. Pick one platform — Meta or TikTok — and run one campaign, not several at once.
2. Set a tight daily budget you're comfortable testing with, and hold it steady for at least 3–4 days before judging results.
3. Use these rules as your copy-ready structure:

```copy
Kill rule: 0 sales after 3x your daily budget spent
Scale rule: sales that clear your product margin after 3+ days -> increase budget 20%
```

This is a framework, not a promise — outcomes depend on your product, your content, and your market, and no daily budget guarantees a result.

Never use engagement pods, follow/unfollow automation, or DM spam to inflate results — all three violate platform terms and put your ad account at risk.

Mark complete once you've run one full test cycle against these rules.$body$,
 'sliders', null, '{sh5_content_that_converts}'),

('sh6_wallet', (select id from public.pathways where slug='shopify'), 6, 1,
 'Understand Your Wallet',
$body$Every Shopify order your store makes is paid to Sync automatically — your **Wallet** is what makes that possible without you touching a card each time.

1. Open **Wallet** in the portal to see your current balance.
2. **Top up** in advance using one of the preset amounts or a custom amount — funds land in your balance once the payment confirms.
3. Every order debits your balance automatically the moment it's placed — the product cost plus shipping, the same figures you saw before listing (Module 2).
4. If your balance can't cover an order, it's held as **awaiting funds** — nothing is lost, and it dispatches automatically the moment you top up, with no extra step from you.

Set a **low-balance threshold** so the portal flags you before you run dry, rather than after an order stalls.

Mark complete once you've topped up your Wallet at least once and understand what happens when a balance is too low.$body$,
 'price-tag', null, '{sh5_starter_ads}'),

('sh6_customer_service', (select id from public.pathways where slug='shopify'), 6, 2,
 'Respond Like a Real Store',
$body$Every reply is a chance to keep a sale or lose a customer for good. Fast, honest, and specific beats scripted every time.

Aim to respond within 24 hours, every time. Use these as starting points, not word-for-word scripts — adjust to the actual order:

```copy
Shipping status: "Thanks for reaching out! Your order is on its way - here's your tracking: [link]. Expected delivery is within the window shown on our shipping page."

Where is my order: "Let me check that for you now. Orders typically move through processing before tracking updates - I'll confirm your status and follow up within the day."

Quality complaint: "I'm sorry to hear that - that's not the experience we want you to have. Send a photo when you can and I'll sort a resolution right away."
```

Mark complete once you've saved these templates somewhere you can access quickly when a message comes in.$body$,
 'handshake', null, '{sh6_wallet}'),

('sh6_refunds', (select id from public.pathways where slug='shopify'), 6, 3,
 'Handle Refunds the Right Way',
$body$Your refund policy (Module 1) is a promise — the refund flow is where you keep it.

1. Check the complaint against your published **Refund Policy** first — it sets what you owe the customer, not what feels fair in the moment.
2. For a genuine product fault or a lost/undelivered order, refund or replace per your policy — this keeps your store's reputation intact.
3. If the issue traces back to sourcing or fulfilment, use **Support** to raise it with Sync's exception process rather than absorbing it silently — Sync's exception handling is what that channel exists for.

Never promise a refund outcome on Sync's behalf — confirm through Support first, then respond to your customer.

Mark complete once you've read your own refund policy end to end and know where to raise a fulfilment-side issue.$body$,
 'check-seal', null, '{sh6_customer_service}'),

('sh7_read_your_numbers', (select id from public.pathways where slug='shopify'), 7, 1,
 'Read Your Margins',
$body$A store that's busy isn't the same as a store that's profitable. This is the arithmetic that tells the difference.

```copy
Per-product margin = sell price - Sync product cost - ad spend allocated to that sale
```

1. Pull your sell price and Sync cost from the same **Products** tab you priced from (Module 3).
2. If you're running ads, divide your ad spend across the sales it produced for a realistic per-unit figure.
3. A product with a shrinking or negative margin after this math is a product to fix or cut — not one to push harder on.

Run this check weekly while you're finding your footing, not just at the end of the month when it's too late to adjust.

Mark complete once you've calculated the margin on your three best-selling products.$body$,
 'sliders', null, '{sh6_refunds}'),

('sh7_expand_catalogue', (select id from public.pathways where slug='shopify'), 7, 2,
 'Expand Your Catalogue',
$body$Once a product is working, the next move is more of what works — not a scattershot of everything else.

1. Use **Support** to request an expanded catalogue assignment once your current products are consistently selling.
2. Add categories adjacent to what's already working — an audience that trusts you for one thing extends that trust more easily to a related one than an unrelated one.
3. Higher tiers unlock more product slots and support — think of an upgrade as more service, not as unlocking secret content; everything in this course works the same at every tier.

Mark complete once you've requested your next catalogue expansion or decided you're not ready to yet.$body$,
 'growth-arrow', null, '{sh7_read_your_numbers}');
