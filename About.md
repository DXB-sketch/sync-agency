Add a new "About Us" page to the Sync Agency site. Match the existing architecture and visual language exactly — this is a React + Vite app using react-router-dom, with page components in src/pages/, sections in src/sections/, shared components in src/components/, and all styling in src/styles/global.css via CSS variables. Do NOT modify the existing homepage About section (src/sections/About.jsx) — this is a separate, standalone page.

Context: Sync Agency sells a Depop Dropshipping Course. Brand voice is practitioner-led, no-fluff, results-first (100+ clients, 100% success rate, real numbers like $300–$800/month). Visual style is premium, dark, gold-accented. The two co-founders are Brock Brown and Dexter Bell.

1. Create src/pages/AboutPage.jsx:
   - Page header reusing the .rep-page-hero pattern from RepListPage: an Eyebrow "About Sync Agency", an h1 such as "Two operators. One proven system." with the second line wrapped in a gold <em>, and a short subheading.
   - "Our story" section: how Sync Agency was built from hands-on Depop experience — not theory, not gurus — why it exists, and the 100% success rate / 100+ clients framing. Match the tone in src/sections/About.jsx.
   - "Meet the founders" section with two founder cards, one for Brock Brown and one for Dexter Bell. Each card has: name, a role/title, a short 2–3 sentence bio, and a photo slot (use an initials/avatar placeholder block for now). Wrap them in FadeUp with staggered delay. Collapse to a single column on mobile.
   - A mission/values strip reusing either the numbered .about-pillar pattern or the .rep-stat-tile tiles, whichever fits cleanly.
   - A closing CTA using the gold button (.btn-gold) linking to the Discord enrol URL https://discord.gg/pVzjXumpbP, matching how Nav/CTASection do it, and firing trackEvent("discord_click", { source: "about" }).
   - Use the existing Eyebrow and FadeUp components throughout.

2. Wire up the route in src/App.jsx: add the import and <Route path="/about" element={<AboutPage />} />.

3. Add an "About" link to src/components/Nav.jsx in BOTH the desktop .nav-links and the mobile menu array, placed before the "Rep List" link, using <Link to="/about">. Follow the existing onHome conditional pattern so it works from any page.

4. Add an "About" link to src/sections/Footer.jsx footer-links, before "Rep List".

5. Add any new styles to src/styles/global.css. Reuse existing variables (--ink, --black, --gold, --gold-lt, --card, --border, --border-md, --text, --text-md, --font-display, etc.) and match the existing class-naming style (e.g. .about-page-*, .founder-card). Must be mobile-first and fully responsive.

For the founder bios, write short on-brand placeholder copy for Brock and Dexter (practitioner founders who built and scaled their own Depop stores before teaching the system), and mark each with a {/* TODO: replace with real bio */} comment so they're easy to swap later.

When finished, run npm run build to confirm it compiles, then verify the /about route renders and the new nav and footer links work.