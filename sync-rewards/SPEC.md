# Sync Rewards — product spec

All money is AUD. All numbers below are proposals from the design; change them in one place (a shared config) when building.

## 1. Earning XP

- **10 XP per $1** of wallet credit bought (a top-up that has cleared in Stripe).
- Bigger top-ups add a pack bonus:

| Top-up | Base XP | Bonus | Total XP | Badge |
|---|---|---|---|---|
| $50 | 500 | 0% | 500 | |
| $100 | 1,000 | +5% | 1,050 | |
| $250 | 2,500 | +10% | 2,750 | Most popular |
| $500 | 5,000 | +15% | 5,750 | Best value |
| $1,000 | 10,000 | +20% | 12,000 | |

- Custom amounts (the wallet allows $10–$1,000) earn base XP plus the bonus of the largest pack at or below the amount.
- **Weekly streak** (optional for v1): +5% XP while the member has topped up or placed a stock order in each of the last N consecutive weeks. Shown as "4 weeks · +5% XP" on the hub.
- Refunded top-ups remove the XP they earned (see § 7).

## 2. Levels

- **1 level = 1,000 XP** (= $100 of credit). `level = floor(xp_total / 1000) + 1`.
- Progress to next level = `xp_total % 1000` out of 1,000.
- The hub always shows the small goal in both XP and dollars: "Only 360 XP to Level 13 · $36 of credit to go".

## 3. Ranks

Rank is set by **lifetime credit bought** and never drops (except through refunds).

Levels come from XP and ranks come from credit, so pack bonuses mean members usually hit a rank's level slightly before its dollar threshold. The level column is the level at that spend with no bonuses, for display only. **Rank is always decided by lifetime credit.**

| Rank | Lifetime credit | ≈ Level | Unlocks |
|---|---|---|---|
| Bronze | $0 | 1 | Rewards access, weekly streak bonus |
| Silver | $500 | 6 | **Elite Scale course**, a mystery crate at every level |
| Gold | $1,500 | 16 | **VIP Inner Circle course**, priority access to new stock drops, Gold crates instead of Silver |
| Platinum | $4,000 | 41 | Quarterly 1:1 strategy call, 3% back as credit |
| Black | $10,000 | 101 | Founders' mastermind, 5% back as credit, free express shipping |

Course unlocks map to the existing course tiers in `src/lib/tiers.js` (`elite`, `vip`). A rank unlock grants access to that tier's course content; it doesn't change the member's billing plan. See `INTEGRATION.md` for how to model this.

Rank colours: Bronze `--bronze`, Silver `--silver`, Gold the gold gradient, Platinum `--plat`, Black near-black with a `--p-gold-deep` edge.

## 4. Level rewards (the reward track)

- From Silver onward, **every level grants one crate**: a Silver crate while Silver, a Gold crate from Gold upward.
- Milestone extras on top of the crate:

| Level | Extra |
|---|---|
| 14 | $5 wallet credit |
| 15 | +1 product slot for 30 days |
| 16 | Gold rank (VIP Inner Circle course) |
| 20 | $10 wallet credit |

- A single top-up can cross several levels. Grant every reward crossed, then show the rank-up screen if a rank was crossed ("Six levels in one top-up").

## 5. Mystery crates

Crates are **earned by levelling only and are never sold**. Each crate pays out exactly one reward. The roll happens **on the server**; the client only animates the result.

### Silver crate (up to $30)

| Reward | Chance | Rarity |
|---|---|---|
| $30 wallet credit | **3%** | Legendary |
| $10 wallet credit | 12% | Epic |
| $5 wallet credit | 20% | Rare |
| 5% off next stock order | 15% | Rare |
| +1 product slot, 30 days | 10% | Rare |
| $2 wallet credit | 20% | Common |
| +200 bonus XP | 20% | Common |

### Gold crate (up to $50)

| Reward | Chance | Rarity |
|---|---|---|
| $50 wallet credit | **3%** | Legendary |
| $20 wallet credit | 10% | Epic |
| $10 wallet credit | 20% | Rare |
| 10% off next stock order | 18% | Rare |
| +1 product slot, 30 days | 12% | Rare |
| $5 wallet credit | 17% | Common |
| +500 bonus XP | 20% | Common |

Expected credit per crate: Silver **$3.50**, Gold **$6.35**, plus the non-cash rewards.

Rarity colours (in `drop-in/crate.css`): Legendary `--r-legendary` (bright gold), Epic `--r-epic` (amber), Rare `--r-rare` (platinum blue), Common `--r-common` (silver).

