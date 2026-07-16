# Phase 1 Implementation Plan — Fulfilment Engine v2 (CJ Dropshipping)

Status: implementation-ready plan. Target environment: Supabase branch `chronos-dev`
(`moatcohllmhgabanxlqr`). Nothing here touches production (`whuqfxdzopyucebtnbkx`).

Sources this plan is derived from (read them before deviating):
- `docs/PHASE0_CJ_VALIDATION.md` — the only CJ endpoints/fields treated as verified.
- `docs/FOUNDER_DECISIONS_REQUIRED.md` — AUD confirmed; margin rule; Vault status; schema-drift note.
- Build plan PART 3 §PHASE 1 and PART 4 (external doc, `PROJECT_CHRONOS_BUILD_PLAN.md`).
- Repo patterns: `supabase/functions/*` (self-contained, no shared imports, admin check =
  `profiles.role === 'admin'`), `supabase/functions/_shared/notes.md`, `src/admin/*.jsx`
  (direct `supabase.from()` calls, no wrapper hooks, `AdminLayout` nav), the single tracked
  migration `supabase/migrations/20260709_...sql`.

---

## 0. Preconditions — verify before writing any DDL

Assumption baked into this plan: **the parity migration has already run** and `chronos-dev` has
all 13 production tables (profiles, products, pool_products, product_catalog, orders,
order_items, pathway_nodes, member_pathway_progress, achievements, member_achievements,
purchases, support_tickets, support_messages) with their existing RLS policies.

Run these checks on `chronos-dev` and record the answers; three DDL choices below depend on them.

1. **Admin predicate.** The repo references policy names `products_admin_write` and
   `pool_admin_all` (see comment in `supabase/migrations/20260709_...sql`) but their SQL bodies
   are not in the repo. Run:
   ```sql
   select tablename, policyname, cmd, qual, with_check
     from pg_policies where schemaname = 'public' order by tablename;
   select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and proname ilike '%admin%';
   ```
   If an `is_admin()`-style helper function exists, **reuse it verbatim** everywhere this plan
   writes `<ADMIN_CHECK>`. If only inline predicates exist (likely something like
   `exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'admin')`),
   copy that exact inline predicate as `<ADMIN_CHECK>`. Do not invent a new helper if none exists.

2. **`orders.status` representation.** Run:
   ```sql
   select data_type, udt_name from information_schema.columns
    where table_name = 'orders' and column_name = 'status';
   ```
   - If it is a Postgres **enum** (`udt_name` like `order_status`): use the
     `ALTER TYPE ... ADD VALUE` variant in §1.3, and put those statements in **their own
     migration file applied before everything else** (`ADD VALUE` values are not usable in the
     same transaction that adds them).
   - If it is **text + CHECK constraint**: drop and recreate the check with the expanded list
     (variant B in §1.3).

3. **Vault + extensions.**
   ```sql
   select name from vault.secrets;                    -- expect: cj_api_key (already stored in Phase 0)
   select extname from pg_extension;                  -- need: pg_cron, pg_net (create if absent)
   ```
   - `cj_api_key` exists on `chronos-dev` (Phase 0). CJ's `getAccessToken` requires **email +
     API key**; confirm whether a `cj_email` secret also exists — if not, create it (value =
     the CJ account email from the founder / `.env` alongside `CJ_DROPSHIPPING_API`; do not
     echo it into the repo).
   - Two more Vault secrets are needed for the DB→edge-function trigger (§1.6):
     `service_role_key` and `edge_functions_url` (e.g. `https://moatcohllmhgabanxlqr.supabase.co/functions/v1`).
   - **Production go-live note:** all four secrets (`cj_api_key`, `cj_email`,
     `service_role_key`, `edge_functions_url`) must be created in production Vault before any
     of this merges — production has none of them today. Add this to the go-live checklist in
     `FOUNDER_DECISIONS_REQUIRED.md`.

