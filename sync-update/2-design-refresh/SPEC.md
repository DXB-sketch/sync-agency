# Design refresh v2: requirements

The brand stays the same: gold on warm black, Cormorant Garamond headings and the pathway idea. Change only what this document lists. Anything it doesn't mention stays as it is.

## Files

| File | Use |
|---|---|
| `refresh.css` | The v2 tokens and components: surfaces `bg-0`–`bg-3`, lines, three text steps, gold, status colours, type scale, buttons, cards, chips, nav bar, tab bar. These values are final. |
| `mockups/Main.dc.html` | Audit: findings 1–14 with before screenshots |
| `mockups/Foundations.dc.html` | Colour, type, buttons, navigation, the 24-icon set (SVG paths), chips, inputs, spacing, radius |
| `mockups/PortalDashboard`, `PortalProducts`, `PortalPathway` | Portal on desktop |
| `mockups/MobileDashboard`, `MobileProducts`, `MobilePathway` | Portal on mobile |
| `mockups/SiteDesktop`, `SiteMobile` | Marketing site, matching the live syncagency.org structure |
| `before-screenshots/` | The repo as it renders today |
| `live-site-reference/` | syncagency.org as it is live today |

## Foundations (site and portal)

- One dark theme only. No light-mode variant on the marketing site.
- Fonts are Cormorant Garamond for headings and big numbers and Jost for everything else. Remove Syne.
- Type scale from `refresh.css`:

  | Style | Size |
  |---|---|
  | Display | 64 |
  | H1 | 44 |
  | H2 | 32 |
  | H3 | 19 |
  | Body | 16 |
  | Small | 14 |
  | Eyebrow | 12 |

  - Nothing renders below 11px.
  - Uppercase is used only for eyebrows. It is never used for buttons, nav or labels.
- Text contrast is at least 4.5:1 everywhere, and secondary or hint text is at least 5.3:1. Replace `p-dim`/`text-dim` for readable text.
- Buttons are sentence case at 15px semibold.
  - Height is 48px; 56px in heroes and 40px inside dense cards.
  - Button text never wraps.
  - There is one gold primary button per view.
- Status colours (`ok`, `warn`, `bad`, `info`) are used for status. Gold is never used to show status.
- Use the single line-icon set from Foundations across the site and portal. Remove emoji used as icons and the mixed icon styles.
- Body text is left-aligned. Only short headings are centred.
- Restore the system cursor and remove the custom gold cursor. Every control shows a visible focus ring.
- Stop loading `src/index.css` (Vite starter styles).
- The footer year comes from the current date.

## Portal

- **Desktop nav:** 15px sentence-case links with icons. The active link has a filled background and a gold underline. Upgrade sits at the right of the nav bar.
- **Top bar:**
  - Shows the wallet balance with a top-up button, help/tour, notifications and account.
  - Discord, Instagram and TikTok icons leave the app header and move to More and the website.
- **Mobile tab bar:**
  - Tabs in this order: Dashboard · Rewards · Products · Achieve · More.
  - Labels are 11px sentence case.
  - The active tab has a gold icon and dot, with no gold slab behind it.
- **"Got a sale on Depop?":**
  - It is no longer a popup that covers every page.
  - It becomes a slim, dismissible banner on the Dashboard only, linking to Products.
- **Dashboard:**
  - Today's focus is the lead card. It has one primary button ("Start this step") and a secondary "See the whole pathway".
  - The tutorial card no longer holds the top spot. The tour is replayed from the help menu.
  - Then come a pathway progress card, four stat tiles (sales, orders shipped, product slots used, achievements), a Sync Rewards summary and recent orders, each with an empty state.
- **Products:**
  - Profit is the largest figure on each card.
  - "List for → discount to" reads as one line, with "You pay" underneath.
  - Phones show one product per row.
  - The slots summary and the upsell to more slots stay.
- **Pathway:**
  - Keep the trail idea.
  - Steps sit to the side of one line, so no label is crossed by a connector.
  - On desktop, stages sit in a side rail. On mobile they are chips.
  - The current step shows "Up next" and an "Open step" button. Locked stages show a lock.

## Marketing site

- The sections, order, copy, prices, tiers (including the Tier 04 Executive Partner flagship), the example-sale illustration, its disclaimer and the FAQ all match https://syncagency.org. Where the repo and the live site differ, the live site wins.
- Do not add stats, testimonials or claims that the live site doesn't have.
- The sticky "Spots are limited / Choose plan" bar that covers the hero is removed. The nav's "Choose your plan" button replaces it.
- **Pricing:**
  - Plan cards are equal height and show the five things that matter per plan.
  - Higher plans start with "Everything in {lower plan}, plus".
  - Buttons line up on one line.
  - The full feature list moves to a compare table.
- Sections run full-width on a 1200px content grid. Remove the narrow boxed column and its vertical rules.
- **FAQ:** a real accordion with clear open and closed states and a chevron. No partly visible answers.
- Mobile layouts never scroll sideways.
