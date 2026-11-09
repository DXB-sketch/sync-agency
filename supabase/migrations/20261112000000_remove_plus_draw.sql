-- Sync Plus monthly draw discontinued (prize draws are prohibited by Stripe).
-- The function is dropped so no draw can be run; plus_draws is kept as a read-only
-- historical record of draws already paid out (wallet ledger links to it).
drop function if exists public.draw_plus_winner();
