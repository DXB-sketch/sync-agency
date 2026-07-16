-- Applied to chronos-dev (moatcohllmhgabanxlqr) 2026-07-16 via Supabase MCP.
-- Schema-drift fix, part 2/2.
--
-- chronos-dev was created by replaying only 3 tracked migrations while production has
-- accumulated untracked drift (dashboard/SQL-editor changes never captured as migration
-- files, plus the one tracked 20260709 migration which was applied directly to
-- production but never to this branch). This migration brings chronos-dev to real
-- parity with production:
--   * 4 tables that exist in production but were never in supabase/migrations/:
--     pool_products, product_catalog, support_tickets, support_messages
--   * column drift on existing tables (products, order_items, pathway_nodes, profiles)
--   * functions/triggers those tables and the 20260709 migration depend on
--   * RLS policies on pre-existing tables that in production gate on has_active_access()
--     but on chronos-dev still reflected an older, more permissive version
-- All DDL/RLS/function bodies below were read verbatim from production
-- (whuqfxdzopyucebtnbkx) via information_schema / pg_policies / pg_proc / pg_indexes /
-- pg_constraint / pg_trigger (read-only queries only). Every write targets chronos-dev.
--
-- Out of scope (found but not touched, flagged for separate follow-up):
--   * public.cj_catalogue_match / public.cj_freight_check (Phase 0 scratch tables,
--     RLS disabled) do not exist in production at all, so are not part of this parity
--     fix; leaving them as-is per house rule "touch only what you must."
--   * production's `ensure_rls` event trigger (public.rls_auto_enable) auto-enables RLS
--     on every future CREATE TABLE in the whole database. It does not exist on
--     chronos-dev. Not recreated here: it's an unrelated platform safety-net, not
--     something any of these tables or Chronos depends on, and every table below (and
--     every Phase 1 table) enables RLS explicitly in its own migration anyway.

-- ============================================================================
-- 1. Column drift on existing tables
-- ============================================================================

alter table public.profiles
  alter column tier set default 'free'::tier;

alter table public.products
  add column if not exists is_bonus       boolean not null default false,
  add column if not exists image_urls     text[],
  add column if not exists listing_price  numeric,
  add column if not exists discount_price numeric;

alter table public.order_items
  add column if not exists product_name text;

alter table public.pathway_nodes
  add column if not exists gx integer not null default 0,
  add column if not exists gy integer not null default 0;

-- ============================================================================
-- 2. Missing tables (verbatim from production DDL)
-- ============================================================================

create table public.pool_products (
  id                   uuid primary key default gen_random_uuid(),
  tier                 tier not null,
  name                 text not null,
  description          text,
  image_url            text,
  price                numeric not null,
  released             boolean not null default false,
  assigned_member_id   uuid references public.profiles(id),
  assigned_product_id  uuid references public.products(id) on delete set null,
  assigned_at          timestamptz,
  created_by           uuid references public.profiles(id),
  created_at           timestamptz not null default now(),
  image_urls           text[],
  listing_price        numeric,
  discount_price       numeric
);

create table public.product_catalog (
  id                uuid primary key default gen_random_uuid(),
  key               text not null,
  price             numeric not null,
  name              text not null,
  stripe_product_id text,
  stripe_price_id   text,
  created_at        timestamptz not null default now(),
  unique (key, price)
);

