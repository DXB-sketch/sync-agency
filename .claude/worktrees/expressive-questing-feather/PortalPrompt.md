# Sync Agency — Member Portal & Backend
## Claude Code Implementation Prompt (Production Build)

> **How to use this document:** This is the full specification for building the Sync Agency member portal as a real, production-ready system that integrates into the existing website. Work through it **phase by phase, in order**. Do not skip ahead.
>
> **CRITICAL DIRECTIVE — READ FIRST:** If at any point you are unsure about anything, hit missing information, encounter an ambiguous decision, or find that a real credential/ID/mapping you need has not been provided, **STOP immediately, ask the owner the specific question, wait for the answer, then continue.** Do not guess, do not invent placeholder business logic, and do not "assume and proceed" on anything that affects payments, access control, or data. Building the wrong thing silently is worse than pausing.

---

## 1. What we're building

The public marketing site (existing React + Vite app) stays as-is. We are adding a **gated member portal** that a customer enters *after* they buy a course. The portal is a premium, dark, gold-themed web app that delivers the course, tracks progress through a visual skill-tree pathway, lets members buy product stock through us, and lets an admin manage everything.

**Included in this build:**
- Supabase backend (Postgres, Auth, Storage, Edge Functions, Row-Level Security)
- Custom-SMTP email confirmation on signup
- Member portal: dashboard, pathway/skill-tree, product catalogue, multi-item checkout with per-item shipping, order tracking, achievements (with proof upload), upgrade screen
- Admin/owner panel: manage each client's products & prices, view/fulfil orders, verify achievements, view any client's portal
- Stripe integration for buying product stock (one lump-sum payment, multiple items, per-item shipping)
- Deployment that works on SiteGround hosting

**Explicitly NOT in this build (do not add these):**
- ❌ Community win feed
- ❌ Auto-synced live Depop stats (there is no Depop public API — do not attempt scraping or any automated Depop data pull)
- ❌ Niche selection / niche quiz (the business uses a **single niche**: Y2K / streetwear)

---

## 2. Critical constraints (architecture depends on these)

1. **Hosting is SiteGround.** SiteGround is shared hosting (Apache, cPanel/Site Tools). It is **not** a good place to run a persistent Node.js server. Therefore:
   - The frontend is a **static build** (`vite build` → `dist/`) served by SiteGround.
   - **All backend logic runs on Supabase**, not SiteGround. Database, auth, file storage, and every server-side function (Stripe checkout creation, Stripe webhooks, admin operations that need elevated privileges) run as **Supabase Edge Functions**. SiteGround only ever serves static files.
   - SPA client-side routing must work on Apache via an `.htaccess` rewrite (provided in §14).

2. **No Depop API exists.** Stats and achievements cannot be automated. Achievements are handled by member-uploaded screenshot proof + admin verification (§12).

3. **Secrets never touch the frontend or the repo.** Stripe secret key, Supabase service-role key, and the SMTP password live only in Supabase (Edge Function secrets / Auth SMTP settings). The frontend gets only public keys (Supabase anon key, Stripe publishable key) via Vite env vars.

---

## 3. Tech stack

- **Frontend:** React 19 + Vite (extend the existing app), `react-router-dom` v7 for routing.
- **State/data:** `@supabase/supabase-js` v2 client.
- **Backend:** Supabase — Postgres + Auth + Storage + Edge Functions (Deno/TypeScript).
- **Payments:** Stripe (Checkout Sessions + webhooks, via Edge Functions).
- **Styling:** Reuse the existing design tokens from `src/styles/global.css` (gold `#C9A84C`, black `#080808`, Cormorant Garamond + Syne fonts). The portal must feel like a continuation of the brand, but more "software/terminal" than the marketing site.

---

## 4. Environment variables & secrets

