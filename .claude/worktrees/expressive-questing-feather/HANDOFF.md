# Sync Agency — Session Handoff

Give this file to a new chat to continue work seamlessly. Last updated: 2026-07-10.

## Project overview

Marketing site + member portal for **Sync Agency** (Depop dropshipping service). Members pay a subscription tier; Sync stocks products for them, members list/sell on Depop, and order fulfilment stock through the portal.

- **Stack:** React 19 + Vite (JS, no TS), React Router, Supabase (auth/DB/edge functions), Stripe (subscriptions + checkout), Capacitor (iOS/Android native builds).
- **Deploy:** `npm run build` → upload `dist/` to SiteGround (manual). No CI.
- **Repo:** https://github.com/DXB-sketch/sync-agency (branch `main`).
- **Supabase project:** `whuqfxdzopyucebtnbkx` ("Sync Client Portal") — MCP connector available; DB changes go through `apply_migration` and are mirrored as files in `supabase/migrations/`.
- **Lint quirk:** eslint config lives at `src/eslint.config.js` — run `npx eslint src --config src/eslint.config.js` (root `npm run lint` fails). ~20 pre-existing errors are accepted baseline; don't add new ones.

## Repo layout (portal-relevant)

- `src/portal/` — member portal: `PortalLayout.jsx` (desktop top nav + `BottomTabBar`), `DashboardPage.jsx`, `PathwayPage.jsx`, `ProductsPage.jsx`, `CheckoutPage.jsx`, `SupportPage.jsx`, `UpgradePage.jsx`, `MorePage.jsx`, `Tutorial.jsx`
- `src/admin/` — admin console: `AdminLayout.jsx`, `ProductsAdminPage.jsx` (catalogue + pool + pricing), `ClientsPage.jsx`, `ClientDetailPage.jsx`, orders queue, achievements review
- `src/components/BottomTabBar.jsx` — icon tab bar + exported `TabIcon`; `src/components/portal/PathwayIcon.jsx`, `NodeBody.jsx`
- `src/lib/` — `supabase.js`, `AuthContext.jsx`, `tiers.js` (TIERS/PAID_TIERS/tierRank/meetsTier), `cart.js` (localStorage cart), `nativeApp.js` (`isNativeApp()` = Capacitor detection), `productImages.js`
- `src/styles/global.css` (site-wide + `--p-*` design tokens) and `src/styles/portal.css` (portal/admin styles)
- `Mockups/SyncClientMockup.extracted.html`, `SyncAdminMockup.extracted.html` — design source of truth (extracted from Claude-Design bundles)
- `Revamp.md` — the original revamp brief; `APP_STORES.md` — native app store notes

## Key domain/DB facts

- Tables: `profiles` (role: admin|member; tier), `products` (per-member stock; `price` = member cost, `listing_price`, `discount_price`), `pool_products` (unassigned catalogue; same price columns; `distribute_pool_products(p_tier)` copies prices on assignment), `orders` (+`order_items`), `pathway_nodes` (39 nodes: id text like `p2_offers`, phase 1–6, order_in_phase, body markdown, icon, min_tier, depends_on text[]; gx/gy columns exist but are **unused** — layout is computed), `member_pathway_progress` (upsert on member_id+node_id), achievements tables, support tickets.
- **RLS trust boundary:** product/pool writes are admin-only (`is_admin()`); members read own rows via `has_active_access()`. Prices must stay read-only for clients — do not loosen.
- Edge functions: `create-checkout-session`, `create-stripe-product`, `archive-stripe-product`, `merge-stripe-duplicates`, `delete-account`.
- Native app rule: hide Upgrade/purchase links when `isNativeApp()` (Apple IAP rule 3.1.1).

## Design system (2026-07 revamp)

Tokens in `global.css` `:root` prefixed `--p-*`: dark oklch background (`--p-bg: oklch(15% 0.014 85)`), gold accents (`--p-gold`, `--p-gold-bright`, `--p-gold-deep`, `--p-grad-gold`), card gradient `--p-grad-card`, radii `--p-radius-*`. Fonts: **Cormorant Garamond** (display, `--font-display`), **Jost** (portal body, `--p-font`), Syne stays for the marketing site. Icons are always inline stroke SVGs — **never emojis** (Android WebView renders some unicode as emoji).

