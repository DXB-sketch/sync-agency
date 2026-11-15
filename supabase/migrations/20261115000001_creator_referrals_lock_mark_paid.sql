-- mark_commissions_paid already refuses non-admins; don't expose it to signed-out callers at all.
revoke execute on function public.mark_commissions_paid(uuid[], timestamptz, text) from public, anon;
grant execute on function public.mark_commissions_paid(uuid[], timestamptz, text) to authenticated;
