-- Coaching plan prices live here, not in Stripe. Checkout (create-landing-checkout, and
-- create-checkout-session for upgrades) reads price_cents and charges it against the plan's
-- Stripe product with inline price_data — no fixed Stripe Prices to keep in sync.
create table public.course_tiers (
  id text primary key check (id in ('pro', 'elite', 'vip', 'executive')),
  name text not null,
  rank int not null unique,
  price_cents int not null check (price_cents > 0),
  stripe_product_id text not null
);

alter table public.course_tiers enable row level security;

-- Prices are public (shown on the marketing site); only service role writes.
create policy course_tiers_read on public.course_tiers for select to anon, authenticated using (true);

insert into public.course_tiers (id, name, rank, price_cents, stripe_product_id) values
  ('pro', 'Pro Accelerator', 1, 9700, 'prod_Ubr12foLHYkWBH'),
  ('elite', 'Elite Scale', 2, 24700, 'prod_Ubr5Lx8hoKC9Ri'),
  ('vip', 'VIP Inner Circle', 3, 68900, 'prod_Ubr6EM3X9HWs4m'),
  ('executive', 'Executive Partner', 4, 379900, 'prod_VaK3vojtOfD04x');
