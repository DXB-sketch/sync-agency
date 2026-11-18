# Integrating Sync Rewards into the portal

Written against the repo as it stands. Follow the repo's `CLAUDE.md` conventions: plain React Context + `useState`, `supabase.from(...)` / `supabase.functions.invoke(...)` called inline in pages, no new state or data-fetching libraries.

## 1. Where things go

| New | Path | Notes |
|---|---|---|
| Rewards hub page | `src/portal/RewardsPage.jsx` | Mobile + desktop in one responsive page (`Main` + `DesktopHub` mockups) |
| Rank ladder | section of `RewardsPage`, or `src/portal/RanksPage.jsx` | Mobile shows it as its own screen (`Ranks`) |
| Top-up packs | `src/portal/RewardsTopUpPage.jsx`, or extend `WalletPage.jsx` | `TopUp` / `DesktopTopUp` mockups |
| Crate opening | `src/portal/CratesPage.jsx` | `CrateOpen` / `DesktopCrate` mockups |
| Odds sheet | `src/portal/CrateOddsPage.jsx` or a panel in `CratesPage` | `CrateOdds` |
| Rank-up moment | `src/components/portal/RankUpModal.jsx` | Shown on return from a top-up that crossed a rank |
| Shared rules | `src/lib/rewards.js` | Plain functions and constants (levels, ranks, packs, milestone rewards, odds for display), like `tiers.js` |
| Sound + haptics | `src/lib/crateFx.js` | From `drop-in/crate-fx.js`; turn the `window.CrateFX` IIFE into ES module exports |
| Animations | `src/styles/rewards.css` | From `drop-in/crate.css`. Drop its `:root` token block except the new tokens (below), because `global.css` already defines the `--p-*` set |
| Styles for the pages | `src/styles/rewards.css` | Reuse `dash-card`, `dash-progress`, `btn-gold`, `btn-ghost`, `tier-badge`, `dash-stat-*` from `portal.css` |

### Tokens to add to `global.css` `:root`
`--p-radius-btn: 12px`, `--silver: oklch(86% 0.012 85)`, `--bronze: oklch(66% 0.10 55)`, `--plat: oklch(84% 0.035 220)`, and the rarity colours `--r-legendary`, `--r-epic`, `--r-rare`, `--r-common` (values in `drop-in/crate.css`). The mockups also use `--font-display` (Cormorant Garamond) and `--p-font` (Jost); in the mockups Jost is named `--font-portal`, so map it to the repo's `--p-font`.

## 2. Routes and navigation

