The current src/App.jsx has grown to 86KB because Claude Code incorrectly merged everything into a single file. Restore the proper file structure by splitting App.jsx back into the correct separate files.

The correct src/ structure is:

src/
  App.jsx
  main.jsx
  App.css
  index.css
  styles/
    global.css
  utils/
    analytics.js
  data/
    pricing.js (already exists — do not modify)
  pages/
    HomePage.jsx
    RepListPage.jsx
  sections/
    Hero.jsx
    WhatIsDropshipping.jsx
    About.jsx
    Pricing.jsx
    FAQ.jsx
    CTASection.jsx
    Footer.jsx
    Testimonials.jsx
  components/
    Cursor.jsx
    Nav.jsx
    Eyebrow.jsx
    FadeUp.jsx
    StaggerGrid.jsx
    Marquee.jsx
    ExitIntentPopup.jsx
    StickyCTABar.jsx
    SocialProofTicker.jsx
    UTMIndicator.jsx
    StripeBuyButton.jsx
    HeroPanel.jsx
    CheckoutDrawer.jsx
    CheckoutSuccessNotification.jsx

## RULES

1. Read the current App.jsx in full first — all the code is in there and must be preserved exactly, just moved into the correct files.
2. App.jsx should only contain the router and top-level layout (Cursor, Nav, Routes, Footer, UTMIndicator) — exactly as it was originally.
3. HomePage.jsx renders: Hero, Marquee, WhatIsDropshipping, About, Pricing, Testimonials, FAQ, CTASection, ExitIntentPopup, StickyCTABar, SocialProofTicker — plus the useEffect for hash-based scroll.
4. RepListPage.jsx contains the rep list page — do not modify its content.
5. Each section (Hero, Pricing, About, etc.) goes into its own file under src/sections/.
6. Each reusable component (Cursor, Nav, Eyebrow, FadeUp, etc.) goes into its own file under src/components/.
7. CheckoutDrawer and CheckoutSuccessNotification are new components added in the last session — keep them intact, just move them to src/components/.
8. Pricing.jsx must use className="pricing-grid" on the grid wrapper div — NOT inline styles for grid layout.
9. Do NOT modify any logic, JSX content, CSS, or functionality — only split into files.
10. Do NOT modify src/data/pricing.js, src/styles/global.css, src/utils/analytics.js, public/checkout.php, or any file outside src/.
11. After splitting, delete the bloated App.jsx content and replace it with the clean router-only version.
12. Run npm run build at the end to confirm no errors.