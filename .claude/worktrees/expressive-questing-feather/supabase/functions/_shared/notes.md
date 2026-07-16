# Edge Functions — source of truth

These folders mirror what is deployed to the Supabase project `whuqfxdzopyucebtnbkx` (Sync Client Portal).
Each function is self-contained (no shared imports) so it can be deployed independently.

Secrets required (set in Supabase Dashboard → Edge Functions → Secrets, or `supabase secrets set`):

- `STRIPE_SECRET_KEY`   — live Stripe secret key (placeholder until owner provides)
- `STRIPE_WEBHOOK_SECRET` — signing secret from the Stripe webhook endpoint registration
- `SITE_URL`            — https://syncagency.org

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are injected automatically.

`merge-stripe-duplicates` is newer than the original deploy — push it (and the updated
`create-stripe-product` / `update-stripe-price`) with `supabase functions deploy <name>`.
It's triggered from the admin Catalogue page ("Merge Stripe duplicates" button).

PLACEHOLDERS TO REPLACE (see PORTAL_SETUP.md at repo root):
- `price_PLACEHOLDER_*` course price IDs in `stripe-webhook/index.ts` and `create-checkout-session/index.ts`.