4. **Existing column semantics (do not change):** `products.price` = numeric AUD dollars
   (member's cost from Sync), `products.listing_price` / `discount_price` = numeric AUD dollars.
   All **new** money columns in this plan are **integer cents**, and all CJ-side amounts are
   **USD cents** — conversion to AUD happens only in margin math with a live FX rate, per the
   corrected Phase 0 rule.

---

## 1. Migration DDL

Deliver as `supabase/migrations/<date>_chronos_phase1_fulfilment_engine.sql` (plus the separate
enum migration if check 0.2 says enum). Apply via the Supabase MCP `apply_migration` on
`chronos-dev` only.

### 1.1 New tables

```sql
-- Supplier registry. CJ is a row, not an assumption.
create table public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  api_base_url text not null,
  status       text not null default 'active' check (status in ('active','paused')),
  notes        text,
  created_at   timestamptz not null default now()
);

-- Cached supplier API tokens. Service-role only; zero RLS policies = no client access.
-- Deviation from build plan's "access_token_enc" naming: v1 stores the raw short-lived token
-- guarded by deny-all RLS (the long-lived API key itself stays in Vault). Naming a plaintext
-- column `_enc` would be misleading; revisit pgsodium encryption only if the founder asks.
create table public.supplier_tokens (
  supplier_id        uuid primary key references public.suppliers(id) on delete cascade,
  access_token       text not null,
  expires_at         timestamptz not null,
  refresh_token      text,
  refresh_expires_at timestamptz,
  updated_at         timestamptz not null default now()
);

-- One row per linked CJ variant. This is also where ALL live cost/margin-sensitive data lives
-- (admin-read only) — deliberately NOT on `products`, see deviation note §6.1.
create table public.supplier_products (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         uuid not null references public.suppliers(id),
  external_product_id text not null,          -- CJ pid
  external_variant_id text not null,          -- CJ vid (used by freightCalculate + order create)
  external_sku        text,                   -- e.g. CJWY1617806
  display_name        text,                   -- CJ product name, for admin linker/alerts UI
  image_url           text,
  cost_price_live_cents integer,              -- USD cents (CJ sellPrice * 100)
  freight_live_cents  integer,                -- USD cents, cheapest CN→AU line at last sync
  freight_line        text,                   -- logistic line name for the cached freight figure
  stock_state         text not null default 'unknown'
                      check (stock_state in ('in_stock','out_of_stock','unknown')),
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  unique (supplier_id, external_variant_id)
);

-- One CJ order per buyer address; a multi-address portal order fans out to N rows.
create table public.order_dispatches (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id),
  supplier_id       uuid not null references public.suppliers(id),
  address_key       text not null,            -- md5 of normalised ship_* tuple; idempotency key
  external_order_id text,                     -- CJ order id; null until CJ create succeeds
  shipping_line     text,
  freight_cost_cents integer,                 -- USD cents quoted at dispatch time
  tracking_number   text,
  tracking_carrier  text,
  attempts          integer not null default 0,
  last_error        text,
  dispatched_at     timestamptz,
  delivered_at      timestamptz,
  raw_response      jsonb,
  created_at        timestamptz not null default now(),
  unique (order_id, address_key)              -- retries can never create a duplicate dispatch
);

create table public.fulfilment_exceptions (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders(id),
  dispatch_id uuid references public.order_dispatches(id),
  stage       text not null check (stage in ('dispatch','webhook','price_sync','other')),
  reason      text not null,
  payload     jsonb,
  status      text not null default 'open'
              check (status in ('open','retrying','resolved','refunded')),
  resolved_by uuid references public.profiles(id),
  notes       text,
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.price_sync_log (
  id               uuid primary key default gen_random_uuid(),
  run_at           timestamptz not null default now(),
  fx_rate          numeric,                   -- USD→AUD used this run
  products_checked integer not null default 0,
  price_changes    integer not null default 0,
  margin_flags     integer not null default 0,
  stock_flags      integer not null default 0,
  details          jsonb,                     -- per-product breach list; feeds Margin Alerts page
  errors           jsonb
);
```

### 1.2 ALTERs on existing tables

```sql
-- Catalogue extensions. NOTE the deliberate omission of cost_price_live_cents — see §6.1.
alter table public.products
  add column if not exists category              text,
  add column if not exists supplier_product_id   uuid references public.supplier_products(id),
  add column if not exists margin_floor_pct      numeric not null default 30,
  add column if not exists weight_grams          integer,
  add column if not exists auto_hide_below_floor boolean not null default false,
  add column if not exists hidden_by_sync        boolean not null default false;

-- Pool entries must carry the same fields so distribute_pool_products() doesn't orphan the
-- supplier link on assignment (same precedent as listing_price/discount_price in the
-- 20260709 migration).
alter table public.pool_products
  add column if not exists category            text,
  add column if not exists supplier_product_id uuid references public.supplier_products(id),
  add column if not exists margin_floor_pct    numeric not null default 30,
  add column if not exists weight_grams        integer;

alter table public.orders
  add column if not exists dispatch_id uuid references public.order_dispatches(id);

-- Tracking is member-visible per item today (order_items.tracking_number); each item belongs
-- to exactly one dispatch (its address group), so cj-webhook can fan tracking back correctly.
alter table public.order_items
  add column if not exists dispatch_id uuid references public.order_dispatches(id);
```

`orders.dispatch_id` semantics (build-plan-mandated, but redundant under fan-out): set it only
when the order produced exactly **one** dispatch; leave null otherwise. The authoritative link
is always `order_dispatches.order_id` / `order_items.dispatch_id`.

### 1.3 Order status values

New values: `dispatching`, `dispatched`, `exception`. Keep `sourcing` (legacy rows +
`OrdersQueuePage` still reference it), keep everything else unchanged. Resulting set:
`pending_payment | paid | dispatching | dispatched | sourcing | shipped | delivered | exception | cancelled`.
(Phase 2 will add `awaiting_funds`; do **not** add it now.)

Variant A — enum type (own migration file, before the main one):
```sql
alter type public.order_status add value if not exists 'dispatching';
alter type public.order_status add value if not exists 'dispatched';
alter type public.order_status add value if not exists 'exception';
```
(Substitute the real `udt_name` from check 0.2 for `order_status`.)

Variant B — text + check constraint (inline in main migration):
```sql
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in
  ('pending_payment','paid','dispatching','dispatched','sourcing','shipped','delivered','exception','cancelled'));
```
(Read the real constraint name from `pg_constraint` first; don't guess.)

### 1.4 RLS

Enable RLS on every new table. `<ADMIN_CHECK>` = the exact predicate/helper found in check 0.1.
Service role bypasses RLS, so "service-role writes only" = simply **no** insert/update/delete
policies for that table. Members get zero visibility into any supplier-cost data (see §6.1).

```sql
alter table public.suppliers             enable row level security;
alter table public.supplier_tokens      enable row level security;   -- NO policies at all
alter table public.supplier_products    enable row level security;
alter table public.order_dispatches     enable row level security;
alter table public.fulfilment_exceptions enable row level security;
alter table public.price_sync_log       enable row level security;

create policy suppliers_admin_read on public.suppliers
  for select to authenticated using (<ADMIN_CHECK>);

create policy supplier_products_admin_read on public.supplier_products
  for select to authenticated using (<ADMIN_CHECK>);

-- Admin-only read. Members do NOT get select here: freight_cost_cents / raw_response reveal
-- Sync's supplier economics. Member-visible outcomes (status, tracking) flow into
-- orders.status and order_items.tracking_number, which members already read via existing RLS.
create policy order_dispatches_admin_read on public.order_dispatches
  for select to authenticated using (<ADMIN_CHECK>);

create policy fulfilment_exceptions_admin_read on public.fulfilment_exceptions
  for select to authenticated using (<ADMIN_CHECK>);

-- Admin resolves/annotates exceptions client-side (same pattern as OrdersQueuePage writing
-- orders.status directly). Inserts remain service-role only.
create policy fulfilment_exceptions_admin_update on public.fulfilment_exceptions
  for update to authenticated using (<ADMIN_CHECK>) with check (<ADMIN_CHECK>);

create policy price_sync_log_admin_read on public.price_sync_log
  for select to authenticated using (<ADMIN_CHECK>);
```

Existing-table columns added in §1.2: covered by the tables' existing policies (members keep
read-only SELECT on their own `products` rows; `products_admin_write` / `pool_admin_all` cover
admin writes). The added columns are safe for member eyes (category, weight, a link uuid, and
margin_floor_pct — a policy constant, not a cost). Verify after migration:
`select * from pg_policies where tablename in ('products','pool_products','orders','order_items');`
and confirm nothing new is needed.

### 1.5 Secret-access RPC (edge functions read Vault via service role)

```sql
create or replace function public.get_secret(secret_name text)
returns text language sql security definer set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;
revoke all on function public.get_secret(text) from public, anon, authenticated;
-- service_role retains execute; edge functions call it via their service-role client .rpc()
```

### 1.6 Dispatch trigger (order reaches `paid` → invoke `dispatch-order`)

`stripe-webhook` already flips orders `pending_payment → paid` with a guarded update, so this
trigger fires exactly once per payment. Uses `pg_net` (Database-Webhooks style):

```sql
create extension if not exists pg_net;

create or replace function public.trigger_dispatch_order()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  base_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_functions_url');
  srk      text := (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key');
begin
  perform net.http_post(
    url     := base_url || '/dispatch-order',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || srk),
    body    := jsonb_build_object('order_id', new.id)
  );
  return new;
end; $$;

create trigger orders_paid_dispatch
  after update of status on public.orders
  for each row
  when (new.status = 'paid' and old.status is distinct from new.status)
  execute function public.trigger_dispatch_order();
```

### 1.7 Cron schedules

```sql
create extension if not exists pg_cron;

-- Nightly price/stock sync, 03:00 Australia/Sydney ≈ 17:00 UTC (accept the DST drift; note it).
select cron.schedule('nightly-price-sync', '0 17 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_functions_url') || '/nightly-price-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
               'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body    := '{}'::jsonb)
$$);

-- Safety sweep every 30 min: catches orders stuck in 'dispatching' (function crashed) or
-- sitting in 'paid' with no dispatch rows (missed trigger). Guarantees "never a silently
-- lost order" (Phase 1 acceptance criterion 3).
select cron.schedule('dispatch-sweep', '*/30 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_functions_url') || '/dispatch-order',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
               'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')),
    body    := '{"sweep": true}'::jsonb)
$$);
```

### 1.8 Carry new fields through pool distribution

Recreate `public.distribute_pool_products(p_tier tier)` exactly as it stands in the 20260709
migration, with the `insert into products (...)` column list and `values (...)` extended by
`category, supplier_product_id, margin_floor_pct, weight_grams` (copied from the `pool` record).
No other changes to the function body.

### 1.9 Seed

```sql
insert into public.suppliers (name, api_base_url, notes)
values ('CJ Dropshipping', 'https://developers.cjdropshipping.com/api2.0/v1',
        'Live account, openId 42784 (Phase 0). Confirm base URL against the Phase 0 call scripts before first deploy.');
```

---

## 2. Edge function specs

House style (mandatory, copy from existing functions): each function is **self-contained** in
`supabase/functions/<name>/index.ts`, no `_shared` imports; duplicate the CORS + `json()`
helpers per function exactly as `create-checkout-session` does; create a user-scoped client
from the `Authorization` header when a human calls it, plus a service-role client
(`SUPABASE_SERVICE_ROLE_KEY`) for privileged writes; admin gate =
`profiles.role !== 'admin' → 403` (same as `create-stripe-product`). Update
`supabase/functions/_shared/notes.md` with the new functions and their secrets.

**Internal-caller auth pattern** (trigger/cron/function-to-function): request carries
`Authorization: Bearer <service_role_key>`; the function accepts if the bearer string equals
`Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`, otherwise falls through to the normal
user-JWT + admin-role check. Deploy flags per function are listed below (`verify_jwt` must be
off for anything CJ or pg_net calls, since those bearers aren't user JWTs — use
`supabase functions deploy <name> --no-verify-jwt` and enforce auth in-code as above).

**CJ API facts treated as verified (from `PHASE0_CJ_VALIDATION.md` — do not rename):**
- `POST /api2.0/v1/authentication/getAccessToken` — live-confirmed; token expiry returned
  (current token valid to 2027-01-12); account `openId 42784`.
- `GET /api2.0/v1/product/listV2` — keyword search; supports `categoryId` filtering; returns
  product rows including `productSku` (e.g. `CJWY1617806`) and `sellPrice` (USD).
- `getCategory` — category tree, source of `categoryId` values.
- `freightCalculate` — live-confirmed CN→AU; returns per-logistic-line freight in USD.
- Rate limit: **1 request/second** — every loop below must throttle to ≥1s between CJ calls.
- Margin rule (founder-ratified, non-negotiable):
  `margin = (listing_price_AUD − (cj_sellPrice_USD + cj_freight_USD) × fx_rate) / listing_price_AUD`,
  FX re-pulled per run, never hardcoded.

**CJ details NOT verified in Phase 0 (confirm against CJ docs/dashboard with one live call each
before building the code that depends on them; record findings in this doc):**
- Exact request/response field names for `getAccessToken` (expected `{email, password}` body →
  `data.accessToken`, `data.accessTokenExpiryDate`, `data.refreshToken`), for `listV2` row
  fields beyond `productSku`/`sellPrice` (name/image/pid/vid keys), for `freightCalculate`
  (expected body `{startCountryCode:"CN", endCountryCode, products:[{vid, quantity}]}` →
  `[{logisticName, logisticPrice, logisticAging}]`), and the auth header name
  (expected `CJ-Access-Token`). Phase 0 proved the endpoints work; the executor should lift the
  exact field names from the Phase 0 call scripts / a fresh test call, not from this plan.
- **Order creation endpoint** (expected `POST /api2.0/v1/shopping/order/createOrderV2`) — not
  exercised in Phase 0. Verify shape with one real call before writing `dispatch-order`.
  Creating a CJ order does **not** ship it; CJ orders sit unpaid until paid from CJ account
  balance. **Open question §6.2: whether dispatch must also call CJ's pay-from-balance endpoint
  or ops pays in the CJ dashboard. Do not guess — ask.**
- CJ webhook registration mechanism + payload shape for `cj-webhook`.

### 2.1 `cj-auth` — token cache/refresh (internal)

- **Trigger:** HTTP POST from other edge functions only. Deploy `--no-verify-jwt`; accept only
  the service-role bearer (in-code check above). Never callable by members or admins directly.
- **Request:** `{}` (optionally `{ "force": true }` to bust cache after a 401 downstream).
- **Response:** `{ "accessToken": "<token>" }` or `{ "error": ... }` with 502.
- **Logic:**
  1. Service-role read of `supplier_tokens` for the CJ `suppliers` row (look up by
     `name = 'CJ Dropshipping'`). If a row exists and `expires_at > now() + interval '10 min'`
     and not `force` → return cached token.
  2. Else read `cj_email` + `cj_api_key` via `rpc('get_secret', ...)`, call
     `POST {api_base_url}/authentication/getAccessToken`, upsert `supplier_tokens`
     (access_token, expires_at, refresh_token, refresh_expires_at, updated_at=now()).
  3. CJ throttles `getAccessToken` hard — on 429/failure, return the cached token if one exists
     (even if near expiry) with a logged warning; only error out when there is no token at all.
- **Idempotency/retry:** upsert on `supplier_id` PK; concurrent calls are harmless (last write
  wins, both tokens valid).

### 2.2 `dispatch-order` — paid order → CJ order(s)

- **Triggers:** (a) DB trigger §1.6 with `{order_id}`; (b) cron sweep §1.7 with `{sweep:true}`;
  (c) admin retry from the Exception Queue page with `{order_id, retry:true}` (user JWT,
  admin-gated). Deploy `--no-verify-jwt`, in-code auth: service-role bearer OR admin JWT.
- **Request:** `{ order_id?: uuid, retry?: boolean, sweep?: boolean }`.
- **Response:** `{ dispatched: n, failed: n }` (or per-sweep summary).
- **Logic (single order):**
  1. **Claim (idempotency):** `update orders set status='dispatching' where id=$1 and status in ('paid','exception') returning id`
     (service role; `'exception'` allowed only when `retry:true`). Zero rows → another
     invocation owns it or state is wrong → exit 200 no-op. This plus the
     `unique(order_id, address_key)` constraint makes double-delivery of the trigger harmless.
  2. Load order + `order_items` + their `products` → `supplier_products`. Any item whose
     product has no `supplier_product_id` → exception (stage `dispatch`, reason
     `unlinked_product`), status → `exception`, stop.
  3. **Group items by buyer address:** normalise the ship_* tuple (trim/lowercase
     `ship_name, ship_address1, ship_address2, ship_city, ship_region, ship_postcode,
     ship_country`), `address_key = md5(joined tuple)`. One CJ order per group (Phase 1
     acceptance criterion 1).
  4. Per group, in a loop: skip groups that already have a dispatch row with
     `external_order_id` set (retry resumes partial fan-outs). Insert-or-reuse the
     `order_dispatches` row (`on conflict (order_id, address_key) do nothing`, then select).
  5. Get token from `cj-auth`. Call `freightCalculate` for the group's vids+quantities to the
     group's `ship_country`; choose the **cheapest** returned logistic line; record
     `shipping_line` + `freight_cost_cents` (USD cents).
  6. Call CJ order create (§ verified-details caveat above) with: our `order_dispatches.id` as
     CJ's client order number (**CJ-side dedupe** — CJ rejects a duplicate order number, so even
     a crashed-after-send retry cannot double-order), the group's ship_* fields, the chosen
     logistic line, and `[{vid, quantity}]` per item.
  7. On success: update the dispatch row (`external_order_id`, `dispatched_at=now()`,
     `raw_response`, `attempts`), set `order_items.dispatch_id` for the group's items.
  8. **Retry policy (per group):** on CJ 5xx/network/429 — up to 3 attempts within the
     invocation, backoff sleeps 1s / 5s / 15s, `attempts`/`last_error` updated each time. On a
     401 — one `cj-auth {force:true}` re-auth, then retry without consuming an attempt. On CJ
     4xx validation errors — no retry (it won't self-heal).
  9. After all groups: all succeeded → `orders.status='dispatched'`, and if exactly one
     dispatch row, `orders.dispatch_id = that id`. Any group exhausted → insert
     `fulfilment_exceptions` (stage `dispatch`, reason = CJ error, payload = request+response
     JSON, `dispatch_id` set), `orders.status='exception'`. Admin "notification" in v1 = the
     queue row itself (real emails are gated by the founder go-ahead list in
     `FOUNDER_DECISIONS_REQUIRED.md` — do not send email).
- **Sweep mode:** (a) orders in `dispatching` with `updated`/`created` older than 15 min → force
  an exception row (stage `dispatch`, reason `stuck_dispatching`) + status `exception`;
  (b) orders in `paid` older than 5 min with zero dispatch rows → run the normal dispatch path
  (missed-trigger recovery). Meets the "within 5 minutes" acceptance criterion even if pg_net
  hiccups.

### 2.3 `cj-webhook` — CJ status/tracking ingestion

- **Trigger:** HTTP POST from CJ. Deploy `--no-verify-jwt` (external caller). Register the
  `chronos-dev` function URL in CJ's webhook settings (mechanism per CJ dashboard — see
  unverified list; document what you find).
