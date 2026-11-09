-- Executive Partner has no practical slot cap (full catalogue). Mirrors
-- TIERS.executive.productLimit in src/lib/tiers.js.
create or replace function public.tier_product_limit(t tier)
returns integer
language sql
immutable
as $function$
  select case t when 'free' then 6 when 'pro' then 9 when 'elite' then 12 when 'vip' then 15 when 'executive' then 1000 end;
$function$;
