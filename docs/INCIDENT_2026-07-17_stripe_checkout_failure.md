# Incident report — Stripe checkout failures, 2026-07-17

Compiled for handoff into a fresh Claude Code session. Project: Sync Agency
(`C:\Projects\sync-agency`), production Supabase project `whuqfxdzopyucebtnbkx`.

## TL;DR

A client reported "checkout could not be started." It looked suspicious because it
started right after Project Chronos (a large backend build, admin-gated, not yet
frontend-deployed) was merged into production the same day. Investigation ruled
out Chronos entirely. There were actually **two independent, unrelated bugs**
stacked on top of each other:

1. **Stripe secret key / webhook secret were stale** in Supabase's Edge Function
   Secrets store — fixed by re-entering both from the Stripe Dashboard.
2. **A stale/archived Stripe Price ID on one product row** — caused by a teammate
   ("Brock") manually creating new Stripe Prices and archiving old ones directly
   in the Stripe Dashboard when he wanted to change what a product costs, instead
   of going through the app's own price-update flow. Stripe Prices are immutable
   (can't be edited in place — only archived + replaced), and the app has a
   built-in function that does that replacement *and* repoints the database at
   the new Price ID. Doing it manually in Stripe skips that repoint step, so the
   `products` table kept pointing at a Price ID that no longer existed/was
   inactive — every checkout attempt for that item died with a Stripe 400
   ("The price specified is inactive").

Both are now fixed. **Bug #2 is the real one to design a systemic fix for** —
nothing in the system currently prevents or detects this class of drift.

## Timeline (UTC, 2026-07-17)

| Time | Event |
|---|---|
| 07:08:25 | Last known-good `create-checkout-session` call (200) |
| ~11:55 | Client reports checkout won't start. First 500s appear in `create-checkout-session` logs. Client retries ~15+ times over the next ~25 min, all 500. |
| — | Investigation begins. Chronos ruled out as cause (see below). |
| — | User independently traces it to "an error with the stripe keys" |
| ~12:1x | User updates `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Supabase → Edge Functions → Secrets |
| 12:12:59–12:13:30 | `create-checkout-session` redeploys (version 8→9) but **still** 500s — key fix hadn't fully resolved it yet at that exact moment |
| 12:17:48 | Detailed logs pulled from Supabase dashboard directly show: (a) harmless Node 20 deprecation warning, (b) real cause — `StripeInvalidRequestError: The price specified is inactive. This field only accepts active prices.` on `line_items[0][price]`, livemode, well-formed request. This confirms the **key fix did work** — this is a legitimate second, different bug. |
| — | Cross-referenced against `orders`/`order_items`/`products`: order `9e17228b-0bea-4a58-9780-ddb7a6a2edc7`, product `a9d60991-83d6-4ece-8e70-27a76e41897a` ("Abercrombie & Fitch gray zip up hoodie with fur hood"), `stripe_price_id = price_1Tr9cOPDABwVk3W5dAFDrllx` — archived in Stripe, still referenced in the DB. |
| — | User confirms root cause: Brock manually replaced this product's Stripe Price in the Stripe Dashboard (create new + archive old) without repointing the `products` row, because Stripe Prices can't be edited in place and (per the user) prices "can't be edited through the portal either." |
| — | Fixed by re-saving the product's price through the admin Products/Catalogue page, which invokes the app's `update-stripe-price` edge function — creates a fresh active Price and repoints `products.stripe_price_id` in one step. |

## Bug #1 — Stripe secret key / webhook secret (fixed)

**Symptom:** every `create-checkout-session` call returned 500 starting ~11:55 UTC.
Last successful call was 07:08 UTC the same day — a ~4h47m gap where something
about the Stripe credentials broke.

**What was checked to rule out Chronos:** pulled live source for every
Stripe-touching edge function on production —
`create-checkout-session`, `stripe-webhook`, `create-stripe-product`,
`update-stripe-price`, `archive-stripe-product`, `merge-stripe-duplicates`,
and the newly-added `wallet-topup`. All of them consistently read
`Deno.env.get("STRIPE_SECRET_KEY")` (webhook additionally reads
`STRIPE_WEBHOOK_SECRET`) — no naming mismatches, no divergence introduced by the
Chronos merge. `create-checkout-session` itself had not been redeployed at any
point during the Chronos work session (its `updated_at` predates it). So the
failure was structurally independent of anything Chronos touched.

**Root cause:** the values stored in Supabase's Edge Function Secrets for
`STRIPE_SECRET_KEY` and/or `STRIPE_WEBHOOK_SECRET` (project `whuqfxdzopyucebtnbkx`)
were stale/incorrect. Note: these secrets are **not** related to the repo's
`.env` file — `.env` only feeds `VITE_...` build-time variables into the
frontend bundle (publishable key, price IDs shown in `src/data/pricing.js`,
`src/components/StripeBuyButton.jsx`). The server-side secret key and webhook
signing secret live entirely inside Supabase's own secrets store, set via
the dashboard or `supabase secrets set` — disconnected from git and from
`.env`.

**Fix:** user re-entered both `STRIPE_SECRET_KEY` (from Stripe Dashboard →
Developers → API keys) and `STRIPE_WEBHOOK_SECRET` (from Stripe Dashboard →
Developers → Webhooks → the endpoint pointed at
`https://whuqfxdzopyucebtnbkx.supabase.co/functions/v1/stripe-webhook` →
Reveal signing secret) directly in Supabase → Edge Functions → Secrets.
Confirmed fixed by the subsequent Stripe error being a legitimate livemode
400 (auth was clearly succeeding).

