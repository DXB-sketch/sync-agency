-- Sync Plus: $43.99/month portal subscription for members who already own a course.
-- Perks: 10% off every portal purchase (stock orders + course upgrades), +1 product slot,
-- and entry into a monthly $500 wallet-credit draw.
--
-- State is mirrored from Stripe by stripe-webhook (service role) only. Members can't write
-- these columns: authenticated only holds UPDATE on profiles.full_name / last_login.
alter table public.profiles
  add column plus_status text,
  add column plus_subscription_id text unique,
  add column plus_current_period_end timestamptz,
  add column plus_cancel_at_period_end boolean not null default false;

create or replace function public.is_plus_active(p_status text)
returns boolean
language sql
immutable
as $$
  select coalesce(p_status in ('active', 'trialing'), false);
$$;

-- Course tier slots plus the Sync Plus bonus slot.
create or replace function public.member_product_limit(p_tier public.tier, p_plus_status text)
returns integer
language sql
immutable
as $$
  select public.tier_product_limit(p_tier) + case when public.is_plus_active(p_plus_status) then 1 else 0 end;
$$;

-- Same as before, but each member's cap includes their Sync Plus slot.
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
       and (p.tier <> 'free' or p.grandfathered_free)
       and (select count(*) from products pr
             where pr.member_id = p.id and pr.active and not pr.is_bonus)
           < member_product_limit(p_tier, p.plus_status)
     order by (select count(*) from products pr
                where pr.member_id = p.id and pr.active and not pr.is_bonus)::numeric
              / member_product_limit(p_tier, p.plus_status),
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

-- Also fill the new slot when a member's Sync Plus turns on.
create or replace function public.handle_slot_opened()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if new.tier is not null and new.subscription_active
     and (old.tier is distinct from new.tier
          or (not old.subscription_active and new.subscription_active)
          or (not public.is_plus_active(old.plus_status) and public.is_plus_active(new.plus_status))) then
    perform public.distribute_pool_products(new.tier);
  end if;
  return new;
end; $function$;

drop trigger on_profile_slot_opened on public.profiles;
create trigger on_profile_slot_opened
  after update of tier, subscription_active, plus_status on public.profiles
  for each row execute function public.handle_slot_opened();

-- Monthly $500 draw: one row per draw, winner credited through wallet_adjust.
create table public.plus_draws (
  id uuid primary key default gen_random_uuid(),
  draw_month date not null unique,
  winner_id uuid not null references public.profiles(id),
  amount_cents integer not null,
  entrants integer not null,
  wallet_transaction_id uuid,
  drawn_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

alter table public.plus_draws enable row level security;

create policy plus_draws_admin_select on public.plus_draws
  for select using (public.is_admin());

-- Admin-only: picks a random active Sync Plus member for the current month (Australia/Brisbane)
-- and credits them $500 of wallet credit. One draw per month (unique draw_month).
create or replace function public.draw_plus_winner()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_month date := date_trunc('month', now() at time zone 'Australia/Brisbane')::date;
  v_winner uuid;
  v_entrants integer;
  v_credit jsonb;
begin
  if not public.is_admin() then
    raise exception 'Admin only';
  end if;
  if exists (select 1 from public.plus_draws where draw_month = v_month) then
    return jsonb_build_object('status', 'already_drawn');
  end if;

  select count(*) into v_entrants from public.profiles
   where role = 'member' and public.is_plus_active(plus_status);
  if v_entrants = 0 then
    return jsonb_build_object('status', 'no_entrants');
  end if;

  select id into v_winner from public.profiles
   where role = 'member' and public.is_plus_active(plus_status)
   order by random() limit 1;

  v_credit := public.wallet_adjust(
    p_member_id => v_winner,
    p_amount_cents => 50000,
    p_type => 'credit',
    p_reason => 'Sync Plus monthly draw winner — ' || to_char(v_month, 'FMMonth YYYY'),
    p_actor => auth.uid(),
    p_order_id => null
  );

  insert into public.plus_draws (draw_month, winner_id, amount_cents, entrants, wallet_transaction_id, drawn_by)
  values (v_month, v_winner, 50000, v_entrants, (v_credit->>'transaction_id')::uuid, auth.uid());

  return jsonb_build_object('status', 'drawn', 'winner_id', v_winner, 'entrants', v_entrants);
end;
$$;

revoke all on function public.draw_plus_winner() from public, anon;
grant execute on function public.draw_plus_winner() to authenticated;
