Sync Agency sells Depop dropshipping courses and stock to resellers. There are two surfaces: the **portal** (members' web and Capacitor app: wallet, products, pathway, achievements) and the **marketing site**. Both are dark-only and gold-on-black. The portal is the primary system; marketing tokens are kept for landing pages.

## Content fundamentals

- Speak to the member as **you**, directly and plainly: "Pre-funded store credit. Pay for stock orders straight from your balance." "Top-up received. Your balance will update within a few seconds."
- Labels, nav, buttons and badges are **UPPERCASE** with tracking (`label`, `button`, `micro`). Headings and body are sentence case.
- Money is always shown with its currency: `$248.00 AUD`. Wallet top-ups run $10–$1,000.
- Tiers are named **Pro Accelerator**, **Elite Scale**, **VIP Inner Circle** (short forms Pro / Elite / VIP). `Free Dashboard` is legacy only.
- No emoji in UI copy.

## Visual foundations

**Color.** A warm near-black ground with a gold tonal range, all in oklch on hue ~85.
- Page ground: `p-bg`, fading out to `p-bg-deep` in a radial at the top of the page.
- Cards: a 165° gradient `p-card-hi` → `p-card-lo`, bordered by `p-line-soft`, with `p-shadow-card`.
- Text: `p-text` for headings and body, `p-muted` for sub-copy, `p-dim` for tertiary captions only.
- Gold: `p-gold` for text-weight gold (links, prices, logo, active nav); `p-gold-bright` for marks that should glow (active underline, in-progress rings); `p-gold-deep` for bronze details and focus borders.
- The **gold gradient** (135°: `p-gold` → `p-gold-bright` 55% → `p-gold-deep`) is reserved for the primary action, the VIP badge and the active bottom tab. Text on it is always `p-ink`.
- Status: `p-warn` on `p-warn-bg` for low balance; `p-danger` for rejected.
- Marketing pages use the flat hex set: `gold` on `black`, panels `card`/`card2`, copy `text`/`text-md`, hairlines `border`/`border-md`.

**Type.** Three Google-hosted families.
- `display` (Cormorant Garamond, 600) for every heading, price and big number: `portal-h1`, `card-title`, `wallet-amount`.
- `portal` (Jost) for portal UI and body: `portal-sub`, `card-sub`, `label`, `micro`.
- `marketing` (Syne) for marketing body copy; marketing headlines are `display` at 700 with italic words in `gold`.

**Spacing and radii.** Cards pad `space-5` (24px); dashboard grids gap `space-4`; product grids gap `space-3`. Portal corners are soft: `p-radius-lg` cards, `p-radius-md` tiles, `p-radius-btn` buttons, `p-radius-pill` badges. The marketing site is nearly square (`radius-mkt`, 2px).

**Depth.** Shadows are dark and low (`p-shadow-card`). One element per view may glow (`p-shadow-glow` plus a soft radial of `p-gold-bright` behind it) to mark what matters now.

**States.** Hover lifts by 1–2px and moves the border to `p-line-gold`. Locked items use a dashed border and `p-dim`. In-progress items get a `p-gold-bright` ring. Completed items fill with the gold gradient.

**Cursor.** The site hides the system cursor (`cursor: none`) and draws its own gold dot and ring. New interactive elements must keep `cursor: none` to match.

## Iconography

Line icons drawn inline as SVG, stroked in `currentColor`, usually `p-gold` inside a `p-elev` 32px well (`dash-stat-icon`). There is no icon font and no logo file: the portal logo is the wordmark "SYNC" in `display` 600, `p-gold`, letter-spaced 0.04em, followed by "/PORTAL" in `portal` 11px `p-muted` tracked 0.14em. The marketing logo is "Sync Agency" in `display` 700, `gold`.

## Contrast notes

`p-dim` on `p-card-hi` and `text-dim` on `black` fall below 4.5:1. They are kept exact from the source; use them only for uppercase labels or non-essential text.