Create `.env` (frontend, committed as `.env.example` **without** real values):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_STRIPE_PUBLISHABLE_KEY=...
VITE_SITE_URL=https://<the production domain on SiteGround>
```

Supabase Edge Function secrets (set via `supabase secrets set`, never in repo):

```
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
SUPABASE_SERVICE_ROLE_KEY=...   # provided automatically to functions
```

**➡️ STOP-AND-ASK #1:** Request from the owner: the live **Stripe publishable key**, **Stripe secret key**, the Supabase project URL + anon key + service-role key, and the production domain. Do not proceed to any Stripe or Supabase wiring without these.

---

## 5. Supabase — Auth & custom SMTP

Configure Supabase Auth to send the email-confirmation message through the Sync Agency mail server. **This is a dashboard/config step, not code** (Supabase Auth → SMTP settings):

```
Sender name:      Sync Agency
Sender email:     confirmation@syncagency.org
SMTP host:        mail.syncagency.org
SMTP port:        465        # if Supabase rejects 465/SSL, fall back to 587 (STARTTLS) — ASK owner before changing
SMTP username:    confirmation@syncagency.org
SMTP password:    (owner will paste into the Supabase dashboard — never put this in code or the repo)
```

- Enable **"Confirm email"** so accounts are only finalised after the user clicks the confirmation link.
- Customise the confirmation email template: Sync Agency branding, gold accent, clear CTA, from "Sync Agency".
- Set the redirect/confirmation URL to `${VITE_SITE_URL}/auth/confirmed`.

**➡️ STOP-AND-ASK #2:** Have the owner paste the SMTP password directly into the Supabase dashboard themselves, or confirm they want you to guide them through it. Do not hard-code it anywhere. Also confirm whether port 465 works in their Supabase project or if 587 is needed.

---

## 6. Supabase — Database schema

Use SQL migrations. Define enums, tables, indexes, and **Row-Level Security on every table**.

### Enums
```sql
create type tier as enum ('pro', 'elite', 'vip');
create type user_role as enum ('member', 'admin');
create type billing_type as enum ('lifetime', 'monthly');
create type node_status as enum ('locked', 'available', 'in_progress', 'complete');
create type order_status as enum ('pending_payment','paid','sourcing','shipped','delivered','cancelled');
create type achievement_status as enum ('not_started','proof_submitted','verified','rejected');
```

### Tables

**`profiles`** (1:1 with `auth.users`)
```
id                uuid  PK  references auth.users(id)
email             text
full_name         text
role              user_role  default 'member'
tier              tier         -- null until a purchase is linked
billing_type      billing_type
subscription_active boolean default true
stripe_customer_id text
tier_price_paid   integer      -- what they paid, drives upgrade proration
created_at        timestamptz default now()
last_login        timestamptz
```

**`purchases`** (records course purchases from Stripe; links to a member by email)
```
id                uuid PK default gen_random_uuid()
email             text          -- from Stripe checkout
tier              tier
billing_type      billing_type
amount            integer
stripe_session_id text
linked_member_id  uuid references profiles(id)  -- null until account created & matched
created_at        timestamptz default now()
```

**`products`** (per-client store items — admin creates, client views)
```
id                uuid PK default gen_random_uuid()
member_id         uuid references profiles(id)   -- the client this product belongs to
name              text
description       text
image_url         text                            -- Supabase Storage
price             numeric(10,2)                    -- price the MEMBER pays us (admin-set only)
stripe_price_id   text                             -- created in our Stripe when product is added
active            boolean default true
created_by        uuid references profiles(id)     -- admin
created_at        timestamptz default now()
```

**`orders`** (a member's lump-sum purchase of stock)
```
id                uuid PK default gen_random_uuid()
member_id         uuid references profiles(id)
status            order_status default 'pending_payment'
stripe_session_id text
total_amount      numeric(10,2)
created_at        timestamptz default now()
```

**`order_items`** (one row per item, each with its own shipping address)
```
id                uuid PK default gen_random_uuid()
order_id          uuid references orders(id) on delete cascade
product_id        uuid references products(id)
quantity          integer default 1
unit_price        numeric(10,2)                    -- snapshot at purchase time
ship_name         text
ship_address1     text
ship_address2     text
ship_city         text
ship_region       text
ship_postcode     text
ship_country      text
tracking_number   text
```

**`pathway_nodes`** (the shared skill-tree definition — content, not per-member)
```
id                text PK          -- e.g. 'p1_create_account'
phase             integer
order_in_phase    integer
title             text
body             text              -- markdown; steps & copyable blocks (see §11)
icon              text              -- icon component name (see §10)
min_tier          tier             -- default null = available to ALL tiers
depends_on        text[]           -- node ids that must be complete first
```

**`member_pathway_progress`** (per-member, self-marked)
```
member_id         uuid references profiles(id)
node_id           text references pathway_nodes(id)
status            node_status default 'available'
completed_at      timestamptz
primary key (member_id, node_id)
```

**`achievements`** (definitions)
```
id                text PK          -- 'first_sale', '500_month', ...
title             text
description       text
icon              text
sort_order        integer
```

**`member_achievements`** (per-member, admin-verified)
```
id                uuid PK default gen_random_uuid()
member_id         uuid references profiles(id)
achievement_id    text references achievements(id)
status            achievement_status default 'not_started'
proof_image_url   text            -- member-uploaded screenshot (Supabase Storage)
verified_by       uuid references profiles(id)
verified_at       timestamptz
submitted_at      timestamptz
unique (member_id, achievement_id)
```

### Row-Level Security (apply to all tables)
- **Members** can `select`/`update` only rows where `member_id = auth.uid()` (or `id = auth.uid()` for profiles).
- **Members can NOT insert/update `products` or set `products.price`** — read-only for members.
- **Members can NOT update `member_achievements.status`** to `verified` — they can only submit proof (set status → `proof_submitted` and `proof_image_url`).
- **Admins** (`profiles.role = 'admin'`) can do everything on all tables. Implement an `is_admin()` SQL helper (`security definer`) that checks the caller's role, and use it in policies.
- Seed the owner's account as admin manually after first signup:
  ```sql
  update profiles set role = 'admin' where email = '<owner email>';
  ```

**➡️ STOP-AND-ASK #3:** Confirm the owner's email address to designate as the admin account.

---

## 7. Supabase — Storage buckets

- `product-images` — admin uploads product photos. Public read (images shown in catalogue), write restricted to admins.
- `achievement-proofs` — members upload screenshots. Read restricted to the owning member + admins (private bucket, signed URLs). These double as promo content the admin can browse.

Apply Storage RLS policies matching the above.

---

## 8. Stripe — product buying flow (the tricky part)

**Goal:** A member sees the products we've added to their store. When they make Depop sales, they order that stock through us. They must be able to **enter a separate shipping address per item** (each item ships to a different Depop buyer) but **pay for everything in one lump-sum Stripe payment**.

**Why standard Stripe shipping collection won't work:** Stripe Checkout collects ONE shipping address per session. We need one address *per item*. So we collect shipping in **our own UI**, store it in `order_items`, and use Stripe only for the single combined payment.

### Flow
1. **Admin adds a product** to a client (§9). An Edge Function `create-stripe-product` creates a Stripe **Product + Price** and stores `stripe_price_id` on the `products` row. Price is admin-set only.
2. **Member builds a cart** in the portal: picks products, sets quantity, and fills in shipping details for each item. This is stored as a draft `order` + `order_items` (status `pending_payment`).
3. **Member clicks one "Pay" button.** Edge Function `create-checkout-session` builds a **single Stripe Checkout Session** with a `line_items` array (one entry per product using its `stripe_price_id` × quantity). This produces one lump-sum payment. Shipping addresses are **not** sent to Stripe — they already live in `order_items`.
4. Member is redirected to Stripe Checkout, pays once.
5. **Webhook** `stripe-webhook` receives `checkout.session.completed`, matches the session to the `order`, sets status → `paid`. Admin now sees a paid order with every item's shipping address to fulfil.
6. Admin fulfils (orders from AliExpress, adds tracking, advances status). Statuses: `paid → sourcing → shipped → delivered`.

### Edge Functions to build
- `create-stripe-product` (admin-only) — creates Stripe Product/Price for a new store product.
- `update-stripe-price` (admin-only) — when admin edits a price, create a new Stripe Price and update the row (Stripe Prices are immutable; archive the old one).
- `create-checkout-session` (member) — builds the multi-line-item Checkout Session for the member's cart.
- `stripe-webhook` — verifies signature with `STRIPE_WEBHOOK_SECRET`, handles `checkout.session.completed` for **both** course purchases (→ `purchases` table + tier linking, §12) and stock orders (→ mark `order` paid). Register this function's URL in the Stripe Dashboard as the webhook endpoint.

**➡️ STOP-AND-ASK #4 (important):** Confirm how a member's course tier maps to Stripe. The webhook must recognise which purchases are *courses* (grant portal access + tier) vs *stock orders*. Ask the owner for the Stripe **Product/Price IDs (or Buy Button IDs)** for each course tier and billing type:
- Pro Accelerator — lifetime ($189) / monthly ($79)
- Elite Scale — lifetime ($397) / monthly ($127)
- VIP Inner Circle — lifetime ($739) / monthly ($349)

**➡️ STOP-AND-ASK #5 (scope):** Monthly plans are recurring. Confirm whether monthly subscriptions need full lifecycle handling — i.e. revoke portal access on cancellation / failed payment via `customer.subscription.deleted` and `invoice.payment_failed` webhooks and the `subscription_active` flag. This affects scope; do not assume.

---

## 9. Admin / owner panel

Routes under `/admin` (visible only to `role = 'admin'`; guard both the route and the data via RLS).

- **Clients list** — every member, their tier, billing type, join date. Click into a client.
- **Client detail / "View as client"** — a read-through view of that client's portal: their pathway progress, their products, their orders, their achievements. This satisfies "access the member's account" without literal impersonation.
- **Manage products for a client** — add a product (name, description, image upload, price). Editing price is **admin-only**. Adding/updating a product triggers the Stripe product/price Edge Functions. Toggle active/inactive.
- **Orders queue** — all paid stock orders across clients, with every item's shipping address, so the owner can fulfil (order from AliExpress, add tracking, advance status).
- **Achievements review** — list of `proof_submitted` achievements with the uploaded screenshot; approve (→ `verified`) or reject. Approved screenshots are browsable as a promo-content library.

---

## 10. Skill-tree icons (coded, not emojis)

Build a `<PathwayIcon name="..." state="..." />` React component that renders **hand-built inline SVG** in the brand's gold palette. **No emojis anywhere in the pathway.**

- Icon set (draw each as clean geometric line-art SVG, ~48px, `stroke` = gold, subtle fill):
  - `storefront` (create account), `profile-badge` (optimise profile), `listing-card` (create listings), `sliders` (listing settings), `price-tag` (pricing), `growth-arrow` (traffic/followers), `handshake` (first sale / order through us), `check-seal` (complete the sale).
- **States** change appearance:
  - `complete` — filled gold, subtle glow, small check.
  - `in_progress` — gold stroke, animated dashed ring around it.
  - `available` — muted/neutral stroke.
  - `locked` — desaturated, dashed outline, small padlock (only used if a node has a `min_tier` the member doesn't hold).
- Render the tree as an SVG graph with connector lines between nodes (like the reference skill-tree screenshots). Nodes are clickable → open the node's content panel.

---

## 11. Pathway content (single niche — Y2K/streetwear)

All nodes are **available to every course/tier** (`min_tier` null) — the Pro Accelerator setup content ships to everyone. The Depop setup instructions below must be **reworded into instructional node content, not copied verbatim**, but the exact operational values (bio text, description template, prices, settings, reference account) must appear as **copyable blocks** inside the relevant nodes. Store this content in `pathway_nodes.body` (markdown) so it's editable later.

**Phase 1 — Launch Your Store**
- `p1_create_account` — *Create Your Depop Account.* Guide them to make an account with username format `Y2k[YourName]`, then enable **Boost Shop** in Settings.
- `p1_optimise_profile` — *Build a Trusted Profile.* Upload a clear profile photo. Add a trust-building bio. Include the exact bio as a copyable block:
  > ⭐️ y2k / streetwear · Trusted Seller · International Shipping 1–2 weeks · Refunds available for selected items

**Phase 2 — List Your Products**
- `p2_create_listings` — *Create Your Listings.* List each item **individually** (never bundle). Copyable description template:
  > DM FOR CHEAPER PRICE
  > [ITEM NAME / DESCRIPTION]
  > #Y2KFashion #y2k #vintage #streetwear #tops
- `p2_listing_settings` — *Configure Every Listing.* Copyable settings block: Brand = **Other**, Size = **Small**, Quantity = **5**, Domestic shipping = **$15**, International shipping = **$15**.
- `p2_pricing` — *Price for Profit.* Shirts: original **$48**, discount to **$38**. Hoodies: original **$98**, discount to **$85**. Tip: duplicate the first listing to speed up the rest.

**Phase 3 — Drive Traffic**
- `p3_grow_audience` — *Grow Your Audience.* Find the reference account `vintagey2ksells`, mass-follow its followers and following, capping at **50 follows per 10 minutes** to stay within safe limits.

**Phase 4 — Sell & Fulfil**
- `p4_order_through_sync` — *Order Stock Through Sync.* When an item sells, order that product through the portal's catalogue, entering the buyer's shipping details, and pay for all pending orders in one payment.
- `p4_complete_sale` — *Complete the Sale.* Mark items dispatched, keep buyers updated, and handle refunds per the stated policy.

Node completion is **self-marked** by the member (progress tracking). Do **not** require admin verification for pathway nodes — that's only for achievements.

**➡️ STOP-AND-ASK #6:** Confirm the reference account handle (`vintagey2ksells`) and username convention are current, and whether Elite/VIP should get any *additional* nodes beyond the shared Phase 1–4 (default: no extra nodes; tiers differ only in the done-for-you services and support level).

---

## 12. Account creation & email verification flow

1. Customer buys a course on the marketing site (Stripe). On success, Stripe redirects to `${VITE_SITE_URL}/signup?session_id=...`.
2. In parallel, the `stripe-webhook` records the purchase in `purchases` (email + tier + billing_type) — this is the source of truth for entitlement.
3. `/signup` page: customer enters **email + password**. They must use the **same email** as the course purchase.
4. Supabase Auth sends the **custom-SMTP confirmation email** (§5). Account is not active until confirmed.
5. Customer clicks the link → lands on `/auth/confirmed`. A DB trigger/function matches their `profiles.email` to a `purchases.email`, sets their `tier`, `billing_type`, `tier_price_paid`, and links `purchases.linked_member_id`.
6. Redirect into the portal `/portal`.

Edge cases to handle: email typo / mismatch (no matching purchase → account created but no tier; show a "we couldn't match your purchase, contact support" state and surface it to admin to fix manually). Do **not** grant a tier without a matching paid purchase.

**➡️ STOP-AND-ASK #7:** Confirm members must sign up with the same email used at checkout, and confirm the desired behaviour when emails don't match (default: no tier + admin alert).

---

## 13. Achievements flow

- Seed achievement definitions (e.g. First Sale, $500 Month, $1,000 Month, 50 Listings, 100 Listings, 30-Day Consistency). Confirm the final list with the owner.
- Member view: grid of achievements; each has an **"Upload proof"** action → uploads a screenshot to `achievement-proofs` → status becomes `proof_submitted`.
- Admin view: review queue → approve (`verified`) or reject, with the screenshot visible. Verified badges show as earned in the member's portal.
- Members can never self-verify.

---

## 14. Frontend routes & deployment (SiteGround)

### Routes
```
/                         marketing site (existing)
/signup?session_id=       post-purchase account creation
/login
/auth/confirmed           email confirmation landing → tier linking
/portal                   dashboard (progress rings, today's focus, tier badge)
/portal/pathway           skill tree
/portal/products          catalogue (member's assigned products)
/portal/checkout          cart + per-item shipping + single pay button
/portal/orders            order tracking
/portal/achievements      achievements + proof upload
/portal/upgrade           prorated upgrade / monthly vs lifetime
/admin/*                  admin panel (role-guarded)
```
Guard `/portal/*` (must be authed + confirmed) and `/admin/*` (must be admin). Use a Supabase session listener + a route guard component.

### Build & deploy to SiteGround
1. `npm run build` → `dist/`.
2. Upload the **contents of `dist/`** to SiteGround `public_html` (or a subfolder) via Site Tools File Manager, FTP, or Git deploy.
3. Add this **`.htaccess`** in the site root so SPA routes resolve (Apache falls back to `index.html`):
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteRule . /index.html [L]
</IfModule>
```
4. Supabase Edge Functions deploy separately via the Supabase CLI (`supabase functions deploy ...`) — they do **not** go on SiteGround.
5. Register the `stripe-webhook` Edge Function URL in the Stripe Dashboard and copy its signing secret into `STRIPE_WEBHOOK_SECRET`.
6. Set the Vite env vars for the production build and confirm the site's real domain in Stripe/Supabase redirect URLs.

**➡️ STOP-AND-ASK #8:** Confirm whether the portal lives on the same domain as the marketing site (e.g. `syncagency.org/portal`) or a subfolder/subdomain, and how the current site is deployed to SiteGround (File Manager, FTP, or Git) so the build output lands correctly.

---

## 15. Recommended build order (phased — pause between phases)

1. **Foundation:** Supabase project, schema + RLS, storage buckets, seed pathway & achievement content. Wire the `supabase-js` client into the app. Basic `/login`.
2. **Auth & entitlement:** custom SMTP, signup flow, email confirmation, purchase→tier linking, route guards.
3. **Portal shell:** dashboard, tier theming, navigation, portal layout.
4. **Pathway:** coded SVG skill-tree icons, node graph, node content panels, self-marked progress.
5. **Products & checkout:** catalogue, cart with per-item shipping, `create-checkout-session`, `stripe-webhook` for stock orders, order tracking.
6. **Admin panel:** client management, product upload + price editing (+ Stripe product/price functions), orders queue, "view as client".
7. **Achievements:** proof upload, admin verification, earned badges.
8. **Upgrade flow:** prorated pricing (lifetime + monthly), upgrade checkout.
9. **Deployment:** SiteGround build/upload, `.htaccess`, function deploy, Stripe webhook registration, end-to-end test.

At the end of each phase, summarise what was built and what remains, and confirm before continuing.

---

## 16. Standing rules for this build

- **Ask, don't assume.** Any missing key, ID, mapping, email, price, or business rule → stop and ask.
- **Never** put secrets in the frontend or repo.
- **Never** attempt to read Depop data automatically.
- Prices are **admin-writable only**; enforce in RLS, not just UI.
- Keep it clean, mobile-first, and fast — the target customer is on their phone.
- Reuse the existing brand tokens; the portal should feel like premium software, not a generic dashboard.
