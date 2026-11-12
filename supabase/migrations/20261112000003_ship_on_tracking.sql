-- Orders never left "paid": tracking numbers were saved on order_items, but
-- nothing advanced the order, and the fulfilment engine that was meant to
-- (dispatch-order) isn't deployed. Once every item in an order has a tracking
-- number, the order is shipped.
create or replace function public.ship_order_when_tracked() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if nullif(trim(new.tracking_number), '') is null then
    return new;
  end if;
  update public.orders o
     set status = 'shipped'
   where o.id = new.order_id
     and o.status in ('paid', 'sourcing', 'dispatching', 'dispatched')
     and not exists (
       select 1 from public.order_items i
        where i.order_id = o.id
          and nullif(trim(i.tracking_number), '') is null
     );
  return new;
end;
$$;

revoke all on function public.ship_order_when_tracked() from public, anon, authenticated;

create trigger order_items_ship_when_tracked
  after insert or update of tracking_number on public.order_items
  for each row execute function public.ship_order_when_tracked();

-- One-off: orders already fully tracked but still waiting
update public.orders o
   set status = 'shipped'
 where o.status in ('paid', 'sourcing', 'dispatching', 'dispatched')
   and exists (select 1 from public.order_items i where i.order_id = o.id)
   and not exists (
     select 1 from public.order_items i
      where i.order_id = o.id
        and nullif(trim(i.tracking_number), '') is null
   );