create table public.support_tickets (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.profiles(id) on delete cascade,
  subject    text not null,
  status     text not null default 'open' check (status in ('open','answered','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_messages (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_tickets_member_idx on public.support_tickets (member_id);
create index if not exists support_messages_ticket_idx on public.support_messages (ticket_id, created_at);
create index if not exists purchases_email_idx on public.purchases (lower(email));
create index if not exists purchases_linked_member_idx on public.purchases (linked_member_id);

-- ============================================================================
-- 3. Functions (verbatim from production, security definer set search_path = public)
-- ============================================================================

create or replace function public.has_active_access()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and subscription_active
  );
$function$;

create or replace function public.tier_product_limit(t tier)
 returns integer
 language sql
 immutable
as $function$
  select case t when 'free' then 6 when 'pro' then 9 when 'elite' then 12 when 'vip' then 15 end;
$function$;

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

    insert into products (member_id, name, description, image_url, image_urls, price, listing_price, discount_price, created_by, is_bonus)
    values (target, pool.name, pool.description, pool.image_url, pool.image_urls, pool.price, pool.listing_price, pool.discount_price, pool.created_by, false)
    returning id into new_product;

    update pool_products
       set assigned_member_id = target, assigned_product_id = new_product, assigned_at = now()
     where id = pool.id;
    assigned := assigned || new_product;
  end loop;
  return assigned;
end; $function$;

create or replace function public.admin_distribute_pool(p_tier tier)
 returns uuid[]
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  update pool_products set released = true
   where tier = p_tier and assigned_member_id is null and not released;
  return public.distribute_pool_products(p_tier);
end; $function$;

create or replace function public.admin_set_member_tier(p_member_id uuid, p_tier tier, p_billing billing_type, p_price_paid integer, p_active boolean)
 returns void
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;

  update public.profiles
     set tier = p_tier,
         billing_type = p_billing,
         tier_price_paid = p_price_paid,
         subscription_active = p_active
   where id = p_member_id
     and role = 'member';

  update public.purchases pu
     set linked_member_id = p_member_id
    from public.profiles pr
   where pr.id = p_member_id
     and pu.linked_member_id is null
     and lower(pu.email) = lower(pr.email);
end;
$function$;

create or replace function public.claim_product_catalog(p_key text, p_price numeric, p_name text)
 returns table(id uuid, stripe_product_id text, stripe_price_id text, claimed boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_id uuid;
  v_stripe_product_id text;
  v_stripe_price_id text;
begin
  insert into product_catalog (key, price, name)
  values (p_key, p_price, p_name)
  on conflict (key, price) do nothing
  returning product_catalog.id into v_id;

  if v_id is not null then
    return query select v_id, null::text, null::text, true;
  else
    select pc.id, pc.stripe_product_id, pc.stripe_price_id
      into v_id, v_stripe_product_id, v_stripe_price_id
      from product_catalog pc
     where pc.key = p_key and pc.price = p_price;
    return query select v_id, v_stripe_product_id, v_stripe_price_id, false;
  end if;
end;
$function$;

create or replace function public.touch_ticket_on_message()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update support_tickets
     set updated_at = now(),
         status = case when is_admin() then 'answered' else 'open' end
   where id = new.ticket_id and status <> 'closed';
  return new;
end $function$;

create or replace function public.handle_slot_opened()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  if new.tier is not null and new.subscription_active
     and (old.tier is distinct from new.tier
          or (not old.subscription_active and new.subscription_active)) then
    perform public.distribute_pool_products(new.tier);
  end if;
  return new;
end; $function$;

-- ============================================================================
-- 4. Triggers
-- ============================================================================

drop trigger if exists on_profile_slot_opened on public.profiles;
create trigger on_profile_slot_opened
  after update of tier, subscription_active on public.profiles
  for each row execute function public.handle_slot_opened();

drop trigger if exists support_message_touch on public.support_messages;
create trigger support_message_touch
  after insert on public.support_messages
  for each row execute function public.touch_ticket_on_message();

-- ============================================================================
-- 5. RLS on the 4 new tables (verbatim from production's pg_policies)
-- ============================================================================

alter table public.pool_products     enable row level security;
alter table public.product_catalog   enable row level security;   -- no policies = service-role only, matches prod
alter table public.support_tickets   enable row level security;
alter table public.support_messages  enable row level security;

create policy pool_admin_all on public.pool_products
  for all to public using (is_admin()) with check (is_admin());

create policy tickets_admin_all on public.support_tickets
  for all to public using (is_admin()) with check (is_admin());
create policy tickets_member_insert on public.support_tickets
  for insert to public with check (member_id = auth.uid() and has_active_access());
create policy tickets_select_own_or_admin on public.support_tickets
  for select to public using ((member_id = auth.uid() and has_active_access()) or is_admin());

create policy msgs_insert_own_or_admin on public.support_messages
  for insert to public with check (
    sender_id = auth.uid() and (is_admin() or exists (
      select 1 from support_tickets t
       where t.id = support_messages.ticket_id and t.member_id = auth.uid()
         and t.status <> 'closed' and has_active_access()
    ))
  );
create policy msgs_select_own_or_admin on public.support_messages
  for select to public using (
    is_admin() or exists (
      select 1 from support_tickets t
       where t.id = support_messages.ticket_id and t.member_id = auth.uid() and has_active_access()
    )
  );

-- ============================================================================
-- 6. RLS parity fix on pre-existing tables (production gates member access on
--    has_active_access(); chronos-dev still had the pre-has_active_access() version)
-- ============================================================================

drop policy if exists achievements_read on public.achievements;
create policy achievements_read on public.achievements
  for select to public using (auth.role() = 'authenticated' and (has_active_access() or is_admin()));

drop policy if exists mach_member_insert_proof on public.member_achievements;
create policy mach_member_insert_proof on public.member_achievements
  for insert to public with check (
    member_id = auth.uid() and has_active_access()
    and status = any (array['not_started'::achievement_status, 'proof_submitted'::achievement_status])
  );

drop policy if exists mach_member_update_proof on public.member_achievements;
create policy mach_member_update_proof on public.member_achievements
  for update to public
  using (
    member_id = auth.uid() and has_active_access()
    and status = any (array['not_started'::achievement_status, 'rejected'::achievement_status, 'proof_submitted'::achievement_status])
  )
  with check (
    member_id = auth.uid() and has_active_access()
    and status = any (array['not_started'::achievement_status, 'proof_submitted'::achievement_status])
    and verified_by is null and verified_at is null
  );

drop policy if exists mach_select_own_or_admin on public.member_achievements;
create policy mach_select_own_or_admin on public.member_achievements
  for select to public using ((member_id = auth.uid() and has_active_access()) or is_admin());

drop policy if exists progress_member_insert on public.member_pathway_progress;
create policy progress_member_insert on public.member_pathway_progress
  for insert to public with check (member_id = auth.uid() and has_active_access());

drop policy if exists progress_member_update on public.member_pathway_progress;
create policy progress_member_update on public.member_pathway_progress
  for update to public
  using (member_id = auth.uid() and has_active_access())
  with check (member_id = auth.uid() and has_active_access());

drop policy if exists progress_select_own_or_admin on public.member_pathway_progress;
create policy progress_select_own_or_admin on public.member_pathway_progress
  for select to public using ((member_id = auth.uid() and has_active_access()) or is_admin());

drop policy if exists order_items_member_insert_draft on public.order_items;
create policy order_items_member_insert_draft on public.order_items
  for insert to public with check (
    has_active_access() and exists (
      select 1 from orders o
       where o.id = order_items.order_id and o.member_id = auth.uid() and o.status = 'pending_payment'::order_status
    )
  );

drop policy if exists order_items_select_own_or_admin on public.order_items;
create policy order_items_select_own_or_admin on public.order_items
  for select to public using (
    is_admin() or (has_active_access() and exists (
      select 1 from orders o where o.id = order_items.order_id and o.member_id = auth.uid()
    ))
  );

drop policy if exists orders_member_insert_draft on public.orders;
create policy orders_member_insert_draft on public.orders
  for insert to public with check (
    member_id = auth.uid() and status = 'pending_payment'::order_status and has_active_access()
  );

drop policy if exists orders_select_own_or_admin on public.orders;
create policy orders_select_own_or_admin on public.orders
  for select to public using ((member_id = auth.uid() and has_active_access()) or is_admin());

drop policy if exists pathway_nodes_read on public.pathway_nodes;
create policy pathway_nodes_read on public.pathway_nodes
  for select to public using (auth.role() = 'authenticated' and (has_active_access() or is_admin()));

drop policy if exists products_select_own_or_admin on public.products;
create policy products_select_own_or_admin on public.products
  for select to public using ((member_id = auth.uid() and has_active_access()) or is_admin());
