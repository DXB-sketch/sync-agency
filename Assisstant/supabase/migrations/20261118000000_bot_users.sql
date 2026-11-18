-- Sync Assistant (Telegram bot). All bot tables are prefixed bot_ to stay
-- separate from the portal/catalogue tables in this project.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.bot_users (
  id                 uuid primary key default gen_random_uuid(),
  telegram_user_id   bigint not null unique,
  telegram_chat_id   bigint not null,
  display_name       text not null,
  digest_time        time not null default '08:00',
  evening_check_time time not null default '18:00',
  created_at         timestamptz not null default now()
);

-- Only the edge functions (service role) touch this table for now.
-- RLS on with no policies = no access via the anon/authenticated keys.
alter table public.bot_users enable row level security;