- `src/App.jsx`: add `/portal/rewards`, `/portal/rewards/top-up`, `/portal/rewards/crates` under the existing `/portal` route (inside `RequireMember`).
- `src/portal/PortalLayout.jsx`:
  - `NAV_LINKS` (desktop strip): add `{ to: "/portal/rewards", label: "Rewards", icon: "rewards" }`.
  - `TAB_LINKS` (mobile/native bottom bar): the mockup puts Rewards in the middle of the five tabs (Dashboard, Pathway, **Rewards**, Products, More). That means moving Achievements into More (add `/portal/achievements` to More's `also`). Confirm with the owner before changing the tab bar.
  - Add a `rewards` icon (filled shield) to the icon set the tabs use.
- Show Rewards only when `walletEnabled(profile)` is true, the same gate the Wallet link uses.
- The topbar wallet chip with "+" (mockups) links to the top-up packs.

## 3. Earning XP from wallet top-ups

Today `WalletPage.jsx` calls `supabase.functions.invoke("wallet-topup", { body: { amount_cents } })` and redirects to the returned Stripe URL. `wallet-topup` and the Stripe webhook that credits the wallet are not in this repo's `supabase/functions/`; find the deployed source before changing them.

- **Packs**: the top-up packs page reuses the same `wallet-topup` call with the pack amount. The existing presets are `[5000, 10000, 25000]` cents; the packs are 5000, 10000, 25000, 50000, 100000.
- **Award on payment, server-side only**: in the webhook branch that credits a cleared wallet top-up, call the `award_topup_xp` database function from `supabase/draft_rewards.sql` in the same transaction. It:
  1. records the Stripe event id (idempotent),
  2. adds XP (base + pack bonus) and lifetime credit,
  3. computes the levels crossed, inserts a crate per level (from Silver), and inserts milestone rewards,
  4. records the rank before and after, so the client can show the rank-up moment.
- **Refunds**: handle `charge.refunded` by calling the reversal function (§ 7 of `SPEC.md`).
- **Return flow**: `WalletPage` already detects `justToppedUp` and reloads after 3s. Do the same on the rewards pages, then compare the rank to the last-seen rank (`member_rewards.rank_seen`) to decide whether to show `RankUpModal`.

## 4. Opening crates (server-side roll)

Never roll on the client. Add an edge function `open-crate` (pattern: user-scoped client from the `Authorization` header plus a service-role client, like the other functions):

1. Check the crate belongs to the caller and is unopened.
2. Roll with `crypto.getRandomValues` against the odds table for the crate type.
3. In one transaction: mark the crate opened, store the reward, and apply it (wallet credit ledger entry, XP, discount, product slot).
4. Return `{ reward: { kind, num, rarity, label, chance } }`.

The client starts the shake animation and the call at the same time. It holds the burst until the response arrives (with a minimum of 1.4s of shake), then reveals. If the call fails, stop the shake, keep the crate unopened, and show "Couldn't open the crate. Try again."

The mockups' `pools()` function shows the exact odds. Keep one copy of the odds on the server and expose them read-only (a `crate_odds` table or a constant served by the function) so the odds sheet can't drift from the real roll.

## 5. Course unlocks

Rank unlocks the Elite Scale course at Silver and VIP Inner Circle at Gold. The portal gates content with `meetsTier(memberTier, minTier)` (`src/lib/tiers.js`), using `profile.tier`.

- **Recommended**: add `rewards_course_tier` (the highest course tier unlocked by rank) and gate content on the max of `profile.tier` and `rewards_course_tier`. This keeps billing (`profile.tier`, Stripe) separate from reward unlocks.
- Don't write rank unlocks into `profile.tier`. The upgrade, reactivate and Stripe-webhook flows own that field.
- Product limits: `TIERS[tier].productLimit` plus active reward product slots.

## 6. Discounts at checkout

`CheckoutPage.jsx` inserts `orders` / `order_items`, then calls `create-checkout-session` with `{ kind: "stock_order" }`. Apply the member's active reward discount **server-side** in that function (look it up there, never trust the client), mark it consumed when the order is paid, and show it as a line on the checkout page.

## 7. Sound and haptics

- `crate-fx.js` synthesises every sound with the Web Audio API, so there are no audio files. The `AudioContext` must be created inside the first tap handler (the module does this lazily).
- Haptics use `window.Capacitor.Plugins.Haptics` when present. Add the plugin: `npm i @capacitor/haptics`, then `npx cap sync`. On Android web it falls back to `navigator.vibrate`; iOS Safari has no web vibration.
- Persist the mute toggle per device (localStorage is fine; it's a convenience).

## 8. Native app and compliance

- The portal hides Upgrade in the native app (`isNativeApp()` in `PortalLayout.jsx`) to stay clear of App Store payment rules. Unlocking **digital courses** through purchases made outside in-app purchase raises the same question. Decide before shipping native: show progress and crates only, and hide the top-up packs CTA, as Upgrade is hidden today.
- Apple requires apps offering random rewards connected to purchases to disclose the odds. Keep the "Odds" button on every crate screen.
- Crates that pay cash-equivalent credit by chance, earned through purchases, should get a legal check under Australian law before launch.

## 9. Suggested build order

1. `src/lib/rewards.js` (rules) + `draft_rewards.sql` reviewed and applied to a branch database.
2. Webhook awarding + backfill script for existing members.
3. Rewards hub + rank ladder (read-only).
4. Top-up packs (reuses `wallet-topup`).
5. `open-crate` function + crate opening screen with sound, haptics and reduced-motion support.
6. Rank-up modal, discounts at checkout, product slots, course unlock gating.
7. Native app review (§ 8).
