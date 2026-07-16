# design-sync notes — sync-agency

- This is an app repo, not a packaged component library: the bundle is built from the authored barrel `.design-sync/ds-entry.jsx` (set as `cfg.entry`). The barrel imports `src/styles/global.css` + `src/styles/portal.css` so both ship in `_ds_bundle.css`. **When a new reusable component lands in `src/components/`, add it to the barrel AND `componentSrcMap`.**
- `global.css` sets `body { cursor: none }` (the app pairs it with the excluded custom `<Cursor/>`). `.design-sync/ds-overrides.css` (wired via `cfg.cssEntry`) restores normal cursors and re-asserts `body { background: var(--black) !important }` because the preview-card harness defaults body to white, which hides the dark-theme text.
- The site genuinely ships a `prefers-color-scheme: light` token remap (global.css ~line 388, cream bg + plum text). Headless capture defaults to light, so **preview cards show the light variant** — expected, not a bug. Designs render whichever scheme the viewer uses.
- HeroPanel's rows use staggered `slideIn` entrance animation (`.panel-animate`, delays up to ~1s) — its authored preview neutralizes the animation or the screenshot catches rows at opacity 0.
- FadeUp/StaggerGrid are IntersectionObserver reveals — they fire fine in headless capture, no special handling.
- Card overrides in config: Nav `cardMode: single` + viewport (position:fixed header), Marquee + PathwayIcon `cardMode: column` (full-width strips / wide state rows).
- Playwright: the machine cache has chromium-1223, which pins **playwright@1.60.0** (installed into `.ds-sync/`). Run validate/capture with `NODE_PATH=.ds-sync/node_modules`.
- `DSProvider` (`.design-sync/ds-extra.jsx`, via `extraEntries`) wraps previews in a MemoryRouter — Nav throws without router context.
- Known render warns: none outstanding.

## Re-sync risks

- The barrel + `componentSrcMap` are a manually maintained scope — new components in `src/` are invisible to the sync until added; removed/renamed source files break the barrel import (build fails loudly).
- `conventions.md` enumerates live class names from global.css/portal.css — re-validate it after any CSS refactor (grep the named classes against the fresh `_ds_bundle.css`).
- Capture appearance depends on the light-theme block; if the owner removes or reworks it, cards will silently change look — re-eyeball the contact sheet.
- Deliberately excluded: Cursor, Guards, UTMIndicator, StripeBuyButton, CheckoutDrawer, CheckoutSuccessNotification, SocialProofTicker, StickyCTABar, CompetitionBanner, ExitIntentPopup (plumbing / data-bound / marketing one-offs) — the owner scoped these out on 2026-07-03.
- Google-hosted fonts (Cormorant Garamond, Syne) load via remote @import — `[FONT_REMOTE]` is the expected warn.
