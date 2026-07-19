-- Chronos Phase 2 — member wallet (store credit), reconstructed from production
-- (project whuqfxdzopyucebtnbkx) to close a repo/migration-history drift gap: this schema is
-- live and already tracked in Supabase's own migration history, but the .sql file was never
-- committed to this repo. DDL below is verified against the live schema/functions/policies —
-- not re-executed, since it already exists on production. Depends on
-- 20260716123634_chronos_phase2_awaiting_funds_enum.sql (order_status.awaiting_funds).

create table if not exists public.wallets (
  member_id uuid primary key references public.profiles(id),
  currency text not null default 'aud' check (currency = 'aud'),
  balance_cents integer not null default 0 check (balance_cents >= 0),
  low_balance_threshold_cents integer check (low_balance_threshold_cents > 0),
  low_balance_flagged_at timestamptz,
  auto_topup_enabled boolean not null default false,
  auto_topup_amount_cents integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.profiles(id),
  type text not null check (type = any (array['topup','debit','credit','adjustment','refund'])),
  amount_cents integer not null,
  balance_after_cents integer not null,
  order_id uuid references public.orders(id),
  stripe_ref text,
  reason text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index if not exists wallet_transactions_stripe_ref_uniq
  on public.wallet_transactions (stripe_ref) where (stripe_ref is not null);
create unique index if not exists wallet_transactions_order_debit_uniq
  on public.wallet_transactions (order_id) where (type = 'debit');
create index if not exists wallet_transactions_member_created_idx
  on public.wallet_transactions (member_id, created_at desc);
create index if not exists wallet_transactions_created_by_idx
  on public.wallet_transactions (created_by);

create table if not exists public.wallet_order_holds (
  order_id uuid primary key references public.orders(id),
  member_id uuid not null references public.profiles(id),
  amount_cents integer not null check (amount_cents > 0),
  created_at timestamptz not null default now()
);

alter table public.wallets enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.wallet_order_holds enable row level security;

-- Members read only their own row; admins read all. No INSERT/UPDATE/DELETE policy exists for
-- any client role on any of these three tables — every write goes through a SECURITY DEFINER
-- RPC below, called only from service-role edge functions.
create policy wallets_select_own_or_admin on public.wallets
  for select to authenticated using (member_id = auth.uid() or is_admin());
create policy wallet_transactions_select_own_or_admin on public.wallet_transactions
  for select to authenticated using (member_id = auth.uid() or is_admin());
create policy wallet_order_holds_select_own_or_admin on public.wallet_order_holds
  for select to authenticated using (member_id = auth.uid() or is_admin());

-- Belt-and-suspenders: Supabase re-applies default table grants on create, which can leave
-- table-level INSERT/UPDATE/DELETE granted to anon/authenticated even though RLS (no matching
-- policy) already blocks every such attempt. Same quirk documented for shopify_stores elsewhere
-- in this project — revoke explicitly so the grant doesn't just happen to be harmless.
revoke insert, update, delete on public.wallets from anon, authenticated;
revoke insert, update, delete on public.wallet_transactions from anon, authenticated;
revoke insert, update, delete on public.wallet_order_holds from anon, authenticated;

-- Append-only ledger: blocks UPDATE/DELETE even for service-role/dashboard sessions.
create or replace function public.wallet_transactions_immutable()
returns trigger
language plpgsql
as $$
begin
  raise exception 'wallet_transactions is append-only (money bugs are ledger bugs)';
end;
$$;

drop trigger if exists wallet_transactions_no_update_delete on public.wallet_transactions;
create trigger wallet_transactions_no_update_delete
  before delete or update on public.wallet_transactions
  for each row execute function public.wallet_transactions_immutable();

-- Debit a member's wallet for an order, inside one transaction: lock the wallet row, refuse a
-- second debit on the same order (belt-and-suspenders with wallet_transactions_order_debit_uniq),
-- park the order awaiting_funds on insufficient balance instead of partially debiting.
create or replace function public.debit_wallet_for_order(p_order_id uuid, p_amount_cents integer default null)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_member uuid;
  v_status public.order_status;
  v_amount integer;
  v_balance integer;
  v_new integer;
  v_txn uuid;
begin
  select member_id into v_member from public.orders where id = p_order_id;
  if v_member is null then
    return jsonb_build_object('status','order_not_found');
  end if;

  select balance_cents into v_balance
    from public.wallets where member_id = v_member for update;

  select status into v_status from public.orders where id = p_order_id for update;

  if exists (select 1 from public.wallet_transactions
              where order_id = p_order_id and type = 'debit') then
    return jsonb_build_object('status','already_debited');
  end if;

  if v_status not in ('pending_payment','awaiting_funds') then
    return jsonb_build_object('status','invalid_status','order_status', v_status::text);
  end if;

  v_amount := p_amount_cents;
  if v_amount is null then
    select amount_cents into v_amount
      from public.wallet_order_holds where order_id = p_order_id;
  end if;
  if v_amount is null or v_amount <= 0 then
    return jsonb_build_object('status','no_amount');
  end if;

  if v_balance is null or v_balance < v_amount then
    insert into public.wallet_order_holds (order_id, member_id, amount_cents)
    values (p_order_id, v_member, v_amount)
    on conflict (order_id) do update set amount_cents = excluded.amount_cents;
    update public.orders set status = 'awaiting_funds' where id = p_order_id;
    return jsonb_build_object('status','insufficient_funds',
      'balance_cents', coalesce(v_balance, 0), 'required_cents', v_amount);
  end if;

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
  update public.orders set status = 'paid' where id = p_order_id;

  return jsonb_build_object('status','debited','transaction_id', v_txn,
                            'balance_cents', v_new);
end;
$$;

-- Resume any awaiting_funds orders for a member (oldest hold first) once their balance can
-- cover them — called after every top-up/credit/adjustment that increases the balance.
create or replace function public.resume_awaiting_funds_orders(p_member_id uuid)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  h record;
  res jsonb;
  resumed integer := 0;
begin
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
end;
$$;

-- Credit a wallet from a Stripe top-up. Idempotent on stripe_ref (also enforced by the unique
-- index above) — a duplicate webhook delivery for the same PaymentIntent is a no-op.
create or replace function public.wallet_topup_credit(p_member_id uuid, p_amount_cents integer, p_stripe_ref text)
returns jsonb
language plpgsql
security definer
set search_path to ''
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

  if p_stripe_ref is not null and exists (
      select 1 from public.wallet_transactions where stripe_ref = p_stripe_ref) then
    return jsonb_build_object('status','duplicate');
  end if;

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
    return jsonb_build_object('status','duplicate');
end;
$$;

-- Admin manual credit / refund-to-wallet / adjustment. Never allows the balance to go negative;
-- resumes awaiting_funds orders on any positive adjustment.
create or replace function public.wallet_adjust(
  p_member_id uuid, p_amount_cents integer, p_type text, p_reason text, p_actor uuid,
  p_order_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path to ''
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
    return jsonb_build_object('status','reason_required');
  end if;

  insert into public.wallets (member_id) values (p_member_id)
  on conflict (member_id) do nothing;

  select balance_cents into v_balance
    from public.wallets where member_id = p_member_id for update;

  v_new := v_balance + p_amount_cents;
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
end;
$$;

-- SECURITY DEFINER RPCs above are callable only from service-role edge functions, never
-- directly by a member's session.
revoke execute on function public.debit_wallet_for_order(uuid, integer) from public, anon, authenticated;
revoke execute on function public.resume_awaiting_funds_orders(uuid) from public, anon, authenticated;
revoke execute on function public.wallet_topup_credit(uuid, integer, text) from public, anon, authenticated;
revoke execute on function public.wallet_adjust(uuid, integer, text, text, uuid, uuid) from public, anon, authenticated;
