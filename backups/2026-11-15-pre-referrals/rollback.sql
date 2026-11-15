-- Rollback for 20261115000000_creator_referrals.sql. Removes the referral program's database
-- objects. Run ONLY after redeploying the backed-up edge functions in ./functions (the new
-- webhook writes purchases.creator_id, which this drops). Deletes all creator/commission data.
drop function if exists public.mark_commissions_paid(uuid[], timestamptz, text);
drop function if exists public.member_has_referrer();
drop function if exists public.member_referrer(uuid);
drop function if exists public.record_referral_click(text);
drop function if exists public.referral_code_active(text);
drop view if exists public.creator_click_counts;
drop view if exists public.referral_commissions_view;
drop table if exists public.referral_commissions;
drop table if exists public.creator_clicks;
alter table public.purchases drop column if exists creator_id;
drop table if exists public.creators;
delete from supabase_migrations.schema_migrations where name = 'creator_referrals';
