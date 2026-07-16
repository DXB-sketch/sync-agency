-- Applied to chronos-dev (moatcohllmhgabanxlqr) 2026-07-16 via Supabase MCP.
-- Project Chronos Phase 3 — Shopify Integration. Schema only (connection model +
-- product linking) + additive `orders` columns. Per PROJECT_CHRONOS_BUILD_PLAN.md
-- PART 3 §PHASE 3 and PART 4 schema summary.
--
-- Explicitly NOT built here: shopify-webhook / shopify-fulfil (depend on Phase 1's
-- dispatch-order and Phase 2's wallet, both in progress elsewhere) and any
-- wallet-debit logic. This migration only lays the connection + linking foundation.

-- ============================================================================
-- 1. Vault: symmetric key for pgcrypto encryption of the Shopify access token.
-- Encryption/decryption happens inside SECURITY DEFINER RPCs (below), mirroring
-- the get_secret() pattern from the Phase 1 migration -- the key and the
-- plaintext token never need to leave Postgres, let alone reach an edge
-- function's env or the client.
-- ============================================================================

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'shopify_token_key') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'shopify_token_key',
      'Symmetric passphrase for pgcrypto encryption of shopify_stores.access_token_enc (Chronos Phase 3).'
    );
  end if;
end $$;

-- ============================================================================
-- 2. shopify_stores -- v1 is one connected store per member (assumption, see
-- migration comment / build report: easy to lift the unique(member_id) later
-- if the founder wants multi-store support).
-- ============================================================================

create table public.shopify_stores (
  id                    uuid primary key default gen_random_uuid(),
  member_id             uuid not null unique references public.profiles(id),
  shop_domain           text not null unique,
  access_token_enc      bytea not null,
  webhook_state         jsonb not null default '{}',
  status                text not null default 'pending'
                        check (status in ('pending','connected','error','disconnected')),
  last_health_check_at  timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

comment on column public.shopify_stores.access_token_enc is
  'pgp_sym_encrypt(token, shopify_token_key vault secret). Not selectable by authenticated/anon (see column REVOKE below); read only via shopify_store_get_token(), called by service-role edge functions.';

alter table public.shopify_stores enable row level security;

-- Members: read their own row (status/domain/webhook_state/timestamps), never
-- the token column. No insert/update/delete policy for members -- every write
-- to this table goes through the shopify-connect edge function's service-role
-- client, because the row holds a live API credential (same posture as
-- supplier_tokens in Phase 1).
create policy shopify_stores_select_own on public.shopify_stores
  for select to authenticated using (member_id = auth.uid() and has_active_access());

create policy shopify_stores_admin_all on public.shopify_stores
  for all to authenticated using (is_admin()) with check (is_admin());

-- Column-level lock, on top of the RLS above: even though access_token_enc is
-- ciphertext (useless without the vault key), no client role -- member or
-- admin -- should ever be able to SELECT it out of the table directly. Only
-- the SECURITY DEFINER RPCs below (running as table owner) can touch it. This
-- is the "token column itself should never be selectable by the member role"
-- requirement, enforced independent of RLS. Chose this over a separate view:
-- one REVOKE, no second object to keep in sync with the table shape.
revoke select (access_token_enc) on public.shopify_stores from authenticated, anon;

-- ============================================================================
-- 3. Service-role RPCs: the only path that reads/writes the plaintext token.
-- ============================================================================

create or replace function public.shopify_store_upsert(
  p_member_id uuid, p_shop_domain text, p_access_token text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'shopify_token_key');
  v_id  uuid;
begin
  insert into public.shopify_stores (member_id, shop_domain, access_token_enc, status, updated_at)
  values (p_member_id, p_shop_domain, extensions.pgp_sym_encrypt(p_access_token, v_key), 'connected', now())
  on conflict (member_id) do update
    set shop_domain = excluded.shop_domain,
        access_token_enc = excluded.access_token_enc,
        status = 'connected',
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.shopify_store_upsert(uuid, text, text) from public, anon, authenticated;

create or replace function public.shopify_store_get_token(p_store_id uuid)
returns text
language sql security definer set search_path = ''
as $$
  select extensions.pgp_sym_decrypt(
    access_token_enc,
    (select decrypted_secret from vault.decrypted_secrets where name = 'shopify_token_key')
  )
  from public.shopify_stores where id = p_store_id;
$$;
revoke all on function public.shopify_store_get_token(uuid) from public, anon, authenticated;

-- ============================================================================
-- 4. product_links -- member's Shopify product/variant <-> Sync catalogue
-- product. "Link table" per build plan Part 4 RLS posture: members read their
-- own links; writes are service-role only (via shopify-connect's link/unlink
-- actions), same posture as shopify_stores -- keeps write validation (does
-- this product actually belong to this member? is this variant already linked
-- elsewhere?) in one place instead of an RLS WITH CHECK clause.
-- ============================================================================

create table public.product_links (
  id                 uuid primary key default gen_random_uuid(),
  shopify_store_id   uuid not null references public.shopify_stores(id) on delete cascade,
  shopify_product_id text not null,
  shopify_variant_id text not null,
  product_id         uuid not null references public.products(id),
  created_at         timestamptz not null default now(),
  unique (shopify_store_id, shopify_variant_id)
);

alter table public.product_links enable row level security;

create policy product_links_select_own on public.product_links
  for select to authenticated using (
    exists (
      select 1 from public.shopify_stores s
      where s.id = product_links.shopify_store_id
        and s.member_id = auth.uid()
        and has_active_access()
    )
  );

create policy product_links_admin_all on public.product_links
  for all to authenticated using (is_admin()) with check (is_admin());

-- ============================================================================
-- 5. orders: source + shopify_order_id (additive; defaults preserve today's
-- Depop rows/flow unchanged -- every existing and new portal order defaults to
-- source='portal', shopify_order_id stays null).
-- ============================================================================

alter table public.orders
  add column if not exists source text not null default 'portal'
    check (source in ('portal','shopify')),
  add column if not exists shopify_order_id text unique;
