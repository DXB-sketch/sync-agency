# Backup before deploying Sync Rewards webhook + XP catch-up (2026-11-15)

- `functions/stripe-webhook/index.ts`: live v17 (referrals only, no Sync Rewards). Redeploy it
  with verify_jwt OFF to switch Rewards awarding back off.
- `rewards-state.json`: the 4 affected members' Sync Rewards state before the catch-up award.
  To undo the catch-up for those 8 top-ups, restore `member_rewards` to these values (delete
  the rows for members listed under members_without_rewards_row), delete rewards_events whose
  stripe_ref is in owed_topups_stripe_refs, and delete any reward_crates / reward_grants for
  those members whose id is not in existing_crate_ids / existing_grant_ids (check first that
  no crate was opened; opened crates may already have paid wallet credit).
