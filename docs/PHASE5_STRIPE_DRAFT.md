# Phase 5 — Stripe Draft Spec (not executed)

**Status: nothing in this document has been created in Stripe.** This is a
dry-run spec, per the Chronos non-negotiable that no live-mode Stripe object
may ever be created with placeholder numbers attached.

## Why nothing was created

Before touching the Stripe API, I checked whether the `STRIPE_SECRET_KEY`
currently set in this project's Supabase edge function secrets is a test-mode
(`sk_test_...`) or live-mode (`sk_live_...`) key. Result: **could not confirm
either way.**

- The repo confirms the key exists (`create-checkout-session/index.ts` reads
  `Deno.env.get("STRIPE_SECRET_KEY")`) but never contains its value.
- The Supabase MCP tools available in this environment (`list_projects`,
  `get_project`, `list_edge_functions`, `get_edge_function`, `list_migrations`,
  `execute_sql`, etc.) have no secrets-listing or secrets-value endpoint —
  Supabase does not expose edge function secret values through its Management
  API by design, only their names, and not even names are surfaced by the
  tools available here.
- `docs/FOUNDER_DECISIONS_REQUIRED.md` already logs the same finding from
  earlier Chronos work ("I can't read the value, only reference it in new
  functions").
- Reading `.env` for this key is not something the founder has authorized
  (unlike the one-off `CJ_DROPSHIPPING_API` exception logged elsewhere in that
  file) and `.env` is on the repo's do-not-touch list regardless.

Per the hard constraint, "if you can't confirm it's a test-mode key, do NOT
call the Stripe API at all" — so no Stripe product, price, or checkout session
was created for this work. Everything below is the spec to execute once (a)
pricing is ratified by the founder and (b) test-mode is confirmed (or a
test-mode key is provisioned specifically for this).

## Recommended approach: no new Stripe objects at all

The existing `create-checkout-session` function already has a precedent for
exactly this shape of problem — the `"upgrade"` kind's lifetime branch doesn't
reference a pre-created Stripe Price for the prorated amount; it builds the
line item inline with `price_data` and a computed `unit_amount`:

```ts
line_items: [{
  price_data: {
    currency: "aud",
    product_data: { name: `Upgrade to ${TIER_NAMES[target]} (lifetime)` },
    unit_amount: diff * 100,
  },
  quantity: 1,
}]
```

The second-pathway bundle discount is the same kind of problem: a formula
applied to an existing tier price, not a new fixed price point. Stripe
Checkout Sessions support `price_data` (including `recurring`) for
**subscription mode too**, so the bundle-discounted monthly price can be
computed the same way the lifetime upgrade diff already is — via
`pathwayTierPrice(tier, "monthly", { isSecondPathway: true })` from
`src/lib/pathwayPricing.js`, fed into `price_data` at session-creation time.

**This means Phase 5 pricing likely needs zero new Stripe product/price
objects** for the bundle case: first-pathway purchases keep using the
existing `MONTHLY_PRICE_IDS` / `products.stripe_price_id` Price IDs unchanged
(the build plan is explicit that first-pathway prices don't change), and
second-pathway bundle purchases compute their line item inline exactly like
the upgrade flow does today. This avoids any Stripe object proliferation and
matches the existing code pattern instead of diverging from it.

## Fallback option: pre-created fixed Price objects

If the founder prefers stable, dashboard-visible Price objects for the bundle
tier (e.g. for reporting, or because Stripe's customer/subscription UI reads
more cleanly off named Prices than inline `price_data`), here is exactly what
would be created — **and only after test-mode is confirmed**:

- **No new Stripe Products.** Per the build plan's explicit rule ("never
  create duplicate Stripe products; archive, never delete" — Part 4.3) and
  the Phase 5 acceptance criterion ("check existing `stripe_price_id` before
  creating"), the new Prices attach to the **existing** three Stripe Products
  (Pro Accelerator, Elite Scale, VIP Inner Circle) already referenced by
  `MONTHLY_PRICE_IDS` in `create-checkout-session/index.ts`.
- **Six new draft Prices**, all clearly named, all AUD (per the founder-
  confirmed settlement currency), all created in **test mode only**:

| Draft price name | Type | Amount (AUD) | Derivation |
|---|---|---|---|
| `[CHRONOS-DRAFT] Pro Accelerator — 2nd Pathway Bundle (Lifetime)` | one-time | $113.40 | 189 × 0.6 |
| `[CHRONOS-DRAFT] Pro Accelerator — 2nd Pathway Bundle (Monthly)` | recurring/month | $47.40 | 79 × 0.6 |
| `[CHRONOS-DRAFT] Elite Scale — 2nd Pathway Bundle (Lifetime)` | one-time | $238.20 | 397 × 0.6 |
| `[CHRONOS-DRAFT] Elite Scale — 2nd Pathway Bundle (Monthly)` | recurring/month | $76.20 | 127 × 0.6 |
| `[CHRONOS-DRAFT] VIP Inner Circle — 2nd Pathway Bundle (Lifetime)` | one-time | $443.40 | 739 × 0.6 |
| `[CHRONOS-DRAFT] VIP Inner Circle — 2nd Pathway Bundle (Monthly)` | recurring/month | $209.40 | 349 × 0.6 |

All six amounts are `pathwayTierPrice(tier, billing, { isSecondPathway: true })`
from `src/lib/pathwayPricing.js` — i.e. this table and the code are the same
source of truth, generated from the same 40%-off placeholder in
`docs/FOUNDER_DECISIONS_REQUIRED.md` item 3.

## What's still a placeholder

Every number above (tier prices, the 40% bundle discount) is the build plan's
proposed default, not founder-ratified. If the founder changes the discount %
or any tier price before Phase 5 ships, update `BUNDLE_DISCOUNT_PCT` and
`TIERS` (in `src/lib/tiers.js`) and this table regenerates from the same
formula — nothing here is hand-typed pricing that could drift from the code.

## Next step, once ratified and test-mode is confirmed

1. Confirm (or provision) a **test-mode** `STRIPE_SECRET_KEY` for this work.
2. Decide: dynamic `price_data` (recommended, no new Stripe objects) vs.
   fixed Prices (table above).
3. If fixed Prices: create the six `[CHRONOS-DRAFT]`-prefixed Prices in test
   mode, attach the returned Price IDs to a new `BUNDLE_PRICE_IDS` map next to
   `MONTHLY_PRICE_IDS` in `create-checkout-session/index.ts`.
4. Either way, never touch live Stripe objects until the founder explicitly
   signs off per the "Activating live (non-placeholder) Stripe prices" item
   in `docs/FOUNDER_DECISIONS_REQUIRED.md`.
