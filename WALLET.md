# Claude Code Prompt — Chronos Admin Toggle + Depop Member Wallet (Store Credit)

Copy everything below the line into a fresh Claude Code session opened at `C:\Projects\sync-agency`.

---

## Context

You are working on the Sync Agency member portal. Production Supabase project: `whuqfxdzopyucebtnbkx`. Stack: React 19 + Vite frontend (static build, SiteGround hosting — **no Node server**; all server logic is Supabase Edge Functions), Supabase (Postgres, Auth, RLS, Edge Functions), Stripe (Checkout Sessions + webhooks). Read `CLAUDE.md` and `docs/FOUNDER_DECISIONS_REQUIRED.md` before writing code.

The Project Chronos backend (CJ fulfilment, wallet, Shopify integration) is **merged into production but admin-gated and not member-facing**. Relevant existing pieces you will reuse, not rebuild:

- Tables: `wallets` (integer cents, cached `balance_cents`), `wallet_transactions` (append-only ledger, every row references its cause — Stripe payment intent or order ID)
- Edge functions: `wallet-topup` (Stripe Checkout Session + webhook credit), `wallet-adjust` (admin ledgered adjustment)
- Existing Depop checkout: portal cart → `create-checkout-session` (Stripe) → `stripe-webhook` → order status `paid` → downstream fulfilment flow

**Business decision change (founder-ratified):** the wallet is no longer Shopify-only. Depop members now get the wallet as a **store-credit feature**. Update any code comments, feature flags, and docs that state "wallet = Shopify members only."

**Incident-informed rules (from INCIDENT 2026-07-17):**
- Never write to money/order tables with raw SQL — all mutations via service-role edge functions.
- Never create duplicate Stripe products/prices; check for an existing `stripe_price_id` before creating; **archive, never delete**.
- All secrets live only in Supabase Edge Function Secrets. Never in the repo, `.env`, or frontend bundle.
- Wallet payment must not touch `stripe_price_id` at all — wallet-paid orders bypass Stripe entirely.

## Embedded decisions (confirm with founder before running if any are wrong)

1. **Currency:** AUD, matching Stripe settlement currency.
2. **No partial payments in v1.** If wallet balance ≥ cart total, the member may pay fully from wallet. If balance < total, the member pays the full amount via the existing Stripe Checkout (unchanged) — with an inline prompt to top up if they'd rather use credit. No wallet+Stripe split.
3. **Toggle persistence:** per-admin, per-device via `localStorage` (key `sync_chronos_mode`). Simple, no schema change; the toggle is UX-only — server-side admin gating and RLS remain the real security boundary.

---

## TASK A — Chronos visibility toggle (admin-only)

Currently Chronos admin sections are visible to admins by default. Change this so the **default portal experience is identical for members and admins: no Chronos UI at all.** Admins get a toggle that reveals it.

Requirements:

1. Create a `ChronosModeContext` (or extend the existing admin context) exposing `chronosMode: boolean` and `setChronosMode`. Initialise from `localStorage.sync_chronos_mode`; default `false`.
2. Add a labelled switch ("Chronos Mode") in the admin panel header/nav, visible **only to admins**. Style consistent with the portal's dark/gold system (`#C9A84C` on `#080808`, no emojis, existing component patterns).
3. Audit the codebase for every Chronos-introduced route, nav item, page, panel, and admin view (CJ supplier tooling, exception queue, margin alerts, supplier product linker, Shopify sections, price-sync views, etc.). Gate **all** of them behind `isAdmin && chronosMode` — routes should not merely hide links; the routes themselves must render a 404/redirect when the condition is false.
4. **Exception:** the wallet (Task B) is being promoted out of Chronos into the live member product. Wallet UI must NOT be gated by `chronosMode` — it is gated only by normal member auth.
5. Do not weaken any server-side check. Every Chronos edge function and RLS policy keeps its existing admin/service-role gating. The toggle changes visibility only.
6. Grep for any Chronos component that leaks into shared member views (dashboards, order views, nav) and confirm members see zero trace with the toggle off and on (toggle state must never affect non-admin sessions).

Acceptance:
- [ ] Admin with toggle OFF sees a portal visually identical to a member's (plus normal pre-Chronos admin panel).
- [ ] Toggle ON reveals all Chronos sections; state survives refresh; toggling OFF hides everything again.
- [ ] A member session can never see or activate the toggle, including by setting the localStorage key manually (gate is `isAdmin && chronosMode`, checked against the authed role).
- [ ] Direct navigation to a Chronos route with toggle off redirects away.

---

## TASK B — Depop member wallet (store credit)

Give every active member a wallet they can pre-fund and spend at portal checkout. Behaviour: member tops up via Stripe → balance is credit → at checkout, if credit covers the cart, they pay from credit with no Stripe payment; once the cart exceeds their balance, they fall back to normal Stripe Checkout.

