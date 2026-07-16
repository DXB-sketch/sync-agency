# Phase 4 Implementation Plan — Shopify Education Pathway (multi-pathway skill tree)

Status: implementation-ready plan. Target environment: Supabase branch `chronos-dev`
(`moatcohllmhgabanxlqr`). Nothing here touches production (`whuqfxdzopyucebtnbkx`).

Sources this plan is derived from (read them before deviating):
- Build plan PART 3 §PHASE 4 and PART 4 (external doc, `PROJECT_CHRONOS_BUILD_PLAN.md`):
  `pathways` table + `pathway_id` on nodes; member access via `member_pathways(member_id,
  pathway_id, tier, source_purchase)`; same node-graph component, new branch data, new SVG icons.
- `docs/PHASE4_COURSE_CONTENT_BRIEF.md` (companion, written with this plan) — governs all node copy.
- `docs/FOUNDER_DECISIONS_REQUIRED.md` — pricing/beta items still open; nothing here blocks on them.
- Live state of `chronos-dev` verified 2026-07-16 (see §0 — do not re-derive, but re-verify).
- Repo patterns: `src/portal/PathwayPage.jsx` + `DashboardPage.jsx` (direct `supabase.from()`,
  no wrapper hooks), `src/components/portal/PathwayIcon.jsx` (hand-drawn SVG glyph map),
  `src/components/portal/NodeBody.jsx` (minimal markdown renderer), security-definer RLS
  helpers `is_admin()` / `has_active_access()`.

Scope note: Phase 4 is schema + RLS + portal UI + admin grant UI + icon assets + course
content seeding. **Zero new edge functions.** Pricing/purchase wiring of pathways is Phase 5.

---

## 0. Verified current state (checked live on `chronos-dev`, 2026-07-16)

Re-run these checks before applying anything — other agents are working on this branch in
parallel (Phase 1 dispatch/webhook work, Phase 3 partial). Expect drift in *their* tables;
none of it touches ours.

1. **Tables.** `pathways` and `member_pathways` do **not** exist yet. Existing:
   - `pathway_nodes(id text PK, phase int, order_in_phase int, title text, body text,
     icon text, min_tier tier null, depends_on text[] default '{}', gx int default 0,
     gy int default 0)` — 8 rows (the tracked seed).
   - `member_pathway_progress(member_id uuid, node_id text, status node_status
     default 'available', completed_at timestamptz)` — PK `(member_id, node_id)`,
     FK member→`profiles(id)` on delete cascade, FK node→`pathway_nodes(id)`.
   - `profiles(..., role user_role default 'member', tier tier default 'free',
     subscription_active bool default true)`.
   - `purchases(id uuid PK, email, tier, billing_type, amount, stripe_session_id,
     linked_member_id, created_at)`.
2. **Enums.** `tier = {free,pro,elite,vip}`, `node_status = {locked,available,in_progress,complete}`,
   `user_role = {member,admin}`.
3. **RLS today (exact, from `pg_policies`):**
   - `pathway_nodes_read` SELECT: `(auth.role() = 'authenticated') AND (has_active_access() OR is_admin())`
   - `pathway_nodes_admin_write` ALL: `is_admin()`
   - `progress_member_insert` INSERT with_check: `(member_id = auth.uid()) AND has_active_access()`
   - `progress_member_update` UPDATE: same predicate both sides
   - `progress_select_own_or_admin` SELECT: `((member_id = auth.uid()) AND has_active_access()) OR is_admin()`
   - `progress_admin_all` ALL: `is_admin()`
   - Helpers `is_admin()` / `has_active_access()` are `sql STABLE SECURITY DEFINER set search_path to 'public'`
     one-liners over `profiles`. **Reuse this exact shape for the new helper in §1.3.**
