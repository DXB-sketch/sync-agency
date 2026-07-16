# Project Chronos — Independent QA Verification Report

**Verifier:** independent QA subagent (no build authority — read-only DB investigation, repo reads only, zero schema/deploy changes made).
**Target:** Supabase branch `chronos-dev`, project ref `moatcohllmhgabanxlqr`.
**Verification window:** 2026-07-16, ~10:15–10:45 UTC.
**Important caveat:** a separate build agent was concurrently finishing Phase 3 ("Phase3-final" task list: webhook secret migration, `shopify-connect` update, `shopify-webhook`/`shopify-fulfil` builds) *during* this verification. Every Phase 3 finding below is timestamped and reflects the state at the moment of the check, not necessarily the state when this report is read. Phases 1, 2, 4 were not being actively modified during this pass.

Methodology note on RLS testing: every RLS claim below was verified by actually running the write/read as a simulated `authenticated` role (`set local role authenticated; set local request.jwt.claims = '{"sub":"<member-uuid>"}'`) inside a rolled-back transaction, and — critically — by checking **actual affected row counts**, not just "did an exception get thrown." Postgres RLS often blocks a write silently (0 rows matched, no error) rather than raising `42501`; a naive "no exception = succeeded" test produces false positives. Two of my own first-pass tests initially looked like vulnerabilities (`wallets` UPDATE, `wallet_transactions` DELETE) and turned out to be correctly-blocked no-ops once I checked row counts — noted explicitly below so the methodology is auditable.

---

## Phase 1 — Fulfilment Engine v2

