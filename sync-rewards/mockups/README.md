# Mockups

The design boards, exported from the canvas (https://claude.ai/artifact/XKnyd9bxRDnXGmH9Ue6hHM).

These files are **Design Component** source (`.dc.html`). They don't run on their own; they need the canvas runtime (`support.js`, which isn't included). Read them as precise specs:

- Markup with inline styles: the exact layout, sizes and colours.
- `{{name}}` holes are filled from `renderVals()` in the `<script type="text/x-dc">` class at the bottom.
- `<sc-for list="{{items}}" as="item">` repeats; `<sc-if value="{{flag}}">` shows when truthy.
- `<dc-import name="CrateOpen" …>` embeds another board with props (`CrateJackpot` is `CrateOpen` with `crate="gold" start-phase="reveal" demo-result="jackpot"`).
- `onClick="{{handler}}"` binds a handler returned by `renderVals()`.
- Links between boards (`href="TopUp.dc.html"`) show the intended navigation.

| File | Screen | Size |
|---|---|---|
| `Main.dc.html` | Rewards hub | 390 × 844 |
| `Ranks.dc.html` | Rank ladder | 390 × 844 |
| `TopUp.dc.html` | Top-up packs (interactive) | 390 × 844 |
| `RankUp.dc.html` | Rank-up moment | 390 × 844 |
| `CrateOpen.dc.html` | Crate opening (interactive, sound, haptics) | 390 × 844 |
| `CrateJackpot.dc.html` | 3% jackpot reveal | 390 × 844 |
| `CrateOdds.dc.html` | Odds sheet | 390 × 844 |
| `DesktopHub.dc.html` | Rewards hub | 1440, fluid |
| `DesktopTopUp.dc.html` | Top-up packs (interactive) | 1440, fluid |
| `DesktopRankUp.dc.html` | Rank-up moment | 1440, fluid |
| `DesktopCrate.dc.html` | Crate opening (interactive, sound, haptics) | 1440, fluid |

Supporting files: `crate.css` (animations), `crate-fx.js` (sound + haptics), `ds/syncagency/components/bundle.css` (design-system classes), `canvas.json` (board layout and the sticky notes with the rules).

All figures in the mockups are example data for one member: 11,640 XP, Level 12, Silver, $1,164 lifetime credit, $248 wallet balance.