4. **Migrations applied** (via `list_migrations`): `...initial_schema`, `...storage_buckets`,
   `...seed_pathway_and_achievements`, `20260716075501 add_free_tier_enum_value`,
   `20260716075544 schema_parity_fix_production`, `20260716075908 chronos_phase1_order_status_enum`,
   `20260716075957 chronos_phase1_fulfilment_engine`. **Collision rule:** re-run
   `list_migrations` immediately before applying; version-stamp Phase 4 migrations later than
   anything present (this plan uses `20260716090000` / `20260716090100` — bump if taken). Do
   not touch any `chronos_phase1_*` / future `chronos_phase3_*` objects.
5. **Known content drift (do not "fix" as part of Phase 4):** `chronos-dev` has the 8-node
   seed version of the Depop tree, but production's tree has since evolved (repo migration
   `20260709_...` replaced the pricing nodes with `p2_price_listings`, re-chained `p2_offers`,
   and production has phase 5/6 nodes the seed lacks). Consequence: **every data statement in
   §1 must be drift-safe** — written against "whatever rows exist", never a hardcoded node
   list. All statements below satisfy this.
6. **Profile creation path:** `auth.users` insert → `handle_new_user()` → `profiles` row.
   `profiles` has 0 rows on the branch (branch doesn't copy data), so the §1.5 backfill
   no-ops here and does its real work at production merge time — the trigger in §1.6 covers
   everyone created after.

---

## 1. Migration DDL — `supabase/migrations/20260716090000_chronos_phase4_pathways.sql`

Apply via Supabase MCP `apply_migration` on `chronos-dev` only, and commit the same file to
the repo (house precedent: the Phase 1 migrations exist in both places).

### 1.1 `pathways` table + seed rows

```sql
create table public.pathways (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  created_at timestamptz not null default now()
);

-- Seed both rows now. The shopify row is invisible to every member until a
-- member_pathways row grants it — safe to exist before content lands.
insert into public.pathways (slug, name) values
  ('depop',   'Depop Dropshipping'),
  ('shopify', 'Shopify Dropshipping');
```

Display names are a ratifiable default — log in `FOUNDER_DECISIONS_REQUIRED.md`; renaming is
a one-row UPDATE, nothing keys on `name`.

### 1.2 `member_pathways` table (per build plan Part 4)

```sql
create table public.member_pathways (
  member_id       uuid not null references public.profiles(id) on delete cascade,
  pathway_id      uuid not null references public.pathways(id),
  tier            public.tier not null default 'free',
  source_purchase uuid references public.purchases(id),
  granted_at      timestamptz not null default now(),
  primary key (member_id, pathway_id)
);
```

**`member_pathways.tier` is recorded but NOT yet authoritative.** In Phase 4 all tier gating
(`min_tier` on nodes, product limits, upgrade flows) continues to read `profiles.tier` exactly
as today. Phase 5 (pathway-scoped pricing) is the phase that switches gating to per-pathway
tier. Do not wire any UI to `member_pathways.tier` now — it exists so Phase 5 has clean data
from day one (kept in sync by the §1.6 trigger). `source_purchase` stays null until Phase 5
creates pathway-scoped purchases; the backfill leaves it null deliberately (existing purchases
predate the concept).

### 1.3 Ownership helper (house-style security-definer, avoids nested-RLS evaluation)

```sql
create or replace function public.owns_pathway(p uuid)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.member_pathways
    where member_id = auth.uid() and pathway_id = p
  );
$$;

-- For progress-write policies: does the caller own the pathway this node belongs to?
create or replace function public.owns_node(n text)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1
      from public.pathway_nodes pn
      join public.member_pathways mp on mp.pathway_id = pn.pathway_id
     where pn.id = n and mp.member_id = auth.uid()
  );
$$;
```

### 1.4 `pathway_id` on `pathway_nodes` + drift-safe data migration

```sql
alter table public.pathway_nodes
  add column pathway_id uuid references public.pathways(id);

-- Every node that exists today is a Depop node, whatever set of rows this
-- database happens to have (drift-safe: no hardcoded node ids).
update public.pathway_nodes
   set pathway_id = (select id from public.pathways where slug = 'depop')
 where pathway_id is null;

alter table public.pathway_nodes
  alter column pathway_id set not null;
```

### 1.5 Backfill: every existing member owns the Depop pathway

Without this, the §1.7 policy change would lock every current member out of their tree in the
same instant it deploys. Same migration file, after 1.4, non-negotiable ordering.

```sql
insert into public.member_pathways (member_id, pathway_id, tier)
select p.id,
       (select id from public.pathways where slug = 'depop'),
       coalesce(p.tier, 'free')
  from public.profiles p
 where p.role = 'member'
on conflict (member_id, pathway_id) do nothing;
```

Admins are deliberately excluded — `is_admin()` short-circuits every policy below, so they see
all pathways without rows here.

### 1.6 Interim auto-grant trigger (Phase 5 replaces this — leave a comment saying so)

Today every purchase/signup is a Depop purchase, and `handle_new_user()` +
`stripe-webhook` only touch `profiles`/`purchases`. Until Phase 5 makes purchases
pathway-scoped, new members must keep getting the Depop tree automatically, and tier changes
(upgrades) must keep `member_pathways.tier` mirrored:

```sql
-- INTERIM until Phase 5 pathway-scoped purchases: every member profile gets/keeps
-- a Depop pathway row mirroring profiles.tier. Phase 5 deletes this trigger and
-- writes member_pathways rows from the purchase flow instead.
create or replace function public.grant_default_pathway()
returns trigger
language plpgsql security definer
set search_path to 'public'
as $$
begin
  insert into public.member_pathways (member_id, pathway_id, tier)
  values (new.id, (select id from public.pathways where slug = 'depop'),
          coalesce(new.tier, 'free'))
  on conflict (member_id, pathway_id)
    do update set tier = excluded.tier;
  return new;
end;
$$;

create trigger profiles_grant_default_pathway
  after insert or update of tier on public.profiles
  for each row
  when (new.role = 'member')
  execute function public.grant_default_pathway();
```

Note the upsert only syncs the **depop** row's tier. That is correct for the interim (there is
no way to buy the Shopify pathway before Phase 5); an admin-granted Shopify row's tier is set
by the admin and untouched by this trigger.

