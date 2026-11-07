-- Wallet top-up promos: admin-editable popup content + the reward a qualifying top-up earns.
-- Only one promo is "live" at a time: the newest active row whose schedule window covers now().
--
-- reward_type / reward_value:
--   bonus_credit   — reward_value is a flat AUD amount added as wallet credit (e.g. 20 = $20)
--   bonus_percent  — reward_value is a percent of the top-up added as wallet credit (e.g. 10 = 10%)
--   order_discount — reward_value is a percent off the member's next order paid from wallet
create table public.wallet_promos (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  cta_label text not null default 'Top up wallet',
  min_topup_cents integer not null check (min_topup_cents between 1000 and 100000),
  reward_type text not null check (reward_type in ('bonus_credit', 'bonus_percent', 'order_discount')),
  reward_value numeric not null check (
    reward_value > 0 and (reward_type = 'bonus_credit' or reward_value <= 100)
  ),
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wallet_promos enable row level security;

create policy wallet_promos_admin_all on public.wallet_promos
  for all using (public.is_admin()) with check (public.is_admin());

create policy wallet_promos_member_select_live on public.wallet_promos
  for select to authenticated using (
    active
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  );

-- "% off next wallet order" rewards. One row per qualifying top-up (stripe_ref is the
-- top-up's payment ref, so a re-delivered webhook can't grant it twice). order_id is set
-- when the discount is claimed by an order.
create table public.member_order_discounts (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id),
  promo_id uuid references public.wallet_promos(id) on delete set null,
  percent numeric not null check (percent > 0 and percent <= 100),
  stripe_ref text not null unique,
  order_id uuid references public.orders(id),
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);

create index member_order_discounts_member_idx on public.member_order_discounts (member_id)
  where order_id is null;
create unique index member_order_discounts_order_uniq on public.member_order_discounts (order_id)
  where order_id is not null;

alter table public.member_order_discounts enable row level security;

create policy member_order_discounts_select_own_or_admin on public.member_order_discounts
  for select using (member_id = auth.uid() or public.is_admin());

-- Grants a top-up's promo reward. Called by stripe-webhook (service role) right after
-- wallet_topup_credit. Idempotent per top-up via the ':promo' stripe_ref suffix.
create or replace function public.wallet_promo_reward(
  p_member_id uuid,
  p_promo_id uuid,
  p_topup_cents integer,
  p_stripe_ref text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_promo public.wallet_promos;
  v_ref text := p_stripe_ref || ':promo';
  v_bonus integer;
  v_new integer;
begin
  select * into v_promo from public.wallet_promos where id = p_promo_id;
  if v_promo.id is null or p_topup_cents < v_promo.min_topup_cents then
    return jsonb_build_object('status', 'not_eligible');
  end if;

  if v_promo.reward_type = 'order_discount' then
    insert into public.member_order_discounts (member_id, promo_id, percent, stripe_ref)
    values (p_member_id, v_promo.id, v_promo.reward_value, v_ref)
    on conflict (stripe_ref) do nothing;
    return jsonb_build_object('status', 'discount_granted');
  end if;

  if exists (select 1 from public.wallet_transactions where stripe_ref = v_ref) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  v_bonus := case v_promo.reward_type
    when 'bonus_credit' then round(v_promo.reward_value * 100)
    else round(p_topup_cents * v_promo.reward_value / 100)
  end;
  if v_bonus <= 0 then
    return jsonb_build_object('status', 'not_eligible');
  end if;

  insert into public.wallets (member_id) values (p_member_id)
  on conflict (member_id) do nothing;

  select balance_cents + v_bonus into v_new
    from public.wallets where member_id = p_member_id for update;

  insert into public.wallet_transactions
    (member_id, type, amount_cents, balance_after_cents, stripe_ref, reason)
  values (p_member_id, 'credit', v_bonus, v_new, v_ref, 'Promo bonus: ' || v_promo.title);

  update public.wallets
     set balance_cents = v_new,
         updated_at = now(),
         low_balance_flagged_at = case
           when low_balance_threshold_cents is not null and v_new < low_balance_threshold_cents
             then coalesce(low_balance_flagged_at, now())
           else null
         end
   where member_id = p_member_id;

  perform public.resume_awaiting_funds_orders(p_member_id);

  return jsonb_build_object('status', 'credited', 'bonus_cents', v_bonus);
exception
  when unique_violation then
    return jsonb_build_object('status', 'duplicate');
end;
$$;

-- Attaches the member's oldest unused order discount to an order and returns its percent
-- (0 if none). Idempotent per order: a retried payment for the same order gets the same
-- discount back instead of consuming a second one.
create or replace function public.claim_order_discount(p_member_id uuid, p_order_id uuid)
returns numeric
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_percent numeric;
begin
  select percent into v_percent from public.member_order_discounts where order_id = p_order_id;
  if v_percent is not null then
    return v_percent;
  end if;

  update public.member_order_discounts
     set order_id = p_order_id, claimed_at = now()
   where id = (
     select id from public.member_order_discounts
      where member_id = p_member_id and order_id is null
      order by created_at
      limit 1
      for update skip locked
   )
  returning percent into v_percent;

  return coalesce(v_percent, 0);
end;
$$;

revoke all on function public.wallet_promo_reward(uuid, uuid, integer, text) from public, anon, authenticated;
revoke all on function public.claim_order_discount(uuid, uuid) from public, anon, authenticated;

-- At most one promo is switched on at a time; its schedule window decides whether it's live.
create unique index wallet_promos_single_active on public.wallet_promos ((true)) where active;
