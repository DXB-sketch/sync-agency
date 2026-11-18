-- Calendar events + reminders (9pm night before, 8:15am on the day, 1 hour before).
-- All times are Australia/Brisbane.

create table if not exists public.bot_events (
  id         bigint generated always as identity primary key,
  created_by uuid not null references public.bot_users(id) on delete cascade,
  title      text not null,
  starts_at  timestamptz not null,
  shared     boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists bot_events_starts_at_idx on public.bot_events (starts_at);
alter table public.bot_events enable row level security;

-- One row per reminder sent, so each fires exactly once.
create table if not exists public.bot_reminders_sent (
  event_id bigint not null references public.bot_events(id) on delete cascade,
  kind     text not null,
  sent_at  timestamptz not null default now(),
  primary key (event_id, kind)
);
alter table public.bot_reminders_sent enable row level security;

-- Shared secret between pg_cron and the bot-reminders function, generated in the DB.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'bot_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'bot_cron_secret');
  end if;
end $$;

-- Claims reminders that are due now and returns who to send them to.
-- Skips reminders whose time had already passed when the event was created,
-- ones that fall after the event starts, and ones more than 15 minutes stale.
create or replace function public.bot_claim_due_reminders(cron_secret text)
returns table (kind text, title text, starts_at timestamptz, shared boolean, chat_ids bigint[])
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not exists (
    select 1 from vault.decrypted_secrets s
    where s.name = 'bot_cron_secret' and s.decrypted_secret = cron_secret
  ) then
    raise exception 'invalid cron secret';
  end if;

  return query
  with due as (
    select e.id, k.kind
    from public.bot_events e
    cross join lateral (values
      ('night',   (((e.starts_at at time zone 'Australia/Brisbane')::date - 1) + time '21:00') at time zone 'Australia/Brisbane'),
      ('morning', (((e.starts_at at time zone 'Australia/Brisbane')::date) + time '08:15') at time zone 'Australia/Brisbane'),
      ('hour',    e.starts_at - interval '1 hour')
    ) as k(kind, due_at)
    where e.starts_at > now()
      and k.due_at <= now()
      and k.due_at > now() - interval '15 minutes'
      and k.due_at > e.created_at
      and k.due_at < e.starts_at
  ), claimed as (
    insert into public.bot_reminders_sent (event_id, kind)
    select id, kind from due
    on conflict do nothing
    returning event_id, kind
  )
  select c.kind, e.title, e.starts_at, e.shared,
    case when e.shared
      then (select array_agg(u.telegram_chat_id) from public.bot_users u)
      else array(select u.telegram_chat_id from public.bot_users u where u.id = e.created_by)
    end
  from claimed c
  join public.bot_events e on e.id = c.event_id;
end $$;

revoke execute on function public.bot_claim_due_reminders(text) from public, anon, authenticated;
grant execute on function public.bot_claim_due_reminders(text) to service_role;

select cron.schedule(
  'bot-reminders',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://whuqfxdzopyucebtnbkx.supabase.co/functions/v1/bot-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'bot_cron_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);
