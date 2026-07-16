-- Applied to chronos-dev (moatcohllmhgabanxlqr) 2026-07-16 via Supabase MCP.
-- Daily cron wiring for shopify-health (build plan §3.3: "a daily health
-- check that flags dead tokens"). Reuses the edge_functions_url /
-- internal_trigger_secret vault secrets already created for Phase 1
-- (docs/PHASE1_PLAN.md §1.7) rather than inventing new ones.

select cron.schedule('shopify-health-daily', '0 18 * * *', $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'edge_functions_url') || '/shopify-health',
    headers := jsonb_build_object('Content-Type','application/json','Authorization',
               'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'internal_trigger_secret')),
    body    := '{}'::jsonb)
$$);