- **Verification (CJ webhooks carry no HMAC):** treat the payload as an untrusted *hint only*.
  Extract the CJ order id / client order number, look up `order_dispatches` by
  `external_order_id` (or by `id` = client order number). No match → 200, log, discard. On
  match, **re-query CJ's order-detail endpoint** for that order and use *that* response as the
  authoritative status/tracking source. A forged webhook can therefore only cause a harmless
  re-read of real CJ state. This also makes redelivery idempotent by construction.
- **Writes (service role):**
  - tracking present → dispatch row: `tracking_number`, `tracking_carrier`; fan out
    `order_items.tracking_number` to items with that `dispatch_id`; when **every** dispatch of
    the order has tracking → `orders.status='shipped'` (guarded
    `where status in ('dispatched','shipped')` — never regress `delivered`).
  - delivered status → `order_dispatches.delivered_at`; all dispatches delivered →
    `orders.status='delivered'`.
  - All updates are absolute-value sets keyed on the dispatch row → redelivery writes the same
    values again (idempotent, acceptance-criteria requirement).
- **Member notification email:** NOT in v1 — gated by founder go-ahead. Tracking appears in the
  member's existing portal order view via `order_items.tracking_number` (acceptance criterion 2
  is satisfied by the existing UI, zero portal changes).
