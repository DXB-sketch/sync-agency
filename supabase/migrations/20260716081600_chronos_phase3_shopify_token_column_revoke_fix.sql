-- Applied to chronos-dev (moatcohllmhgabanxlqr) 2026-07-16 via Supabase MCP.
-- Follow-up to chronos_phase3_shopify_schema. Verified after that migration
-- committed that `authenticated`/`anon` still had column-level
-- SELECT/INSERT/UPDATE/REFERENCES on shopify_stores.access_token_enc despite
-- the REVOKE statement inside that same migration -- Supabase appears to
-- (re-)apply its default per-table grants to anon/authenticated/service_role
-- via a hook that isn't guaranteed to run strictly before a same-transaction
-- REVOKE takes final effect. Re-asserting the revoke here, as its own
-- migration, closes that gap and makes it independently verifiable/replayable.
-- REFERENCES is left alone (table-level grant, harmless -- it only allows
-- declaring a FK to this column, not reading data); SELECT/INSERT/UPDATE are
-- the privileges that actually matter for "never selectable by the member
-- role" and are revoked below.

revoke select, insert, update (access_token_enc)
  on public.shopify_stores
  from authenticated, anon;