### 1.7 RLS changes

`pathways` and `member_pathways` get RLS; `pathway_nodes_read` and both progress write
policies are dropped and recreated with ownership added. Everything else
(`pathway_nodes_admin_write`, `progress_admin_all`, `progress_select_own_or_admin`) is
untouched.

```sql
alter table public.pathways        enable row level security;
alter table public.member_pathways enable row level security;

-- Pathway names are public marketing vocabulary, not a secret.
create policy pathways_read on public.pathways
  for select using (auth.role() = 'authenticated');
create policy pathways_admin_write on public.pathways
  for all using (is_admin()) with check (is_admin());

-- Members read their own grants; only admin writes (client-side grant UI in §3.3).
-- Members can never self-grant a pathway.
create policy member_pathways_select_own_or_admin on public.member_pathways
  for select using (member_id = auth.uid() or is_admin());
create policy member_pathways_admin_write on public.member_pathways
  for all using (is_admin()) with check (is_admin());

-- Nodes: visible only for owned pathways (this is the core Phase 4 access rule).
drop policy pathway_nodes_read on public.pathway_nodes;
create policy pathway_nodes_read on public.pathway_nodes
  for select using (
    (auth.role() = 'authenticated')
    and (is_admin() or (has_active_access() and owns_pathway(pathway_id)))
  );

-- Progress writes: additionally require owning the node's pathway. (Tightening beyond
-- the spec's letter: without it a member could write progress rows against unowned
-- pathways' node ids. Cheap, correct, uses the same helper.)
drop policy progress_member_insert on public.member_pathway_progress;
create policy progress_member_insert on public.member_pathway_progress
  for insert with check (
    (member_id = auth.uid()) and has_active_access() and owns_node(node_id)
  );

drop policy progress_member_update on public.member_pathway_progress;
create policy progress_member_update on public.member_pathway_progress
  for update
  using     ((member_id = auth.uid()) and has_active_access() and owns_node(node_id))
  with check ((member_id = auth.uid()) and has_active_access() and owns_node(node_id));
```

