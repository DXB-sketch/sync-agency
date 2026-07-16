# Claude Code Prompt — Sync Agency Portal Redesign (Pathway, Products, Dashboard, Nav, Tutorial)

Paste everything below this line into Claude Code (Fable 5).

---

## Context

You're working on the **Sync Agency member portal** — a gated, premium, dark/gold web app for a Depop dropshipping course (React 19 + Vite, Supabase backend/RLS, Stripe, static build deployed to SiteGround). Full project conventions are in the project's coding-assistant instructions file — follow them (custom hand-drawn SVG icons, never emojis; RLS enforces that clients have **read-only** access to prices; no Depop API/scraping; no functionality changes beyond what's listed below).

I've designed two new mockups using Claude Design, showing the target look for the next portal update:

- `C:\Projects\sync-agency\Mockups\<client-dashboard-mockup>.png` — mobile **client** dashboard view (pathway + tracking stats)
- `C:\Projects\sync-agency\Mockups\<admin-or-products-mockup>.png` — **products** view (pricing display)

**Before writing any code, open and study both images in the Mockups folder.** Treat them as the source of truth for spacing, color, type, iconography, corner radii, shadows/glow, and component structure. The mockups are illustrative, not pixel-exact specs — extract the *design system and conventions* (color palette, gold/dark gradient circles, typography hierarchy, spacing rhythm, card styling) and apply them consistently to every screen this update touches, not just the two that were mocked up. Reuse existing design tokens/CSS variables where they already match; extend them where the mockups introduce something new (e.g. new gold gradient node style, new card styling for products).

This is a **design and information-architecture update**, not a functionality change, with **one explicit exception**: admins gain the ability to set/edit a listing price and a post-listing discount price per product (see Products section below). Everything else — auth, checkout, order flow, achievements verification, admin capabilities — stays functionally the same; only presentation changes.

Apply every change below across **all targets that share this codebase**: the mobile web view, the packaged app-store builds, and the desktop web view. Where a change is described as desktop-specific (the full-width layout and pathway), scope it correctly with responsive breakpoints rather than applying it to mobile.

---

## 1. Dashboard tracking stats (client view)

Add four new stat items to the client dashboard, styled to match the mockup's small-caps/serif treatment used for other dashboard elements:

- **`$X Total Sales`** — total sales value for the client
- **`X Orders Shipped`**
- **`X Orders Placed`**
- **`X Earned`** — count of achievements earned (verified achievement screenshots)

Source these from existing data (orders table, achievements table) — no new backend concepts are needed, just new UI surfacing. Confirm the correct source fields/tables in the existing schema before wiring these up; ask me if a needed aggregate doesn't already exist rather than guessing.

## 2. Pathway redesign (skill-tree)

Restructure the pathway from today's flat/individual-node layout into a **grouped structure**, matching the mockup:

- Introduce a **Group node** — visually larger than a normal step node — representing a category (e.g. "Launch Your Store"). Each Group node shows overall progress for its category (e.g. "2 of 2 done") and branches downward into its individual instruction nodes, exactly as shown in the mockup (single trunk line down from the group, splitting into child nodes).
- Individual step nodes keep their existing icon-based style (custom SVG icons, gold circular nodes, checkmark badge on completion) but are visually subordinate to their parent Group node.
- Add a **"Groups" dropdown button** (top-right, per the mockup) that lists every group category and lets the user jump straight to a group's position on the pathway.
- **Remove** any pathway nodes dedicated to setting/discounting prices — pricing is moving entirely to the Products page (see below). In their place, add or edit a node that explains: prices for each item are shown on the Products tab; the member lists the item at the listing price shown there, then applies a discount **through Depop** after listing to reach the discounted price also shown there. This should read as an instructional step, in the site's existing pathway copy voice — reworded, not copy-pasted from any internal doc.
- Keep progress self-marked by the member, same as today — no change to how completion is recorded, just how it's grouped and displayed.

### Desktop pathway — full-screen, top-left expanding

For desktop specifically, the pathway should occupy the **entire viewport**, starting at the top-left and expanding **both downward and rightward simultaneously** as it branches — i.e., new groups/nodes push the layout further down and further right rather than staying in a constrained central column. This should feel spatial and expansive, taking advantage of the full desktop canvas, and should integrate with the new Group-node structure (groups arranged in a diagonal/cascading flow, each branching further down-and-right into their child nodes). Preserve zoom/pan or scroll behavior as needed so nothing is ever cut off, but the default/initial view should read as filling the screen, not centered in a narrow column.

## 3. Products page

Rework the product display (client view) to match the mockup:

- Show **listing price** and **discounted price** together with a directional indicator between them (e.g. arrow), exactly as in the mockup ("LIST ITEM FOR $45.00 → THEN DISCOUNT TO $38.00").
- Show **profit per sale** (discount price minus client cost) prominently.
- Show the **client's cost** ("You pay $X.XX") in smaller, de-emphasized text below, per the mockup.
- Keep the existing "Add to order" action and any other existing product-card functionality intact — this is a visual/layout rework of the card, not a new ordering flow.

### Admin product editing (the one functional change)

Update the admin product-creation/edit flow so admins can set and edit, per product:

- The listing price
- The discount price
- (Cost to client already exists — keep it, and make sure the profit-per-sale shown to clients is derived correctly from cost vs. discount price.)

**Do not change the RLS policy that keeps prices read-only for clients** — clients should only ever see the computed/display values through the normal client-facing queries; the write path stays admin-only, same trust boundary as today, just with new fields.

## 4. Mobile navigation

Replace the current mobile navigation with an **icon-based bottom nav bar**, as shown in the mockup. Follow the mockup's icon style (same custom-icon convention as the pathway) and states (active/inactive). Wire it to the existing top-level routes/sections — no new destinations unless the mockup clearly introduces one (in which case, flag it to me before adding a new route).

## 5. Dashboard tutorial redesign

Replace the current "highlight every step at once" tutorial with a compact, current-step-focused version:

- Show only the **current step** the member needs to complete, in a small, unobtrusive card.
- Add a **dropdown/expand control** to reveal the full list of steps when wanted, but keep every state — collapsed and expanded — much smaller than the current implementation. It should never dominate the dashboard the way the current version does.
- No change to how step completion is tracked — this is purely a presentational/information-architecture change to the same underlying step data.

## 6. Popups and tooltip/highlight system

Redesign the existing popup and box-highlighting tutorial system (the UI that walks users through highlighting specific elements) to use the same visual language introduced by the mockups — same corner radii, gold/dark palette, typography, and card treatment as the rest of this update. No change to *when* or *what* these popups trigger on — just their appearance.

## 7. Desktop layout — full width

Currently the desktop client and admin views only occupy the middle third of the screen, leaving both side thirds empty. Fix this so the desktop portal uses the full viewport width:

- Expand layout containers so content fills the available width, using generous spacing/larger components rather than adding new decorative elements just to fill space.
- Don't invent new sidebar content, ads, or filler — the goal is a layout that scales properly to the viewport, not new information density.
- The pathway is the main showcase for this (see the full-screen pathway spec above) — make sure it and the products/dashboard views all reflect the same "uses full width intentionally" principle rather than centering in a fixed max-width column.

---

## How to approach this

1. First, view both mockup images at the paths above and study them carefully.
2. Then explore the current codebase to find: the pathway/skill-tree components, the dashboard stat area, the products page and admin product form, the mobile nav component, the tutorial/step component, and the popup/highlight tutorial system. Map out what exists today before changing anything.
3. Propose a short implementation plan (component-by-component) and check it against this brief before making sweeping changes, especially anywhere you're inferring something the mockups don't fully specify.
4. Implement incrementally, keeping the existing design tokens/CSS variables where they already fit, extending them where the mockups introduce new patterns.
5. Preserve all existing RLS policies and data flows except the one explicit addition (admin-editable listing/discount price fields). If anything here seems to require a functionality or schema change beyond that, stop and ask me first rather than assuming.
6. After implementing, run the project's build/lint/type-check and fix anything that breaks, and sanity-check the responsive behavior at mobile, app-store-build, and desktop breakpoints.
