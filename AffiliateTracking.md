Implement affiliate link tracking for this site.

## Goal

We're running a manual affiliate program. We'll hand out links like `https://oursite.com/?aff=JORDAN20` to affiliates. Anyone who visits via one of these links and later completes a purchase — regardless of which product, pricing tier, payment type (one-time or subscription), or which specific Stripe buy button they end up clicking — should have that affiliate code attached to the resulting Stripe payment, so we can manually reconcile sales to affiliates from the Stripe Dashboard.

We use Stripe's `<stripe-buy-button>` web component embeds (not server-side Checkout Session creation). That component supports a `client-reference-id` attribute, which Stripe attaches to the resulting Checkout Session/Payment. That's the mechanism to use.

## Requirements

- Capture the `?aff=` query param when present, sanitize it (it will end up in an HTML attribute, so don't allow anything that isn't safe there), and persist it client-side for a reasonable attribution window (e.g. ~30 days) so it survives the visitor browsing multiple pages or returning later before buying — not just the current session.
- Every Stripe buy button anywhere on the site should automatically pick up the stored affiliate code and apply it as `client-reference-id`, with no code missing it. Find every place a Stripe buy button is rendered and confirm coverage — don't assume there's only one.
- If no affiliate code is stored, buttons should render exactly as they do today (no empty/broken attribute).
- This is purely additive — don't change pricing, tier structure, existing analytics/UTM tracking, or anything else unrelated.
- Follow the existing code style and patterns already used in this codebase (e.g. however UTM params or similar transient client-side state are currently captured/stored/read) rather than introducing a new pattern.

## When you're done, report back

- Every file you changed and why.
- A full list of every Stripe buy button/checkout entry point in the codebase, and confirm each one now applies the affiliate code.
- How to manually verify it end-to-end: visiting with a test `?aff=` value, confirming it's stored correctly, clicking a buy button, and confirming `client-reference-id` shows up on the resulting Stripe Checkout Session in test mode.
- Anything you found in the codebase that seems broken or inconsistent with what this task assumed (e.g. if existing similar tracking code doesn't actually work as expected).
