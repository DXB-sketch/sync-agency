-- Sync Rewards: XP, levels, ranks, crates and reward grants (sync-rewards/SPEC.md).
-- Members read their own rows. Every write goes through the security-definer functions
-- below: the Stripe webhook (award / reverse), and two member RPCs (open a crate, mark
-- the rank-up moment seen). Rules here are mirrored in src/lib/rewards.js.

-- ── State per member ────────────────────────────────────────────────
create table public.member_rewards (
  member_id             uuid        primary key references public.profiles (id) on delete cascade,
  xp_total              integer     not null default 0 check (xp_total >= 0),
  lifetime_credit_cents bigint      not null default 0 check (lifetime_credit_cents >= 0),
  rank                  text        not null default 'bronze'
                          check (rank in ('bronze','silver','gold','platinum','black')),
  -- last rank the member was shown; drives the rank-up moment
  rank_seen             text        not null default 'bronze'
                          check (rank_seen in ('bronze','silver','gold','platinum','black')),
  -- highest level whose rewards have been granted, so a level is only ever paid once
  level_rewarded        integer     not null default 1,
  updated_at            timestamptz not null default now()
);

-- ── Every XP / credit movement. Top-ups are idempotent on the payment ref ──
create table public.rewards_events (
  id             bigserial   primary key,
  member_id      uuid        not null references public.profiles (id) on delete cascade,
  source         text        not null check (source in ('topup','refund','crate','backfill','admin')),
  -- the same ref wallet_topup_credit stores (payment intent), so the two can't drift
  stripe_ref     text        unique,
  xp             integer     not null default 0,
  credit_cents   bigint      not null default 0,
  refunded_cents bigint      not null default 0,  -- top-ups: how much has been reversed so far
  result         jsonb,                           -- top-ups: levels and rank crossed, for the rank-up moment
  created_at     timestamptz not null default now()
);
create index rewards_events_member on public.rewards_events (member_id, created_at desc);

-- ── Crates ─────────────────────────────────────────────────────────
create table public.reward_crates (
  id           uuid        primary key default gen_random_uuid(),
  member_id    uuid        not null references public.profiles (id) on delete cascade,
  crate_type   text        not null check (crate_type in ('silver','gold')),
  source       text        not null default 'level' check (source in ('level','welcome')),
  earned_level integer,                -- null for the welcome crate
  status       text        not null default 'unopened' check (status in ('unopened','opened','void')),
  reward       jsonb,                  -- {key, kind, amount, rarity, label, chance} once opened
  created_at   timestamptz not null default now(),
  opened_at    timestamptz
);
create index reward_crates_member_status on public.reward_crates (member_id, status);
create unique index reward_crates_one_welcome on public.reward_crates (member_id) where source = 'welcome';

-- ── Grants that outlive the moment: credit, product slots, discounts ──
create table public.reward_grants (
  id             uuid        primary key default gen_random_uuid(),
  member_id      uuid        not null references public.profiles (id) on delete cascade,
  kind           text        not null check (kind in ('credit','slot','discount','xp')),
  amount         integer     not null,  -- cents for credit, 1 for a slot, percent for a discount, XP for xp
  level          integer,               -- milestone / crate level, for refund clawback
  source         text        not null check (source in ('milestone','crate','cashback')),
  crate_id       uuid        references public.reward_crates (id) on delete set null,
  stripe_ref     text,                  -- cashback: the top-up it came from
  wallet_txn_id  uuid        references public.wallet_transactions (id),
  discount_id    uuid        references public.member_order_discounts (id) on delete set null,
  expires_at     timestamptz,           -- product slots: activation + 30 days
  clawed_back_at timestamptz,
  created_at     timestamptz not null default now()
);
create index reward_grants_member on public.reward_grants (member_id, kind);

-- ── The one copy of the crate odds. The roll and the odds sheet both read it ──
create table public.crate_odds (
  crate_type text    not null check (crate_type in ('silver','gold')),
  key        text    not null,
  kind       text    not null check (kind in ('credit','discount','slot','xp')),
  amount     integer not null,          -- cents / percent / 1 / XP
  chance     numeric not null check (chance > 0 and chance <= 100),
  rarity     text    not null check (rarity in ('legendary','epic','rare','common')),
  label      text    not null,
  sort       integer not null,
  primary key (crate_type, key)
);