**Dual-pathway independence falls out of the data model, no special handling:** progress is
keyed `(member_id, node_id)` and node ids are namespaced per pathway (`p*_` Depop, `sh*_`
Shopify), so a member owning both pathways has two disjoint progress sets. Completing a
Shopify node can never touch Depop state.

**Revoke semantics:** deleting a `member_pathways` row hides the branch (nodes disappear via
RLS) but progress rows persist — re-granting restores progress exactly. Correct for beta
churn; document in admin UI copy, don't cascade-delete progress.

### 1.8 Content seed — separate migration, after copy is approved

`supabase/migrations/20260716090100_chronos_phase4_shopify_pathway_content.sql` — inserts the
Shopify `pathway_nodes` rows (ids `sh<phase>_<slug>`, `pathway_id` = shopify row, phases 1–7,
`min_tier` null on all core nodes, `depends_on` chains within the branch only, `gx`/`gy` left
at default — the component computes layout). Node list, copy and guardrails are governed by
`docs/PHASE4_COURSE_CONTENT_BRIEF.md`; keep schema and content in separate migrations so copy
can iterate without re-running DDL. **Do not seed nodes whose body still contains an
unresolved `[FOUNDER-DATA: …]` token (see brief §5).**

### 1.9 Post-migration verification (run all, record results)

```sql
-- Policies landed exactly as specified
select tablename, policyname, cmd, qual, with_check from pg_policies
 where tablename in ('pathways','member_pathways','pathway_nodes','member_pathway_progress')
 order by tablename, policyname;

-- No orphan nodes
select count(*) from pathway_nodes where pathway_id is null;  -- must be 0

-- Impersonation matrix (repeat per test user uuid; profiles is empty on the branch,
-- so first create 2 test users via Supabase Auth admin: A = member owning depop only,
-- B = member owning both; grant B shopify via a service-role insert)
begin;
set local role authenticated;
set local request.jwt.claims to '{"sub":"<USER-A-UUID>","role":"authenticated"}';
select pathway_id, count(*) from pathway_nodes group by 1;   -- depop only for A; both for B
insert into member_pathway_progress (member_id, node_id, status)
values ('<USER-A-UUID>', 'sh1_create_store', 'complete');     -- must FAIL for A (owns_node)
insert into member_pathways (member_id, pathway_id, tier)
select '<USER-A-UUID>', id, 'pro' from pathways where slug='shopify'; -- must FAIL (no self-grant)
rollback;
```

---

## 2. UI plan — `src/portal/PathwayPage.jsx` becomes multi-branch

Read of the actual component (452 lines) says most of it is pathway-agnostic already. Keep the
diff surgical.

### 2.1 Reusable unchanged (do not touch)

- The entire layout algorithm (`M`/`D` constants, the `useMemo` computing hubs/rows/trunk
  positions) — it derives everything from whatever node set it's given.
- Trunk/branch SVG rendering, `trunkStyle`, drag-to-pan handlers, hub/step buttons, the
  Groups jump menu, the node side-panel, `NodeBody`, `PathwayIcon` (extended, not modified —
  new glyphs only, §4).
- `nodeState` / `groupState` / `setStatus` — tier logic still reads `profile.tier` (§1.2),
  progress upsert unchanged.
- `?start=1` deep link (applies to the default/active pathway).

### 2.2 Changes (all inside `PathwayPage.jsx` + a few CSS classes)

1. **`GROUPS` constant becomes per-pathway.** Today it's a flat `{phase: {name, icon}}` map
   (6 Depop phases). Restructure keyed by slug:
   ```
   const GROUPS = {
     depop:   { 1: {name:"Launch Your Store", icon:"storefront"}, ... 6: {...} },   // exactly today's six
     shopify: { 1: {name:"Set Up Your Store", icon:"browser-store"},
                2: {name:"Pick Your Products", icon:"catalogue-grid"},
                3: {name:"Build & List", icon:"layout-blocks"},
                4: {name:"Connect to Sync", icon:"link-nodes"},
                5: {name:"Drive Traffic", icon:"megaphone"},
                6: {name:"Run the Machine", icon:"wallet"},
                7: {name:"Scale", icon:"growth-arrow"} },
   };
   ```
   Every existing `GROUPS[phase]` read (layout memo, node-panel head) becomes
   `GROUPS[activeSlug][phase]`. Hub names above are working labels — final names come from the
   content brief execution; icons from §4.
