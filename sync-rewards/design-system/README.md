# Sync Agency design system

Extracted from `src/styles/global.css` and `src/styles/portal.css`; the values match the codebase exactly. The live version is https://claude.ai/artifact/A7WKKoFL3wDvZ7tx9hLqtQ.

- `BRAND.md`: usage rules (voice, colour, type, spacing, depth, states, iconography, contrast notes).
- `tokens.json`: every colour, type style, spacing step, radius and shadow, each with a usage note.
- `components.css`: the portal component classes used by the mockups (`btn-gold`, `btn-ghost`, `tier-badge`, `dash-card`, `dash-progress`, `dash-stat-*`, `portal-nav`, `ach-status`). These already exist in `portal.css`, so don't import this file into the app; it's here so the mockups render the same.

New tokens the rewards design adds (add these to `global.css`): `--p-radius-btn`, `--silver`, `--bronze`, `--plat`, `--r-legendary`, `--r-epic`, `--r-rare`, `--r-common`. Values are in `../drop-in/crate.css`.