Reward behaviour:
- **Wallet credit**: added to the wallet balance immediately on collect, as a ledger entry marked as a reward.
- **Bonus XP**: added to `xp_total`. It counts toward levels but **not** toward lifetime credit (so it can't move rank).
- **Stock-order discount**: one active at a time, applied automatically at the next checkout, then consumed. If a second is won while one is unused, keep the larger.
- **Product slot**: raises the member's product limit by 1 for 30 days from activation. Stacks.

The odds must be visible from every crate screen (an "Odds" button), and a full odds sheet must exist (`CrateOdds`). Apple requires this for random rewards tied to purchases.

## 6. Screens and states

Each mockup in `mockups/` is the reference for layout, spacing, colour and copy.

### Rewards hub (`Main` / `DesktopHub`)
- Level ring (progress to next level), XP total, rank pill.
- Level bar with "LVL n · $x of credit to go · LVL n+1".
- Next-rank goal: "Gold rank in $336", with a progress bar and the course it unlocks.
- Stat tiles: streak, next crate, lifetime credit (desktop), member percentile (desktop, optional).
- Reward track: the previous level, the current level, and the next 4–6 rewards. Mystery placeholder "?" for rewards beyond the next rank.
- Rank ladder (desktop inline, mobile on `Ranks`).
- Primary CTA: "Top up & earn XP" with a caption that names the pack that reaches the next rank.

### Top-up packs (`TopUp` / `DesktopTopUp`)
- The five packs; default selection is the smallest pack that reaches the next rank, otherwise "Most popular".
- Selecting a pack updates: target level, target rank, the course unlock (only if the pack reaches a new rank), and on desktop the list of every reward crossed plus an order summary (credit, base XP, pack bonus, total XP, new balance).
- CTA "Pay $500.00 AUD" starts the existing wallet top-up checkout.
- Caption: "XP is added as soon as your payment clears."

### Rank-up moment (`RankUp` / `DesktopRankUp`)
Shown once after returning from a top-up that crossed a rank. Note: the mockups say "3 crates" for the Level 12 → 18 example. Under these rules it's 6 (Silver 13–15, Gold 16–18); show the real count. Shows the new rank shield with the new level, "You're Gold", the course unlocked, the rewards collected on the way (crates, credit, slots), and the next rank goal. CTAs: "Start the VIP course", "Open my crates".

### Crate opening (`CrateOpen` / `DesktopCrate`)
State machine:

| Phase | Duration | Visual | Sound (`crate-fx.js`) | Haptic |
|---|---|---|---|---|
| idle | — | Crate floats, gem pulses, rays turn slowly, "Tap the crate to open" | — | — |
| tap | instant | | `tap()` wooden knock | medium |
| shake | 1.4 s | Shake builds and scales up, light leaks from the lid seam, aura grows | `shake(1.4)` accelerating rattles + rising whoosh | a light tick on every rattle, medium for the last 40% |
| burst | 0.65 s | Lid flies off, body drops, flash, screen jolt, shockwave ring, particles | `burst()` boom + crack + glitter | heavy |
| reveal | until collect | Reward card pops in, rarity rays and glow, confetti, value counts up | `reveal(rarity)` chime sized to rarity; `tick(p)` during count-up | success, or a long jackpot pattern for Legendary |
| collect | instant | Back to idle with the next crate | `coin()` | light |

- A sound on/off toggle is on the screen. Sound starts on the first tap (browser rule).
- `prefers-reduced-motion`: skip shake/burst, go straight to the reveal with the final value.
- Desktop adds a crate queue (pick which crate to open), the odds for the selected crate, and recent pulls.
- Empty state: "All crates opened" + when the next crate drops + "Top up & earn XP".

## 7. Edge cases

- **Refunds / chargebacks**: reverse the XP and lifetime credit from that top-up. Recompute level and rank. Unopened crates from levels no longer reached are removed. Rewards already collected stay (or claw back credit; your call).
- **Concurrency**: two top-ups clearing at once must not double-grant levels. Do all awarding in one database transaction keyed on the Stripe event id.
- **Idempotency**: Stripe can deliver a webhook twice. Record the event id and ignore repeats.
- **Existing members at launch**: backfill `lifetime_credit` and `xp_total` from past top-ups, but grant no crates for levels already passed (or a one-off welcome crate; your call).

## 8. Open decisions

1. XP on credit **bought** (designed) vs credit **spent** on stock orders. Spent is safer against top-up-then-refund farming.
2. Native iOS app: show top-up packs and course unlocks, or show progress only. The portal already hides Upgrade in the native app (`isNativeApp()`).
3. Legal review of crates that pay wallet credit by chance.
4. Streak bonus and the member percentile stat: build, or drop for v1.
5. Clawback policy for collected rewards after a refund.
