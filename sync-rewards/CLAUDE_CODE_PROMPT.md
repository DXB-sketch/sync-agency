# Prompt for Claude Code

Copy everything in the block below into Claude Code, run from the repo root, with this folder at `sync-rewards/`.

```
I want to add the Sync Rewards system to the portal. The full handoff is in ./sync-rewards/.

Read these first, in this order:
1. sync-rewards/README.md
2. sync-rewards/SPEC.md (every rule and number; this is the source of truth for behaviour)
3. sync-rewards/INTEGRATION.md (how it maps onto this codebase, and the build order)
4. sync-rewards/design-system/BRAND.md

Then look at the mockups in sync-rewards/mockups/. They are Design Component files (.dc.html):
plain HTML with inline styles, {{holes}} filled by the renderVals() class at the bottom of each
file, <sc-for> loops and <sc-if> branches. Treat them as the exact reference for layout, sizes,
colours, copy and states, then rebuild them as React components using the repo's existing classes
(dash-card, btn-gold, tier-badge, etc. in src/styles/portal.css) and tokens in src/styles/global.css.
Don't copy the inline-style approach. Mobile and desktop mockups should become one responsive page each.

sync-rewards/drop-in/crate-fx.js (sound + haptics) and sync-rewards/drop-in/crate.css (crate
animations) are meant to be used nearly as-is: convert crate-fx.js to an ES module in src/lib/ and
move crate.css into src/styles/ without its duplicated :root token block.

sync-rewards/supabase/draft_rewards.sql is a draft. Review it against the existing schema and the
wallet tables before turning it into a migration, and tell me what you changed.

Work through INTEGRATION.md § 9 one step at a time. Before step 1, give me your plan and list
anything in SPEC.md § 8 (open decisions) you need me to decide. Ask me before changing the mobile
bottom tab bar, before touching Stripe or billing logic, and before applying anything to the database.
```
