# Phase 4 Course Content Brief — Shopify Dropshipping Pathway

This is a **brief for the agent/author who writes the node copy**, not the copy itself.
Companion to `docs/PHASE4_PLAN.md` (schema/UI). The copy it produces is seeded via the
`chronos_phase4_shopify_pathway_content` migration (plan §1.8).

Voice calibration below is taken from the **live Depop pathway node bodies** on `chronos-dev`
(queried 2026-07-16), not from memory. Re-read 2–3 live node bodies before writing.

---

## 1. Delivery format — hard technical constraints

Node copy lives in `pathway_nodes.body` and is rendered by
`src/components/portal/NodeBody.jsx`, a deliberately minimal renderer. It supports **only**:

- paragraphs (blank-line separated)
- `**bold**` and `*italic*`
- ordered lists (`1. `) and unordered lists (`- `)
- `> ` blockquotes (single-line)
- ` ```copy ` fenced blocks → rendered as a copy-to-clipboard box

It does **not** support headings, links, images, tables, nested lists, or inline code. Do not
use them — they will render as literal text. Structure long content as more nodes, not longer
bodies.

Node row fields the author must supply per node: `id` (scheme `sh<phase>_<slug>`, e.g.
`sh1_create_store` — the `sh` prefix keeps the namespace disjoint from Depop's `p*_` ids),
`phase` (1–7 = module number), `order_in_phase`, `title`, `body`, `icon` (a `GLYPHS` key —
see plan §4), `min_tier` (**null on every core node** — the core pathway ships on every tier;
tiers differ by service level, never by locking core content), `depends_on` (text[] of node
ids **within the Shopify branch only** — never reference a `p*_` Depop node).

---

## 2. Voice & structure — match the existing Depop nodes exactly

Two live samples for register (from `pathway_nodes` on `chronos-dev`):

> "Buyers decide in seconds whether your shop looks legit. Two things convince them: a real
> profile photo and a bio that answers their doubts before they have them." — then two
> numbered steps, an exact-value copy block, and "Mark complete when your photo and bio are
> live."

> "Anchor high, then discount. Depop shows the crossed-out original price, and the visible
> markdown is what converts browsers into buyers." — then a copy block of exact prices and a
> one-line speed tip in bold.

The formula every node follows:

1. **Outcome-first opener** — one or two sentences on why this step matters, stated as a
   practitioner's observation, never hype. ("Your storefront starts here. Set it up once,
   properly, and everything after gets easier.")
2. **Numbered, concrete steps** — imperative voice, second person. Bold the exact UI names
   the member will see (**Settings**, **Products**, **Orders**, **Wallet**).
3. **Exact values as ` ```copy ` blocks** — anything the member types, pastes, or sets
   verbatim (usernames, settings values, scope lists, price formulas, response templates).
   This is the signature of the course: specifics, not vibes.