| # | Acceptance criterion | Result | Evidence |
|---|---|---|---|
| 1 | Paid multi-item order auto-dispatches to CJ within 5 min, one CJ order per buyer address, correct shipping line | **PASS** | `order_dispatches` has 2 rows with real CJ order numbers (`SD2607160840530669300`, `SD2607160840350658100`), `dispatched_at` populated within ~9s of each other for the same `order_id` (two buyer addresses on one order → two dispatches, as designed). `trigger_dispatch_order()` DB function exists and is wired to fire on `orders.status → paid`. |
| 2 | CJ tracking number appears in member's portal order view without human action | **UNVERIFIED** | `cj-webhook` is deployed (`ACTIVE`) but no real CJ webhook delivery has been received against this branch (no public callback URL was registered — same conclusion as the founder log). All sampled `order_dispatches`/`order_items` rows have `tracking_number = null`. Code-reviewed only, not exercised against a live "shipped" payload. |
| 3 | Killing CJ API mid-dispatch → retried, then exceptioned, order visible in admin queue (never silently lost) | **PASS** | Independently confirmed via live data, not just self-report: one `order_dispatches` row shows `attempts = 3`, `last_error = "Variant not found, vid: INVALID-VID-DOES-NOT-EXIST"`, `dispatched_at = null`, and a matching row exists in `fulfilment_exceptions` (`stage='dispatch'`, `status='open'`). Retry-then-exception path is real, not asserted. |
| 4 | Nightly sync updates live costs; product forced below margin floor appears in margin alerts and (if configured) auto-hides | **PASS** | `price_sync_log` has 4 real rows with a live FX rate (`1.428913`, matches the founder log's independently-noted rate). One row's `details` contains a genuine margin breach: `{"name":"Chronos Test Leisure Top","floor":30,"landed_aud":15.13,"margin_pct":5.4,"listing_price":16}` — a real computed breach, not a placeholder. `products.auto_hide_below_floor` / `hidden_by_sync` columns exist and are wired per the founder log's live test. |
| 5 | Zero manual AliExpress orders required for one full week of live volume | **FAIL / OPEN** | No live volume exists yet (dev branch), so this is untestable as stated — but more importantly, **CJ order creation does not pay for the order** (`createOrderV2` returns `paymentDate: null`, `actualPayment: null` per the founder log, independently plausible given no pay-from-balance call exists in `dispatch-order`'s source). Every CJ order currently requires one manual payment click in the CJ dashboard. This is a real, unresolved gap against the criterion's literal wording, not just an untested criterion — it needs a founder decision (documented already in `FOUNDER_DECISIONS_REQUIRED.md`). |

**Phase 1 verdict:** Core dispatch/retry/exception/margin-sync mechanics are real and independently verified against live data. The one outstanding item (manual CJ payment) is already correctly flagged as an open founder decision, not silently missed.

---

## Phase 2 — Member Wallet

| # | Acceptance criterion | Result | Evidence |
|---|---|---|---|
| 1 | Top-up via Stripe reflects in balance within seconds; ledger row references payment intent | **UNVERIFIED** | `wallet-topup` and `stripe-webhook`'s `wallet_topup` branch are deployed and code-reviewed against the house pattern. Cannot be verified live: this environment has no outbound network egress (confirmed independently — matches the founder log), and edge-function secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`) on `chronos-dev` are not confirmed set (no MCP tool here can read/list edge function secrets). |
| 2 | Ledger sum always equals cached balance under concurrent debit tests | **PASS (structural verification)** | I did not re-run the 20-way concurrency drill myself (rerunning it would leave more synthetic data on the branch for no new signal — the append-only guarantee below is the load-bearing control). I independently verified the mechanism that makes the guarantee possible: the `wallet_transactions` append-only trigger fires even for the service-role/postgres connection (see RLS test #5/#6 below), meaning the ledger cannot be edited out from under the balance after the fact by any role. Combined with the founder log's detailed concurrency-drill numbers (12 immediate debits + 8 parked, balance never negative, ledger sum == balance throughout), this is credible. |
| 3 | Insufficient-funds order parks in `awaiting_funds`, notifies member, auto-dispatches after top-up, no admin touch | **PARTIAL** | `wallet_order_holds` table and `resume_awaiting_funds_orders` RPC exist; `orders.status` enum includes `awaiting_funds`. "Notifies member" is only a portal banner (`wallet-banner-warn` in `WalletPage.jsx`) — **no email is sent**, which is a documented deliberate default (founder email gate), not a bug, but it means the plan's literal "member notified (email + portal banner)" wording is only half-satisfied by design. |
| 4 | Member cannot mutate any wallet value through any client path (RLS verified by test) | **PASS — independently verified, not just asserted** | See full RLS test table below. Every write path I attempted as a simulated non-admin member (`wallets` UPDATE/INSERT, `wallet_transactions` INSERT/DELETE) was blocked. Table-level GRANTs for `wallets`/`wallet_transactions`/`wallet_order_holds` are Supabase's normal default-broad-grant pattern (anon/authenticated have full SQL-level privileges), so **RLS is the only thing standing between a member and their own wallet balance** — and it held under direct testing, including a same-row UPDATE that a naive test would have misread as successful (0 rows actually changed). |

**Phase 2 verdict:** The one property that actually matters for a wallet — "can a client mutate money" — is genuinely, not just documented, enforced. The two open items (live Stripe round-trip, email notification) are already known/flagged gaps, not surprises.

---

## Phase 3 — Shopify Integration

**State at time of check (2026-07-16 ~10:40 UTC):** schema (`shopify_stores`, `product_links`) and `shopify-connect`/`shopify-health` edge functions are deployed. `shopify-webhook` and `shopify-fulfil` **do not exist yet** — confirmed via `list_edge_functions` (10 functions total, no `shopify-webhook`/`shopify-fulfil`). A separate agent's task queue shows this as in-progress work ("Phase3-final: build shopify-webhook edge function" — pending at time of check).

| # | Acceptance criterion | Result | Evidence |
|---|---|---|---|
| 1 | E2E live test: Shopify sale → wallet debit → CJ order → tracking pushed back → buyer notified, zero human actions | **FAIL / NOT YET BUILT** | `shopify-webhook` and `shopify-fulfil` are not deployed as of this check. Cannot pass a criterion for a function that doesn't exist yet. |
| 2 | Webhook with invalid HMAC rejected and logged | **FAIL / NOT YET BUILT** | Same reason — no `shopify-webhook` to test. |
| 3 | Order with unlinked product exceptions cleanly, notifies member with fix-it link | **FAIL / NOT YET BUILT** | Same reason. |
| 4 | Store token revoked at Shopify surfaces in daily health check within 24h | **PARTIAL** | `shopify-health` is deployed and code-reviewed against Shopify's documented `shop.json` shape, but per the founder log it has never been exercised against a real Shopify store/token (no real store available in this environment either). Mechanism exists, live behavior unverified. |
| 5 | Duplicate webhook delivery doesn't double-order or double-debit (idempotency on `shopify_order_id`) | **Structural PASS / functional FAIL** | The schema-level guard is in place and correct: `orders.shopify_order_id` has a `unique` constraint (confirmed in schema). But the function that would rely on it (`shopify-webhook`) doesn't exist yet, so the end-to-end guarantee can't be exercised. |

### Critical finding not in the build plan's checklist: Phase 3's *already-shipped* portal UI is broken for real members right now

Independently discovered and verified live (not in the founder log): `shopify_stores` has **no table-level `SELECT`/`INSERT`/`UPDATE` grant for `authenticated` or `anon`** — confirmed via `information_schema.column_privileges` (every column shows only `REFERENCES` for these roles, zero `SELECT` rows) and reproduced live: a simulated member querying their own `status`/`shop_domain` (deliberately excluding `access_token_enc`) gets `permission denied for table shopify_stores`, not an empty result.

Root cause: `supabase/migrations/20260716081500_chronos_phase3_shopify_schema.sql` line 71 intends a **column-scoped** revoke (`revoke select (access_token_enc) on public.shopify_stores from authenticated, anon;`), and the follow-up fix migration (`20260716081600_..._token_column_revoke_fix.sql`) is also correctly column-scoped in its SQL text. But the *live* grant state on `chronos-dev` shows table-wide `SELECT` missing entirely, not just on that one column — meaning `shopify_stores` never actually received Supabase's normal default per-table grant to `authenticated`/`anon` that every other Chronos table has (all other new tables — `wallets`, `order_dispatches`, `supplier_products`, etc. — do have full default `SELECT/INSERT/UPDATE/DELETE` grants, confirmed by the same query). This looks like exactly the kind of grant-timing race the founder log already flagged as a known quirk on this table, just manifesting more broadly than the log's writer caught.

**Concrete, verified impact:**
- `src/portal/ConnectStorePage.jsx` line 25-28 does `supabase.from("shopify_stores").select("id, shop_domain, status, last_health_check_at, created_at").maybeSingle()` — this call will fail with a permission error for every real member, every time. The comment directly above it (lines 21-24) asserts RLS handles scoping — true in principle, but moot because the table-level grant check happens before RLS is even evaluated.
- `src/portal/ProductLinkingPage.jsx` line 19-22 makes the identical `shopify_stores` call and will fail the same way.
- Cascading failure: `product_links_select_own`'s RLS policy contains `EXISTS (SELECT 1 FROM shopify_stores s WHERE s.id = product_links.shopify_store_id AND s.member_id = auth.uid() ...)`. I independently reproduced that a member's `SELECT * FROM product_links` fails with `permission denied for table shopify_stores` (not `product_links`) — the RLS policy's own subquery trips the same missing grant. `ProductLinkingPage.jsx` line 32 (`supabase.from("product_links").select(...)`) is therefore also broken for every real member.

This means the "Connect Store" and "Product Linking" pages — both already shipped/live on `chronos-dev` per the founder log — are non-functional for any real member using the normal client, independent of whether `shopify-webhook`/`shopify-fulfil` ever get built. This should be fixed before Phase 3 is considered done, and it directly blocks Phase 4's still-open acceptance criterion (#3 below) — nobody can complete "connect a store without support contact" while the connect page 403s on load.

**Fix:** re-grant table-level `SELECT, INSERT, UPDATE` on `shopify_stores` to `authenticated` (RLS + the existing column-level `access_token_enc` revoke will still correctly scope what's actually readable/writable), e.g. `grant select, insert, update on public.shopify_stores to authenticated;` then re-verify `access_token_enc` is still excluded via `information_schema.column_privileges`.

**Phase 3 verdict:** Foundation (schema, connect/health functions) is sound in isolation, but a live, verified privilege bug makes the two portal pages built on top of it non-functional right now. Core webhook/fulfil pipeline is genuinely mid-build, not missing by oversight.

---

## Phase 4 — Shopify Education Pathway

| # | Acceptance criterion | Result | Evidence |
|---|---|---|---|
| 1 | Shopify-pathway member sees only their branch; dual member sees both, independent progress | **PASS — independently reverified** | I re-ran a subset of the founder log's own drill rather than trusting it outright: querying `pathway_nodes` joined to `pathways` as the Depop-only test member returns **0 rows** for `slug='shopify'` (RLS correctly scopes by ownership). Attempting a self-grant `INSERT INTO member_pathways` as that same non-admin member was rejected by RLS. `pathway_nodes` total = 27 (8 depop + 19 shopify), matching the founder log's counts exactly. |
| 2 | All 7 modules live with nodes, icons, copy blocks | **PASS (content unreviewed)** | Node counts check out (19 Shopify nodes). I did not re-review the actual copy for compliance/tone — that's a founder content review task per the build plan, not something I can meaningfully QA. 6 of 14 hub glyphs are still undesigned (documented, falls back to an existing icon — cosmetic only, not a functional gap). |
| 3 | Module 4 walkthrough: non-technical member connects a store, no support contact | **FAIL — and currently unmeetable** | Explicitly flagged as not-done in the founder log (needs a real external tester). Independently, this criterion **cannot currently pass regardless of tester availability** — the Connect Store page the module points to is broken by the Phase 3 grant bug above. This should be fixed before scheduling any real tester. |

**Phase 4 verdict:** Schema/RLS work is genuinely solid and I could independently reproduce the key claims. The one open criterion has a newly-identified blocker (Phase 3's bug), not just "needs a human."

---

## RLS policy test log (every test run, with result)

All tests run as `set local role authenticated; set local request.jwt.claims` inside a rolled-back transaction against `chronos-dev`, using real test member `de272546-022b-48af-8867-dde4cb9e6df6` (non-admin). Row-count verification used where a silent no-op vs. a real error both looked like "no exception."

| Table | Action attempted | Actor | Result | Verified how |
|---|---|---|---|---|
| `wallets` | UPDATE own `balance_cents` directly (+$9,999.99) | non-admin member | **BLOCKED** (0 rows changed) | `RETURNING` + row count inside txn — balance unchanged before/after |
| `wallets` | INSERT a new wallet row for another member | non-admin member | **BLOCKED** | `42501` RLS violation |
| `wallet_transactions` | INSERT a fake `credit` row for self | non-admin member | **BLOCKED** | `42501` RLS violation |
| `wallet_transactions` | DELETE own rows | non-admin member | **BLOCKED** (0 rows deleted) | `RETURNING` + row count; count before/after unchanged (30 → 30) |
| `wallet_transactions` | UPDATE a row (tamper `reason`) | **service-role/postgres connection** (not RLS-subject) | **BLOCKED** | Append-only trigger fired: `wallet_transactions is append-only (money bugs are ledger bugs)` — holds even for the role that bypasses RLS |
| `wallet_transactions` | DELETE a row | **service-role/postgres connection** | **BLOCKED** | Same append-only trigger |
| `order_dispatches` | INSERT a fake dispatch row | non-admin member | **BLOCKED** | `42501` RLS violation |
| `order_dispatches` | UPDATE `tracking_number` on own orders' dispatches | non-admin member | **BLOCKED** (0 rows changed) | `RETURNING` + row count |
| `supplier_products` | INSERT a fake product row | non-admin member | **BLOCKED** | `42501` RLS violation |
| `supplier_tokens` | INSERT a fake token row | non-admin member | **BLOCKED** | `42501` RLS violation |
| `supplier_tokens` | SELECT (no policy exists at all — advisor-flagged `rls_enabled_no_policy`) | non-admin member | **BLOCKED** (0 rows) | Default-deny confirmed correct behavior, not a gap — RLS enabled + zero policies = zero visible rows for any non-owner role |
| `fulfilment_exceptions` | INSERT a fake exception row | non-admin member | **BLOCKED** | `42501` RLS violation |
| `shopify_stores` | INSERT a store row for a *different* member | non-admin member | **BLOCKED** | `permission denied for table shopify_stores` (table-level grant missing — see bug above) |
| `shopify_stores` | INSERT a store row for *own* member_id | non-admin member | **BLOCKED, but for the wrong reason** | Same permission-denied — correct outcome, but it's blocking legitimate service-role-only writes for the wrong reason (grant missing, not RLS) and simultaneously blocks reads it shouldn't |
| `shopify_stores` | SELECT `access_token_enc` column specifically | non-admin member | **BLOCKED (intended)** | `permission denied` — this part is working as designed |
| `shopify_stores` | SELECT own row, non-token columns only (`status`, `shop_domain`, etc.) | non-admin member | **BLOCKED (BUG — should succeed)** | `permission denied for table shopify_stores` — see Phase 3 finding above |
| `product_links` | SELECT own links (via `shopify_stores` join in RLS policy) | non-admin member | **BLOCKED (BUG — cascading from above)** | `permission denied for table shopify_stores` |
| `member_pathways` | INSERT self-grant of the Shopify pathway | non-admin member | **BLOCKED** | `42501` RLS violation |
| `pathway_nodes` | SELECT nodes outside owned pathway (Depop member reading Shopify nodes) | non-admin member | **CORRECTLY SCOPED** (0 rows) | Row count check against known total (19 Shopify nodes exist, 0 visible) |

**19 distinct write/read paths tested. 17 behave correctly. 2 (`shopify_stores` own-row SELECT, cascading `product_links` SELECT) are a genuine bug — see Phase 3 section.**

---

## Secrets / hardcoded-credentials scan

Grepped `supabase/functions/`, `src/`, and `docs/` for Stripe/Shopify/CJ key patterns (`sk_live_`, `sk_test_`, `shpat_`, `shpca_`, `whsec_`, `CJ_DROPSHIPPING_API`).

**No real secrets found hardcoded.** Every match was one of:
- `Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_PLACEHOLDER"` in `stripe-webhook/index.ts` and `wallet-topup/index.ts` — the fallback string is the literal word `PLACEHOLDER`, not a functioning key. Minor style note (not a security issue): a garbage fallback key means a missing env var fails with a confusing Stripe API error rather than failing fast with a clear message — low-priority polish, not a fix-before-launch item.
- `shpat_…` in `ConnectStorePage.jsx` — UI placeholder text for an `<input>`, not a value.
- Docs (`PHASE0_CJ_VALIDATION.md`, `PHASE5_STRIPE_DRAFT.md`) referencing env var *names*, not values.

Every internal secret (`cj_api_key`, `internal_trigger_secret`, `edge_functions_url`, `shopify_token_key`) is fetched via `admin.rpc("get_secret", ...)` (Supabase Vault) inside edge functions, confirmed across `cj-auth`, `cj-search`, `dispatch-order`, `freight-quote`, `nightly-price-sync`, `shopify-health`, `cj-webhook`. No `.env` reads inside `supabase/functions/`. This matches the founder log's claims and is independently confirmed.

---

## Admin panel / portal UI vs. live schema cross-check

| Component | Tables/columns queried | Matches live schema? |
|---|---|---|
| `src/admin/ExceptionQueuePage.jsx` | `fulfilment_exceptions` with embedded `orders(*, profiles!orders_member_id_fkey(email), order_items(*, products(name))), order_dispatches(*)` | **Yes** — all FK names (`orders_member_id_fkey`, `fulfilment_exceptions_order_id_fkey`, `fulfilment_exceptions_dispatch_id_fkey`) exist exactly as referenced. |
| `src/admin/MarginAlertsPage.jsx` | `price_sync_log` (`*`), `supplier_products` (`*`, filtered `stock_state='out_of_stock'`) | **Yes** — columns used (`display_name`, `external_sku`, `image_url`, `last_synced_at`, `stock_state`) all exist. |
| `src/admin/ClientDetailPage.jsx` (Wallet tab) | `wallets`, `wallet_transactions`, `wallet_order_holds`, all `.eq("member_id", id)` | **Yes** — matches schema; admin RLS (`is_admin()` OR own-row) permits this. |
| `src/admin/ProductsAdminPage.jsx` (supplier linker) | `products`/`pool_products` embedding `supplier_products(external_sku, stock_state, display_name)` via `supplier_product_id` FK | **Yes** — FK and columns match. |
| `src/portal/WalletPage.jsx` | `wallets`, `wallet_transactions`, `wallet_order_holds` (direct client queries) | **Yes**, and functionally correct — these tables have the normal full default grants, so the member-facing wallet UI will actually work, unlike the Shopify pages below. |
| `src/portal/ConnectStorePage.jsx` | `shopify_stores` direct client query | **Column names match schema, but the query will fail live** — see Phase 3 grant bug. |
| `src/portal/ProductLinkingPage.jsx` | `shopify_stores`, `product_links`, `products` direct client queries | **Column names match schema, but both `shopify_stores` and `product_links` queries will fail live** — same bug, cascading. |

---

## Mobile-first CSS spot check

The app's actual mobile strategy (confirmed in `src/styles/portal.css`) is a `@media (max-width: 768px)` breakpoint that hides the top nav and shows `.bottom-tab-bar` — not per-component breakpoints. New Chronos component styles (`.wallet-*`, `.store-status-*`, `.connect-store-*`, `.product-link-*`, `.exception-status-*`, `.margin-row-*`) follow the same pattern as existing components: flexible `flex-wrap: wrap` layouts, no fixed desktop-only widths, consistent with the rest of the app. This is a genuine match to house convention, not just superficially similar.

One minor gap: `.wallet-ledger-table` (member-facing, `WalletPage.jsx`) is a plain `<table>` with no scrollable wrapper, whereas every admin-facing table in the app uses `.admin-table-wrap { overflow-x: auto; }`. On a narrow phone screen with 4 columns (Date/Type/Amount/Reason) this could clip or force page-level horizontal scroll. Low priority (member-facing tables elsewhere in the existing app, e.g. order history, use card layouts rather than `<table>`, so this is arguably an inconsistency in table-vs-card choice more than a missing breakpoint) but worth a quick fix.

---

## Supabase Advisors — full output

### Security advisors (`get_advisors(type=security)`) — 27 findings, all INFO/WARN, none ERROR

- **INFO — RLS enabled, no policy:** `product_catalog`, `supplier_tokens`. For `supplier_tokens` this is correct-by-design (verified above — default-deny protects it). `product_catalog` is a pre-existing table (0 rows), unrelated to Chronos — flagging for completeness only, not a Chronos regression.
- **WARN — Function search_path mutable:** `tier_product_limit`, `wallet_transactions_immutable`. The latter is the append-only trigger function itself — worth pinning `search_path` on it as defense-in-depth (it's `SECURITY INVOKER` by default for triggers, but explicit `search_path` is still best practice), even though I could not find an exploitable path given it only compares `NEW`/`OLD`.
- **WARN — Extension in public schema:** `pg_net` installed in `public` rather than a dedicated schema. Pre-existing, not Chronos-introduced.
- **WARN — Public bucket allows listing:** `product-images` storage bucket. Pre-existing, unrelated to Chronos.
- **WARN — `anon`/`authenticated` can execute `SECURITY DEFINER` functions** (17 functions total): `admin_distribute_pool`, `admin_set_member_tier`, `claim_product_catalog`, `distribute_pool_products`, `grant_default_pathway`, `handle_new_user`, `handle_slot_opened`, `handle_user_confirmed`, `has_active_access`, `is_admin`, `link_purchase_to_member`, `owns_node`, `owns_pathway`, `touch_ticket_on_message`, `trigger_dispatch_order`. This is expected/accepted for the auth.uid()-gated helper functions (`is_admin`, `has_active_access`, `owns_node`, `owns_pathway` all internally check `auth.uid()` and return booleans — safe to expose) and for trigger-only functions that no client would call directly with useful arguments. The founder log already reviewed and accepted this exact pattern for Phase 4's additions; nothing new here.
- **WARN — Leaked password protection disabled** (Supabase Auth / HaveIBeenPwned check). Project-wide setting, not Chronos-specific, but worth turning on before any real signups against this data model.

### Performance advisors (`get_advisors(type=performance)`) — output was 140,937 characters, too large to return inline; categorized by grepping the saved output for every `cache_key`/`detail`/`level`

- **`unindexed_foreign_keys`** (~22 findings, INFO): every new Chronos FK lacks a covering index — `fulfilment_exceptions` (×3: `dispatch_id`, `order_id`, `resolved_by`), `member_pathways` (×2), `order_dispatches.supplier_id`, `order_items` (×2: `dispatch_id`, `product_id`), `orders.dispatch_id`, `pathway_nodes.pathway_id`, `pool_products` (×4), `product_links.product_id`, `products` (×2), `wallet_order_holds.member_id`, `wallet_transactions.created_by`, plus some pre-existing ones (`member_achievements`, `support_messages`). None are urgent at current (near-zero) row counts, but `fulfilment_exceptions.order_id`/`order_dispatches.supplier_id` will matter once `ExceptionQueuePage`'s embedded-join queries run against real volume.
- **`auth_rls_init_plan`** (~24 findings, WARN — perf, not security): many RLS policies call `auth.uid()` / `is_admin()` directly in the `USING`/`WITH CHECK` clause rather than wrapped as `(select auth.uid())`, which means Postgres re-evaluates it per row instead of once per query. Affects most Chronos tables' policies (`wallets_select_own_or_admin`, `wallet_transactions_select_own_or_admin`, `wallet_order_holds_select_own_or_admin`, `shopify_stores_select_own`, `product_links_select_own`, `member_pathways_select_own_or_admin`, etc.) plus several pre-existing tables. Standard Supabase lint noise — worth a batch fix pass, not urgent at current volume.
- **`unused_index`** (7 findings, INFO): mostly pre-existing tables (`support_tickets`, `support_messages`, `purchases`, `products`, `orders`, `member_achievements`) plus `wallet_transactions_member_created_idx` — unused only because there's no real query volume yet on a dev branch; not a real signal at this stage.
- **`multiple_permissive_policies`** (~90 findings, WARN — perf): many tables have overlapping permissive policies for the same role+action (e.g., a `select_own` and an admin `_all` policy both apply to `authenticated` SELECT, so Postgres evaluates both instead of one combined policy). Affects `orders`, `order_items`, `products`, `member_pathways`, `member_pathway_progress`, `pathway_nodes`, `pathways`, `product_links`, `purchases`, `shopify_stores`, `support_tickets`, `member_achievements`, `achievements`, `profiles`. This is a pattern across the whole app (pre-existing tables affected too), not something Chronos introduced in isolation, but Chronos's new tables (`shopify_stores`, `product_links`, `member_pathways`) follow the same pattern and could be collapsed into single `OR`-combined policies for a minor perf win.
- **`auth_db_connections_absolute`**: informational connection-count advisory, not actionable.

**None of the performance findings are urgent given current data volume** (single-digit to low-double-digit row counts across every Chronos table). Worth a cleanup pass before the branch merges to production and starts taking real traffic, not before then.

---

## Prioritized fix list before this goes near production

1. **[HIGH — functional bug, verified live] Fix `shopify_stores` table-level grants.** `authenticated`/`anon` currently have zero `SELECT`/`INSERT`/`UPDATE` privilege on the table (only `access_token_enc` was meant to be locked down). This breaks `ConnectStorePage.jsx` and `ProductLinkingPage.jsx` for every real member and blocks Phase 4's last open acceptance criterion. Fix: `grant select, insert, update on public.shopify_stores to authenticated;` then re-verify `access_token_enc` stays excluded via `information_schema.column_privileges`. Cheap, mechanical fix — but must happen before any real member sees the Connect Store page.
2. **[HIGH — business decision, already flagged, not newly found] CJ order payment is manual.** `dispatch-order` creates the CJ order but does not pay for it — every order needs a manual click in the CJ dashboard until someone researches CJ's pay-from-balance API (with sign-off, since it moves money). Confirmed still true; re-flagging because it's the single biggest gap between "Phase 1 done" and the literal acceptance criterion #5 wording.
3. **[MEDIUM — not yet built, in progress] `shopify-webhook` / `shopify-fulfil`.** Phase 3's core zero-touch pipeline doesn't exist yet as of this check. Not a bug, just incomplete — tracked as in-progress elsewhere. Flagging so nobody mistakes "schema exists" for "Phase 3 done."
4. **[MEDIUM] Wallet top-up is unverified live end-to-end.** No sandbox egress + unconfirmed edge-function secrets on `chronos-dev` means the actual Stripe→webhook→balance-credit round trip has never fired for real. Needs a real test-mode top-up once someone with dashboard/CLI access sets `STRIPE_SECRET_KEY`/`STRIPE_WEBHOOK_SECRET`/`SITE_URL` on the branch.
5. **[LOW] Performance-advisor cleanup**: unindexed FKs on the highest-traffic new tables (`fulfilment_exceptions.order_id`, `order_dispatches.supplier_id`) and the `auth_rls_init_plan`/`multiple_permissive_policies` pattern across Chronos's new RLS policies. Not urgent at current volume; do this in the same pass as any pre-merge cleanup, not as a blocker.
6. **[LOW] `.wallet-ledger-table` has no horizontal-scroll wrapper** on mobile, unlike the app's `.admin-table-wrap` convention. Cosmetic, five-minute fix.
7. **[LOW] `sk_test_PLACEHOLDER` fallback** in `stripe-webhook`/`wallet-topup` — not a leak, but a missing env var will currently fail with a confusing Stripe SDK error instead of a clear "STRIPE_SECRET_KEY not set" message. Nice-to-have, not required.
8. **[LOW] Supabase project-wide settings**: enable leaked-password protection; move `pg_net` out of `public` schema. Pre-existing, not Chronos-caused, but cheap to fix while in the area.

## What's genuinely solid (don't rebuild these)

- Wallet money-safety: independently verified, not just documented. RLS + the append-only ledger trigger together mean no client path — and no service-role/dashboard path — can mutate a balance or edit history outside the RPC layer.
- Phase 1's dispatch/retry/exception/margin-sync mechanics: real live evidence in the data (actual CJ order numbers, a real retry-then-exception row, a real computed margin breach), not self-reported claims taken on faith.
- Phase 4's pathway RLS scoping: independently reproduced the ownership-scoping and self-grant-rejection behavior described in the founder log.
