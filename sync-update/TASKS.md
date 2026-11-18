# Sync Agency update: tasks

Integrate the work in this folder into the repo. Each folder's `SPEC.md` holds the requirements for that piece. The mockups (`*.dc.html`) set layout, spacing, colour and copy. Sync Rewards is already built in the repo, so this folder doesn't cover it.

| Folder | What it is |
|---|---|
| `1-design-system/` | Sync Agency design system v1: tokens, components, brand rules |
| `2-design-refresh/` | Design refresh (v2) for the portal and the marketing site |
| `3-tutorials/` | First-run playable tutorials for the Portal and for Rewards |

## Tasks

1. **Apply the design refresh** to the portal (`src/portal/`), including the existing Rewards screens, and to the marketing site, as `2-design-refresh/SPEC.md` describes.
2. **Replace the current portal tour** with the playable Portal tutorial and add the Rewards tutorial, as `3-tutorials/SPEC.md` describes.

## Rules for all tasks

- Where v1 (`1-design-system/`) and v2 (`2-design-refresh/`) disagree, v2 wins: sentence-case buttons and nav, the system cursor, Jost instead of Syne, and the text contrast values.
- The tutorial mockups use v1 styling. Build them in v2 styling, and keep their steps, copy, motion and sound.
- **Mobile bottom tabs, in this order:** Dashboard · Rewards · Products · Achieve · More. Pathway and Support live in More.
- **Marketing site content must match the live site, https://syncagency.org.** The repo's marketing code is older than the live site. Keep the live site's sections, order, copy, prices and disclaimers. Apply only the visual fixes in the refresh SPEC. `2-design-refresh/live-site-reference/` has screenshots of the live site taken 12 Nov 2026.
- All money is AUD.
- Sync Rewards' behaviour doesn't change: no change to XP, levels, ranks, crates or odds. Only its styling follows v2.
- Every screen must work at phone width (390px) and desktop width (1440px), with keyboard focus and `prefers-reduced-motion`.
- Leave `ios/`, `android/`, `.env`, `node_modules/` and `dist/` untouched.

## Done means

- Every numbered finding (1–14) and every "Also fixed everywhere" item on the audit board (`2-design-refresh/mockups/Main.dc.html`) is fixed.
- The marketing site matches syncagency.org in content, with the v2 visual fixes applied.
- Both tutorials run on first visit. Each shows once per member, stored server-side, and can be replayed from Support.
- The Rewards tutorial uses the member's real level and rank. It charges nothing and adds or unlocks nothing.
- `npm run build` and `npm run lint` pass.
