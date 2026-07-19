-- Chronos Phase 2 — wallet: new order status for orders parked on insufficient wallet funds.
-- Reconstructed from production (project whuqfxdzopyucebtnbkx) to close a repo/migration-history
-- drift gap: this was applied directly via apply_migration in an earlier session and never
-- landed as a tracked file in this repo. DDL verified against the live enum, not re-executed.

alter type order_status add value if not exists 'awaiting_funds';
