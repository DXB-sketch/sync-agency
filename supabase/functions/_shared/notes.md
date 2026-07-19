# Edge Functions — source of truth

These folders mirror what is deployed to the Supabase project `whuqfxdzopyucebtnbkx` (Sync Client Portal).
Each function is self-contained (no shared imports) so it can be deployed independently.

Secrets required (set in Supabase Dashboard → Edge Functions → Secrets, or `supabase secrets set`):

- `STRIPE_SECRET_KEY`   — live Stripe secret key (placeholder until owner provides)
- `STRIPE_WEBHOOK_SECRET` — signing secret from the Stripe webhook endpoint registration
- `SITE_URL`            — https://syncagency.org

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

`merge-stripe-duplicates` is newer than the original deploy — push it (and the updated
`create-stripe-product` / `update-stripe-price`) with `supabase functions deploy <name>`.
It's triggered from the admin Catalogue page ("Merge Stripe duplicates" button).

PLACEHOLDERS TO REPLACE (see PORTAL_SETUP.md at repo root):
- `price_PLACEHOLDER_*` course price IDs in `stripe-webhook/index.ts` and `create-checkout-session/index.ts`.

## Project Chronos — CJ Dropshipping fulfilment engine (Phase 1)

Deployed on `chronos-dev` (`moatcohllmhgabanxlqr`) only — not merged to production. See
`docs/PHASE1_PLAN.md` for the full spec and `docs/FOUNDER_DECISIONS_REQUIRED.md` for open
decisions and live-verified findings.

Functions (all self-contained, no `_shared` imports, deployed `--no-verify-jwt` except
`freight-quote`/`cj-search` which take normal user JWTs):
- `cj-auth` — CJ token cache/refresh. Internal-only (`internal_trigger_secret` bearer).
- `freight-quote` — CN→AU shipping quote for one vid. Admin JWT or internal bearer.
- `cj-search` — admin product search/link (categories/search/variants/link actions). Admin JWT only.
- `dispatch-order` — paid order → CJ order(s). Triggered by DB trigger `orders_paid_dispatch`,
  cron `dispatch-sweep` (every 30 min), or admin retry from the Exception Queue.
- `cj-webhook` — CJ tracking/status ingestion. Payload is an untrusted hint only; always
  re-queries CJ's `order/list` for authoritative state before writing anything.
- `nightly-price-sync` — cost/stock refresh + margin flags. Cron nightly at 17:00 UTC
  (03:00 Sydney) plus admin "Run sync now".

Secrets required (Vault, not edge-function secrets — read via `rpc('get_secret', {secret_name})`):
- `cj_api_key` — CJ Dropshipping API key (format `CJUserNum@api@hexkey`).
- `internal_trigger_secret` — shared bearer for DB-trigger/cron→edge-function calls (stands in
  for the service_role_key the original plan called for — see FOUNDER_DECISIONS_REQUIRED.md).
- `edge_functions_url` — this project's `https://<ref>.supabase.co/functions/v1` base.
None of these exist in production yet — must be created there before any Chronos merge.

IMPORTANT gotcha (cost real debugging time, don't reintroduce): a service-role
`createClient(...)` calling `admin.functions.invoke("cj-auth", ...)` does NOT automatically send
`internal_trigger_secret` as the bearer — it sends the service-role key itself, which cj-auth
correctly rejects. Every internal caller of `cj-auth` must fetch `internal_trigger_secret` via
`rpc('get_secret', ...)` and pass it explicitly: `{ headers: { Authorization: \`Bearer ${secret}\` } }`.

## Project Chronos — chronos-dev branch (moatcohllmhgabanxlqr)

Chronos functions are being built and deployed to the Supabase dev branch `chronos-dev`
first (see docs/FOUNDER_DECISIONS_REQUIRED.md), not to production `whuqfxdzopyucebtnbkx`
above. Not yet reflected in the secrets list above since they're branch-only until merge:

- `cj-auth`, `freight-quote`, `cj-search` (Phase 1) — read `cj_api_key`,
  `internal_trigger_secret`, `edge_functions_url` from Supabase Vault via the
  `get_secret()` RPC (not edge function env secrets — see FOUNDER_DECISIONS_REQUIRED.md
  on why Vault was used instead).
- `shopify-connect`, `shopify-health` (Phase 3) — member-facing store connect/product-link
  and daily token health check. No new edge function secrets; token encryption uses the
  `shopify_token_key` Vault secret via the `shopify_store_upsert` / `shopify_store_get_token`
  RPCs (same pattern as `get_secret`). `shopify-webhook` / `shopify-fulfil` are NOT built —
  they depend on Phase 1's `dispatch-order` and Phase 2's wallet, both still in progress.
- `wallet-topup`, `wallet-adjust`, `wallet-pay-order` — member wallet (store credit), live on
  production (`whuqfxdzopyucebtnbkx`), open to every active member (not Chronos/Shopify-pathway
  gated — the `WALLET_MEMBER_IDS` allowlist was removed from both `wallet-topup/index.ts` and
  `src/lib/walletFlag.js`). `wallet-topup`: top-up checkout session + threshold preference.
  `wallet-adjust`: admin manual credit/adjustment/refund (admin JWT only) — also the Exception
  Queue's automatic wallet-refund-on-cancel path. `wallet-pay-order`: pays an existing draft
  order entirely from wallet credit, recomputing the total server-side from live `products`
  prices (never trusts the client). All three self-contained, same CORS/`json()`/user-scoped-
  client pattern as `create-checkout-session`. Money movement is never done directly by these
  functions — all call `security definer` Postgres RPCs (`wallet_topup_credit`, `wallet_adjust`,
  `debit_wallet_for_order`) that are revoked from `anon`/`authenticated` and granted only to
  `service_role`, so the ledger insert + cached-balance update happen atomically in one DB
  transaction regardless of which edge function triggered it. `debit_wallet_for_order`'s own
  unique index (`wallet_transactions_order_debit_uniq`) makes a concurrent double-submit of
  `wallet-pay-order` produce exactly one debit.
  `stripe-webhook` got one surgical addition: a `kind === "wallet_topup"` branch in
  `handleCheckoutCompleted` that calls `wallet_topup_credit` — the existing Depop
  `stock_order`/`upgrade`/`reactivate` branches and the course-purchase fallthrough are
  unchanged. Reads the same `STRIPE_SECRET_KEY`/`SITE_URL` secrets as `create-checkout-session`.
- All four Vault secrets (`cj_api_key`, `internal_trigger_secret`, `edge_functions_url`,
  `shopify_token_key`) must be created in production Vault before any Chronos code merges —
  production has none of them today (tracked in FOUNDER_DECISIONS_REQUIRED.md).
