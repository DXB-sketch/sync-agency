-- Applied to production 2026-07-09 via Supabase MCP
-- (migration name: listing_discount_prices_and_pricing_node_consolidation)

-- 1. Listing / discount price fields (admin-write only via existing RLS:
--    products_admin_write + pool_admin_all; members keep read-only SELECT).
alter table public.products
  add column if not exists listing_price numeric,
  add column if not exists discount_price numeric;

alter table public.pool_products
  add column if not exists listing_price numeric,
  add column if not exists discount_price numeric;

-- 2. Carry the new fields through pool distribution.
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
    -- No member in this tier has a free slot: the rest of the pool waits too.
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

-- 3. Pathway: pricing moves to the Products page. Replace the six
--    pricing nodes with one instructional step.
insert into pathway_nodes (id, phase, order_in_phase, title, body, icon, min_tier, depends_on, gx, gy)
values (
  'p2_price_listings', 2, 3, 'Price Every Listing',
  'Every product now comes with its prices worked out for you. Open the **Products** tab and you''ll see two numbers on every item:

```copy
List price — what the listing starts at
Discounted price — what the listing drops to
```

For each item you stock:

1. Create the listing at the **list price** shown on the Products tab.
2. Once it''s live, apply a discount **through Depop** so the visible price drops to the **discounted price** shown there.

Depop keeps the crossed-out starting price next to the new one, and that visible markdown is what converts browsers into buyers.

Mark complete when every live listing shows its discounted price from the Products tab.',
  'price-tag', null, '{p2_listing_settings}', 0, 4
);

update pathway_nodes
   set depends_on = '{p2_price_listings}', order_in_phase = 4, gy = 5
 where id = 'p2_offers';

delete from member_pathway_progress
 where node_id in ('p2_pricing','p2_pricing_shirts','p2_pricing_hoodies','p2_pricing_shorts','p2_pricing_chains','p2_pricing_accessories');

delete from pathway_nodes
 where id in ('p2_pricing','p2_pricing_shirts','p2_pricing_hoodies','p2_pricing_shorts','p2_pricing_chains','p2_pricing_accessories');