- **Response:** always 200 with `{received:true}` on handled/ignored payloads (CJ re-delivers on
  non-200; only return 5xx on our own DB failure so redelivery retries the write).

### 2.4 `freight-quote` — shipping options lookup (admin tooling)

- **Trigger:** HTTP POST from admin pages (user JWT, admin-gated) or internal (service bearer).
  Normal `verify_jwt` deploy is fine (callers always have real JWTs); keep the in-code
  admin/service check anyway, matching house style.
- **Request:** `{ vid: string, quantity: number, country_code: string }` (vid =
  `supplier_products.external_variant_id`; accepts `supplier_product_id` as an alternative and
  resolves it).
- **Response:** `{ options: [{ logisticName, logisticPrice, logisticAging }] }` passed through
  from CJ `freightCalculate` (`startCountryCode:"CN"`), sorted cheapest first, prices in USD.
- **Notes:** stateless, no DB writes. `dispatch-order` and `nightly-price-sync` embed their own
  freight call (self-contained-function house rule) — this function exists for the admin linker
  and margin tooling, and later Phase 3 pricing checks.

### 2.5 `nightly-price-sync` — cost/stock refresh + margin flags

- **Trigger:** cron §1.7 (service bearer). Deploy `--no-verify-jwt`, service/admin check
  in-code (admin may trigger a manual run from the Margin Alerts page).