insert into public.crate_odds (crate_type, key, kind, amount, chance, rarity, label, sort) values
  ('silver', 'credit_3000', 'credit',   3000,  3, 'legendary', '$30 wallet credit',         1),
  ('silver', 'credit_1000', 'credit',   1000, 12, 'epic',      '$10 wallet credit',         2),
  ('silver', 'credit_500',  'credit',    500, 20, 'rare',      '$5 wallet credit',          3),
  ('silver', 'discount_5',  'discount',    5, 15, 'rare',      '5% off next stock order',   4),
  ('silver', 'slot',        'slot',        1, 10, 'rare',      '+1 product slot, 30 days',  5),
  ('silver', 'credit_200',  'credit',    200, 20, 'common',    '$2 wallet credit',          6),
  ('silver', 'xp_200',      'xp',        200, 20, 'common',    '+200 bonus XP',             7),
  ('gold',   'credit_5000', 'credit',   5000,  3, 'legendary', '$50 wallet credit',         1),
  ('gold',   'credit_2000', 'credit',   2000, 10, 'epic',      '$20 wallet credit',         2),
  ('gold',   'credit_1000', 'credit',   1000, 20, 'rare',      '$10 wallet credit',         3),
  ('gold',   'discount_10', 'discount',   10, 18, 'rare',      '10% off next stock order',  4),
  ('gold',   'slot',        'slot',        1, 12, 'rare',      '+1 product slot, 30 days',  5),
  ('gold',   'credit_500',  'credit',    500, 17, 'common',    '$5 wallet credit',          6),
  ('gold',   'xp_500',      'xp',        500, 20, 'common',    '+500 bonus XP',             7);

-- ── Read access ────────────────────────────────────────────────────
alter table public.member_rewards enable row level security;
alter table public.rewards_events enable row level security;
alter table public.reward_crates  enable row level security;
alter table public.reward_grants  enable row level security;
alter table public.crate_odds     enable row level security;

create policy member_rewards_select on public.member_rewards for select using (member_id = auth.uid() or public.is_admin());
create policy rewards_events_select on public.rewards_events for select using (member_id = auth.uid() or public.is_admin());
create policy reward_crates_select  on public.reward_crates  for select using (member_id = auth.uid() or public.is_admin());
create policy reward_grants_select  on public.reward_grants  for select using (member_id = auth.uid() or public.is_admin());
create policy crate_odds_select     on public.crate_odds     for select to authenticated using (true);

-- ── Rules (keep in step with src/lib/rewards.js) ────────────────────
create function public.rewards_level(p_xp integer) returns integer
language sql immutable as $$ select p_xp / 1000 + 1 $$;

create function public.rewards_rank(p_credit_cents bigint) returns text
language sql immutable as $$
  select case
    when p_credit_cents >= 1000000 then 'black'
    when p_credit_cents >=  400000 then 'platinum'
    when p_credit_cents >=  150000 then 'gold'
    when p_credit_cents >=   50000 then 'silver'
    else 'bronze' end
$$;

-- Bonus of the largest pack at or below the amount
create function public.rewards_pack_bonus_pct(p_amount_cents bigint) returns integer
language sql immutable as $$
  select case
    when p_amount_cents >= 100000 then 20
    when p_amount_cents >=  50000 then 15
    when p_amount_cents >=  25000 then 10
    when p_amount_cents >=  10000 then 5
    else 0 end
$$;

-- Consecutive weeks (Brisbane time, ending this week or last) with a top-up or a paid
-- stock order. A streak of 3+ weeks earns +5% XP on top-ups.
create function public.rewards_active_week(p_member uuid, p_week date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.wallet_transactions
                  where member_id = p_member and type = 'topup'
                    and created_at >= p_week::timestamp at time zone 'Australia/Brisbane'
                    and created_at < (p_week + 7)::timestamp at time zone 'Australia/Brisbane')
      or exists (select 1 from public.orders
                  where member_id = p_member and status in ('paid','delivered')
                    and created_at >= p_week::timestamp at time zone 'Australia/Brisbane'
                    and created_at < (p_week + 7)::timestamp at time zone 'Australia/Brisbane')
$$;

create function public.rewards_streak_weeks(p_member uuid) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  v_week  date := date_trunc('week', now() at time zone 'Australia/Brisbane')::date;
  v_count integer := 0;
