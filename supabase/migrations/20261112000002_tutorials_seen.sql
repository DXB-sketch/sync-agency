-- First-run tutorials (sync-update/3-tutorials): each tutorial shows once per
-- member. "Seen" is stored on the profile so it follows the member across
-- devices. Members only hold UPDATE on profiles.full_name / last_login, so the
-- flag is set through a narrow RPC that can only stamp the caller's own row.
alter table public.profiles
  add column if not exists portal_tour_seen_at timestamptz,
  add column if not exists rewards_tour_seen_at timestamptz;

create or replace function public.mark_tour_seen(p_tour text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_tour = 'portal' then
    update public.profiles set portal_tour_seen_at = coalesce(portal_tour_seen_at, now()) where id = auth.uid();
  elsif p_tour = 'rewards' then
    update public.profiles set rewards_tour_seen_at = coalesce(rewards_tour_seen_at, now()) where id = auth.uid();
  else
    raise exception 'unknown tour %', p_tour;
  end if;
end;
$$;

revoke all on function public.mark_tour_seen(text) from public, anon;
grant execute on function public.mark_tour_seen(text) to authenticated;