- **Request:** `{}`. **Response:** the summary row it wrote.
- **Logic:**
  1. Fetch FX USD→AUD once per run from a live source and record it in `price_sync_log.fx_rate`.
     Source not yet founder-ratified: default to a free daily-rate API (e.g.
     `open.er-api.com/v6/latest/USD`) with fallback to the most recent `price_sync_log.fx_rate`
     on failure; log the choice in `FOUNDER_DECISIONS_REQUIRED.md` as a ratifiable default.
  2. Token via `cj-auth`. For each `supplier_products` row (throttle ≥1.1s between CJ calls):
     re-query the CJ product (by `productSku` via `listV2`, or the product-query endpoint if the
     Phase 0 scripts used it — lift whichever was proven) → new `sellPrice` → update
     `cost_price_live_cents`, `stock_state`, `last_synced_at`. Then `freightCalculate` CN→AU for
     the vid → update `freight_live_cents`, `freight_line`. (~2 CJ calls per SKU; at the current
     ~20-SKU catalogue this is ~45s. Flag in code comments that >300 SKUs needs batching.)
  3. For every `products` row (and `pool_products` row) with that `supplier_product_id` and a
     non-null `listing_price`: compute margin with the founder-ratified formula (listing_price
     AUD vs (sellPrice+freight)×fx). Margin < `margin_floor_pct` → add to `details` array
     `{product_id | pool_product_id, name, listing_price, landed_aud, margin_pct, floor}` and
     count in `margin_flags`. (Margin data lives only in this admin-only log row — see §6.1.)
  4. Stock handling: `out_of_stock` → set `products.active=false, hidden_by_sync=true` (member
     catalogues hide inactive products already). Back `in_stock` → re-activate **only** rows
     with `hidden_by_sync=true` (never resurrect admin-hidden products). Count in `stock_flags`.
  5. Margin-floor hide (the acceptance criteria's "if configured"): rows with
     `auto_hide_below_floor=true` that breach → same hide mechanism. Default off; flag-only.
  6. Insert one `price_sync_log` row: counts, `details`, `errors` (per-SKU CJ failures — a
     failing SKU must not abort the run).

### 2.6 `cj-search` — supplier product search/link (admin-only) — **addition, see §6.3**

- **Trigger:** HTTP POST from the admin Products page (user JWT, admin-gated; normal deploy).
- **Request:** one of
  - `{ action:"categories" }` → CJ `getCategory` passthrough (cache in-memory per invocation
    only; no table).
  - `{ action:"search", keyword?: string, category_id?: string, page?: number }` → CJ
    `listV2` with `categoryId` filtering (the exact scoped-search improvement
    `PHASE0_CJ_VALIDATION.md` calls for) → returns rows
    `{ pid, vid, productSku, name, image, sellPrice }` (exact CJ keys lifted at build time).
  - `{ action:"link", product_id?: uuid, pool_product_id?: uuid, pid, vid, productSku, name, image, sell_price_usd }`
    → service-role upsert of `supplier_products` (on `(supplier_id, external_variant_id)`),
    then one `freightCalculate` call to prime `freight_live_cents`, then set
    `supplier_product_id` on the target `products` or `pool_products` row. Returns the
    computed live margin for that row so the admin sees pass/fail vs floor at link time.
- **Why an edge function:** the CJ token must never reach the browser, and `supplier_products`
  writes are service-role-only by design.

---

## 3. Admin panel plan (`src/admin/`, existing pattern: direct `supabase.from()`, no hooks)

Register all new routes in `src/App.jsx` under the existing `/admin` route block, and add nav
entries to `LINKS` in `src/admin/AdminLayout.jsx` (short labels for `TAB_LINKS` where needed).

### 3.1 `ExceptionQueuePage.jsx` — route `/admin/exceptions`, nav "Exceptions"
- Query: `fulfilment_exceptions` with joins
  `orders(*, profiles!orders_member_id_fkey(email), order_items(*, products(name)))` and
  `order_dispatches(*)`; default filter `status in ('open','retrying')`, toggle to show
  resolved/refunded (mirror `OrdersQueuePage`'s `showDone` toggle).
- Card per exception (reuse `order-card` styles): stage, reason, created_at, order context
  (member email, items, addresses), CJ error payload in a collapsible `<pre>`.
- Actions:
  - **Retry** → `supabase.functions.invoke('dispatch-order', { body: { order_id, retry: true } })`,
    then reload. Optimistically set the row to `retrying` first (admin RLS update).
  - **Resolve manually** → update `{status:'resolved', resolved_by: <auth user id>, resolved_at, notes}`
    (direct table update; the admin then advances the order by hand via the existing Orders
    queue if needed).
  - **Mark refunded** → update `{status:'refunded', ...}` with a required note. v1 performs the
    actual Stripe refund manually in the Stripe dashboard (no refund edge function exists and
    Phase 1 doesn't mandate one); the wallet-credit path is Phase 2. State this in the UI copy.

### 3.2 `MarginAlertsPage.jsx` — route `/admin/margins`, nav "Margins"
- Query: latest `price_sync_log` row (`order('run_at', {ascending:false}).limit(1)`); render
  `run_at`, `fx_rate`, counts; table from `details`: product name, listing price (AUD), landed
  cost (AUD), live margin %, floor % — red rows below floor. Second section: `supplier_products`
  where `stock_state='out_of_stock'`.
- Actions: "Run sync now" → `supabase.functions.invoke('nightly-price-sync', { body: {} })`
  (admin JWT passes the function's in-code gate). Per-row link to the product in
  `ProductsAdminPage` to fix price/link.

### 3.3 Supplier product linker — extend `ProductsAdminPage.jsx` (no new page)
- Each master-catalogue row (both pool and assigned products views) shows a link badge:
  linked (supplier SKU + stock state, via a `supplier_products` join) or "Not linked".
- "Link supplier" button → modal: category dropdown (from `cj-search {action:"categories"}`),
  keyword input → `cj-search {action:"search", ...}` → result cards (image, name, sku,
  sellPrice USD). Selecting one calls `cj-search {action:"link", ...}`; show the returned live
  margin vs floor before closing (green/red). Unlink = admin sets `supplier_product_id` to null
  (direct update under existing admin write policy).
- This tool is how the 12 unresolved Phase 0 searches get their scoped, category-filtered pass
  (`PHASE0_CJ_VALIDATION.md` §"The other 12").

### 3.4 Category management — extend existing pages, no new table
- Fixed constant `CATEGORIES = ['apparel','accessories','home','beauty','electronics','pets','fitness']`
  in a small shared module (e.g. `src/lib/categories.js`) — a table is speculative until
  categories need per-row admin CRUD.
- `ProductsAdminPage.jsx`: category `<select>` on the product create/edit form (writes
  `products.category` / `pool_products.category` under existing admin policies) + a category
  filter over the list.
- `ClientDetailPage.jsx`: category filter in the per-member assignment UI.

### 3.5 Orders queue + portal touch-ups (small, required by new statuses)
- `src/admin/OrdersQueuePage.jsx`: `NEXT_STATUS` currently maps `paid → sourcing`. Keep manual
  advancement as the fallback path, but new statuses must render: add
  `dispatching/dispatched/exception` to the status badge styling and stop offering "Mark
  sourcing" for orders the engine owns (present manual advance only for `sourcing`-path legacy
  orders and `shipped → delivered`).
- Member portal order view (`src/portal/` orders page): add a display-label map so members see
  familiar wording — `dispatching`/`dispatched` render as "sourcing", `exception` renders as
  "processing" (members must never see the word "exception"). Raw status strings elsewhere
  untouched. Add the matching `order-status-*` CSS classes where the existing pattern
  (`order-status-${status}`) demands them.

---

## 4. Deliberate deviations & open items (read before executing)

### 4.1 Supplier cost data is NOT duplicated onto `products` (deviation from the letter of the spec)
The build plan lists `cost_price_live_cents` on both `supplier_products` and `products`. RLS is
row-level, not column-level, and members have SELECT on their own `products` rows — a
`cost_price_live_cents` column there would show every member exactly what Sync pays for the
items they buy (and Supabase's single `authenticated` role makes column-level REVOKE hit admins
too). So: **all live cost, freight, and computed margin data lives only on `supplier_products`
and `price_sync_log` (admin-read tables)**; admin UIs join through `supplier_product_id`.
`margin_floor_pct` stays on `products` per spec (it's a policy knob, not a cost). If the
founder explicitly wants the cached column on `products` anyway, that is a one-line ALTER plus
an accepted-leak note — do not add it silently.

### 4.2 CJ order payment (**BLOCKING question for dispatch go-live, not for building**)
Creating a CJ order does not pay for it; CJ orders ship after payment from CJ account balance.
Phase 0 never exercised order creation or payment. Before `dispatch-order` is considered done:
confirm with the founder/CJ dashboard whether (a) dispatch must call CJ's pay-from-balance
endpoint after create (then add that call + a balance-insufficient exception reason), or
(b) ops pays manually in the CJ dashboard for v1. Log in `FOUNDER_DECISIONS_REQUIRED.md`.

### 4.3 Additions beyond the mandated list (each justified, all small)
- `cj-search` edge function (§2.6): the linker cannot call CJ from the browser.
- `order_items.dispatch_id`, `order_dispatches.address_key/attempts/last_error`,
  `supplier_products.freight_live_cents/display_name/image_url`,
  `products.auto_hide_below_floor/hidden_by_sync`, `price_sync_log.fx_rate/details/errors`:
  each exists to satisfy a specific Phase 1 acceptance criterion (tracking fan-out, retry
  idempotency, margin-with-freight rule, "if configured" hide, alert UI data) — not speculative.
- `pool_products` gains the same catalogue columns + `distribute_pool_products` update
  (precedent: 20260709 migration did exactly this for listing/discount prices).
- `supplier_tokens` stores plaintext under deny-all RLS instead of `_enc` naming (§1.1 comment).

### 4.4 Other defaults adopted (ratifiable, non-blocking)
- FX source: free daily-rate API with last-known-rate fallback (§2.5.1).
- Margin uses `listing_price` (exactly the Phase 0 corrected formula). Whether
  `discount_price` (the price buyers actually pay after the Depop markdown) should be the
  conservative basis instead is a founder question — flag it, default to `listing_price`.
- Shipping line selection at dispatch = cheapest `freightCalculate` option (member-facing flat
  bands are Phase 2 pricing; Phase 1 only spends, doesn't charge).
- Admin/member notification emails: none sent in Phase 1 (founder go-ahead list).

---

## 5. Task breakdown (dependency order — execute top to bottom)

| # | Task | Done when |
|---|------|-----------|
| 1 | Run §0 verification queries on `chronos-dev`; record `<ADMIN_CHECK>`, `orders.status` type, Vault secret inventory in a scratch note (not a committed doc) | All three answers written down; parity of the 13 tables confirmed via `list_tables` |
| 2 | Create missing Vault secrets on `chronos-dev`: `cj_email`, `service_role_key`, `edge_functions_url` | `select name from vault.secrets` shows all four incl. `cj_api_key` |
| 3 | If enum: apply the §1.3 Variant A migration alone | New status values visible in `pg_enum` |
| 4 | Apply the main Phase 1 migration (§1.1–1.2, 1.4–1.9, and §1.3 Variant B if text) | All 6 new tables exist; `pg_policies` shows exactly the policies in §1.4; anon/member test query against `supplier_tokens`/`supplier_products` returns zero rows |
| 5 | Live-verify unproven CJ shapes (§2 caveat list): one `getAccessToken`, one `listV2`, one `freightCalculate`, one order-create against the real API; paste exact field names into the function code comments | Each call's real request/response recorded; order-create test order visible (and cancelled) in CJ dashboard |
| 6 | Build + deploy `cj-auth` (`--no-verify-jwt`) | Invoking with service bearer returns a token; `supplier_tokens` row populated; second call returns cached token without hitting CJ |
| 7 | Build + deploy `freight-quote` | Quote for `CJWY1617806`-linked vid CN→AU returns options; cheapest ≈ the $8.33 USD figure from Phase 0 (sanity, not exact match) |
| 8 | Build + deploy `cj-search`; link 1 real product end-to-end via curl/console | `supplier_products` row created, `products.supplier_product_id` set, returned margin matches hand calculation with the day's FX |
| 9 | Build + deploy `dispatch-order` (`--no-verify-jwt`); resolve §4.2 first | Test order (2 items, 2 addresses) in `paid` → 2 `order_dispatches` rows with distinct `external_order_id`s, items' `dispatch_id` set, order `dispatched` — within 5 min of `paid`, no manual step |
| 10 | Failure drill: point one item at an invalid vid and re-dispatch; also kill mid-run (bad token) and wait for sweep | 3 attempts logged with backoff, then `fulfilment_exceptions` row + order `exception`; stuck-`dispatching` order exceptioned by the 30-min sweep — nothing silently lost |
| 11 | Build + deploy `cj-webhook` (`--no-verify-jwt`); register URL with CJ; simulate delivery + a forged payload + a duplicate delivery | Tracking lands on dispatch + `order_items.tracking_number`, order → `shipped`; forged payload changes nothing; duplicate delivery changes nothing |
| 12 | Build + deploy `nightly-price-sync`; confirm cron rows exist (`select * from cron.job`) | Manual run writes a `price_sync_log` row with `fx_rate` + counts; forcing a linked product's `listing_price` below floor puts it in `details`; forcing `stock_state='out_of_stock'` flips `products.active` false with `hidden_by_sync=true`, and restock flips it back |
| 13 | Admin: `ExceptionQueuePage.jsx` + route + nav | Exception from task 10 renders with full order context; Retry re-dispatches; Resolve writes `resolved_by`/`resolved_at` |
| 14 | Admin: `MarginAlertsPage.jsx` + route + nav | Task 12's forced breach renders red with correct margin %; "Run sync now" works from the page |
| 15 | Admin: linker modal in `ProductsAdminPage.jsx` (+ `cj-search` categories/search wiring) | Admin links a product via category-scoped search in the UI; badge shows SKU + stock; unlink works |
| 16 | Admin: category field/filters in `ProductsAdminPage.jsx` + `ClientDetailPage.jsx`; `src/lib/categories.js` | Category set on a pool product survives `distribute_pool_products` into the member copy; filters narrow both lists |
| 17 | `OrdersQueuePage.jsx` status handling + portal status label map + CSS classes (§3.5) | New statuses render sanely in admin; member portal shows "sourcing" for dispatching/dispatched and never the word "exception" |
| 18 | `_shared/notes.md` updated (new functions, secrets incl. prod Vault TODO); `FOUNDER_DECISIONS_REQUIRED.md` updated (§4.2 question, §4.4 defaults, prod-Vault go-live item) | Both files list every new function/secret/decision from this plan |
| 19 | Full acceptance pass against the Phase 1 criteria (build plan §Phase 1), using tasks 9–12 artifacts | All 5 criteria demonstrably pass on `chronos-dev`; evidence noted per criterion |

Acceptance-criteria → task mapping: criterion 1 (multi-item auto-dispatch ≤5 min, one CJ order
per address, correct line) = task 9; criterion 2 (tracking appears without human action) =
task 11; criterion 3 (kill → retry → exception, never lost) = tasks 10+11; criterion 4
(nightly sync, margin flag, configured hide) = task 12; criterion 5 (a week of zero manual
AliExpress orders) = post-merge production observation, out of `chronos-dev` scope — note it
for the launch checklist.
