# Sync Rewards — design handoff

A game-style rewards system for the Sync portal. Members buy wallet credit, earn XP, climb levels and ranks, unlock higher courses, and open mystery crates with published odds.

## Where to put this

Unzip into the repo root so you get `sync-agency/sync-rewards/`. It is reference material only: nothing in here is wired into the app. Then open Claude Code in the repo and paste the prompt from `CLAUDE_CODE_PROMPT.md`.

## What's inside

| Path | What it is | Use it for |
|---|---|---|
| `CLAUDE_CODE_PROMPT.md` | A ready-to-paste prompt for Claude Code | Starting the build |
| `SPEC.md` | Every rule and number: XP, levels, ranks, unlocks, top-up packs, crate odds, screen states, copy | The source of truth for behaviour |
| `INTEGRATION.md` | How this maps onto the existing codebase: routes, nav, wallet top-up, Stripe webhook, data model, native app rules | Planning the build |
| `supabase/draft_rewards.sql` | A draft migration (tables, RLS, functions) | Starting point for the schema. Review before applying |
| `design-system/` | Sync Agency tokens, brand rules and component CSS, extracted from `src/styles/` | Matching the look |
| `drop-in/crate-fx.js` | Synthesised sound effects + haptics for the crate opening (no audio files) | Copy into `src/lib/` and import |
| `drop-in/crate.css` | Every crate animation (float, shake, lid fly, burst, rays, confetti, card pop) plus rarity tokens | Copy into `src/styles/` |
| `mockups/` | The 11 design boards as source (`.dc.html`) | Exact layout, sizes, colours and copy for each screen |

## The screens

**Mobile (390 × 844)**: `Main` (rewards hub) · `Ranks` (rank ladder) · `TopUp` (top-up packs, interactive) · `RankUp` (rank-up moment) · `CrateOpen` (crate opening, interactive, sound + haptics) · `CrateJackpot` (the 3% reveal) · `CrateOdds` (odds sheet)

**Desktop (1440 wide, fluid)**: `DesktopHub` · `DesktopTopUp` (interactive) · `DesktopRankUp` · `DesktopCrate` (interactive, sound + haptics)

Live, clickable versions are on the design canvas: https://claude.ai/artifact/XKnyd9bxRDnXGmH9Ue6hHM
Design system: https://claude.ai/artifact/A7WKKoFL3wDvZ7tx9hLqtQ
(Both are private to you until shared from their Share menu.)

## Decisions still open

These are flagged in `SPEC.md` § Open decisions. The numbers in the spec are proposals; tune them before launch.

1. XP on credit **bought** (current design) or on credit **spent**.
2. Native iOS app: whether top-up packs and course unlocks are shown there (App Store rules, see `INTEGRATION.md`).
3. A legal check on crates that pay out wallet credit by chance (Australian consumer and gambling law).
4. Whether to build the weekly streak bonus and the "Top 18% of members" stat, or drop them for v1.
