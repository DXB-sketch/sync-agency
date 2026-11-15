-- Creator referral program: creators share a link/code, buyers get 10% off their first course
-- purchase, and each course payment (new purchase or upgrade) a creator drove earns them a
-- commission at their rate at the time of payment. Payouts happen outside the system.
-- Everything here is admin-only; edge functions write through the service role.

create table public.creators (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  code            text not null check (code ~ '^[A-Za-z0-9]{2,20}$'),
  commission_rate numeric(5,2) not null check (commission_rate >= 0 and commission_rate <= 100),
  payout_notes    text,
  contact         text,
  active          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
-- Codes are case-insensitive: JAKE, jake and Jake are the same code
create unique index creators_code_key on public.creators (lower(code));

create table public.creator_clicks (
  id         bigint generated always as identity primary key,
  creator_id uuid not null references public.creators (id),
  created_at timestamptz not null default now()
);
create index creator_clicks_creator_idx on public.creator_clicks (creator_id);

-- Which creator drove a marketing-site course purchase (null = no referral)
alter table public.purchases add column creator_id uuid references public.creators (id);

-- One row per Stripe payment. 'approved' is never stored: a pending commission becomes approved
-- once it is 14 days old (see referral_commissions_view), so no scheduled job is needed.
create table public.referral_commissions (
  id                    uuid primary key default gen_random_uuid(),
  creator_id            uuid not null references public.creators (id),
  kind                  text not null check (kind in ('new_purchase', 'renewal', 'upgrade')),
  -- One payment can only ever be credited once
  stripe_payment_intent text not null unique,
  stripe_session_id     text,
  member_id             uuid references public.profiles (id),
  customer_email        text,
  tier                  text,
  amount_paid_cents     integer not null check (amount_paid_cents >= 0),
  -- Snapshot of the creator's rate when the payment happened
  commission_rate       numeric(5,2) not null,
  commission_cents      integer not null check (commission_cents >= 0),
  status                text not null default 'pending' check (status in ('pending', 'paid', 'voided')),
  paid_at               timestamptz,
  payout_note           text,
  voided_at             timestamptz,
  void_reason           text,
  -- Refund/dispute after payout: never changed silently, flagged for the admin instead
  needs_attention       boolean not null default false,
  attention_reason      text,
  created_at            timestamptz not null default now()
);
create index referral_commissions_creator_idx on public.referral_commissions (creator_id);
create index referral_commissions_member_idx on public.referral_commissions (member_id);

create view public.referral_commissions_view with (security_invoker = true) as
select c.*,
       case when c.status = 'pending' and c.created_at <= now() - interval '14 days'
            then 'approved' else c.status end as effective_status
  from public.referral_commissions c;

create view public.creator_click_counts with (security_invoker = true) as
select creator_id, count(*)::int as clicks from public.creator_clicks group by creator_id;

alter table public.creators enable row level security;
alter table public.creator_clicks enable row level security;
alter table public.referral_commissions enable row level security;

create policy creators_admin on public.creators
  for all using (public.is_admin()) with check (public.is_admin());
create policy creator_clicks_admin_read on public.creator_clicks
  for select using (public.is_admin());
-- Admins read commissions directly; status changes go through mark_commissions_paid()
create policy referral_commissions_admin_read on public.referral_commissions
  for select using (public.is_admin());

-- Public: is this an active code? Returns the canonical code, or null. Reveals nothing else.
create function public.referral_code_active(p_code text)
returns text language sql stable security definer set search_path = public as $$
  select code from public.creators where lower(code) = lower(p_code) and active;
$$;

-- Public: count a referral-link visit for an active code. Returns the canonical code, or null.
create function public.record_referral_click(p_code text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_creator public.creators;
begin
  select * into v_creator from public.creators where lower(code) = lower(p_code) and active;
  if v_creator.id is null then return null; end if;
  insert into public.creator_clicks (creator_id) values (v_creator.id);
  return v_creator.code;
end $$;

-- The creator who referred a member: the earliest referred course purchase linked to them, or
-- the earliest commission recorded against them (an upgrade made with a code). Service role only.
create function public.member_referrer(p_member uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select creator_id from (
    select creator_id, created_at from public.purchases
     where linked_member_id = p_member and creator_id is not null
    union all
    select creator_id, created_at from public.referral_commissions where member_id = p_member
  ) r
  order by created_at
  limit 1;
$$;
revoke execute on function public.member_referrer(uuid) from public, anon, authenticated;

-- Signed-in member: are they already credited to a creator? (Hides the code field on upgrades.)
create function public.member_has_referrer()
returns boolean language sql stable security definer set search_path = public as $$
  select public.member_referrer(auth.uid()) is not null;
$$;
revoke execute on function public.member_has_referrer() from public, anon;
grant execute on function public.member_has_referrer() to authenticated;

-- Admin: mark approved commissions paid. Only rows that are approved right now (pending, 14+
-- days old, not flagged) are touched, whatever ids are sent. Returns how many were marked.
create function public.mark_commissions_paid(p_ids uuid[], p_paid_at timestamptz, p_note text)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
begin
  if not public.is_admin() then
    raise exception 'Admins only';
  end if;
  update public.referral_commissions
     set status = 'paid', paid_at = coalesce(p_paid_at, now()), payout_note = nullif(trim(p_note), '')
   where id = any (p_ids)
     and status = 'pending'
     and created_at <= now() - interval '14 days'
     and not needs_attention;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
