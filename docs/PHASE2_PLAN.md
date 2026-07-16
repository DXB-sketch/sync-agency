# Phase 2 Implementation Plan — Member Wallet (Shopify members only)

Status: implementation-ready plan. Target environment: Supabase branch `chronos-dev`
(`moatcohllmhgabanxlqr`). Nothing here touches production (`whuqfxdzopyucebtnbkx`).

Sources this plan is derived from (read them before deviating):
- Build plan PART 3 §PHASE 2 and PART 4 (external doc, `PROJECT_CHRONOS_BUILD_PLAN.md`).
- `docs/FOUNDER_DECISIONS_REQUIRED.md` — AUD confirmed; flat shipping bands default; **no real
  emails/notifications without founder go-ahead** (low-balance alert is data + banner only).
- `docs/PHASE1_PLAN.md` — house patterns this plan reuses (self-contained edge functions,
  `is_admin()`, deny-all-write RLS = zero write policies, enum values in their own migration).
- Repo patterns: `supabase/functions/create-checkout-session/index.ts` (kind-branching Checkout
  Session builder), `supabase/functions/stripe-webhook/index.ts` (single Stripe endpoint,
  `metadata.kind` dispatch), `src/portal/CheckoutPage.jsx` / `UpgradePage.jsx` (direct
  `supabase.from()` + `functions.invoke` + `window.location.href = data.url`).

**Non-negotiables (apply without exception):**
1. `wallet_transactions` is **append-only**. Enforced by trigger, not convention.
2. `wallets.balance` (`balance_cents`) is a cached aggregate updated in the **same DB
   transaction** as every ledger insert. All money movement happens inside single Postgres
   functions — the edge functions never do two separate round-trip writes.
3. Wallet tables are **never client-writable under any RLS policy**. Zero
   insert/update/delete policies. All writes via service-role edge functions → RPCs.
4. Wallet is for **Shopify members only**. The Depop Stripe Checkout flow
   (`create-checkout-session` kinds `stock_order`/`upgrade`/`reactivate` and their webhook
   branches) is **not modified**. The only shared-code change in this whole phase is one new
   `kind === "wallet_topup"` branch appended to `stripe-webhook` (§3.2) — a branch no Depop
   flow can ever emit.

---

## 0. Preconditions — verified 2026-07-16, re-verify before applying anything

State of `chronos-dev` as checked while writing this plan (via `list_tables` /
`list_migrations` / `pg_policies` / `pg_enum`):

1. **Phase 1 tables exist** (`suppliers`, `supplier_tokens`, `supplier_products`,
   `order_dispatches`, `fulfilment_exceptions`, `price_sync_log`) plus the 13 parity tables.
   **No `wallets`, `wallet_transactions`, or Shopify (`shopify_stores`/`product_links`) tables
   exist yet.** Phase 3 is being built in parallel — **re-run `list_tables` and
   `list_migrations` immediately before applying §1** and bump this plan's migration
   timestamps to sort after whatever is newest then. Table names in this plan
   (`wallets`, `wallet_transactions`, `wallet_order_holds`) do not overlap Phase 3's
   (`shopify_stores`, `product_links`) — keep it that way.
2. **Admin predicate:** helper `public.is_admin()` exists and is used by every Phase 1 policy.
   Use it verbatim. (`has_active_access()` also exists; see §1.4 for where it is *not* used.)
3. **`orders.status` is enum `public.order_status`** with values
   `pending_payment, paid, sourcing, shipped, delivered, cancelled, dispatching, dispatched,
   exception`. **`awaiting_funds` is missing** — Phase 1 deliberately deferred it to this
   phase. Enum `ADD VALUE` goes in its own migration file applied before the main one
   (Phase 1 precedent).
4. **Member write surface on `orders` (checked, drives a security decision in §2):**
   `orders_member_insert_draft` allows member INSERT only with
   `member_id = auth.uid() AND status = 'pending_payment' AND has_active_access()`; members
   have **no UPDATE policy** on `orders`. But `orders.total_amount` (and `order_items.unit_price`)
   are member-supplied at insert time — therefore **`total_amount` must never be the basis of a
   wallet debit** (§5.1 deviation, `wallet_order_holds`).
5. **Dispatch hand-off:** `public.trigger_dispatch_order()` + the `orders_paid_dispatch`
   trigger (fires on `status → 'paid'`) exist from Phase 1. The wallet's park/resume path
   re-uses it as-is: resume sets `status = 'paid'` and the Phase 1 engine takes over. Verify
   the trigger is present and enabled before task 9:
   `select tgname, tgenabled from pg_trigger where tgname = 'orders_paid_dispatch';`
6. **Edge function state on `chronos-dev`:** only `cj-auth`, `freight-quote`, `cj-search` are
   deployed. **`stripe-webhook` and `create-checkout-session` are NOT deployed to the branch
   yet.** Phase 2 needs `stripe-webhook` (edited per §3.2) and the new `wallet-topup` deployed
   to the branch, with branch function secrets set: `STRIPE_SECRET_KEY` (**Stripe TEST-mode
   key** — never point the branch at live money), `STRIPE_WEBHOOK_SECRET` (from a **new
   test-mode webhook endpoint** registered in the Stripe dashboard pointing at
   `https://moatcohllmhgabanxlqr.supabase.co/functions/v1/stripe-webhook`), and `SITE_URL`.
   The production webhook endpoint/secret is untouched.
7. **Vault:** no new Vault secrets are needed for Phase 2 (Stripe keys are edge-function
   secrets, matching the existing functions). Current Vault holds `cj_api_key`,
   `edge_functions_url`, `internal_trigger_secret` — none used here.
