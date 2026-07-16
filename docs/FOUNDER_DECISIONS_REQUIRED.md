# Founder Decisions Required — Project Chronos

Running log. Every item below has a placeholder/default already adopted so the build keeps moving — nothing here is blocking progress unless explicitly marked **BLOCKING**.

Last updated: 2026-07-16

---

## Infrastructure status (not a business decision, logged for visibility)

- **Supabase dev branch created:** `chronos-dev` (project ref `moatcohllmhgabanxlqr`), forked from production `whuqfxdzopyucebtnbkx`. All Chronos schema/migrations/edge-function work happens here first, per the non-negotiable "DB branch, not production." Cost: ~$0.0134/hr (~$9.70/mo if left running) — small enough I proceeded without a stop; flagging for your visibility. Delete the branch if unused for a while to stop the charge.
- **CJ Dropshipping credentials — RESOLVED.** You added `CJ_DROPSHIPPING_API` to `.env` and authorized me to read it (overriding the repo's usual .env rule for this one case). Moved it into Supabase Vault on the `chronos-dev` branch rather than leaving it as the only copy in a plaintext repo file — same principle as "secrets live only in Supabase," just via Vault instead of Edge Function secrets since there's no MCP tool for setting the latter directly. Live CJ auth confirmed working (account `openId 42784`). See `docs/PHASE0_CJ_VALIDATION.md` for what a first-pass catalogue check found and what's still a real (not placeholder) to-do: precise per-SKU matching needs the Phase 1 admin "supplier product linker" tool, not just keyword search — see that doc for why.
- **This sandbox cannot reach the open internet directly** (proxy allowlist blocks arbitrary domains, including CJ's and even the Supabase project's own subdomain from `bash`/`curl`). Worked around it for one-off validation by calling CJ's API from inside Postgres itself (`http` extension on the `chronos-dev` branch), since Supabase's servers aren't behind my sandbox's proxy. The actual product's edge functions (`cj-auth`, `dispatch-order`, etc.) aren't affected by this at all once deployed — they run on Supabase's infrastructure with normal internet access; this only mattered for me personally test-driving the API from chat.
- **Stripe secret key:** you confirmed `STRIPE_SECRET_KEY` already exists in Supabase edge function secrets (consistent with the existing `create-checkout-session` function, which reads it). I can't read the value, only reference it in new functions.
- **Stripe live-vs-test mode — still unconfirmed, and this now blocks more than before.** For Phase 5 I went looking for any way to confirm whether that key is `sk_test_...` or `sk_live_...` before touching the Stripe API at all. There is no tool available in this environment that exposes the value (Supabase's Management API doesn't return secret values, only — at most — names, and even that isn't surfaced by the MCP tools here), and reading it from `.env` isn't something you've authorized for this key. **Net effect: I can't safely create even clearly-named TEST/DRAFT Stripe objects right now, because I can't rule out that "test mode" is actually live.** Nothing was created; see `docs/PHASE5_STRIPE_DRAFT.md` for the full dry-run spec instead. **This is a real blocker for Phase 5 launch sequencing** — before any Stripe object (draft or real) gets created for Chronos, someone needs to either (a) tell me directly whether the current key is test or live, or (b) provision a dedicated test-mode key for this work. Not marking BLOCKING for the rest of the build since Phases 1–4 don't touch Stripe, but it is a hard gate on Phase 5 execution specifically.
- **Supabase branch schema drift found:** `chronos-dev` was created by replaying tracked migrations, but only 3 migrations are tracked in Supabase's history (`initial_schema`, `storage_buckets`, `seed_pathway_and_achievements`) while production actually has 13 tables. Four tables (`pool_products`, `product_catalog`, `purchases`, `support_tickets`, `support_messages`) exist in production but were apparently created outside a tracked migration (dashboard/SQL editor) and were never captured as a migration file — the repo's `supabase/migrations/` folder only has one file. Branch creation failed (`MIGRATIONS_FAILED`) as a result. I'm closing this gap by writing migrations that bring `chronos-dev` to parity with production's real schema before adding any Chronos tables, so the schema history stops silently drifting. Flagging this because it's a pre-existing repo/ops gap, not something Chronos caused — worth fixing generally, not just for this branch.

---

## Business decisions (placeholder adopted, logged, awaiting ratification)

### 1. Wallet / settlement currency — RESOLVED
- **AUD, founder-confirmed directly** (not just the build plan's default assumption anymore). Founder also confirmed current landed cost (product + shipping) runs $20–60 AUD per item — this corrected an early margin read in `docs/PHASE0_CJ_VALIDATION.md` that compared CJ's USD product-only price against our AUD all-in cost. All margin math from here on: `(listing_price_AUD − (cj_product_USD + cj_freight_USD) × live_fx_rate) / listing_price_AUD`.

### 2. Shipping pricing model
- **Default adopted: flat shipping bands** (per destination country × weight class), per the build plan's own recommendation (2.3).
- **Needed from founder:** ratify, or direct to live per-order quotes instead.

### 3. Chronos pricing / bundle discount
- **Default adopted: existing 3 tiers become pathway-scoped; 40% off a second pathway's tier price** (build plan 5.1 proposal).
- **Needed from founder:** ratify tier×pathway prices and the bundle discount %, or override.
- **Scaffolding built (placeholder numbers only, nothing live):** `src/lib/pathwayPricing.js` — pathway-scoped price calculator (`pathwayTierPrice`, `bundlePrice`) and prorated upgrade math for pathway-scoped tiers (`pathwayUpgradeDiff`, extending the existing diff logic in `create-checkout-session`'s `"upgrade"` kind). All numbers are read from `TIERS` in `src/lib/tiers.js` plus a `BUNDLE_DISCOUNT_PCT` constant, so ratifying new numbers is a one-line change, not a rewrite. Stripe object plan (not executed — see item above) is in `docs/PHASE5_STRIPE_DRAFT.md`.

### 4. Sourcing-list product (Rep Spreadsheet replacement)
- **Default adopted:** `PLACEHOLDER` name and price — drafted as a founder-reviewable product description, not published, not priced for real.
- **Needed from founder:** product name, price, and sign-off on the compliant copy draft.

### 5. Beta cohort selection
- **No placeholder possible.** Requires real member identities.
- **Needed from founder:** 5–10 existing members (build plan suggests VIP first) for the Shopify pathway beta, plus their incentive terms.

---

## Items requiring explicit founder go-ahead before going live (built and staged, not activated)

- [ ] Merging any `chronos-dev` schema/code into the production database
- [ ] Activating live (non-placeholder) Stripe prices for Chronos tiers/bundle/sourcing-list product
- [ ] Sending any real email/notification to a member or the public (low-balance alerts, dispatch/tracking notifications, beta invites)
- [ ] Publishing the rewritten compliance copy or new marketing/pathway pages live

---

*This file is updated as the build progresses. Nothing in it should be read as "waiting on you to proceed" unless marked BLOCKING — everything else has a default and work continues.*
