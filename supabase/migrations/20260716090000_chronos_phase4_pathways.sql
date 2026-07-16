-- Phase 4: pathways + member_pathways schema, pathway_id on pathway_nodes, RLS.
-- See docs/PHASE4_PLAN.md sections 1.1-1.7.
--
-- DEVIATION from plan's literal section order: owns_node() (plan §1.3) references
-- pathway_nodes.pathway_id, which plan §1.4 adds. Postgres validates `language sql`
-- function bodies against the catalog at CREATE FUNCTION time, so creating owns_node()
-- before the column exists fails outright (confirmed live: "column pn.pathway_id does
-- not exist"). Reordered here: add the column (§1.4) before creating owns_node()
-- (§1.3b). owns_pathway() has no such dependency and stays where the plan put it.
-- No semantic change from the plan, just a compile-order fix.

-- 1.1 pathways table + seed rows
create table public.pathways (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

insert into public.pathways (slug, name) values
  ('depop',   'Depop Dropshipping'),
  ('shopify', 'Shopify Dropshipping');

-- 1.2 member_pathways table
create table public.member_pathways (
  member_id       uuid not null references public.profiles(id) on delete cascade,
  pathway_id      uuid not null references public.pathways(id),
  tier            public.tier not null default 'free',
  source_purchase uuid references public.purchases(id),
  granted_at      timestamptz not null default now(),
  primary key (member_id, pathway_id)
);

-- 1.3a owns_pathway() (no dependency on pathway_nodes.pathway_id)
create or replace function public.owns_pathway(p uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.member_pathways
    where member_id = auth.uid() and pathway_id = p
  );
$$;

-- 1.4 pathway_id on pathway_nodes + drift-safe backfill
alter table public.pathway_nodes
  add column pathway_id uuid references public.pathways(id);

update public.pathway_nodes
   set pathway_id = (select id from public.pathways where slug = 'depop')
 where pathway_id is null;

alter table public.pathway_nodes
  alter column pathway_id set not null;

-- 1.3b owns_node() (needs pathway_nodes.pathway_id to exist first)
create or replace function public.owns_node(n text)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
      from public.pathway_nodes pn
      join public.member_pathways mp on mp.pathway_id = pn.pathway_id
     where pn.id = n and mp.member_id = auth.uid()
  );
$$;

-- 1.5 Backfill: every existing member owns the Depop pathway
insert into public.member_pathways (member_id, pathway_id, tier)
select p.id,
       (select id from public.pathways where slug = 'depop'),
       coalesce(p.tier, 'free')
  from public.profiles p
 where p.role = 'member'
on conflict (member_id, pathway_id) do nothing;

-- 1.6 Interim auto-grant trigger (INTERIM until Phase 5 pathway-scoped purchases:
-- every member profile gets/keeps a Depop pathway row mirroring profiles.tier.
-- Phase 5 deletes this trigger and writes member_pathways rows from the purchase
-- flow instead.)
create or replace function public.grant_default_pathway()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  insert into public.member_pathways (member_id, pathway_id, tier)
  values (new.id, (select id from public.pathways where slug = 'depop'),
          coalesce(new.tier, 'free'))
  on conflict (member_id, pathway_id)
    do update set tier = excluded.tier;
  return new;
end;
$$;

create trigger profiles_grant_default_pathway
  after insert or update of tier on public.profiles
  for each row
  when (new.role = 'member')
  execute function public.grant_default_pathway();

-- 1.7 RLS
alter table public.pathways        enable row level security;
alter table public.member_pathways enable row level security;

create policy pathways_read on public.pathways
  for select using (auth.role() = 'authenticated');
create policy pathways_admin_write on public.pathways
  for all using (is_admin()) with check (is_admin());

create policy member_pathways_select_own_or_admin on public.member_pathways
  for select using (member_id = auth.uid() or is_admin());
create policy member_pathways_admin_write on public.member_pathways
  for all using (is_admin()) with check (is_admin());

drop policy pathway_nodes_read on public.pathway_nodes;
create policy pathway_nodes_read on public.pathway_nodes
  for select using (
    (auth.role() = 'authenticated')
    and (is_admin() or (has_active_access() and owns_pathway(pathway_id)))
  );

drop policy progress_member_insert on public.member_pathway_progress;
create policy progress_member_insert on public.member_pathway_progress
  for insert with check (
    (member_id = auth.uid()) and has_active_access() and owns_node(node_id)
  );

drop policy progress_member_update on public.member_pathway_progress;
create policy progress_member_update on public.member_pathway_progress
  for update
  using     ((member_id = auth.uid()) and has_active_access() and owns_node(node_id))
  with check ((member_id = auth.uid()) and has_active_access() and owns_node(node_id));
