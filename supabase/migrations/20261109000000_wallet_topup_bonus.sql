-- Fixed top-up pack bonuses (e.g. top up $500, get $80 bonus credit). The bonus table lives in
-- stripe-webhook; this credits it. Idempotent per top-up via the ':bonus' stripe_ref suffix,
-- so a re-delivered webhook can't pay it twice. Separate from wallet promo rewards (':promo').
create or replace function public.wallet_topup_bonus(
  p_member_id uuid,
  p_bonus_cents integer,
  p_stripe_ref text,
  p_reason text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_ref text := p_stripe_ref || ':bonus';
  v_new integer;
begin
  if p_member_id is null or p_bonus_cents is null or p_bonus_cents <= 0 or p_stripe_ref is null then
    return jsonb_build_object('status', 'bad_request');
  end if;
  if exists (select 1 from public.wallet_transactions where stripe_ref = v_ref) then
    return jsonb_build_object('status', 'duplicate');
  end if;

  insert into public.wallets (member_id) values (p_member_id)
  on conflict (member_id) do nothing;

  select balance_cents + p_bonus_cents into v_new
    from public.wallets where member_id = p_member_id for update;

  insert into public.wallet_transactions
    (member_id, type, amount_cents, balance_after_cents, stripe_ref, reason)
  values (p_member_id, 'credit', p_bonus_cents, v_new, v_ref, p_reason);

  update public.wallets
     set balance_cents = v_new,
         updated_at = now(),
         low_balance_flagged_at = case
           when low_balance_threshold_cents is not null and v_new < low_balance_threshold_cents
             then coalesce(low_balance_flagged_at, now())
           else null
         end
   where member_id = p_member_id;

  perform public.resume_awaiting_funds_orders(p_member_id);

  return jsonb_build_object('status', 'credited', 'bonus_cents', p_bonus_cents);
exception
  when unique_violation then
    return jsonb_build_object('status', 'duplicate');
end;
$$;

revoke all on function public.wallet_topup_bonus(uuid, integer, text, text) from public, anon, authenticated;