## Portal revamp — what was shipped (branch `worktree-portal-revamp`, merged to local `main`)

1. **Dashboard:** 4 stat tiles ($ total sales, orders shipped, orders placed, achievements earned) computed client-side from `orders`; compact tutorial card (progress `seen/total`, "Up next" button, "Show all steps" expander); merged progress-ring + Today's-focus card.
2. **Pathway:** grouped into 6 phase hubs (`GROUPS` in `PathwayPage.jsx`: Launch Your Store / List Your Products / Drive Traffic / Sell & Fulfil / Scale / VIP). **Layout: centred vertical trunk on BOTH breakpoints** — hubs stacked top-down, children diverge left/right in rows of 2 (lone last child sits on trunk). Constants `M` (mobile, 380px) and `D` (desktop, 900px) in `PathwayPage.jsx`. Sticky "Groups" jump dropdown top-right. Drag-to-pan on desktop. (An earlier down-and-right cascade was reverted by user request on 2026-07-10.)
3. **Pricing nodes consolidated:** 6 old phase-2 pricing nodes deleted, replaced by one `p2_price_listings` node pointing members at the Products tab; `p2_offers` now depends on it.
4. **Products page:** cards show "1. List item for $X → 2. Then discount to $Y", profit pill (`discount − cost`, shown only if > 0), de-emphasised "You pay $cost AUD". Falls back to plain price when listing/discount are null.
5. **Admin products:** listing/discount price columns everywhere (create form, catalogue table inline editor via `savePrices` — updates both `products` by ids and same-named unassigned `pool_products`).
6. **Navigation:** desktop keeps top nav strip; mobile/native uses icon `BottomTabBar` with 5 tabs (Dashboard, Pathway, Products, Achieve, More). `MorePage.jsx` holds Upgrade (hidden in native), Checkout & orders, Support, Sign out, and delete-account danger zone (hidden for admins). Tab bar shows at ≤768px or `.portal-native`.
7. **Tutorial:** anchors via `data-nav="…"` attributes, picks first *visible* match; progress persisted in localStorage `sync_tutorial_seen`.
8. **DB migration applied to production** and mirrored at `supabase/migrations/20260709_listing_discount_prices_and_pricing_node_consolidation.sql`.

## Current git state (as of 2026-07-10)

- Local `main` at `C:\Projects\sync-agency` = merged revamp (commits: `e801c35` WIP snapshot → `13b54a9` merge). Tree verified identical to branch tip.
- Branch `worktree-portal-revamp` pushed to origin (tip `7d7dcdb`); worktree lives at `.claude\worktrees\portal-revamp`.
- **Local `main` is NOT pushed** — user pushes when ready. No PR was opened (gh CLI not installed); compare URL: https://github.com/DXB-sketch/sync-agency/pull/new/worktree-portal-revamp
- Build verified passing in both checkouts (`vite build` ✓).

## Open follow-ups (flagged, not done — need user decision)

1. **"Total sales" semantics:** currently sums member stock spend (`orders.total_amount`), not Depop revenue. Alternative: qty × `discount_price`.
2. **Admin `ClientDetailPage.jsx` `addProduct` form** (~line 95–133) lacks the new listing/discount price inputs.
3. **Native-app tour** still contains the two Upgrade steps (IAP wrinkle).
4. Dashboard orders query fetches all rows and filters client-side — could filter server-side.
5. **Admins must populate listing/discount prices** in the admin console before members see the new pricing flow on product cards.
6. Bundle is >500 kB minified (Vite warning) — code-splitting candidate.

## Owner decisions on record (do not re-ask)

- Nav: 5 tabs + More screen. Pricing nodes: 6 → 1 new instructional node. Tutorial progress: localStorage.
- Mockup node text was written blind — real `pathway_nodes` content wins over mockup copy.
- See also memory file `sync-portal-decisions.md` (admin email, domain, Stripe placeholders, subscription lockout, tier nodes).

## Working rules (from CLAUDE.md)

Think before coding, surface assumptions, ask when unsure (owner explicitly prefers being asked over guessing). Simplicity first, surgical changes only, match existing style, verify with build/lint before finishing.
