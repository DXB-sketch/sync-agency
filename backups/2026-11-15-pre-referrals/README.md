# Backup before the creator referral deploy (2026-11-15)

Live state captured right before deploying. To roll back, in this order:

1. Redeploy the old edge functions from `functions/` (same names, same JWT settings):
   - `stripe-webhook` (verify_jwt **off**), was v16
   - `create-checkout-session` (verify_jwt on), was v17
   - `create-landing-checkout` (verify_jwt on), was v6
   e.g. `supabase functions deploy stripe-webhook --no-verify-jwt` after copying the file into
   `supabase/functions/stripe-webhook/index.ts` (or paste it into the Supabase dashboard editor).
2. Run `rollback.sql` in the Supabase SQL editor (deletes all creator/commission data).
3. Stripe webhook `we_1Tp0vGPDABwVk3W5cXCBLuD6`: set events back to the list in
   `stripe-webhook-endpoint.json` (removes charge.refunded and charge.dispute.created).
   Leaving the two extra events on is harmless with the old webhook (it ignores them).
4. Re-upload the previous site build (the old `dist/`) if the site was updated.

Note: the live stripe-webhook (v16) was the repo version from commit ed46cc6. The Sync Rewards
webhook code from commit 4f1e80b (top-up XP, refund clawback) has never been deployed, and this
deploy deliberately does not include it either.
