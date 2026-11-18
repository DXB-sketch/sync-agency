# First-run tutorials: requirements

These tutorials replace the current text-popover tour in `src/portal/Tutorial.jsx`. They are live, interactive overlays on the real screens, not videos.

Files: `mockups/` (playable references: press Play), `mockups/TutorialKit.dc.html` (the building blocks), `assets/tut.css` (spotlight, hand, card, dots, cheer, modal and practice-chip styles). Sound and the practice crate use `assets/crate-fx.js` and `assets/crate.css` (the same files as the shipped Rewards crates). Styling follows design refresh v2.

## 1. How every step works

- The screen dims to 80%. The one target glows gold, pings outward, and a hand taps at it every 1.1s.
- An instruction card is pinned to the top or bottom of the screen (whichever side the target isn't on). It has an icon, one bold line (at most 8 words, starting with the verb and naming the button exactly as written) and one plain line saying why.
- The step moves on **only when the member taps the real target**. No Next buttons, except on the start and finish cards.
- After a step: a gold check, a short praise word and a chime, for about 0.9s. Then the next step starts.
- Five progress dots show how far through you are. **Skip** is always visible. The finish card offers the next action; Replay lives in Support.
- Mobile says "Tap", desktop says "Click".
- **Reduced motion:** no pulsing or tapping, cards appear instantly, and the crate jumps straight to its reveal.

## 2. When they show

| Tutorial | Shows | Then |
|---|---|---|
| Portal | Automatically on the member's first login | Marked seen on finish or Skip. Replay from Support (and the existing dashboard tutorial card) |
| Rewards | The first time the member opens Rewards | Same |

"Seen" is stored per member on the server, not in the browser, so it doesn't show again on a new device.

## 3. Rewards tutorial (demonstration only)

**Inputs:** the member's real `xp_total` and lifetime credit (for rank). The tutorial reads them and **writes nothing**.

| # | Screen | Target | Bold line | Plain line | On tap |
|---|---|---|---|---|---|
| start | Rewards hub | "Let's go" | Welcome to Sync Rewards | Top up, level up, open crates. Let's try it. It takes 30 seconds. | Step 1 |
| 1 | Rewards hub | XP bar | This bar is your XP. | Tap it. Fill it up to level up. | "Nice!" → step 2 |
| 2 | Rewards hub | Top up & earn XP | Tap here to top up. | Every $1 of credit = 10 XP. | Opens the packs screen in **practice mode** (chip: "Practice mode · no payment") → step 3 |
| 3 | Packs | The $500 pack | Tap the $500 pack. | See what it would do. Nothing is charged. | **Preview screen** for 2.6s (below), then the practice crate → step 4 |
| 4 | Practice crate | The crate | You got a crate! Tap it. | Every level gives you one. | Shake 1.4s → burst → $50 Legendary reveal, counting up → step 5 |
| 5 | Practice crate | Got it (practice) | Tap Got it. | You earn real crates as you level up. | "Nice!", That's how crates work → finish |
| finish | Modal | Start earning | You're ready! | Top up → Level up → Open crates. *This was practice. Nothing was charged or added.* | Back to the real hub |

**Preview screen:** the chip "Preview · nothing is charged", then:
- "+5,750 XP" and "This pack would take you to Level {n}", where n = floor((xp + 5,750) / 1,000) + 1;
- the rank pill for the rank at (lifetime credit + $500);
- "Would unlock {reward}", only if that rank is higher than the member's;
- "You're still Level {real level}. This was a preview."

The pack card itself reads "Would take you to {rank}" if the pack would rank them up, otherwise "Would take you to Level {n}".

**Practice crate:** always reveals $50 Legendary, labelled "Practice crate" and "Practice only. Nothing is added. Real crates use the odds in the app." It must never call `open-crate` or touch any real crate.

**Hard rules:** no Stripe session, no `wallet-topup` call, no inserts or updates to any rewards, wallet or crate table. The hub keeps showing the member's real numbers throughout.

## 4. Portal tutorial

| # | Screen | Target (mobile / desktop) | Bold line | Plain line | On tap |
|---|---|---|---|---|---|
| start | Dashboard | "Show me" | Welcome to Sync | Here's how your store works, in five taps. | Step 1 |
| 1 | Dashboard | Today's focus card | Start here every day. | Today's focus is your next step. Tap it. | Opens the Pathway |
| 2 | Pathway | The next open step | This is your Pathway. Tap your next step. | Mobile: Find it any time in More. Desktop: Each one tells you what to do. | Opens the step panel |
| 3 | Step panel | Mark complete | Done it? Tap Mark complete. | The next step unlocks. | "Nice!", Next step unlocked |
| 4 | Any | Products tab / Products nav | Made a sale? Tap Products. | Your stock lives here. | Opens Products |
| 5 | Products | First product's Add to order | Find what sold. Tap Add to order. | We source it for you. | Adds it (see note) |
| 6 | Products | Mobile: "1 item · Checkout →" bar. Desktop: Checkout nav | Now tap Checkout. | Pay for what you sold. | Opens Checkout |
| 7 | Checkout | Pay | Add your buyer's address. Tap Pay. | We ship it straight to them. | Order tracker runs Paid → Sourcing → Shipped → Delivered, then "Shipped!" |
| 8 | Any | Mobile: More tab. Desktop: Support nav | Stuck? Tap More / Click Support. | Mobile: Support and your Pathway live here. Desktop: The Sync team replies there. | "Found it!" |
| finish | Modal | Start my next step | You've got it! | Do a step → Made a sale? → Pay & ship. Mobile: Pathway and Support are both in More. | Back to Dashboard |

**Steps 3, 5 and 7 are simulated**, as in the Rewards tutorial. They don't complete the member's real step, add a real item to their order or charge anything. The UI shows the result, then returns to how it was. Whether step 3 should really complete the step is the owner's call; the default is simulated.

The mobile "1 item in your order · Checkout →" bar from step 6 also appears outside the tutorial whenever the order has items. It replaces the `SaleNudges` popover in `Tutorial.jsx`.

## 5. Sounds (from crate-fx.js)

| Moment | Sound |
|---|---|
| Any target tap | `tap()` |
| "Nice!" / praise | `reveal('common')` |
| $500 preview | `coin()`, then `reveal('epic')` after 0.35s |
| Crate | `tap()` + `shake(1.4)`, `burst()` at 1.4s, `reveal('legendary')` at 2.05s, `tick()` while the $50 counts up |
| Add to order, Pay | `coin()` |
| Order tracker stages | `tick()` per stage |

Sound follows the member's mute setting.