8. **Money units:** all new wallet columns are **integer cents, AUD** (founder-confirmed
   currency). Existing `orders.total_amount` stays numeric AUD dollars and is display-only —
   the wallet never trusts it (see 4 above).

---

## 1. Migration DDL

Two files (Phase 1 precedent: enum `ADD VALUE` cannot share a transaction with its first use):

- `supabase/migrations/20260716110000_chronos_phase2_awaiting_funds_enum.sql`
- `supabase/migrations/20260716110100_chronos_phase2_member_wallet.sql`

Apply via the Supabase MCP `apply_migration` on `chronos-dev` only. If Phase 3 has landed
migrations with later timestamps by execution time, rename both files to sort after them
(keep the `chronos_phase2_` infix so histories stay legible).

### 1.1 Enum migration (own file, first)

```sql
alter type public.order_status add value if not exists 'awaiting_funds';
```

Resulting status machine for wallet-paid orders:
`pending_payment → (debit ok) paid → dispatching → …` with branch
`pending_payment → (insufficient) awaiting_funds → (top-up) paid → …`.
Depop orders never enter `awaiting_funds` (nothing in their flow writes it).

### 1.2 Wallet tables (main migration)

```sql
-- One wallet per member. balance_cents is a CACHED AGGREGATE of wallet_transactions,
-- updated only inside the §2 Postgres functions, always in the same transaction as the
-- ledger insert. Currency fixed to AUD per founder decision (FOUNDER_DECISIONS_REQUIRED §1).
create table public.wallets (
  member_id                   uuid primary key references public.profiles(id) on delete cascade,
  currency                    text not null default 'aud' check (currency = 'aud'),
  balance_cents               integer not null default 0 check (balance_cents >= 0),
  low_balance_threshold_cents integer check (low_balance_threshold_cents > 0),
  low_balance_flagged_at      timestamptz,          -- data-only alert flag, §4 of build plan / §5 here
  auto_topup_enabled          boolean not null default false,  -- P1 feature; columns per Part 4
  auto_topup_amount_cents     integer,                         -- schema; NO code reads them in Phase 2
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Immutable, append-only ledger. Every row references its cause (stripe_ref or order_id).
-- Sign convention enforced by CHECK: money in > 0, debits < 0, adjustments either (never 0).
create table public.wallet_transactions (
  id                  uuid primary key default gen_random_uuid(),
  member_id           uuid not null references public.profiles(id),
  type                text not null check (type in ('topup','debit','credit','adjustment','refund')),
  amount_cents        integer not null check (
                        (type in ('topup','credit','refund') and amount_cents > 0)
                        or (type = 'debit' and amount_cents < 0)
                        or (type = 'adjustment' and amount_cents <> 0)),
  balance_after_cents integer not null,   -- audit/reconciliation aid; see §5.3
  order_id            uuid references public.orders(id),
  stripe_ref          text,               -- Stripe PaymentIntent id (top-ups)
  reason              text,
  created_by          uuid references public.profiles(id),  -- admin actor on adjustments
  created_at          timestamptz not null default now()
);

-- Idempotency backstops (the §2 functions also check explicitly):
-- a Stripe payment can credit at most once; an order can be debited at most once.
create unique index wallet_transactions_stripe_ref_uniq
  on public.wallet_transactions (stripe_ref) where stripe_ref is not null;
create unique index wallet_transactions_order_debit_uniq
  on public.wallet_transactions (order_id) where type = 'debit';
create index wallet_transactions_member_created_idx
  on public.wallet_transactions (member_id, created_at desc);

-- Parked-order charge amounts (see §5.1 for why this table exists and is NOT in Part 4's
-- summary): orders.total_amount is member-writable at insert, so the amount a wallet will be
-- debited must live in a table the client can never write. One row per order awaiting funds;
-- deleted when the debit lands or the order is abandoned/cancelled.
create table public.wallet_order_holds (
  order_id     uuid primary key references public.orders(id) on delete cascade,
  member_id    uuid not null references public.profiles(id),
  amount_cents integer not null check (amount_cents > 0),
  created_at   timestamptz not null default now()
);
```

### 1.3 Append-only enforcement (trigger — binds even service-role and dashboard sessions)

```sql
create or replace function public.wallet_transactions_immutable()
returns trigger language plpgsql
as $$
begin
  raise exception 'wallet_transactions is append-only (money bugs are ledger bugs)';
end; $$;

create trigger wallet_transactions_no_update_delete
  before update or delete on public.wallet_transactions
  for each row execute function public.wallet_transactions_immutable();
```

(RLS already blocks clients; this trigger is what makes "append-only, no exceptions" true for
service-role code paths and humans in the SQL editor too. Corrections are new `adjustment`
rows, never edits.)

### 1.4 RLS

```sql
alter table public.wallets             enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_order_holds  enable row level security;

-- Member reads own; admin reads all (ClientDetailPage wallet card, §4.3).
-- ZERO insert/update/delete policies on all three tables — service role (which bypasses RLS)
-- via the §2 functions is the only write path. This is the whole security model; do not add
-- any write policy "temporarily" during testing.
create policy wallets_select_own_or_admin on public.wallets
  for select to authenticated using (member_id = auth.uid() or is_admin());

create policy wallet_transactions_select_own_or_admin on public.wallet_transactions
  for select to authenticated using (member_id = auth.uid() or is_admin());

create policy wallet_order_holds_select_own_or_admin on public.wallet_order_holds
  for select to authenticated using (member_id = auth.uid() or is_admin());
```

Deliberate choice: member SELECT does **not** require `has_active_access()` (unlike
`orders_select_own_or_admin`) — a member whose subscription lapsed must still be able to see
their own money. Flag-only default; founder can tighten later.

---

## 2. The atomic ledger pattern — Postgres functions (single transaction, single round trip)

