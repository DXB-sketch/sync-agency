These are the rules you must follow at all times:

## 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Project: Sync Agency

Two apps live in this repo:
- src/portal/ — the primary webapp (client/admin portal for Depop dropshipping tools)
- src/{pages,sections,admin,components,...} — marketing/landing site

Backend: Supabase. Payments: Stripe. Mobile: Capacitor (ios/ and android/ are
generated native wrappers — do not read/edit unless task is explicitly native-mobile).

## Do not touch by default
- ios/, android/ (Capacitor native wrappers)
- node_modules/, dist/
- .design-sync/, .ds-sync/, ds-bundle/
- .env (contains live API keys — never read into context or echo back)

## State & data

**State management:** no library (no Redux/Zustand/etc.) — plain React Context + `useState`.
- `src/lib/AuthContext.jsx` — global `AuthContext`/`useAuth()` (session, profile, loading), subscribes to `supabase.auth.onAuthStateChange`.
- `src/portal/Tutorial.jsx` — local `TutorialContext`/`useTutorial()` for the guided-tour overlay, portal-scoped only.
- Everything else is component-local `useState`/`useEffect`. Cart state (`src/lib/cart.js`) is plain functions over `localStorage`, not React state.

**Data fetching:** no hooks/wrapper layer — `supabase.from(...)` and `supabase.functions.invoke(...)` are called directly inline in components (client from `src/lib/supabase.js`, a bare `createClient` instance). Pattern repeats across `src/portal/{AchievementsPage,DashboardPage,CheckoutPage,PathwayPage}.jsx`, `src/admin/{ProductsAdminPage,OrdersQueuePage,ClientDetailPage}.jsx`, `src/lib/AuthContext.jsx`. `src/lib/tiers.js` and `src/lib/cart.js` are the only "lib" helpers, and neither wraps network calls.

**Stripe/checkout:** client never touches Stripe.js directly — pages call one shared edge function and redirect to the returned URL.
- `src/portal/CheckoutPage.jsx` inserts `orders`/`order_items` then invokes `create-checkout-session` with `{kind:"stock_order"}`.
- `src/portal/UpgradePage.jsx` invokes it with `{kind:"upgrade"}`; `src/portal/ReactivatePage.jsx` with `{kind:"reactivate"}`.
- `supabase/functions/create-checkout-session/index.ts` branches on `kind`: one-time payment (stock order), subscription or prorated lifetime payment (upgrade), or subscription reuse (reactivate). Reads `STRIPE_SECRET_KEY` env var.
- Admin catalogue side (`src/admin/ProductsAdminPage.jsx`, `src/admin/ClientDetailPage.jsx`) calls `create-stripe-product`, `archive-stripe-product`, `merge-stripe-duplicates`, `update-stripe-price` — all admin-only, all under `supabase/functions/`.
- `supabase/functions/stripe-webhook/index.ts` handles inbound Stripe events server-side.
- Edge functions share no `_shared` code (CORS/`json()` helpers duplicated per function); each creates a user-scoped client (from `Authorization` header) plus a service-role client for privileged reads/writes.

## Structure
- portal/       main webapp — start here for most feature work
- pages/        marketing site routes
- sections/     marketing page sections
- components/   shared UI components
- admin/        admin-only views
- data/         static data/fixtures
- lib/          Supabase/Stripe clients, utilities
- utils/        helper functions
- styles/       global styles

## Exploration
Scope Grep/Glob to the relevant folder (portal/ vs marketing folders) — the two
apps rarely share logic beyond components/ and lib/.