2. **Fetch owned pathways.** Extend the existing initial `Promise.all` with
   `supabase.from("member_pathways").select("pathway_id, granted_at, pathways(id, slug, name)").order("granted_at")`.
   (Admins get `[]` here — fall back to `supabase.from("pathways").select("*")` ordered by
   `created_at` when the profile role is admin, so "view as client"/admin preview still works.)
3. **Active-pathway state.** `const [activeId, setActiveId] = useState(null)` resolved to the
   first owned pathway once loaded. Nodes stay one query (RLS already scopes it); derive
   `branchNodes = nodes.filter(n => n.pathway_id === activeId)` and feed **that** to the
   existing layout memo. Switching pathways: `setOpenId(null)`, reset scroll to top-centre
   (the existing initial-scroll effect already re-runs when `laidOut` changes).
4. **Selector UI** — rendered only when the member owns ≥2 pathways (single-pathway members
   see zero difference): a small segmented control above `pathway-wrap`, one button per owned
   pathway showing `pathways.name` + a `done/total` count (reuse the `groupState` counting
   approach over each branch's nodes). New CSS classes `pathway-switch`, `pathway-switch-btn`,
   `pathway-switch-active` in the portal stylesheet, styled to match the existing
   `pathway-groups-btn` family (dark card, gold active state). No new component file — it's
   ~15 lines of JSX.
5. **Header copy.** `"Six groups, each branching into its own steps"` hardcodes six. Replace
   with count-free copy (e.g. "Every group branches into its own steps — all connected, all in
   one place."), or interpolate the active pathway name. Do not hardcode a count again.

### 2.3 `src/portal/DashboardPage.jsx` (small, required)

RLS now returns nodes from *all* owned pathways in one list ordered `phase, order_in_phase` —
two pathways interleave (both have a phase 1). Minimal correct fix:
- After fetch, sort nodes client-side by `(owned-pathway grant order, phase, order_in_phase)`
  using the same `member_pathways` fetch as §2.2.2.
- Progress ring stays a **single aggregate** across all owned, tier-eligible nodes (ratifiable
  default — log it; per-pathway rings are a Phase 5+ nicety, don't build now). When the member
  owns ≥2 pathways, subtitle becomes "`{completed}` of `{nodes.length}` steps across your
  pathways".
- "Today's focus" = first incomplete node in that sort (unchanged logic, now deterministic).
- The first-visit start popup keys off `nodes[0]` — with the sort above that's the first Depop
  node for existing members, first node of their only pathway for future single-pathway
  members. No change needed beyond the sort.

### 2.4 `src/admin/ClientDetailPage.jsx` (admin grant UI — required for beta cohort + testing)

- New "Pathways" card: query `pathways` + the member's `member_pathways`; render each pathway
  with owned/not-owned state and a grant/revoke button doing direct `insert`/`delete` on
  `member_pathways` (covered by `member_pathways_admin_write`; matches the house
  direct-`supabase.from()` admin pattern). Grant inserts `{member_id, pathway_id, tier: <the
  member's current profiles.tier>}`. Revoke copy must state progress is kept and restored on
  re-grant (§1.7).
- The existing progress table (`member_pathway_progress` joined to
  `pathway_nodes(title, phase)`) gains the pathway: extend the select to
  `pathway_nodes(title, phase, pathways(name))` and add a "Pathway" column (or group rows by
  pathway — whichever is less code against the existing table markup).

### 2.5 Explicitly out of scope for UI

- No changes to `Tutorial.jsx` (its pathway step copy is count-free — verified).
- No changes to `UpgradePage`/`CheckoutPage`/tier logic — Phase 5.
- No marketing-site pages — Phase 5 launch sequence.

---

## 3. RLS summary (what the criteria demand → where it's satisfied)

| Requirement | Mechanism |
|---|---|
| Member sees only nodes for owned pathways | `pathway_nodes_read` + `owns_pathway()` (§1.7) |
| Dual member sees both, independent progress | Two `member_pathways` rows; progress keyed per node id; disjoint id namespaces (§1.7 note) |
| Member cannot self-grant a pathway | No member insert policy on `member_pathways` |
| Member cannot write progress into unowned branch | `owns_node()` in both progress write policies |
| Existing members keep access at deploy instant | §1.5 backfill in the same migration, ordered before policy swap is live — single-transaction migration guarantees no gap |
| New signups keep working pre-Phase-5 | §1.6 trigger |
| Admin sees/manages everything | `is_admin()` short-circuits every policy (unchanged pattern) |

---

## 4. SVG icon assets needed (asset task — not designed in this plan)

New glyphs go into the `GLYPHS` map in `src/components/portal/PathwayIcon.jsx` alongside the
existing eight. **Style contract (from the existing set — match exactly):** 48×48 viewBox,
single-weight 1.8 stroke, round caps/joins, `fill="none"` (solid `#080808` knockouts only
where the motif demands it, cf. `sliders`), hand-drawn/imperfect geometry rather than
geometric-perfect, must stay legible at 44px, sits comfortably inside the r≈22 state ring.
Never emojis, never imported icon-font paths, never the Shopify trademark logo (generic
motifs only).

Required (7 hub icons — one per Shopify module):

| Glyph key | Motif | Used by |
|---|---|---|
| `browser-store` | browser window with a storefront awning inside | Module 1 hub |
| `catalogue-grid` | 2×2 product-card grid with a magnifier over one cell | Module 2 hub |
| `layout-blocks` | page-builder blocks (hero bar + two content blocks) | Module 3 hub |
| `link-nodes` | two circles joined by a chain/plug link | Module 4 hub |
| `megaphone` | megaphone with two motion strokes | Module 5 hub |
| `wallet` | wallet with card peeking out | Module 6 hub |
| *(reuse)* `growth-arrow` | existing | Module 7 hub |

Desirable node-level icons (author with the content pass; any node may also reuse an existing
or hub glyph — the Depop tree reuses freely):
`domain-globe` (globe + link), `payment-card` (card + check), `shield-check` (trust/legal
pages), `camera-content` (phone/camera for organic content), `target-ads` (target + arrow for
paid), `chat-support` (speech bubble), `refund-loop` (arrow loop over a coin),
`margin-scales` (balance scales or bar-with-floor for margin reading).

Existing glyphs safe to reuse across pathways: `storefront`, `listing-card`, `sliders`,
`price-tag`, `growth-arrow`, `handshake`, `check-seal`, `profile-badge`.

---

## 5. Deliberate deviations & open items (read before executing)

1. **`member_pathways.tier` recorded, not enforced (§1.2).** Tier gating stays on
   `profiles.tier` through Phase 4. Deviation from a maximal reading of "pathway-scoped
   tiers" — that is Phase 5's job; doing it now would fork tier logic across two sources
   mid-flight.
2. **Interim auto-grant trigger (§1.6)** is an addition beyond the build plan's letter,
   required so signups/upgrades between Phase 4 and Phase 5 deploys keep working. Phase 5
   must delete it (leave the code comment).
3. **Progress-write tightening (§1.7)** goes beyond the spec's read-side requirement.
   Justified: without it the access rule is read-only theatre.
4. **Dashboard aggregate ring (§2.3)** — ratifiable default, log in
   `FOUNDER_DECISIONS_REQUIRED.md`.
5. **Pathway display names (§1.1)** — ratifiable default, log it.
6. **Branch/production content drift (§0.5):** the Depop tree on `chronos-dev` is the old
   8-node seed. Phase 4 must not attempt to reconcile it; the schema migration is drift-safe
   and will do the right thing when merged to production. Acceptance testing of *Shopify*
   content happens on the branch; final visual QA of the *Depop* tree only means anything on
   production data.
7. **Production merge note for the go-live checklist:** the §1.5 backfill is what protects
   real members at merge time — merge the schema migration and content migration together,
   and run §1.9 verification on production immediately after.
8. **Beta cohort dependency:** granting the Shopify pathway to real members (build plan
   Phase 5.2) needs the founder's cohort list — already logged as decision #5 in
   `FOUNDER_DECISIONS_REQUIRED.md`. The §2.4 grant UI is the mechanism; the list is not
   Phase 4's blocker.

---

## 6. Task breakdown (dependency order — execute top to bottom)

| # | Task | Done when |
|---|------|-----------|
| 1 | Preflight on `chronos-dev`: `list_migrations` + `list_tables`; confirm no `pathways`/`member_pathways` exist and record the latest migration version; bump this plan's version stamps if `202607160900xx` is taken | Both answers recorded; chosen migration versions are strictly newest |
| 2 | Apply `chronos_phase4_pathways` migration (§1.1–1.7) and commit the file to `supabase/migrations/` | All §1.9 structural checks pass: 2 new tables, `pathway_nodes.pathway_id` not-null with 0 orphans, `pg_policies` matches §1.7 verbatim, both helpers + trigger exist |
| 3 | Create test users A (depop only) and B (depop + shopify, shopify granted via service-role insert) on the branch; run the §1.9 impersonation matrix | A sees only depop nodes; B sees both; A's forged progress insert on a shopify node id fails; A's self-grant insert fails; admin JWT sees everything |
| 4 | Icon assets: add the 6 new hub glyphs (+ node glyphs as content lands) to `GLYPHS` in `PathwayIcon.jsx` per §4 style contract | Each new glyph renders in all four states (available/in_progress/complete/locked) at 44–52px alongside existing icons with no visible style mismatch |
| 5 | `PathwayPage.jsx` multi-branch (§2.2): per-slug `GROUPS`, owned-pathways fetch (+ admin fallback), active-pathway state + filter, selector UI + CSS, header copy | User A sees today's page unchanged (no selector); user B sees the selector, switches branches, each renders its own hubs/nodes/lines; open panel closes and scroll resets on switch; `?start=1` still lands on node 1 of the default branch |
| 6 | `DashboardPage.jsx` (§2.3): pathway-ordered sort, aggregate subtitle when ≥2 owned | B's dashboard shows a stable focus node and correct combined counts; A's dashboard is pixel-identical to before |
| 7 | `ClientDetailPage.jsx` (§2.4): Pathways grant/revoke card + pathway column on the progress table | Admin grants B-style access in the UI and the member's portal shows the new branch on next load; revoke hides it; re-grant restores prior progress; progress table shows which pathway each row belongs to |
| 8 | Execute `docs/PHASE4_COURSE_CONTENT_BRIEF.md`: author all 7 modules' node copy, run the brief's compliance checklist, then apply `chronos_phase4_shopify_pathway_content` migration (§1.8) | All 7 phases render as hubs with nodes; every `depends_on` chain resolves within the branch; zero unresolved `[FOUNDER-DATA]` tokens; brief's guardrail checklist signed off per module (module 2 transparency items individually checked) |
| 9 | Full acceptance pass against build-plan Phase 4 criteria using users A/B and the seeded content | Criterion 1 (branch isolation + dual independence) evidenced from task 3+5; criterion 2 (7 modules live with nodes/icons/copy) from tasks 4+8; criterion 3 (non-technical member connects a store via module 4 alone) staged: requires Phase 3 connect UI live on the branch and a founder-supplied tester — record as pending-external if not yet possible, do not fake it |
| 10 | Update `FOUNDER_DECISIONS_REQUIRED.md`: pathway display names, dashboard aggregate default, any content items the brief escalated (documented-range sources, module-2 cost wording), Phase-5 reminder to delete the §1.6 trigger | File lists every default/decision this phase introduced |