All balance mutations are `security definer` Postgres functions called by edge functions via
their **service-role** client's `.rpc(...)`. Each function body is one implicit transaction:
row lock → idempotency check → ledger insert → cached-balance update → (flag/status
side-effects) → return. The edge function makes exactly **one** DB call per money movement.
A crash anywhere inside rolls back everything — ledger and balance can never diverge.

Concurrency model: every function takes `select … from wallets where member_id = … for update`
before touching money, serialising all mutations per member. Lock ordering is **wallet first,
then order** in every function that touches both — consistent ordering, no deadlocks. The
partial unique indexes (§1.2) are the backstop if two callers race past an idempotency check:
the second insert fails, its transaction rolls back whole, the caller retries and gets the
idempotent "duplicate"/"already_debited" answer.

Include all of §2 in the main migration file, after §1.4.

### 2.1 `debit_wallet_for_order` — the stable interface Phase 3 will call

**Contract for Phase 3 (do not change without updating this doc):**
`public.debit_wallet_for_order(p_order_id uuid, p_amount_cents integer default null) returns jsonb`

- Caller (Phase 3's `shopify-webhook`, service role) creates the order + items itself with
  the member price it computed (product cost + shipping band + Sync margin), then calls this
  with that amount in **integer AUD cents**. The function never reads
  `orders.total_amount` (member-writable → untrusted).
- Success: ledger debit + balance decrement + `orders.status = 'paid'` — which fires the
  Phase 1 `orders_paid_dispatch` trigger, so dispatch needs no further wiring.
- Insufficient funds: records the charge in `wallet_order_holds`, sets
  `orders.status = 'awaiting_funds'`, returns `insufficient_funds`. Nothing else for the
  caller to do — resume is automatic on any future credit (§2.2/§2.3).
- `p_amount_cents = null` is the internal resume path: amount is read from the hold row.
- Idempotent on `order_id`: a second call for an already-debited order returns
  `already_debited` and moves no money (this is what makes Phase 3's duplicate-webhook
  acceptance criterion hold on the wallet side).
- Returns `jsonb`:
  `{status: 'debited'|'insufficient_funds'|'already_debited'|'order_not_found'|'invalid_status'|'no_amount', balance_cents?, required_cents?, transaction_id?, order_status?}`.

```sql
create or replace function public.debit_wallet_for_order(
  p_order_id uuid, p_amount_cents integer default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_member uuid;
  v_status public.order_status;
  v_amount integer;
  v_balance integer;
  v_new integer;
  v_txn uuid;
begin
  -- Read (no lock yet) to learn the member; lock ordering is wallet -> order.
  select member_id into v_member from public.orders where id = p_order_id;
  if v_member is null then
    return jsonb_build_object('status','order_not_found');
  end if;

  -- Lock the wallet row (if any) FIRST — serialises against every other mutation.
  select balance_cents into v_balance
    from public.wallets where member_id = v_member for update;

  -- Now lock the order and re-read its status under the lock.
  select status into v_status from public.orders where id = p_order_id for update;

  -- Idempotency: one debit per order, ever.
  if exists (select 1 from public.wallet_transactions
              where order_id = p_order_id and type = 'debit') then
    return jsonb_build_object('status','already_debited');
  end if;

  if v_status not in ('pending_payment','awaiting_funds') then
    return jsonb_build_object('status','invalid_status','order_status', v_status::text);
  end if;

  -- Amount: explicit (Phase 3 intake) or from the hold row (resume path).
  v_amount := p_amount_cents;
  if v_amount is null then
    select amount_cents into v_amount
      from public.wallet_order_holds where order_id = p_order_id;
  end if;
  if v_amount is null or v_amount <= 0 then
    return jsonb_build_object('status','no_amount');
  end if;

  -- Insufficient (or no wallet row at all): park the order, record the trusted amount.
  if v_balance is null or v_balance < v_amount then
    insert into public.wallet_order_holds (order_id, member_id, amount_cents)
    values (p_order_id, v_member, v_amount)
    on conflict (order_id) do update set amount_cents = excluded.amount_cents;
    update public.orders set status = 'awaiting_funds' where id = p_order_id;
    return jsonb_build_object('status','insufficient_funds',
      'balance_cents', coalesce(v_balance, 0), 'required_cents', v_amount);
  end if;

  -- Money moves: ledger insert + cached balance update, SAME transaction, always together.
  v_new := v_balance - v_amount;

  insert into public.wallet_transactions
    (member_id, type, amount_cents, balance_after_cents, order_id, reason)
  values (v_member, 'debit', -v_amount, v_new, p_order_id, 'order debit')
  returning id into v_txn;

  update public.wallets
     set balance_cents = v_new,
         updated_at = now(),
         low_balance_flagged_at = case
           when low_balance_threshold_cents is not null
                and v_new < low_balance_threshold_cents
             then coalesce(low_balance_flagged_at, now())
           else null
         end
   where member_id = v_member;

  delete from public.wallet_order_holds where order_id = p_order_id;
  update public.orders set status = 'paid' where id = p_order_id;  -- fires orders_paid_dispatch

  return jsonb_build_object('status','debited','transaction_id', v_txn,
                            'balance_cents', v_new);
end; $$;
```

### 2.2 `resume_awaiting_funds_orders` — internal helper, called after every credit

Oldest-first FIFO over the member's holds; skips (does not stop at) orders the new balance
can't cover — a member topping up $50 with a $200 order and a $30 order parked gets the $30
one dispatched. Deterministic and simple; logged as a ratifiable default in
`FOUNDER_DECISIONS_REQUIRED.md`. Also garbage-collects holds whose orders were cancelled.

```sql
create or replace function public.resume_awaiting_funds_orders(p_member_id uuid)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  h record;
  res jsonb;
  resumed integer := 0;
begin
  -- Stale holds: order left awaiting_funds by some other path (admin cancel etc.)
  delete from public.wallet_order_holds h2
   using public.orders o
   where h2.member_id = p_member_id and o.id = h2.order_id
     and o.status <> 'awaiting_funds';

  for h in
    select w.order_id
      from public.wallet_order_holds w
      join public.orders o on o.id = w.order_id
     where w.member_id = p_member_id and o.status = 'awaiting_funds'
     order by w.created_at
  loop
    res := public.debit_wallet_for_order(h.order_id, null);
    if res->>'status' = 'debited' then resumed := resumed + 1; end if;
  end loop;
  return resumed;
end; $$;
```

(Caller already holds the wallet lock in the same transaction; the nested `for update` in
`debit_wallet_for_order` re-acquires a lock this transaction owns — fine.)

### 2.3 `wallet_topup_credit` — webhook-confirmed credit (idempotent on Stripe ref)

```sql
create or replace function public.wallet_topup_credit(
  p_member_id uuid, p_amount_cents integer, p_stripe_ref text)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_balance integer;
  v_new integer;
  v_txn uuid;
  v_resumed integer := 0;
begin
  if p_member_id is null or p_amount_cents is null or p_amount_cents <= 0 then
    return jsonb_build_object('status','bad_request');
  end if;

  -- Idempotency: Stripe redelivers webhooks; one credit per PaymentIntent.
  if p_stripe_ref is not null and exists (
      select 1 from public.wallet_transactions where stripe_ref = p_stripe_ref) then
    return jsonb_build_object('status','duplicate');
  end if;

  -- Lazy wallet creation, then lock.
  insert into public.wallets (member_id) values (p_member_id)
  on conflict (member_id) do nothing;

  select balance_cents into v_balance
    from public.wallets where member_id = p_member_id for update;

  v_new := v_balance + p_amount_cents;

  insert into public.wallet_transactions
    (member_id, type, amount_cents, balance_after_cents, stripe_ref, reason)
  values (p_member_id, 'topup', p_amount_cents, v_new, p_stripe_ref, 'stripe top-up')
  returning id into v_txn;

  update public.wallets
     set balance_cents = v_new,
         updated_at = now(),
         low_balance_flagged_at = case
           when low_balance_threshold_cents is not null
                and v_new < low_balance_threshold_cents
             then coalesce(low_balance_flagged_at, now())
           else null
         end
   where member_id = p_member_id;

  v_resumed := public.resume_awaiting_funds_orders(p_member_id);

  return jsonb_build_object('status','credited','transaction_id', v_txn,
    'balance_cents', (select balance_cents from public.wallets where member_id = p_member_id),
    'orders_resumed', v_resumed);
exception
  when unique_violation then
    -- Two concurrent deliveries of the same stripe_ref: loser lands here after rollback.
    return jsonb_build_object('status','duplicate');
end; $$;
```

(Note the final `balance_cents` is re-read: resume may have debited parked orders inside the
same transaction.)

### 2.4 `wallet_adjust` — admin manual credit / refund-to-wallet / adjustment (build plan §2.4)

```sql
create or replace function public.wallet_adjust(
  p_member_id uuid, p_amount_cents integer, p_type text,
  p_reason text, p_actor uuid, p_order_id uuid default null)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_balance integer;
  v_new integer;
  v_txn uuid;
  v_resumed integer := 0;
begin
  if p_type not in ('credit','adjustment','refund') then
    return jsonb_build_object('status','bad_type');
  end if;
  if p_amount_cents is null or p_amount_cents = 0
     or (p_type in ('credit','refund') and p_amount_cents <= 0) then
    return jsonb_build_object('status','bad_amount');
  end if;
  if coalesce(trim(p_reason), '') = '' then
    return jsonb_build_object('status','reason_required');  -- ledgered, reasoned, audit-logged
  end if;

  insert into public.wallets (member_id) values (p_member_id)
  on conflict (member_id) do nothing;

  select balance_cents into v_balance
    from public.wallets where member_id = p_member_id for update;

  v_new := v_balance + p_amount_cents;   -- adjustments may be negative
  if v_new < 0 then
    return jsonb_build_object('status','would_go_negative','balance_cents', v_balance);
  end if;

  insert into public.wallet_transactions
    (member_id, type, amount_cents, balance_after_cents, order_id, reason, created_by)
  values (p_member_id, p_type, p_amount_cents, v_new, p_order_id, trim(p_reason), p_actor)
  returning id into v_txn;

  update public.wallets
     set balance_cents = v_new,
         updated_at = now(),
         low_balance_flagged_at = case
           when low_balance_threshold_cents is not null
                and v_new < low_balance_threshold_cents
             then coalesce(low_balance_flagged_at, now())
           else null
         end
   where member_id = p_member_id;

  if p_amount_cents > 0 then
    v_resumed := public.resume_awaiting_funds_orders(p_member_id);
  end if;

  return jsonb_build_object('status','adjusted','transaction_id', v_txn,
    'balance_cents', (select balance_cents from public.wallets where member_id = p_member_id),
    'orders_resumed', v_resumed);
end; $$;
```

### 2.5 Grants — RPCs are service-role-only (mirror `get_secret` precedent)

```sql
revoke all on function public.debit_wallet_for_order(uuid, integer)            from public, anon, authenticated;
revoke all on function public.resume_awaiting_funds_orders(uuid)               from public, anon, authenticated;
revoke all on function public.wallet_topup_credit(uuid, integer, text)         from public, anon, authenticated;
revoke all on function public.wallet_adjust(uuid, integer, text, text, uuid, uuid) from public, anon, authenticated;

grant execute on function public.debit_wallet_for_order(uuid, integer)            to service_role;
grant execute on function public.resume_awaiting_funds_orders(uuid)               to service_role;
grant execute on function public.wallet_topup_credit(uuid, integer, text)         to service_role;
grant execute on function public.wallet_adjust(uuid, integer, text, text, uuid, uuid) to service_role;
```

(These are `security definer`, so the explicit revoke is load-bearing: a client that could
execute them would move money. Verify after migration: calling any of them with a member JWT
via PostgREST `/rpc/...` must return a permission error — task 5.)

### 2.6 Reconciliation invariant (the acceptance-test query, not a schema object)

At any moment, for every member:

```sql
select w.member_id, w.balance_cents, coalesce(sum(t.amount_cents), 0) as ledger_sum
  from public.wallets w
  left join public.wallet_transactions t on t.member_id = w.member_id
 group by w.member_id, w.balance_cents
having w.balance_cents <> coalesce(sum(t.amount_cents), 0);
```

**Must return zero rows, always** — including mid-concurrency-drill (task 6) and after every
other task. Any row is a stop-the-line bug.

---

## 3. Edge functions

House style (mandatory, copy from existing functions): self-contained
`supabase/functions/<name>/index.ts`, no `_shared` imports, duplicated CORS + `json()`
helpers exactly as `create-checkout-session` does; user-scoped client from the
`Authorization` header for identity, service-role client for privileged work. Update
`supabase/functions/_shared/notes.md` when done.

### 3.1 Session creation: NEW function `wallet-topup` — recommendation and rationale

Two candidate shapes existed; this plan picks **(a) webhook: extend the existing
`stripe-webhook` with a new `kind`, (b) session creation: a NEW self-contained `wallet-topup`
function** (not a 4th `kind` inside `create-checkout-session`).

- **Webhook side — no real choice.** Stripe delivers `checkout.session.completed` to the
  registered endpoint(s); the existing `stripe-webhook` is the single endpoint for the whole
  business and already dispatches on `session.metadata.kind`
  (`stock_order`/`upgrade`/`reactivate`/fallthrough-course-purchase). A second webhook
  function would need its own endpoint registration + signing secret and would *also* receive
  every event, forcing both functions to filter each other's kinds — strictly worse. So:
  one new `kind === "wallet_topup"` branch in `handleCheckoutCompleted`, following the exact
  existing pattern (§3.2).
- **Session-creation side — new function wins.** Extending `create-checkout-session` would
  match its kind-branching pattern, but that function is the Depop members' payment path and
  this project's rules say don't touch it; a new self-contained function keeps the diff
  surface on Depop-critical code at zero, matches the build plan's own function inventory
  (which names `wallet-topup`), and costs ~nothing under the house one-folder-per-function
  style. The scaffolding (auth, profile fetch, Stripe client, CORS/json helpers) is copied
  from `create-checkout-session`, not imported.

### 3.2 `stripe-webhook` — surgical edit (the ONLY shared-code change in Phase 2)

In `handleCheckoutCompleted`, insert one branch after the `reactivate` block and before the
course-purchase fallthrough (same shape as the existing kind blocks):

```ts
// ── Wallet top-up (Shopify members) — credit is ledgered atomically by the RPC ──
if (kind === "wallet_topup" && session.metadata?.member_id) {
  const { data, error } = await supabase.rpc("wallet_topup_credit", {
    p_member_id: session.metadata.member_id,
    p_amount_cents: session.amount_total ?? Number(session.metadata.amount_cents),
    p_stripe_ref:
      typeof session.payment_intent === "string" ? session.payment_intent : session.id,
  });
  if (error) throw error; // -> 500 -> Stripe redelivers -> RPC answers 'duplicate' (idempotent)
  return;
}
```

Notes:
- `session.amount_total` (authoritative, set by Stripe) is preferred over the metadata echo.
- `stripe_ref` = the PaymentIntent id — the ledger row's required reference to its cause
  (acceptance criterion 1) and the idempotency key for redelivery.
- No other line of the function changes. The Depop `stock_order`/`upgrade`/`reactivate`
  branches and the course fallthrough are byte-identical before/after — verify with a diff.

### 3.3 `wallet-topup` — member-facing wallet actions

- **Trigger:** HTTP POST from the portal Wallet page (member JWT). Normal `verify_jwt` deploy.
- **Auth/gating (in order):**
  1. User JWT → `auth.getUser()`; 401 if absent (as `create-checkout-session`).
  2. Service-role read of `profiles`; 403 if `!profile.subscription_active`
     (same gate as `stock_order`; ratifiable default).
  3. **Shopify-member feature flag:** Phase 4 will introduce the pathway concept
     (`member_pathways`) — the real gate will be "member has the Shopify pathway". Until
     then: a hardcoded `WALLET_MEMBER_IDS: string[]` allowlist constant at the top of the
     function (beta/test member UUIDs; empty by default), mirrored in `src/lib/walletFlag.js`
     (§4.1). Not on the allowlist → 403 `{ error: "Wallet not enabled for this account" }`.
     Mark both constants with `// PHASE 4: replace with member_pathways check`. Do not build
     anything fancier — the flag point is noted, not solved, per plan.
- **Request** (JSON body, `action` switch — precedent: `cj-search`):
  - `{ action?: "create_session", amount_cents: number }` (default action)
    Validation: integer; either one of the presets `[2500, 5000, 10000, 25000]` or a custom
    amount with `1000 <= amount_cents <= 100000` ($10–$1,000; presets $25/$50/$100/$250 —
    ratifiable defaults, log in `FOUNDER_DECISIONS_REQUIRED.md`). Reject otherwise (400).
    Then `stripe.checkout.sessions.create`:
    ```ts
    {
      mode: "payment",
      line_items: [{
        price_data: {
          currency: "aud",
          product_data: { name: "Sync wallet top-up" },
          unit_amount: amount_cents,
        },
        quantity: 1,
      }],
      customer_email: profile.email ?? undefined,
      success_url: `${SITE_URL}/portal/wallet?topup=1`,
      cancel_url: `${SITE_URL}/portal/wallet`,
      metadata: { kind: "wallet_topup", member_id: user.id, amount_cents: String(amount_cents) },
    }
    ```
    Response `{ url: session.url }` — client redirects, exactly like `UpgradePage`.
    **No DB write here** — the wallet is only ever credited by the webhook→RPC path; an
    abandoned checkout leaves zero rows anywhere.
  - `{ action: "set_threshold", threshold_cents: number | null }`
    Why here: `wallets` is never client-writable (non-negotiable 3), so even this non-money
    preference needs a service-role path. Validate `null` or `1 <= threshold_cents <= 10_000_00`;
    service-role upsert of the member's `wallets` row setting `low_balance_threshold_cents`,
    then recompute the flag in the same statement (`low_balance_flagged_at = case when new
    threshold is not null and balance_cents < threshold then coalesce(old, now()) else null end`).
    This is a preference write, not money — a direct service-role `update` (not an RPC) is
    acceptable; it touches no `balance_cents` or ledger. Response: the updated
    `{ balance_cents, low_balance_threshold_cents, low_balance_flagged_at }`.
- **Secrets:** `STRIPE_SECRET_KEY`, `SITE_URL` (both already conventions).

### 3.4 `wallet-adjust` — admin manual credit / refund-to-wallet

- **Trigger:** HTTP POST from admin `ClientDetailPage` (user JWT). Normal `verify_jwt` deploy.
- **Auth:** user JWT → profile → `profile.role !== 'admin'` → 403 (same as
  `create-stripe-product`).
- **Request:** `{ member_id: uuid, amount_cents: number, type: "credit"|"adjustment"|"refund",
  reason: string, order_id?: uuid }`.
- **Logic:** validate presence; single call
  `serviceClient.rpc("wallet_adjust", { p_member_id, p_amount_cents, p_type, p_reason,
  p_actor: user.id, p_order_id: order_id ?? null })`; pass the RPC's jsonb straight through.
- This is also the future hook for Phase 1's Exception Queue "resolve as wallet refund" path
  for Shopify orders (build plan §2.4 refund policy). Do **not** wire ExceptionQueuePage to it
  in Phase 2 — Shopify orders don't exist yet; note it in the function's header comment.

### 3.5 What is deliberately NOT built in Phase 2

- **Auto-top-up** (saved payment method, off-session PaymentIntents): P1 per build plan
  ("ship after core wallet proves stable"). Schema columns exist (Part 4 fidelity), zero code.
- **Emails of any kind** (low-balance, awaiting-funds, top-up receipts beyond Stripe's own):
  gated by the founder go-ahead list in `FOUNDER_DECISIONS_REQUIRED.md`. The data layer (§5)
  is ready for a later notifier.
- **Any Stripe-refund-to-card flow** for wallet balances (account closures): build plan
  mentions it exists as policy; v1 handles it manually in the Stripe dashboard + a
  `wallet_adjust` negative adjustment with reason. Note in admin UI copy.

---

## 4. Portal & admin UI plan

Existing patterns only: direct `supabase.from()` / `functions.invoke` inline in components,
no hooks layer, portal CSS classes (`portal-page`, `dash-card`, `order-card`, `btn-gold`,
`portal-banner-ok`, `auth-input`/`auth-label`).

### 4.1 Feature flag — `src/lib/walletFlag.js` (new, tiny)

```js
// PHASE 4: replace the allowlist with a member_pathways lookup (Shopify pathway active).
export const WALLET_MEMBER_IDS = []; // chronos-dev beta member UUIDs
export function walletEnabled(profile) {
  return !!profile && (WALLET_MEMBER_IDS.includes(profile.id) || profile.role === "admin");
}
```

Admins always see it (they need to test it); members only via allowlist. Keep the UUID list
in sync with the constant in `wallet-topup` (§3.3) — two copies is the house's
no-shared-imports cost, note it in both files.

### 4.2 `src/portal/WalletPage.jsx` — route `/portal/wallet`

Register in `src/App.jsx` inside the existing `/portal` route block (sibling of
`checkout` etc.). Nav: in `PortalLayout.jsx`, the desktop `NAV_LINKS` array is module-level —
append the Wallet link at render time instead:
`const navLinks = walletEnabled(profile) ? [...NAV_LINKS, { to: "/portal/wallet", label: "Wallet", icon: "wallet" }] : NAV_LINKS;`
(mobile: add a Wallet row to `MorePage.jsx` under the same flag, and add `"/portal/wallet"`
to the More tab's `also` array — no new bottom tab). If `walletEnabled` is false and the
route is hit directly, render a simple "Wallet isn't enabled for your account" empty state —
don't add a new guard component.

Page sections (top to bottom), all data via three parallel queries on mount:
`supabase.from("wallets").select("*").maybeSingle()`,
`supabase.from("wallet_transactions").select("*").order("created_at",{ascending:false}).limit(50)`,
`supabase.from("wallet_order_holds").select("*, orders(id, created_at, status)")` —
RLS scopes all three to the member automatically.

1. **Balance card:** `$(balance_cents / 100).toFixed(2)` AUD (missing wallet row renders as
   `$0.00` — wallets are created lazily on first credit). `?topup=1` in the URL → show the
   `portal-banner-ok` "Top-up received — your balance will update within a few seconds."
   (webhook race: also re-fetch once after 3s when the param is present).
   If `low_balance_flagged_at` is set → amber banner "Balance below your alert threshold."
2. **Awaiting funds** (only when holds exist): red-tinted card per hold — order date, amount
   needed (`amount_cents`), shortfall vs current balance, copy: "Top up to release this order
   automatically." No buttons — resume is automatic.
3. **Top up:** preset buttons ($25/$50/$100/$250) + custom amount input (validated
   $10–$1,000), one `btn-gold` "Top up" →
   `supabase.functions.invoke("wallet-topup", { body: { amount_cents } })` →
   `window.location.href = data.url` (identical shape to `UpgradePage.jsx`).
4. **Low-balance threshold:** current value + input + save →
   `invoke("wallet-topup", { body: { action: "set_threshold", threshold_cents } })`, with
   "Alerts are shown here in the portal; email alerts are coming later." (honest copy per the
   founder email gate).
5. **Ledger:** table of the 50 most recent transactions — date, type badge, signed amount
   (green +$X.XX / red −$X.XX), reason, and when `order_id` is set a short link/label
   "Order #id-prefix". Empty state: "No wallet activity yet."

Statuses: **no changes to `CheckoutPage.jsx`** — `awaiting_funds` can only occur on
wallet-debited (future Shopify) orders, which Depop members' order list never contains.
Phase 3's unified orders view owns that label. (If a stray `awaiting_funds` order were ever
rendered there today it shows an undefined label — accepted, unreachable in practice.)

### 4.3 Admin: wallet card in `src/admin/ClientDetailPage.jsx` (no new page)

- New "Wallet" card in the existing detail layout, rendered for every member (admins read all
  wallets via §1.4 policies): balance, threshold, flag state, last 10 transactions
  (member-scoped query with `.eq("member_id", id)`), and open holds.
- **Adjust form:** amount (dollars input, converted to cents), type select
  (`credit` / `adjustment` / `refund`), required reason text, optional order id →
  `supabase.functions.invoke("wallet-adjust", { body: ... })` → reload card. Show the RPC's
  error statuses verbatim (`would_go_negative`, `reason_required`, …).
- UI copy note on the card: "Balance refunds to card are manual (Stripe dashboard) + a
  negative adjustment here."

---

## 5. Deliberate deviations & defaults (read before executing)

### 5.1 `wallet_order_holds` — addition beyond Part 4's schema summary (security-mandated)
Part 4 has no home for "how much to debit a parked order when funds arrive."
`orders.total_amount` cannot be it: members insert their own order rows
(`orders_member_insert_draft`) and set `total_amount` freely — in the existing Depop flow
that column is display-only (Stripe prices come from `products.stripe_price_id` server-side),
but a wallet debit based on it would let a member under-price their own dispatch. The charge
amount must therefore live where clients can never write: a dedicated, zero-write-policy
table keyed by order. It also gives the Wallet page its "this order needs $X" data. This is
the same class of deviation as Phase 1's §4.1 (cost data kept off member-writable/readable
surfaces) — do not "simplify" it away onto `orders`.

### 5.2 `type` is text + CHECK, not a Postgres enum (Part 4 says enum)
House precedent: every Phase 1 table used text + CHECK for new columns; enums are only used
where they pre-existed (`order_status`). Avoids the ADD-VALUE-needs-own-migration tax forever.

### 5.3 Extra ledger columns: `balance_after_cents`, `created_by`
Not in Part 4's summary. `balance_after_cents` makes reconciliation drift *locatable* (the
first row whose running sum disagrees) and gives the admin/member ledger views a running
balance for free; `created_by` is the "audit-logged" half of build plan §2.4's admin
adjustments. Both are inert data columns; neither adds a write path.