## Bug #2 — stale/archived Stripe Price ID on a product (fixed for one product, confirm others)

**Symptom (after Bug #1 was fixed):** `create-checkout-session` still 500'd for
one specific client, one specific product. Detailed edge function logs (pulled
via the Supabase dashboard's own Logs tab, not the summarized API log endpoint)
showed:

```
Error: The price specified is inactive. This field only accepts active prices.
type: "StripeInvalidRequestError"
param: "line_items[0][price]"
statusCode: 400
```

**Root cause (confirmed by user):** Brock wanted to change what customers pay
for an item. Stripe Prices are immutable — you cannot edit an existing Price's
amount, only create a new Price and archive/deactivate the old one. The app
already has a function that does exactly this correctly:
`supabase/functions/update-stripe-price/index.ts` — it creates a new Stripe
Price, archives the old one, **and repoints `products.stripe_price_id` at the
new Price ID** in the same operation. Brock instead made the change directly
in the Stripe Dashboard (create new Price, archive old Price) — which changes
Stripe's state but has no way to know about or update the Supabase `products`
table. Result: `products.stripe_price_id` kept pointing at a Price ID Stripe
now considers inactive. Every checkout attempt for that product fails at
Stripe's validation step, 100% reproducible, for every client, until someone
notices.

**Evidence:**
- Product: `a9d60991-83d6-4ece-8e70-27a76e41897a` — "Abercrombie & Fitch gray
  zip up hoodie with fur hood"
- Stale price: `price_1Tr9cOPDABwVk3W5dAFDrllx` (archived in Stripe)
- Affected client retried the same failing checkout 15+ times between 11:55
  and 12:17 UTC (`member_id 40dac01a-f152-4862-84a5-f294c9c8ed76`), generating
  15 duplicate `pending_payment` order rows for the same item — harmless but
  worth cleaning up (order IDs available via query in the "Useful queries"
  section below if wanted).
- **Not yet confirmed, worth checking:** a second client
  (`member_id e4215abf-15f4-4d1c-ab74-b79d7c45b7c5`) was also repeatedly
  retrying checkout for a different product ("Black Slim Fit Rock Angel Cross
  Y2k Graphic Tee", `stripe_price_id price_1TqlZePDABwVk3W5Y4cZCunQ`) around
  the same time window. This may be the same class of bug on a second product
  — was not directly confirmed with a matching error log the way the hoodie
  was. Worth checking whether that Price is also archived in Stripe, and
  whether Brock (or anyone) touched other products' prices directly in Stripe
  around the same time.

**Fix applied:** re-saved the hoodie's price through the admin
Products/Catalogue page in the portal, which calls `update-stripe-price` —
creates a fresh active Price, repoints the DB. Since `create-checkout-session`
reads `products.stripe_price_id` fresh at session-creation time, this
unblocked all of that client's pending retries immediately with no need to
touch the existing order rows.

## Why this is worth a "serious backend change"

The system currently has **two divergent paths** to change what a product
costs in Stripe:

1. **Through the app** (`update-stripe-price` edge function, wired to the
   admin Products/Catalogue page) — atomic: new Price created, old one
   archived, `products.stripe_price_id` repointed. Safe.
2. **Directly in the Stripe Dashboard** — nothing stops an admin from doing
   this (it's a completely separate system with its own login), and nothing
   in Sync Agency's stack knows it happened. The `products` table silently
   goes stale. There is no reconciliation job, no webhook listener for
   `price.updated`/`price.deleted` from Stripe, no admin-facing warning when a
   product's `stripe_price_id` no longer matches an active Stripe Price. The
   failure mode is silent until a real client hits it at checkout — exactly
   what happened here.

Also worth noting: the user's own words were that prices "can't be edited
through the portal either" — worth checking with Brock whether the existing
admin price-edit UI is actually discoverable/usable, since if it's not
obviously the right tool for the job, people will keep reaching for the Stripe
Dashboard directly out of habit, and this will recur.

Things a fresh session might want to scope out (not prescriptive, just
starting points — no design decisions made yet):
- A nightly (or on-demand) reconciliation check: for every `products` row with
  a non-null `stripe_price_id`, verify the Price is still active in Stripe;
  flag/alert on mismatches before a client hits them. `nightly-price-sync`
  already exists for the (separate, Chronos-only) CJ Dropshipping catalogue —
  worth checking if that pattern is reusable or if it should stay scoped to
  CJ only.
- Making the admin "change price" flow in the portal more obviously the right
  place to do this, so there's less temptation to go straight to Stripe.
- Possibly restricting who has direct Stripe Dashboard access, or at minimum
  documenting "never archive/edit Prices directly in Stripe — always use the
  portal" somewhere Brock and any other admin will actually see it.

## Relevant code (for a fresh session)

- `supabase/functions/create-checkout-session/index.ts` — where checkout 500s
  surfaced; reads `STRIPE_SECRET_KEY`; falls back to product's `price_data` if
  `products.stripe_price_id` is null (but not if it's set-but-inactive, which
  is this bug).
- `supabase/functions/update-stripe-price/index.ts` — the correct/safe way to
  change a product's price; the one Brock bypassed.
- `supabase/functions/create-stripe-product/index.ts` — only creates a Price
  if `products.stripe_price_id` is currently null; won't self-heal an
  inactive-but-set price.
- `supabase/functions/archive-stripe-product/index.ts`,
  `supabase/functions/merge-stripe-duplicates/index.ts` — other places that
  touch Stripe Products/Prices; same "must stay in sync with `products` table"
  concern applies to these too.
- `supabase/functions/_shared/notes.md` — existing doc of which secrets each
  function needs.
- `src/admin/ProductsAdminPage.jsx` — admin Products/Catalogue UI, calls
  `update-stripe-price` / `create-stripe-product` / `archive-stripe-product`.
- Project rule (from repo `CLAUDE.md`): money-table writes only via
  service-role edge functions — i.e. don't fix `products.stripe_price_id`
  drift with raw SQL from a debugging session; go through
  `update-stripe-price` or a purpose-built reconciliation function, same as
  was done here.

## What this incident was *not*

For the record, since Chronos was the original suspect: nothing about the
Chronos merge (schema migrations, new edge functions — `cj-auth`,
`freight-quote`, `cj-search`, `dispatch-order`, `cj-webhook`,
`nightly-price-sync`, `shopify-connect`, `shopify-health`, `wallet-topup`,
`wallet-adjust`, `shopify-webhook`, `shopify-fulfil`, or the one shared file it
touched, `stripe-webhook`) wrote to `products.stripe_price_id`, changed any
Stripe secret, or redeployed `create-checkout-session`. Both bugs here were
pre-existing and unrelated to that work. Full detail on the Chronos merge
itself is in `docs/FOUNDER_DECISIONS_REQUIRED.md`.

## Useful queries (production, project `whuqfxdzopyucebtnbkx`)

Find pending orders and the Stripe price each depends on:

```sql
select o.id as order_id, o.member_id, o.status, o.created_at,
       oi.quantity, oi.unit_price,
       p.id as product_id, p.name, p.price, p.stripe_price_id
from orders o
join order_items oi on oi.order_id = o.id
join products p on p.id = oi.product_id
where o.status = 'pending_payment'
order by o.created_at desc;
```

Clean up the ~15 duplicate `pending_payment` rows left behind by the affected
client's retries (review before running — not executed as part of this
incident):

```sql
-- example shape only, verify order_ids first
-- delete from order_items where order_id in (...);
-- delete from orders where id in (...);
```
