-- Sync Rewards — DRAFT schema. Dry-run on plain Postgres 16 with stubbed auth
-- (a Level 12 member topping up $500 lands on Level 18 / Gold with Silver crates 13–15,
-- Gold crates 16–18, $5 credit at 14 and a slot at 15; a repeated Stripe event is ignored).
-- Not run on Supabase: review, wire to the existing wallet tables, apply to a branch first.
-- Rules live in SPEC.md. Clients can read their own rows; every write goes through
-- service-role edge functions (Stripe webhook, open-crate).

-- ── State per member ────────────────────────────────────────────────
create table if not exists public.member_rewards (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  xp_total              integer     not null default 0 check (xp_total >= 0),
  lifetime_credit_cents bigint      not null default 0 check (lifetime_credit_cents >= 0),
  rank                  text        not null default 'bronze'
                          check (rank in ('bronze','silver','gold','platinum','black')),
  rank_seen             text        not null default 'bronze',  -- last rank the member was shown; drives the rank-up moment
  updated_at            timestamptz not null default now()
);

-- ── Every XP / credit movement (idempotent on the Stripe event) ─────
create table if not exists public.rewards_events (
  id              bigserial primary key,
  user_id         uuid        not null references auth.users (id) on delete cascade,
  source          text        not null check (source in ('topup','refund','crate','backfill','admin')),
  stripe_event_id text        unique,
  xp              integer     not null default 0,
  credit_cents    bigint      not null default 0,
  created_at      timestamptz not null default now()
);

-- ── Crates ─────────────────────────────────────────────────────────
create table if not exists public.reward_crates (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  crate_type   text        not null check (crate_type in ('silver','gold')),
  earned_level integer     not null,
  status       text        not null default 'unopened' check (status in ('unopened','opened','void')),
  reward       jsonb,                -- {kind, num, rarity, label, chance} once opened
  created_at   timestamptz not null default now(),
  opened_at    timestamptz
);
create index if not exists reward_crates_user_status on public.reward_crates (user_id, status);

-- ── Non-crate grants: milestone credit, product slots, discounts ────
create table if not exists public.reward_grants (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  kind        text        not null check (kind in ('credit','slot','discount')),
  amount      integer     not null,   -- cents for credit, 1 for a slot, percent for a discount
  level       integer,
  source      text        not null check (source in ('milestone','crate')),
  crate_id    uuid        references public.reward_crates (id),
  expires_at  timestamptz,           -- product slots: activation + 30 days
  consumed_at timestamptz,           -- discounts: set when the stock order is paid
  created_at  timestamptz not null default now()
);

-- ── Read-only access for members ───────────────────────────────────
alter table public.member_rewards enable row level security;
alter table public.rewards_events enable row level security;
alter table public.reward_crates  enable row level security;
alter table public.reward_grants  enable row level security;

create policy "own rewards"  on public.member_rewards for select using (auth.uid() = user_id);
create policy "own events"   on public.rewards_events for select using (auth.uid() = user_id);
create policy "own crates"   on public.reward_crates  for select using (auth.uid() = user_id);
create policy "own grants"   on public.reward_grants  for select using (auth.uid() = user_id);

-- ── Rules (keep in step with src/lib/rewards.js) ────────────────────
create or replace function public.rewards_level(p_xp integer) returns integer
language sql immutable as $$ select p_xp / 1000 + 1 $$;

create or replace function public.rewards_rank(p_credit_cents bigint) returns text
language sql immutable as $$
  select case
    when p_credit_cents >= 1000000 then 'black'
    when p_credit_cents >=  400000 then 'platinum'
    when p_credit_cents >=  150000 then 'gold'
    when p_credit_cents >=   50000 then 'silver'
    else 'bronze' end
$$;

create or replace function public.rewards_pack_bonus_pct(p_amount_cents bigint) returns integer
language sql immutable as $$
  select case
    when p_amount_cents >= 100000 then 20
    when p_amount_cents >=  50000 then 15
    when p_amount_cents >=  25000 then 10
    when p_amount_cents >=  10000 then 5
    else 0 end