### 5.4 Low-balance alert = data + portal banner only
`low_balance_threshold_cents` (member-set, nullable) + `low_balance_flagged_at` (maintained
inside every balance-mutating function, in-transaction). No email is sent anywhere — that
whole capability sits behind the founder go-ahead checklist. The build plan's suggested
default threshold ("2× average order value") is not computable before Shopify order history
exists; default is **null (no alert until the member sets one)** — log as ratifiable.
A future notifier consumes `low_balance_flagged_at is not null` rows; nothing else needed now.

### 5.5 Resume policy: FIFO with skip
Oldest hold first; holds the balance can't cover are skipped, not blocking (§2.2). Ratifiable.

### 5.6 `auto_topup_*` columns shipped dark
Part 4 lists them; Phase 2 code never reads them (auto-top-up is P1). If the founder prefers
a leaner table, dropping two columns later is trivial — but adding them now keeps the schema
matching the ratified Part 4 summary.

### 5.7 Enum value `awaiting_funds` added now, used only by wallet paths
Phase 1 explicitly deferred it here. `OrdersQueuePage.jsx` (admin) will render it as a raw
badge without special styling — acceptable for chronos-dev; Phase 3's admin/order work owns
proper admin presentation. Add nothing to Depop member UI (§4.2 last note).