4. **One "why" line** where a rule looks arbitrary ("Quantity 5 means one listing can sell
   multiple times without relisting.").
5. **Closer: an explicit done-check** — "Mark complete when/once …" tied to a verifiable
   state, not a feeling.

Length: **80–180 words per node body.** If it wants to be longer, split the node.
Density: one action theme per node. Tone: calm, direct, experienced; no exclamation marks,
no "crush it"/"insane results" register; premium and understated (dark/gold brand).

**No emojis anywhere in Shopify pathway copy.** (One legacy Depop node carries a star emoji
*inside a copy block that members paste into their Depop bio* — external-platform text, not
portal chrome. Do not repeat even that pattern in new content; default is zero emojis,
including inside copy blocks.)

---

## 3. The seven modules (exact set from the build plan — do not add or merge modules)

Node splits below are the recommended starting shape (2–3 nodes each, ~18 total). The author
may adjust splits within a module; the **module set and order are fixed**. Each module = one
`phase` = one hub in the tree.

### Module 1 — Set Up Your Store (phase 1)
Scope per build plan: account, theme, domain, legal pages, payments.
- `sh1_create_store` — create the Shopify account, pick the basic plan, tour the admin.
- `sh1_theme_pages` — install a clean free theme; create the four legal/trust pages
  (refund policy, privacy, terms, shipping/delivery-time page). Copy blocks: page checklist.
  Delivery-time wording **must match Sync's published fulfilment disclosure** (Phase 0.2) —
  do not invent shipping promises.
- `sh1_domain_payments` — connect a domain; enable payments (Shopify Payments/PayPal).
  No revenue projections here — setup mechanics only.

### Module 2 — Pick Your Products, from the Sync Catalogue (phase 2) — **flywheel-transparency module**
Scope per build plan: niche & product selection **from the Sync catalogue**; the course
teaches members to build on Sync-supplied products, **explicit and honest** that Sync is the
supplier and what that costs. This is a mandatory requirement, not tone guidance.
- `sh2_how_sourcing_works` — **the transparency node.** Must state, plainly and affirmatively,
  all four of these (checklist — sign off each individually before seeding):
  1. **Sync is your supplier.** Your curated catalogue in the **Products** tab is stock Sync
     sources and ships for you; when your store sells, the order is fulfilled through Sync.
  2. **What it costs you:** you pay the catalogue price for the product plus shipping on each
     order, paid automatically from your **Wallet** balance when a store order lands. Those
     two numbers are visible on every product before you ever list it. *(Exact shipping-price
     wording depends on the founder ratifying flat bands vs live quotes — decision #2 in
     `FOUNDER_DECISIONS_REQUIRED.md`. Use a `[FOUNDER-DATA: shipping pricing model]` token
     until ratified; the node cannot ship with the token unresolved.)*
  3. **What Sync keeps:** Sync makes a margin on each unit it supplies — say it in those
     words. Frame honestly as the business model: you get sourcing, stock handling, and
     direct-to-customer shipping without holding inventory; Sync earns on each unit it ships
     for you. Members should never discover the margin exists from anywhere but this course.
  4. **What you control:** your store's sell price — your profit is the difference between
     what your customer pays you and what you pay Sync. Show the arithmetic pattern as a
     copy block with variables, not invented numbers.
- `sh2_choose_products` — choosing from the assigned catalogue: selection criteria
  (category coherence, price band, weight/shipping sanity), how many to start with, how to
  request assignment changes. Grounded in the actual catalogue/assignment UI.

### Module 3 — Build & List (phase 3)
Scope: product pages, pricing psychology, trust elements.
- `sh3_product_pages` — product page anatomy: title, photos, description structure
  (copy-block template mirroring the Depop description-template pattern).
- `sh3_pricing` — anchor/markdown pricing using the **listing price** and **discounted
  price** already shown on the Products tab (same mechanic as the Depop
  `p2_price_listings` node — reuse that framing, adapted to Shopify's compare-at price).
- `sh3_trust` — trust elements: policies linked in footer, honest delivery times, guarantees
  you can actually honour. **Explicitly prohibited content:** fake reviews, fake scarcity/
  countdown timers, fabricated "X people are viewing" widgets. Brand principle: urgency only
  from real constraints.

### Module 4 — Connect Your Store to Sync (phase 4) — must double as the Phase 3 onboarding lesson
Scope: the custom-app token connection, taught as a lesson. Acceptance criterion: a
non-technical member connects their store using **only these nodes**, no support contact.
- `sh4_create_app` — create the custom app in Shopify admin; grant exactly the three scopes.
  Copy block with the literal scope names: `read_orders`, `write_fulfillments`,
  `read_products`.
- `sh4_paste_token` — paste the Admin API token into the portal's **Connect Store** screen;
  what the green/verified state looks like; what to do if verification fails.
- `sh4_link_products` — the product-linking screen: match each Shopify listing to its Sync
  catalogue product; what happens to orders containing unlinked products (they exception and
  you're notified — mirror the real Phase 3 behaviour).
**Hard dependency:** this module's copy must be written against the *built* Phase 3 screens
(names, button labels, states) — not the build plan's description of them. If Phase 3 UI
isn't merged on the branch yet, draft with `[VERIFY-UI: …]` tokens and resolve before seeding.

### Module 5 — Drive Traffic (phase 5)
Scope: organic (TikTok/IG content systems) and paid (starter Meta/TikTok ads).
- `sh5_organic_system` — a repeatable short-form content system: formats, cadence
  (copy-block posting schedule), hooks tied to the product niche.
- `sh5_content_that_converts` — what converts browsers: product-in-use, social proof you
  actually have, offer framing.
- `sh5_starter_ads` — small-budget starter structure for Meta/TikTok: one campaign, tight
  budget, kill/scale rules as copy blocks. **No ROAS promises, no "profitable in X days"** —
  frame as a testing framework with a defined daily budget the member chooses.
Platform-conduct guardrail: nothing that violates TikTok/IG/Meta TOS (no engagement pods,
follow/unfollow automation, DM spam). The Depop follow-tactic node is a Depop-specific
mechanic — do not port it.

### Module 6 — Run the Machine: Operations (phase 6)
Scope: wallet management, customer service, refund flows.
- `sh6_wallet` — how the wallet works: top-ups, what a debit looks like per order, the
  low-balance threshold, and what `awaiting funds` means for an order (member-facing wording
  per the built Phase 2 UI — verify labels, same `[VERIFY-UI]` rule as module 4).
- `sh6_customer_service` — response times, tone, and 2–3 copy-block reply templates
  (shipping-status question, where-is-my-order, quality complaint).
- `sh6_refunds` — the refund decision flow consistent with the member's published refund
  policy (module 1) and Sync's exception/refund handling. Never promise refund outcomes on
  Sync's behalf.

### Module 7 — Scale (phase 7)
Scope: reading margins, expanding catalogue assignments, when to add products.
- `sh7_read_your_numbers` — per-product margin arithmetic (sell price − Sync cost − shipping
  − ad cost), as a copy-block formula; when a product is working vs when to cut it.
- `sh7_expand_catalogue` — requesting expanded assignments, adding categories, tier
  upgrade path framed as service-level (more slots/support), not as unlocking secret content.

Dependency chains: linear within each module; each module's first node depends on the
previous module's last node (same convention as the Depop tree). First node
(`sh1_create_store`) has `depends_on = '{}'`.

---

## 4. Claims compliance — every earnings reference defensible (Phase 0.2, no exceptions)

This is the compliance hardening the whole business depends on (ACCC actively targets
earnings claims in make-money-online offers). Rules for **all** Shopify pathway copy:

1. **Banned outright, in any phrasing:** "100% success rate"; guaranteed sales/income/results;
   "replace your income"; specific earnings figures presented as typical or expected
   ("members make $X/week"); "profitable in X days"; any ROAS/conversion-rate promise.
2. **Numbers require documents.** A monetary or performance figure may appear only if the
   founder can produce documentation for it (verified member results, order data). Mechanism:
   write `[FOUNDER-DATA: <what's needed, e.g. documented member first-month revenue range>]`
   in the draft. Before seeding, every token is either replaced with the founder-supplied
   documented range (phrased as "documented member results range from…", never as a promise)
   or **the sentence is deleted**. The seeding migration must contain zero tokens (plan §1.8
   enforces this).
3. **Process claims are free; outcome claims are not.** "This is the exact checkout flow" —
   fine. "This flow will make you sales" — not fine. Teach mechanics and let the mechanism be
   the pitch.
4. **Delivery/shipping claims** must match the CJ lead times documented from Phase 0 test
   orders and Sync's published delivery disclosure — nothing faster.
5. **No replica/counterfeit references of any kind**, no "reps", no branded-lookalike
   sourcing. (The Rep Spreadsheet is retired; nothing in this pathway may echo it.)
6. **No AI-agent product features implied** — the course teaches the member doing the work
   with deterministic portal tools. Founder-internal tooling is never member-facing copy.
7. Costs charged by Sync (module 2, module 6) must be stated accurately per the ratified
   pricing decisions — where a decision is still open (shipping bands, pathway pricing),
   token it; never print an unratified price.

Sign-off procedure before the content migration is applied: one pass over every node body
checking (a) zero banned phrasings, (b) zero unresolved `[FOUNDER-DATA]`/`[VERIFY-UI]`
tokens, (c) module 2 transparency checklist (§3, four items) individually confirmed,
(d) zero emojis, (e) renderer-unsupported markdown absent (§1). Record the pass in the task
log (plan §6 task 8).

---

## 5. What the author receives vs must produce

Receives: this brief; live read access to the Depop node bodies (tone source of truth); the
built Phase 2/3 portal screens (UI-label source of truth); founder-supplied documented ranges
(via `FOUNDER_DECISIONS_REQUIRED.md` follow-ups) as they land.

Produces: one `insert into pathway_nodes …` content migration
(`chronos_phase4_shopify_pathway_content`, plan §1.8) containing ~18 nodes across phases 1–7
per §3, each passing §4 sign-off; plus the list of node-level icon keys actually used, so the
icon task (plan §6 task 4) covers exactly what the content needs.
