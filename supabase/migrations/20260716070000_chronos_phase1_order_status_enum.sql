-- Applied to chronos-dev (moatcohllmhgabanxlqr) 2026-07-16 via Supabase MCP.
-- Project Chronos Phase 1 — Fulfilment Engine v2. Part 1/2 (own migration file
-- because ADD VALUE must commit before the new labels can be referenced
-- elsewhere — see docs/PHASE1_PLAN.md §0.2 / §1.3 Variant A).
--
-- Verified against chronos-dev: orders.status is a Postgres enum (order_status),
-- not text+check, so Variant A applies.

alter type public.order_status add value if not exists 'dispatching';
alter type public.order_status add value if not exists 'dispatched';
alter type public.order_status add value if not exists 'exception';