begin
  if not public.rewards_active_week(p_member, v_week) then
    v_week := v_week - 7;  -- this week isn't over yet; a streak can still be alive from last week
  end if;
  while public.rewards_active_week(p_member, v_week) loop
    v_count := v_count + 1;
    v_week := v_week - 7;
  end loop;
  return v_count;
end $$;

-- Credits the wallet through the existing ledger and returns the transaction id.
create function public.rewards_credit_wallet(p_member uuid, p_cents integer, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  r := public.wallet_adjust(p_member, p_cents, 'credit', p_reason, null);
  if r->>'status' <> 'adjusted' then
    raise exception 'rewards_credit_wallet: %', r;
  end if;
  return (r->>'transaction_id')::uuid;
end $$;

-- Takes back up to p_cents of reward credit (never below a zero balance). Returns what it took.
create function public.rewards_clawback_wallet(p_member uuid, p_cents integer, p_reason text) returns integer
language plpgsql security definer set search_path = '' as $$
declare v_take integer;
begin
  select least(p_cents, balance_cents) into v_take from public.wallets where member_id = p_member;
  if coalesce(v_take, 0) <= 0 then return 0; end if;
  perform public.wallet_adjust(p_member, -v_take, 'adjustment', p_reason, null);
  return v_take;
end $$;

-- One crate per level from Silver (crate type follows the rank that level sits in:
-- Silver for 6–15, Gold from 16), plus the milestone extras (SPEC.md § 4).
create function public.rewards_grant_level(p_member uuid, p_level integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_rank text := public.rewards_rank((p_level - 1)::bigint * 10000);
begin
  if v_rank <> 'bronze' then
    insert into public.reward_crates (member_id, crate_type, earned_level)
    values (p_member, case when v_rank = 'silver' then 'silver' else 'gold' end, p_level);
  end if;
  if p_level in (14, 20) then
    insert into public.reward_grants (member_id, kind, amount, level, source, wallet_txn_id)
    values (p_member, 'credit', case p_level when 14 then 500 else 1000 end, p_level, 'milestone',
            public.rewards_credit_wallet(p_member, case p_level when 14 then 500 else 1000 end,
                                         'Sync Rewards: Level ' || p_level || ' reward'));
  elsif p_level = 15 then
    insert into public.reward_grants (member_id, kind, amount, level, source, expires_at)
    values (p_member, 'slot', 1, p_level, 'milestone', now() + interval '30 days');
  end if;
end $$;

-- Adds XP (and optionally lifetime credit) and grants every level crossed that hasn't
-- been paid before. p_grant = false (launch backfill) moves the high-water mark only.
create function public.rewards_apply(p_member uuid, p_xp integer, p_credit_cents bigint, p_grant boolean default true)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  r          public.member_rewards;
  old_level  integer;
  new_level  integer;
  rank_after text;
  lvl        integer;
  crates     integer := 0;
begin
  insert into public.member_rewards (member_id) values (p_member) on conflict (member_id) do nothing;
  select * into r from public.member_rewards where member_id = p_member for update;

  old_level  := public.rewards_level(r.xp_total);
  new_level  := public.rewards_level(r.xp_total + p_xp);
  rank_after := public.rewards_rank(r.lifetime_credit_cents + p_credit_cents);

  if p_grant then
    for lvl in greatest(old_level, r.level_rewarded) + 1 .. new_level loop
      perform public.rewards_grant_level(p_member, lvl);
      if lvl >= 6 then crates := crates + 1; end if;
    end loop;
  end if;

  update public.member_rewards
     set xp_total = r.xp_total + p_xp,
         lifetime_credit_cents = r.lifetime_credit_cents + p_credit_cents,
         rank = rank_after,
         -- backfill: the member is shown their current rank, not a rank-up
         rank_seen = case when p_grant then rank_seen else rank_after end,
         level_rewarded = greatest(level_rewarded, new_level),
         updated_at = now()
   where member_id = p_member;

  return jsonb_build_object(
    'xp_added', p_xp,
    'level_before', old_level, 'level_after', new_level,
    'rank_before', r.rank, 'rank_after', rank_after,
    'crates', crates
  );
end $$;

-- Called by stripe-webhook after wallet_topup_credit. Safe to call twice per payment.
create function public.award_topup_xp(p_member uuid, p_amount_cents bigint, p_stripe_ref text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_streak   integer := public.rewards_streak_weeks(p_member);
  v_pct      integer := public.rewards_pack_bonus_pct(p_amount_cents) + case when v_streak >= 3 then 5 else 0 end;
  v_xp       integer := round(p_amount_cents / 100.0 * 10 * (1 + v_pct / 100.0));
  v_rank     text;
  v_cashback integer;
  v_result   jsonb;
begin
  if p_member is null or p_amount_cents is null or p_amount_cents <= 0 or p_stripe_ref is null then
    return jsonb_build_object('status', 'bad_request');
  end if;
  insert into public.rewards_events (member_id, source, stripe_ref, xp, credit_cents)
  values (p_member, 'topup', p_stripe_ref, v_xp, p_amount_cents)
  on conflict (stripe_ref) do nothing;
  if not found then
    return jsonb_build_object('status', 'duplicate');
  end if;

  -- Platinum and Black earn credit back on top-ups, at the rank held before this one
  select rank into v_rank from public.member_rewards where member_id = p_member;
  v_cashback := round(p_amount_cents * case v_rank when 'black' then 0.05 when 'platinum' then 0.03 else 0 end);
  if v_cashback > 0 then
    insert into public.reward_grants (member_id, kind, amount, source, stripe_ref, wallet_txn_id)
    values (p_member, 'credit', v_cashback, 'cashback', p_stripe_ref,
            public.rewards_credit_wallet(p_member, v_cashback,
              'Sync Rewards: ' || initcap(v_rank) || ' credit back on $' || (p_amount_cents / 100) || ' top-up'));
  end if;

  v_result := public.rewards_apply(p_member, v_xp, p_amount_cents)
              || jsonb_build_object('streak_weeks', v_streak, 'bonus_pct', v_pct, 'cashback_cents', v_cashback);
  update public.rewards_events set result = v_result where stripe_ref = p_stripe_ref;
  return v_result || jsonb_build_object('status', 'awarded');
end $$;

-- Claws back one grant (credit from the wallet, an unused discount, a live slot).
create function public.rewards_clawback_grant(p_grant public.reward_grants, p_cents integer default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_grant.kind = 'credit' then
    perform public.rewards_clawback_wallet(p_grant.member_id, coalesce(p_cents, p_grant.amount), 'Sync Rewards: refund clawback');
  elsif p_grant.kind = 'discount' then
    delete from public.member_order_discounts where id = p_grant.discount_id and order_id is null;
  elsif p_grant.kind = 'slot' then
    update public.reward_grants set expires_at = least(expires_at, now()) where id = p_grant.id;
  end if;
  if p_cents is null then
    update public.reward_grants set clawed_back_at = now() where id = p_grant.id;
  end if;
end $$;

-- Called by stripe-webhook on charge.refunded. p_refunded_total_cents is Stripe's running
-- total, so repeated or partial refund events only reverse what hasn't been reversed yet.
-- Reverses the XP and lifetime credit, voids unopened crates above the new level and claws
-- back what was collected from those levels (wallet credit only down to a zero balance).
create function public.reverse_topup_rewards(p_stripe_ref text, p_refunded_total_cents bigint)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e         public.rewards_events;
  r         public.member_rewards;
  g         public.reward_grants;
  v_delta   bigint;
  v_xp      integer;
  new_level integer;
begin
  select * into e from public.rewards_events where stripe_ref = p_stripe_ref and source in ('topup','backfill') for update;
  if e.id is null then return jsonb_build_object('status', 'not_found'); end if;
  v_delta := least(p_refunded_total_cents, e.credit_cents) - e.refunded_cents;
  if v_delta <= 0 then return jsonb_build_object('status', 'duplicate'); end if;
  v_xp := round(e.xp * v_delta::numeric / e.credit_cents);

  update public.rewards_events set refunded_cents = refunded_cents + v_delta where id = e.id;
  insert into public.rewards_events (member_id, source, xp, credit_cents)
  values (e.member_id, 'refund', -v_xp, -v_delta);

  select * into r from public.member_rewards where member_id = e.member_id for update;
  new_level := public.rewards_level(greatest(r.xp_total - v_xp, 0));

  -- Cashback earned on this top-up, in proportion to the refund
  for g in select * from public.reward_grants
            where stripe_ref = p_stripe_ref and source = 'cashback' and clawed_back_at is null loop
    perform public.rewards_clawback_grant(g, round(g.amount * v_delta::numeric / e.credit_cents)::integer);
  end loop;

  -- Levels no longer reached: unopened crates go, collected rewards come back
  update public.reward_crates set status = 'void'
   where member_id = e.member_id and source = 'level' and status = 'unopened' and earned_level > new_level;
  for g in select * from public.reward_grants
            where member_id = e.member_id and source in ('milestone','crate') and level > new_level
              and clawed_back_at is null loop
    perform public.rewards_clawback_grant(g);
  end loop;

  update public.member_rewards
     set xp_total = greatest(xp_total - v_xp, 0),
         lifetime_credit_cents = greatest(lifetime_credit_cents - v_delta, 0),
         rank = public.rewards_rank(greatest(lifetime_credit_cents - v_delta, 0)),
         rank_seen = public.rewards_rank(greatest(lifetime_credit_cents - v_delta, 0)),
         -- rewards above the new level were taken back, so they can be earned again
         level_rewarded = least(level_rewarded, new_level),
         updated_at = now()
   where member_id = e.member_id;

  return jsonb_build_object('status', 'reversed', 'xp_removed', v_xp, 'credit_removed', v_delta, 'level_after', new_level);
end $$;

-- Member RPC: opens one of the caller's crates. The roll happens here, with pgcrypto
-- randomness against crate_odds, and the reward is applied in the same transaction.
create function public.rewards_open_crate(p_crate_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_member uuid := auth.uid();
  c        public.reward_crates;
  o        public.crate_odds;
  v_roll   numeric;
  v_acc    numeric := 0;
  v_reward jsonb;
  v_disc   uuid;
begin
  if v_member is null or not public.has_active_access() then
    return jsonb_build_object('status', 'forbidden');
  end if;
  select * into c from public.reward_crates where id = p_crate_id and member_id = v_member for update;
  if c.id is null or c.status <> 'unopened' then
    return jsonb_build_object('status', 'not_available');
  end if;

  -- uniform in [0, 100) from 32 random bits
  v_roll := (('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint) / 4294967296.0 * 100;
  for o in select * from public.crate_odds where crate_type = c.crate_type order by sort loop
    v_acc := v_acc + o.chance;
    exit when v_roll < v_acc;
  end loop;

  v_reward := jsonb_build_object('key', o.key, 'kind', o.kind, 'amount', o.amount,
                                 'rarity', o.rarity, 'label', o.label, 'chance', o.chance);
  if o.kind = 'credit' then
    insert into public.reward_grants (member_id, kind, amount, level, source, crate_id, wallet_txn_id)
    values (v_member, 'credit', o.amount, c.earned_level, 'crate', c.id,
            public.rewards_credit_wallet(v_member, o.amount, 'Sync Rewards: ' || o.label || ' from a ' || c.crate_type || ' crate'));
  elsif o.kind = 'discount' then
    insert into public.member_order_discounts (member_id, percent, stripe_ref)
    values (v_member, o.amount, 'crate:' || c.id) returning id into v_disc;
    insert into public.reward_grants (member_id, kind, amount, level, source, crate_id, discount_id)
    values (v_member, 'discount', o.amount, c.earned_level, 'crate', c.id, v_disc);
  elsif o.kind = 'slot' then
    insert into public.reward_grants (member_id, kind, amount, level, source, crate_id, expires_at)
    values (v_member, 'slot', 1, c.earned_level, 'crate', c.id, now() + interval '30 days');
  else
    insert into public.reward_grants (member_id, kind, amount, level, source, crate_id)
    values (v_member, 'xp', o.amount, c.earned_level, 'crate', c.id);
    insert into public.rewards_events (member_id, source, xp) values (v_member, 'crate', o.amount);
    perform public.rewards_apply(v_member, o.amount, 0);
  end if;

  update public.reward_crates set status = 'opened', reward = v_reward, opened_at = now() where id = c.id;
  return jsonb_build_object('status', 'opened', 'reward', v_reward);
end $$;

-- Member RPC: the rank-up moment has been shown.
create function public.rewards_mark_rank_seen() returns void
language sql security definer set search_path = '' as $$
  update public.member_rewards set rank_seen = rank where member_id = auth.uid();
$$;

-- Member RPC: the caller's live streak, for the hub (the award uses the same function).
create function public.rewards_my_streak() returns integer
language sql stable security definer set search_path = '' as $$
  select public.rewards_streak_weeks(auth.uid())
$$;

-- Active reward product slots (milestone + crate), added to the tier limit.
create function public.member_reward_slots(p_member uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.reward_grants
   where member_id = p_member and kind = 'slot' and clawed_back_at is null and expires_at > now()
$$;

-- Launch backfill: XP and lifetime credit from past top-ups, no level rewards, then one
-- welcome crate per active member. Re-runnable: skips top-ups and crates already recorded.
create function public.rewards_backfill() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  t        record;
  v_xp     integer;
  v_topups integer := 0;
  v_crates integer;
begin
  for t in select * from public.wallet_transactions w
            where w.type = 'topup' and w.stripe_ref is not null
              and not exists (select 1 from public.rewards_events e where e.stripe_ref = w.stripe_ref)
            order by w.created_at loop
    v_xp := round(t.amount_cents / 100.0 * 10 * (1 + public.rewards_pack_bonus_pct(t.amount_cents) / 100.0));
    insert into public.rewards_events (member_id, source, stripe_ref, xp, credit_cents, created_at)
    values (t.member_id, 'backfill', t.stripe_ref, v_xp, t.amount_cents, t.created_at);
    perform public.rewards_apply(t.member_id, v_xp, t.amount_cents, false);
    v_topups := v_topups + 1;
  end loop;

  insert into public.reward_crates (member_id, crate_type, source)
  select p.id,
         case when coalesce(m.rank, 'bronze') in ('bronze','silver') then 'silver' else 'gold' end,
         'welcome'
    from public.profiles p
    left join public.member_rewards m on m.member_id = p.id
   where p.role = 'member' and p.subscription_active
  on conflict (member_id) where source = 'welcome' do nothing;
  get diagnostics v_crates = row_count;

  return jsonb_build_object('topups', v_topups, 'welcome_crates', v_crates);
end $$;

-- ── Checkout uses the member's largest unused discount (was: oldest) ──
create or replace function public.claim_order_discount(p_member_id uuid, p_order_id uuid)
 returns numeric
 language plpgsql
 security definer
 set search_path to ''
as $function$
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
      order by percent desc, created_at
      limit 1
      for update skip locked
   )
  returning percent into v_percent;

  return coalesce(v_percent, 0);
end;
$function$;

-- ── Pool distribution counts active reward slots on top of the tier limit ──
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
           < member_product_limit(p_tier, p.plus_status) + member_reward_slots(p.id)
     order by (select count(*) from products pr
                where pr.member_id = p.id and pr.active and not pr.is_bonus)::numeric
              / (member_product_limit(p_tier, p.plus_status) + member_reward_slots(p.id)),
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

-- ── Who can call what ──────────────────────────────────────────────
revoke all on function public.rewards_active_week(uuid, date)                  from public, anon, authenticated;
revoke all on function public.rewards_streak_weeks(uuid)                       from public, anon, authenticated;
revoke all on function public.member_reward_slots(uuid)                        from public, anon, authenticated;
revoke all on function public.rewards_credit_wallet(uuid, integer, text)       from public, anon, authenticated;
revoke all on function public.rewards_clawback_wallet(uuid, integer, text)     from public, anon, authenticated;
revoke all on function public.rewards_grant_level(uuid, integer)               from public, anon, authenticated;
revoke all on function public.rewards_apply(uuid, integer, bigint, boolean)    from public, anon, authenticated;
revoke all on function public.award_topup_xp(uuid, bigint, text)               from public, anon, authenticated;
revoke all on function public.rewards_clawback_grant(public.reward_grants, integer) from public, anon, authenticated;
revoke all on function public.reverse_topup_rewards(text, bigint)              from public, anon, authenticated;
revoke all on function public.rewards_backfill()                               from public, anon, authenticated;
revoke all on function public.rewards_open_crate(uuid)                         from public, anon;
revoke all on function public.rewards_mark_rank_seen()                         from public, anon;
revoke all on function public.rewards_my_streak()                              from public, anon;
grant execute on function public.award_topup_xp(uuid, bigint, text)            to service_role;
grant execute on function public.reverse_topup_rewards(text, bigint)           to service_role;
grant execute on function public.rewards_backfill()                            to service_role;
grant execute on function public.rewards_open_crate(uuid)                      to authenticated;
grant execute on function public.rewards_mark_rank_seen()                      to authenticated;
grant execute on function public.rewards_my_streak()                           to authenticated;
grant execute on function public.member_reward_slots(uuid)                     to service_role;
