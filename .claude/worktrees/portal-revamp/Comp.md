Read CLAUDE.md before doing anything else.

You are adding the Sync Store Competition feature to the Sync Agency website. This involves:
1. A new page at /competition
2. A prominent nav entry with a special highlighted style
3. A site-wide announcement banner that appears on every page

Do not modify any existing functionality unless explicitly stated. Work in this order.

---

STEP 1 — Create src/pages/CompetitionPage.jsx

This is a standalone marketing page. It must feel like a high-energy ad — bold, short, punchy. No filler sections.

Structure (top to bottom):

HERO BLOCK
- Large display headline: "We're giving YOU $10,000."
- Subtext: "To celebrate the growth of Sync Agency and expand into new territory, we're hosting the Sync Store Competition."
- A short descriptor line below: "Have the top-earning Depop store by 22nd July 2025 and walk away with ten thousand dollars."
- Primary CTA button: "Get Started →" — this links to /#pricing (the pricing section on the homepage)
- Style: use --font-display for the headline, italic gold on "$10,000", dark background, centred layout

HOW IT WORKS BLOCK
- Three numbered steps, horizontal on desktop, stacked on mobile:
  1. "Enrol" — "Become a paying member of Sync Agency on any tier."
  2. "Build" — "Launch and grow your Depop dropshipping store using our system."
  3. "Win" — "Have the highest-earning store by 22nd July 2025 and claim $10,000 AUD."

ELIGIBILITY NOTICE — make this visually prominent, use a bordered card with a gold left-border accent:
- Heading: "Eligibility"
- Body: "This competition is open exclusively to paying members of Sync Agency. You must be enrolled on an active tier at the time of judging. Store earnings will be verified. One winner. $10,000 AUD, paid directly."

FINAL CTA BLOCK
- Repeat the headline: "Ready to compete?"
- Body: "Enrol now and your store is automatically entered."
- Button: "Enter the Competition →" linking to /#pricing
- Small print below the button: "Must be a paying Sync Agency member to be eligible."

Styling rules:
- Use existing CSS variables only — no hardcoded hex values
- No external component libraries
- Match the existing site aesthetic: dark background, gold accents, Cormorant Garamond for display text, Syne for body
- Page must be fully responsive and mobile-first
- Add the page top padding (pt: 120px) to account for the fixed nav

---

STEP 2 — Register the route in src/App.jsx

Import CompetitionPage and add:
<Route path="/competition" element={<CompetitionPage />} />

Place it after the /rep-list route.

---

STEP 3 — Add Competition nav link in src/components/Nav.jsx

In both the desktop nav-links and the mobile menu, add a "Competition" link to /competition.

This link must be visually distinct from all other nav links. Style it with:
- A gold background pill/badge: background var(--gold), color var(--black), padding 6px 14px, border-radius 2px, font-weight 700, font-size 11px, letter-spacing 0.12em, text-transform uppercase
- On hover: background var(--gold-lt)
- Give it a className of "nav-btn-competition" and add the CSS to global.css

Place it between the Rep List ghost button and the "Enrol Now →" button in desktop nav.

In the mobile menu, place it below the Rep List link and above the Enrol Now button, styled the same way (full-width, text-align center).

---

STEP 4 — Create src/components/CompetitionBanner.jsx

A site-wide dismissible announcement banner that renders at the very top of every page, above the nav.

Behaviour:
- Renders above the nav (z-index 600, so above nav's 500)
- Shifts the rest of the page down — add margin-top or padding-top equal to the banner height when it is visible
- Has a close/dismiss button (✕) on the right
- Once dismissed, store in sessionStorage key "compBannerDismissed" — do not show again for the session
- On mount, check sessionStorage and skip render if already dismissed

Content:
- Left side: "🏆 $10,000 Sync Store Competition — 22nd July deadline"
- Right side: a link/button "See Details →" that navigates to /competition
- Dismiss button (✕) far right

Styling:
- Background: var(--gold)
- Text: var(--black)
- Font: var(--font-body), font-size 13px, font-weight 700, letter-spacing 0.06em
- Height: ~44px, content vertically centred
- The "See Details →" link: slightly darker text (var(--gold-dk)), underline on hover
- Dismiss button: transparent background, var(--black) colour, no border, cursor pointer

When the banner is visible, add a CSS class "banner-visible" to <body> and set --banner-height: 44px as a CSS variable on :root. Remove both when dismissed. The nav's top: 0 is fine — the banner pushes everything down naturally since it's in the normal document flow, not fixed.

Make the banner fixed to the top of the viewport (position: fixed, top: 0) and set body padding-top dynamically via the component (add 44px when mounted, remove when dismissed).

Export default CompetitionBanner.

---

STEP 5 — Mount CompetitionBanner in src/App.jsx

Import CompetitionBanner and render it as the very first child inside the BrowserRouter div, before the noise div and Nav.

---

ACCEPTANCE CRITERIA

[ ] /competition route renders the full page with all four blocks
[ ] Page headline uses gold italic for "$10,000"
[ ] "Get Started →" and "Enter the Competition →" both link to /#pricing
[ ] Eligibility note is clearly visible and states paying member requirement
[ ] Nav shows "Competition" badge link in both desktop and mobile menus
[ ] Competition badge link is visually distinct from all other nav items
[ ] Announcement banner appears at the top of every page on first load
[ ] Banner is dismissible and stays dismissed for the session
[ ] Banner links to /competition
[ ] Dismissing the banner removes it and restores normal page layout
[ ] No hardcoded hex values in any new or modified file
[ ] npm run build completes without errors
[ ] All new pages and components are mobile responsive