### 5.8 Defaults adopted (ratifiable, non-blocking — log all in FOUNDER_DECISIONS_REQUIRED.md)
- Top-up presets $25/$50/$100/$250; custom $10–$1,000 per transaction.
- Top-up requires `subscription_active` (same gate as stock orders).
- Members keep wallet read access after subscription lapse (§1.4).
- Wallet beta allowlist mechanism until Phase 4 pathways exist (§3.3/§4.1).
- Card-refund of wallet balance: manual dashboard + negative adjustment (§3.5).

---

## 6. Task breakdown (dependency order — execute top to bottom)

| # | Task | Done when |
|---|------|-----------|
| 1 | Re-run §0 checks on `chronos-dev`: `list_tables` (no `wallets`/`wallet_transactions`/`wallet_order_holds`; note any Phase 3 tables that appeared), `list_migrations` (pick timestamps sorting last), `orders_paid_dispatch` trigger enabled, `is_admin()` present | All answers recorded in a scratch note; migration filenames fixed |
| 2 | Stripe branch plumbing: confirm/set **test-mode** `STRIPE_SECRET_KEY` + `SITE_URL` on `chronos-dev` function secrets; register a test-mode webhook endpoint in the Stripe dashboard pointing at the branch `stripe-webhook` URL (events: `checkout.session.completed` at minimum); set its signing secret as branch `STRIPE_WEBHOOK_SECRET` | Secrets present on the branch; production webhook endpoint untouched |
| 3 | Apply §1.1 enum migration alone | `awaiting_funds` visible in `pg_enum` for `order_status` |
| 4 | Apply main migration (§1.2–1.4, §2.1–2.5) | 3 new tables exist; `pg_policies` shows exactly the three SELECT policies and **zero** write policies; all four functions exist with grants |
| 5 | **RLS + grant verification drill** (acceptance criterion 4): with a member JWT and with the anon key, attempt `insert`/`update`/`delete` on all three tables and PostgREST `/rpc/` calls to all four functions; attempt `update`/`delete` on a `wallet_transactions` row as **service role** | Every client attempt fails (permission/RLS); service-role update/delete fails with the append-only trigger exception; member JWT can select only own rows |
| 6 | RPC unit drill via `execute_sql` (service role): `wallet_topup_credit` twice with the same `p_stripe_ref` (second → `duplicate`, one ledger row); `debit_wallet_for_order` on a funded wallet (→ `debited`, order → `paid`), again (→ `already_debited`), on an underfunded wallet (→ `insufficient_funds`, hold row created, order → `awaiting_funds`); `wallet_adjust` with empty reason (→ `reason_required`) and over-negative amount (→ `would_go_negative`) | Every return status as specified; §2.6 invariant query returns zero rows after each step |
| 7 | **Concurrency drill** (acceptance criterion 2): one member, wallet funded to cover ~half of 20 test orders; fire 20 parallel `debit_wallet_for_order` PostgREST calls (service key, `curl ... &` loop) plus 2 parallel `wallet_topup_credit` calls with distinct refs mid-flight | No errors other than clean statuses; no negative balance ever; §2.6 invariant returns zero rows; exactly one debit ledger row per debited order |
| 8 | Build + deploy `wallet-topup` (§3.3); edit + deploy `stripe-webhook` (§3.2) to the branch; diff `stripe-webhook` to confirm only the new branch was added | Depop branches byte-identical; `wallet-topup` rejects non-allowlisted members (403), bad amounts (400) |
| 9 | **End-to-end top-up** (acceptance criterion 1): allowlisted test member → Wallet top-up → Stripe test checkout (card 4242…) → webhook fires | Balance reflects within seconds of webhook; ledger row `type='topup'` with `stripe_ref` = PaymentIntent id; Stripe "resend webhook" produces `duplicate`, no second row |
| 10 | **Park/resume drill** (acceptance criterion 3): service-role-create a test order (`pending_payment`) + `debit_wallet_for_order(order, amount > balance)` → parks; then top up ≥ shortfall via the real Stripe flow | Order flips `awaiting_funds → paid` with zero admin touches; hold row deleted; `orders_paid_dispatch` fired (order reaches `dispatching`/`exception` per Phase 1 engine); FIFO-skip verified with a second small parked order |
| 11 | Portal UI: `src/lib/walletFlag.js`, `WalletPage.jsx`, route in `App.jsx`, nav gating in `PortalLayout.jsx`, `MorePage.jsx` row (§4.1–4.2) | Non-allowlisted member sees no nav entry and the empty state on direct URL; allowlisted member sees balance, holds, ledger, top-up (full round trip from the page), threshold save; `?topup=1` banner shows |
| 12 | Low-balance flag drill: set threshold above balance via the page → flag set + amber banner; top up past threshold → flag cleared, banner gone | `low_balance_flagged_at` observed set/cleared in DB by the RPCs, never by client writes; no email sent anywhere |
| 13 | Build + deploy `wallet-adjust`; admin wallet card in `ClientDetailPage.jsx` (§4.3) | Admin credits $10 with a reason from the UI → ledger row with `created_by` = admin id; non-admin invoke → 403; a positive admin credit resumes a parked order |
| 14 | Docs: update `supabase/functions/_shared/notes.md` (2 functions, secrets, branch webhook endpoint note) and `FOUNDER_DECISIONS_REQUIRED.md` (§5.8 defaults; add "wallet go-live: register production Stripe webhook + real allowlist/pathway gate" to the go-live checklist) | Both files list every new function/secret/default from this plan |
| 15 | Full acceptance pass against build plan §Phase 2 criteria using artifacts from tasks 5–10; run §2.6 invariant one final time | All 4 criteria demonstrably pass on `chronos-dev`; evidence noted per criterion |

Acceptance-criteria → task mapping: criterion 1 (top-up reflects within seconds, ledger
references payment intent) = task 9; criterion 2 (ledger sum ≡ cached balance under
concurrent debits) = tasks 6–7 (+ §2.6 rechecked in 15); criterion 3 (insufficient-funds
order parks in `awaiting_funds`, member notified, auto-dispatches after top-up with no admin
touch) = task 10 — "notified" is satisfied in v1 by the Wallet page holds banner (task 11),
email being founder-gated; criterion 4 (no client path can mutate wallet values) = task 5.

**Interface handed to Phase 3 (stable):** create order + items with service role at the
computed member price → `rpc('debit_wallet_for_order', { p_order_id, p_amount_cents })` →
act on `status`: `debited` means the order is `paid` and dispatching; `insufficient_funds`
means it is parked and will self-resume; `already_debited` means a duplicate webhook — do
nothing. Nothing else about wallet internals is part of the contract.
