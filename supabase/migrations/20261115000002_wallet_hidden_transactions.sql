-- Admin-only list of wallet ledger rows hidden from the member's own view (e.g. admin mistakes
-- that were reversed). The ledger itself stays immutable and complete; admins still see every row.
create table public.wallet_hidden_transactions (
  transaction_id uuid primary key references public.wallet_transactions (id),
  hidden_by      uuid references public.profiles (id),
  note           text,
  created_at     timestamptz not null default now()
);
alter table public.wallet_hidden_transactions enable row level security;
create policy wallet_hidden_transactions_admin on public.wallet_hidden_transactions
  for all using (public.is_admin()) with check (public.is_admin());

-- Security definer so the member's policy can check the admin-only list
create function public.wallet_txn_hidden(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.wallet_hidden_transactions where transaction_id = p_id);
$$;

-- Was: using ((member_id = auth.uid()) OR is_admin())
drop policy wallet_transactions_select_own_or_admin on public.wallet_transactions;
create policy wallet_transactions_select_own_or_admin on public.wallet_transactions
  for select to authenticated
  using (
    (member_id = auth.uid()
      and not public.wallet_txn_hidden(id))
    or public.is_admin()
  );
