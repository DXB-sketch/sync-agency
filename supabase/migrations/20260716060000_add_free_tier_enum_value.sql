-- Applied to chronos-dev (moatcohllmhgabanxlqr) 2026-07-16 via Supabase MCP.
-- Schema-drift fix, part 1/2 (see 20260716060100_schema_parity_fix_production.sql).
--
-- chronos-dev's tier enum was missing 'free' (production has free/pro/elite/vip;
-- chronos-dev only had pro/elite/vip). production.profiles.tier defaults to
-- 'free'::tier and tier_product_limit() switches on it. ADD VALUE must commit
-- before the value can be referenced elsewhere, hence its own migration file.

alter type public.tier add value if not exists 'free' before 'pro';