### B1. Eligibility & flags
- Remove/adjust the "Shopify pathway only" feature flag on wallet UI and `wallet-topup`. Wallet is available to **all active members**.
- Keep `wallets` and `wallet_transactions` schema as-is (integer cents, AUD, append-only ledger, cached balance updated in the same DB transaction as every ledger insert). If a member has no wallet row, lazily create one (service-role) on first wallet-page visit or first top-up.

### B2. Member Wallet page (new portal route `/wallet`)
- Balance (large, formatted AUD), full transaction ledger (type, amount, linked order where applicable, date), and top-up UI: preset amounts ($50 / $100 / $250) plus custom amount (min $10), calling the existing `wallet-topup` edge function → Stripe Checkout → webhook credits ledger.
- Low-balance threshold display/edit if already supported by schema (`low_balance_threshold_cents`); otherwise skip — do not add auto-top-up in this task.
- Mobile-first layout, dark/gold styling, custom SVG icons in the existing art style (reuse/extend the icon set; never emojis).

### B3. Checkout integration
In the existing portal cart/checkout flow (the screen that currently leads to `create-checkout-session`):

- Fetch the member's wallet balance when the checkout screen mounts.
- If `balance_cents >= cart_total_cents`: show a "Pay with wallet credit — $X.XX balance" option alongside the normal card payment. Selecting it calls the new `wallet-pay-order` edge function (B4). On success, route the member to the same order-confirmation experience as a Stripe payment.
- If `balance_cents < cart_total_cents`: wallet option is shown disabled with the balance and a "Top up" link to `/wallet`; the Stripe path proceeds exactly as today. **Do not modify `create-checkout-session`'s Stripe logic.**

### B4. New edge function: `wallet-pay-order`
Service-role only. Input: order ID(s) / cart payload matching however `create-checkout-session` currently receives the cart (mirror its contract so the frontend diff is small). Inside **one Postgres transaction**:

1. Lock the wallet row (`SELECT ... FOR UPDATE`).
2. Recompute the order total server-side from `products` prices — never trust a client-supplied total.
3. Verify the order is in `pending_payment` and has no prior debit; verify `balance_cents >= total`.
4. Insert a `wallet_transactions` row: `type = 'debit'`, negative `amount_cents`, `order_id` set, `reason = 'portal order payment'`.
5. Update `wallets.balance_cents` (cached aggregate) in the same transaction.
6. Set the order status to `paid` — the exact same status transition the Stripe webhook produces, so every downstream process (dispatch/fulfilment, notifications, admin views) fires identically with zero special-casing.

Idempotency and safety:
- Add a partial unique index on `wallet_transactions (order_id) WHERE type = 'debit'` (or equivalent guard) so an order can never be debited twice, even under concurrent double-submits.
- If any step fails, the whole transaction rolls back — no ledger row without a status change, no status change without a ledger row.
- On insufficient funds return a clean 4xx the frontend maps to the disabled state; never partially debit.

### B5. Refunds
- Wallet-paid orders that are cancelled/refunded (via the existing admin exception/refund action) credit the wallet by default: `type = 'refund'`, positive amount, referencing the order, in one transaction with the balance update. Wire this into the existing admin refund action; Stripe-refund path remains for card-paid orders and account closures.

### B6. RLS
- Members: `SELECT` only on their own `wallets` and `wallet_transactions` rows. Verify by test that **no client role can INSERT/UPDATE/DELETE** on either table under any policy. All writes go through service-role functions.

Acceptance:
- [ ] Top-up via Stripe reflects in balance within seconds of webhook; ledger row references the payment intent.
- [ ] Member with sufficient balance pays an order fully from wallet; order reaches `paid` and flows downstream identically to a Stripe-paid order; ledger and cached balance agree.
- [ ] Member with insufficient balance sees the disabled wallet option and completes the unchanged Stripe flow.
- [ ] Concurrent double-submit of `wallet-pay-order` for the same order produces exactly one debit (unique-guard test).
- [ ] Ledger sum equals cached balance under a simulated concurrent debit + top-up test.
- [ ] RLS test proves members cannot write wallet tables through any client path.
- [ ] Admin refund of a wallet-paid order credits the wallet in one ledgered transaction.

---

## Out of scope for this task

- Auto-top-up / saved payment methods.
- Partial wallet + card split payments.
- Any change to Shopify integration, CJ dispatch logic, or `create-checkout-session` internals.
- Cleaning up the 2026-07-17 duplicate `pending_payment` rows (separate task).
- Any Depop API/scraping (none exists — never attempt).

## Delivery

Work migration-first: schema/index changes as Supabase migrations, then edge functions, then frontend. Provide the full file diffs, the migration SQL, the `wallet-pay-order` function complete and production-ready (no placeholders), and a short manual test script covering every acceptance checkbox. Flag anything you discover in the existing wallet code that contradicts the assumptions above before building on it.
