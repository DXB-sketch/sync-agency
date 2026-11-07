-- Sync Plus monthly price, editable from the admin Sync Plus page so a price change never
-- needs a site rebuild. Read by the portal (display) and plus-subscription (Stripe checkout).
-- Single-row table: id is always true.
create table public.plus_settings (
  id boolean primary key default true check (id),
  monthly_cents integer not null check (monthly_cents between 100 and 100000),
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

insert into public.plus_settings (monthly_cents) values (3400);

alter table public.plus_settings enable row level security;

create policy plus_settings_select on public.plus_settings
  for select to authenticated using (true);

create policy plus_settings_admin_update on public.plus_settings
  for update using (public.is_admin()) with check (public.is_admin());