$$;

-- Adds XP (and optionally lifetime credit), grants crates and milestone rewards
-- for every level crossed. Used by top-ups and by bonus-XP crate rewards.
-- Pass p_grant = false for the launch backfill so past levels grant nothing.
create or replace function public.rewards_apply(p_user uuid, p_xp integer, p_credit_cents bigint, p_grant boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r            public.member_rewards;
  old_level    integer;
  new_level    integer;
  rank_after   text;
  lvl          integer;
  lvl_rank     text;
begin
  insert into public.member_rewards (user_id) values (p_user) on conflict (user_id) do nothing;
  select * into r from public.member_rewards where user_id = p_user for update;

  old_level  := public.rewards_level(r.xp_total);
  new_level  := public.rewards_level(r.xp_total + p_xp);
  rank_after := public.rewards_rank(r.lifetime_credit_cents + p_credit_cents);

  update public.member_rewards
     set xp_total = r.xp_total + p_xp,
         lifetime_credit_cents = r.lifetime_credit_cents + p_credit_cents,
         rank = rank_after,
         updated_at = now()
   where user_id = p_user;

  for lvl in old_level + 1 .. (case when p_grant then new_level else old_level end) loop
    -- Crate type follows the rank that level belongs to (Silver 6–15, Gold 16+), so a
    -- top-up from Level 12 to 18 gives Silver crates for 13–15 and Gold for 16–18.
    lvl_rank := public.rewards_rank((lvl - 1)::bigint * 10000);
    if lvl_rank <> 'bronze' then
      insert into public.reward_crates (user_id, crate_type, earned_level)
      values (p_user, case when lvl_rank = 'silver' then 'silver' else 'gold' end, lvl);
    end if;
    -- Milestone extras (SPEC.md § 4). Credit grants must ALSO be written to the
    -- existing wallet ledger: TODO, wire to the wallet tables used by wallet-topup.
    if lvl = 14 then insert into public.reward_grants (user_id, kind, amount, level, source) values (p_user, 'credit', 500, lvl, 'milestone'); end if;
    if lvl = 15 then insert into public.reward_grants (user_id, kind, amount, level, source, expires_at) values (p_user, 'slot', 1, lvl, 'milestone', now() + interval '30 days'); end if;
    if lvl = 20 then insert into public.reward_grants (user_id, kind, amount, level, source) values (p_user, 'credit', 1000, lvl, 'milestone'); end if;
  end loop;

  return jsonb_build_object(
    'xp_added', p_xp,
    'level_before', old_level, 'level_after', new_level,
    'rank_before', r.rank, 'rank_after', rank_after
  );
end $$;

-- Called by the Stripe webhook when a wallet top-up clears. Safe to call twice
-- with the same event id.
create or replace function public.award_topup_xp(p_user uuid, p_amount_cents bigint, p_stripe_event_id text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  xp integer := round(p_amount_cents / 100.0 * 10 * (1 + public.rewards_pack_bonus_pct(p_amount_cents) / 100.0));
begin
  insert into public.rewards_events (user_id, source, stripe_event_id, xp, credit_cents)
  values (p_user, 'topup', p_stripe_event_id, xp, p_amount_cents)
  on conflict (stripe_event_id) do nothing;
  if not found then
    return jsonb_build_object('duplicate', true);
  end if;
  return public.rewards_apply(p_user, xp, p_amount_cents);
end $$;

-- TODO (SPEC.md § 7): award_refund_reversal(p_user, p_amount_cents, p_stripe_event_id)
-- subtracting the XP and credit recorded for that top-up, recomputing rank and
-- voiding unopened crates above the new level.

revoke all on function public.rewards_apply(uuid, integer, bigint, boolean) from public, anon, authenticated;
revoke all on function public.award_topup_xp(uuid, bigint, text)          from public, anon, authenticated;
grant execute on function public.rewards_apply(uuid, integer, bigint, boolean) to service_role;
grant execute on function public.award_topup_xp(uuid, bigint, text)       to service_role;
