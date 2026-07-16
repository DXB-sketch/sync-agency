-- Applied to chronos-dev (moatcohllmhgabanxlqr) 2026-07-16 via Supabase MCP.
-- Project Chronos Phase 1 — Fulfilment Engine v2 (CJ Dropshipping). Part 2/2.
-- Per docs/PHASE1_PLAN.md §1, with two corrections applied (see
-- "## Execution notes" in that doc):
--   (a) no cj_email secret — cj_api_key alone is the whole CJ apiKey body field
--   (b) no service_role_key vault secret — the DB trigger (§1.6) and cron jobs
--       (§1.7) authenticate to edge functions with the internal_trigger_secret
--       vault secret instead (both cj_api_key, internal_trigger_secret and
--       edge_functions_url already existed in chronos-dev's vault).
-- pg_cron / pg_net extensions were created separately (execute_sql, not DDL
-- requiring migration tracking per Supabase MCP convention for extensions).

-- ============================================================================
-- 1.1 New tables
-- ============================================================================

create table public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  api_base_url text not null,
  status       text not null default 'active' check (status in ('active','paused')),
  notes        text,
  created_at   timestamptz not null default now()
);

create table public.supplier_tokens (
  supplier_id        uuid primary key references public.suppliers(id) on delete cascade,
  access_token       text not null,
  expires_at         timestamptz not null,
  refresh_token      text,
  refresh_expires_at timestamptz,
  updated_at         timestamptz not null default now()
);

create table public.supplier_products (
  id                  uuid primary key default gen_random_uuid(),
  supplier_id         uuid not null references public.suppliers(id),
  external_product_id text not null,
  external_variant_id text not null,
  external_sku        text,
  display_name        text,
  image_url           text,
  cost_price_live_cents integer,
  freight_live_cents  integer,
  freight_line        text,
  stock_state         text not null default 'unknown'
                      check (stock_state in ('in_stock','out_of_stock','unknown')),
  last_synced_at      timestamptz,
  created_at          timestamptz not null default now(),
  unique (supplier_id, external_variant_id)
);

create table public.order_dispatches (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid not null references public.orders(id),
  supplier_id       uuid not null references public.suppliers(id),
  address_key       text not null,
  external_order_id text,
  shipping_line     text,
  freight_cost_cents integer,
  tracking_number   text,
  tracking_carrier  text,
  attempts          integer not null default 0,
  last_error        text,
  dispatched_at     timestamptz,
  delivered_at      timestamptz,
  raw_response      jsonb,
  created_at        timestamptz not null default now(),
  unique (order_id, address_key)
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
  fx_rate          numeric,
  products_checked integer not null default 0,
  price_changes    integer not null default 0,
  margin_flags     integer not null default 0,
  stock_flags      integer not null default 0,
  details          jsonb,
  errors           jsonb
);

-- ============================================================================
-- 1.2 ALTERs on existing tables
-- ============================================================================

alter table public.products
  add column if not exists category              text,
  add column if not exists supplier_product_id   uuid references public.supplier_products(id),
  add column if not exists margin_floor_pct      numeric not null default 30,
  add column if not exists weight_grams          integer,
  add column if not exists auto_hide_below_floor boolean not null default false,
  add column if not exists hidden_by_sync        boolean not null default false;

alter table public.pool_products
  add column if not exists category            text,
  add column if not exists supplier_product_id uuid references public.supplier_products(id),
  add column if not exists margin_floor_pct    numeric not null default 30,
  add column if not exists weight_grams        integer;

alter table public.orders
  add column if not exists dispatch_id uuid references public.order_dispatches(id);

alter table public.order_items
  add column if not exists dispatch_id uuid references public.order_dispatches(id);

-- ============================================================================
-- 1.4 RLS
-- ============================================================================

alter table public.suppliers             enable row level security;
alter table public.supplier_tokens      enable row level security;   -- NO policies at all
alter table public.supplier_products    enable row level security;
alter table public.order_dispatches     enable row level security;
alter table public.fulfilment_exceptions enable row level security;
alter table public.price_sync_log       enable row level security;

create policy suppliers_admin_read on public.suppliers
  for select to authenticated using (is_admin());

