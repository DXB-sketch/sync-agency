-- Finishing Project Chronos Phase 3: shopify-webhook needs a per-store shared secret to
-- verify X-Shopify-Hmac-Sha256 on inbound deliveries. The original Phase 3 schema pass
-- (chronos_phase3_shopify_schema) didn't add one because shopify-webhook wasn't built yet --
-- adding it now, same encryption pattern as access_token_enc (reuses the shopify_token_key
-- vault secret; pgp_sym_encrypt embeds its own random salt/IV per call, so reusing the key
-- for a second column is safe).
--
-- Design note (not founder-ratified, flagging in FOUNDER_DECISIONS_REQUIRED.md): for a
-- Shopify CUSTOM app (this project's v1 connection model, per build plan §3.1), the value
-- Shopify signs webhook payloads with is the custom app's "Client secret" / "API secret key"
-- -- a distinct credential from the Admin API access token already collected. There is no way
-- to derive it from the access token, so the member must paste both when connecting.
--
-- Verified live (unlike the first Phase 3 pass): the in-same-migration REVOKE DID take effect
-- this time (information_schema.column_privileges shows anon/authenticated have only
-- REFERENCES, no SELECT, immediately after apply) -- this migration only ALTERs an existing
-- table rather than CREATEing one, so whatever hook re-applied default grants after CREATE
-- TABLE last time apparently doesn't fire on ADD COLUMN. Still verified independently rather
-- than assumed, per the lesson from that incident.

alter table public.shopify_stores
  add column if not exists webhook_secret_enc bytea;

comment on column public.shopify_stores.webhook_secret_enc is
  'pgp_sym_encrypt(secret, shopify_token_key vault secret). The custom app''s API secret key (Shopify''s "Client secret"), used to verify X-Shopify-Hmac-Sha256 on inbound shopify-webhook deliveries. Not selectable by authenticated/anon; read only via shopify_store_get_webhook_secret().';

revoke select (webhook_secret_enc) on public.shopify_stores from authenticated, anon;

-- New 4-arg signature; only caller (shopify-connect) is updated in the same pass.
create or replace function public.shopify_store_upsert(
  p_member_id uuid, p_shop_domain text, p_access_token text, p_webhook_secret text
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_key text := (select decrypted_secret from vault.decrypted_secrets where name = 'shopify_token_key');
  v_id  uuid;
begin
  insert into public.shopify_stores (member_id, shop_domain, access_token_enc, webhook_secret_enc, status, updated_at)
  values (p_member_id, p_shop_domain, extensions.pgp_sym_encrypt(p_access_token, v_key),
          extensions.pgp_sym_encrypt(p_webhook_secret, v_key), 'connected', now())
  on conflict (member_id) do update
    set shop_domain = excluded.shop_domain,
        access_token_enc = excluded.access_token_enc,
        webhook_secret_enc = excluded.webhook_secret_enc,
        status = 'connected',
        updated_at = now()
  returning id into v_id;
  return v_id;
end;
$$;
drop function if exists public.shopify_store_upsert(uuid, text, text);
revoke all on function public.shopify_store_upsert(uuid, text, text, text) from public, anon, authenticated;

create or replace function public.shopify_store_get_webhook_secret(p_store_id uuid)
returns text
language sql security definer set search_path = ''
as $$
  select extensions.pgp_sym_decrypt(
    webhook_secret_enc,
    (select decrypted_secret from vault.decrypted_secrets where name = 'shopify_token_key')
  )
  from public.shopify_stores where id = p_store_id;
$$;
revoke all on function public.shopify_store_get_webhook_secret(uuid) from public, anon, authenticated;