create policy supplier_products_admin_read on public.supplier_products
  for select to authenticated using (is_admin());

create policy order_dispatches_admin_read on public.order_dispatches
  for select to authenticated using (is_admin());

create policy fulfilment_exceptions_admin_read on public.fulfilment_exceptions
  for select to authenticated using (is_admin());

create policy fulfilment_exceptions_admin_update on public.fulfilment_exceptions
  for update to authenticated using (is_admin()) with check (is_admin());

create policy price_sync_log_admin_read on public.price_sync_log
  for select to authenticated using (is_admin());

-- ============================================================================
-- 1.5 Secret-access RPC (edge functions read Vault via service role)
-- ============================================================================

create or replace function public.get_secret(secret_name text)
returns text language sql security definer set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = secret_name limit 1;
$$;
revoke all on function public.get_secret(text) from public, anon, authenticated;

-- ============================================================================
-- 1.6 Dispatch trigger (order reaches `paid` -> invoke dispatch-order)
-- CORRECTED: uses internal_trigger_secret vault secret instead of
-- service_role_key (no real service_role_key ever touched by this project).
-- ============================================================================

create or replace function public.trigger_dispatch_order()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  base_url text := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_functions_url');
  its      text := (select decrypted_secret from vault.decrypted_secrets where name = 'internal_trigger_secret');
begin
  perform net.http_post(
    url     := base_url || '/dispatch-order',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || its),
    body    := jsonb_build_object('order_id', new.id)
  );
  return new;
end; $$;

drop trigger if exists orders_paid_dispatch on public.orders;
create trigger orders_paid_dispatch
  after update of status on public.orders
  for each row
  when (new.status = 'paid' and old.status is distinct from new.status)
  execute function public.trigger_dispatch_order();

-- ============================================================================
-- 1.7 Cron schedules (CORRECTED: internal_trigger_secret, not service_role_key)
-- ============================================================================

select cron.schedule('nightly-price-sync', '0 17 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_functions_url') || '/nightly-price-sync',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
               'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'internal_trigger_secret')),
    body    := '{}'::jsonb)
$$);

select cron.schedule('dispatch-sweep', '*/30 * * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_functions_url') || '/dispatch-order',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
               'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'internal_trigger_secret')),
    body    := '{"sweep": true}'::jsonb)
$$);

-- ============================================================================
-- 1.8 Carry new fields through pool distribution
-- ============================================================================

create or replace function public.distribute_pool_products(p_tier tier)
 returns uuid[]
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  pool record;
  target uuid;
  new_product uuid;
  assigned uuid[] := '{}';
begin
  for pool in
    select * from pool_products
     where tier = p_tier and released and assigned_member_id is null
     order by created_at
  loop
    select p.id into target
      from profiles p
     where p.role = 'member' and p.tier = p_tier and p.subscription_active
       and (select count(*) from products pr
             where pr.member_id = p.id and pr.active and not pr.is_bonus)
           < tier_product_limit(p_tier)
     order by (select count(*) from products pr
                where pr.member_id = p.id and pr.active and not pr.is_bonus)::numeric
              / tier_product_limit(p_tier),
              random()
     limit 1;
    exit when target is null;

    insert into products (member_id, name, description, image_url, image_urls, price, listing_price, discount_price, created_by, is_bonus, category, supplier_product_id, margin_floor_pct, weight_grams)
    values (target, pool.name, pool.description, pool.image_url, pool.image_urls, pool.price, pool.listing_price, pool.discount_price, pool.created_by, false, pool.category, pool.supplier_product_id, pool.margin_floor_pct, pool.weight_grams)
    returning id into new_product;

    update pool_products
       set assigned_member_id = target, assigned_product_id = new_product, assigned_at = now()
     where id = pool.id;
    assigned := assigned || new_product;
  end loop;
  return assigned;
end; $function$;

-- ============================================================================
-- 1.9 Seed
-- ============================================================================

insert into public.suppliers (name, api_base_url, notes)
values ('CJ Dropshipping', 'https://developers.cjdropshipping.com/api2.0/v1',
        'Live account, openId 42784 (Phase 0). Confirm base URL against the Phase 0 call scripts before first deploy.');
