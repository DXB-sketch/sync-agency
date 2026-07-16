# DESIGN.md — Sync Agency
> Extracted design system. Use this file to ensure any new UI matches the existing site exactly.
> Place this file in the project root alongside PRODUCT.md.

---

## Theme

**Dark, luxury-editorial.** Near-black backgrounds with warm tinted neutrals. Gold is the sole accent — restrained but present everywhere. The feeling is high-end agency, not startup SaaS. Think print magazine meets premium e-commerce.

Physical scene: a 19-year-old on their phone at night, scrolling for a way to make money. The dark theme reduces eye strain, the gold signals premium, the typography signals credibility.

---

## Color Tokens

All colors are defined as CSS custom properties on `:root`. Never hardcode hex values — always use the variable.

```css
/* Gold scale */
--gold:        #C9A84C   /* Primary accent. Buttons, links, highlights, icons */
--gold-lt:     #E8C97A   /* Hover state for gold elements */
--gold-dk:     #8A6820   /* Rarely used. Deep gold for contrast contexts */
--gold-glow:   rgba(201,168,76,0.18)  /* Glow effects, shadows */
--gold-subtle: rgba(201,168,76,0.08)  /* Tinted backgrounds on badges, icons */

/* Surface scale — near-black, warm-tinted */
--black: #080808   /* Page background */
--ink:   #0F0F0F   /* Section alternates (about, pricing, marquee) */
--card:  #121212   /* Card backgrounds */
--card2: #1A1A1A   /* Elevated cards, table headers, toggle backgrounds */
--card3: #222222   /* Further elevated surfaces */

/* Text scale */
--text:     #F0EDE6   /* Primary text — warm white, not pure white */
--text-md:  #B8B0A0   /* Secondary text, body copy */
--text-dim: #6A6258   /* Tertiary, metadata, small print */

/* Border scale */
--border:    rgba(201,168,76,0.12)   /* Default borders — gold-tinted, subtle */
--border-md: rgba(201,168,76,0.25)   /* Medium borders — featured cards, active states */

/* Status */
--urgent:    #E84545                  /* Error, waitlist full, destructive */
--urgent-bg: rgba(232,69,69,0.12)    /* Error background tint */
```

### Color rules
- `--black` and `--ink` alternate for section backgrounds to create rhythm without borders
- Featured/highlighted cards use `--border-md` instead of `--border`
- Gold is used for: eyebrow labels, price amounts, feature list icons (—), check marks (✦), hover states, CTA buttons, active toggles
- Never use pure white (`#fff`) or pure black (`#000`)
- All overlays: `rgba(0,0,0,0.72–0.78)` with `backdrop-filter: blur(4–6px)`

### Light mode overrides
The site supports `prefers-color-scheme: light` via CSS. All surface variables flip to warm cream tones. New components must use CSS variables only — never hardcode dark colors.

---

## Typography

### Fonts
```css
--font-display: 'Cormorant Garamond', Georgia, serif;
--font-body:    'Syne', sans-serif;
```
Loaded from Google Fonts: `Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700` and `Syne:wght@400;500;600;700;800`

### Type scale

| Role | Font | Size | Weight | Notes |
|---|---|---|---|---|
| Hero H1 | display | `clamp(58px, 5.5vw, 88px)` | 700 | Line-height 1.0 |
| Section title | display | `clamp(40px, 4vw, 64px)` | 700 | Line-height 1.05 |
| CTA heading | display | `clamp(48px, 5.5vw, 80px)` | 700 | Line-height 1.0 |
| Price amount | display | 56–64px | 700 | Line-height 1.0, gold colour |
| Card name | display | 28–30px | 700 | Line-height 1.1 |
| Quote/italic | display | `clamp(28px, 3vw, 42px)` | 400 italic | |
| Body / sub | body | 15–17px | 400 | Line-height 1.65–1.75 |
| Card body | body | 13–14px | 400–500 | Line-height 1.7 |
| Eyebrow label | body | 11px | 600 | `letter-spacing: 0.2em`, uppercase |
| Small metadata | body | 10–12px | 500–600 | `letter-spacing: 0.1–0.22em`, uppercase |
| Nav links | body | 13px | 500 | `letter-spacing: 0.1em`, uppercase |
| Buttons | body | 12–14px | 700 | `letter-spacing: 0.1–0.12em`, uppercase |

### Italic emphasis
`<em>` tags inside headings render in **italic gold** (`color: var(--gold); font-style: italic`). This is the primary decorative pattern throughout the site. Use it on the last word or phrase of a heading.

```jsx
<h2>One system.<br />Three levels of <em>access.</em></h2>
```

### Eyebrow pattern
Every section opens with an eyebrow label above the heading:
```jsx
<Eyebrow text="Pricing" />
// Renders: [gold line] PRICING (uppercase, spaced, gold, 11px)
```

---

## Spacing & Layout

### Section padding
```css
.section { padding: 120px 80px; }           /* Desktop default */
.section-inner { max-width: 1300px; margin: 0 auto; }  /* Content cap */

/* Mobile (≤768px) */
.section { padding: 80px 20px; }
```

### Grid patterns in use
- **Two-column content**: `grid-template-columns: 1fr 1fr; gap: 80–100px`
- **Three-column pricing**: `grid-template-columns: repeat(3, 1fr); gap: 20px`
- **Hero grid**: `grid-template-columns: 1fr 420px; gap: 80px`
- **Two-column wide+sidebar**: `grid-template-columns: 1fr 420px; gap: 60px`

### Card anatomy
All cards share this base:
```css
background: var(--card);
border: 1px solid var(--border);
border-radius: 4px;
padding: 40px 36px;
```
Featured/highlighted variant adds:
```css
border-color: var(--border-md);
background: linear-gradient(160deg, rgba(201,168,76,0.06) 0%, var(--card) 60%);
```
Hover state on interactive cards:
```css
border-color: rgba(201,168,76,0.3);
transform: translateY(-4px);
transition: border-color .3s, transform .3s;
```

---

## Buttons

### Primary — `.btn-gold`
```css
background: var(--gold);
color: var(--black);
padding: 16px 44px;
border-radius: 2px;
font-size: 13px;
font-weight: 700;
letter-spacing: 0.12em;
text-transform: uppercase;
transition: all .2s;
border: none;
cursor: none; /* site uses custom cursor */

/* Hover */
background: var(--gold-lt);
transform: translateY(-2px);
box-shadow: 0 12px 40px rgba(201,168,76,0.25);
```

### Ghost — `.btn-ghost`
```css
border: 1px solid var(--border-md);
color: var(--gold);
padding: 15px 36px;
border-radius: 2px;
font-size: 13px;
font-weight: 600;
letter-spacing: 0.1em;
text-transform: uppercase;
background: transparent;

/* Hover */
background: var(--gold-subtle);
border-color: var(--gold);
```

### Nav button — `.nav-btn`
Compact version: `padding: 10px 28px; font-size: 12px`

### Rules
- Border radius is always `2px` on buttons — never rounded-full or `8px+`
- All buttons use `cursor: none` (the site has a custom cursor)
- Disabled state: `opacity: 0.6; cursor: not-allowed`
- Loading state: reduce opacity, show inline spinner or "Processing..." text

---

## Overlays & Modals

### Overlay backdrop
```css
position: fixed;
inset: 0;
background: rgba(0,0,0,0.78);
backdrop-filter: blur(6px);
z-index: 9000;
opacity: 0;
pointer-events: none;
transition: opacity .35s ease;

/* Active */
opacity: 1;
pointer-events: auto;
```

### Centred popup (exit intent pattern)
```css
background: var(--card);
border: 1px solid var(--border-md);
border-radius: 4px;
padding: 56px 56px 44px;
max-width: 540px;
width: 100%;
transform: translateY(20px);
transition: transform .45s cubic-bezier(.16,1,.3,1);
box-shadow: 0 30px 80px rgba(0,0,0,0.5);

/* Active — popup slides up */
transform: translateY(0);
```

### Close button pattern
```css
position: absolute;
top: 16px;
right: 16px;
width: 32px;
height: 32px;
border-radius: 50%;
border: 1px solid var(--border);
background: transparent;
color: var(--text-md);
font-size: 16px;

/* Hover */
color: var(--gold);
border-color: var(--border-md);
```

### Z-index layers
| Layer | Z-index | Usage |
|---|---|---|
| Cursor | 9999 | Custom cursor dot + ring |
| UTM indicator (dev) | 9100 | Dev-only debug overlay |
| Exit popup overlay | 9000 | Exit intent |
| Checkout overlay | 8000 | Checkout drawer backdrop |
| Checkout drawer | 8001 | Checkout sidebar/sheet |
| Nav | 500 | Fixed navigation |
| Sticky CTA bar | 400 | Bottom CTA strip |
| Social proof ticker | 350 | Bottom-left notification |
| Noise overlay | 1 | Fullscreen grain texture |

---

## Motion & Animation

### Easing — use exclusively
```css
cubic-bezier(.16, 1, 0.3, 1)   /* Expo ease-out — all entrances, slides, reveals */
ease                             /* Simple fades only */
linear                           /* Marquee scroll only */
```
No bounce, no elastic, no spring curves.

### Standard durations
| Purpose | Duration |
|---|---|
| Simple fade/colour | 0.2s |
| State transitions (border, bg) | 0.3s |
| Overlay fade-in | 0.35s |
| Popup/drawer slide | 0.45s |
| Scroll reveals (FadeUp) | 0.75s |
| Stagger children | 0.6s base, 0.12s delay per child |
| Word reveal (hero) | 0.7s |
| Marquee | 22s linear infinite |

### FadeUp component
All section content uses scroll-triggered fade-up:
```css
.fade-up { opacity: 0; transform: translateY(36px); transition: opacity .75s cubic-bezier(.16,1,.3,1), transform .75s cubic-bezier(.16,1,.3,1); }
.fade-up.visible { opacity: 1; transform: translateY(0); }
/* Delay variants: .delay-1 through .delay-6 at 0.1s increments */
```

### Stagger grid
Card grids stagger children on scroll entry (0.12s between each child).

### Slide-in patterns
- **From bottom (mobile sheet)**: `translateY(100%)` → `translateY(0)`
- **From right (desktop drawer)**: `translateX(100%)` → `translateX(0)`
- **From left (social proof)**: `translateX(-120%)` → `translateX(0)`
- **Fade up (popups)**: `translateY(20px) + opacity:0` → `translateY(0) + opacity:1`

---

## Badges & Labels

### Eyebrow label
```
[32px gold line] [UPPERCASE TEXT — 11px, 600, 0.2em spacing, gold]
```

### Spots badge
```css
/* Colours: default (available), urgent (<15), full */
/* Dot + text, inline-flex, small */
font-size: 11px; letter-spacing: 0.06em;
```

### "Most Popular" badge (pricing card)
```css
position: absolute; top: -1px; left: 50%; transform: translateX(-50%);
background: var(--gold); color: var(--black);
font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;
padding: 5px 18px; border-radius: 0 0 4px 4px;
```

### Pill/badge (savings, trial)
```css
display: inline-flex; align-items: center; gap: 6px;
background: var(--gold-subtle);
border: 1px solid var(--border-md);
border-radius: 100px;
padding: 6px 14px;
font-size: 12px; font-weight: 600; color: var(--gold); letter-spacing: 0.06em;
```

---

## Feature Lists

Items in feature/includes lists use an em-dash prefix in gold:
```css
li::before { content: '—'; color: var(--gold); flex-shrink: 0; }
```
Check marks in comparison tables use `✦` (not ✓) in gold.

---

## Interactive Toggles

Plan toggles (e.g. monthly/yearly) use pill-button style inside a container:
```css
/* Container */
display: flex; gap: 8px;
background: var(--card2);
border-radius: 100px;
padding: 4px;

/* Button */
flex: 1; padding: 10px 16px;
border-radius: 100px;
font-family: var(--font-body); font-size: 13px; font-weight: 600;
letter-spacing: 0.06em;
background: transparent; color: var(--text-dim);
transition: all .2s;

/* Active */
background: var(--gold); color: var(--black);
```

---

## Custom Cursor

The site uses a custom cursor (desktop only). All interactive elements must use `cursor: none` in CSS. On mobile (≤768px), `cursor: none` is removed from body and cursor elements are hidden.

---

## Responsive Breakpoints

| Breakpoint | Behaviour |
|---|---|
| `≤768px` | Single-column layouts, mobile padding (20px sides), custom cursor off, nav collapses to hamburger |
| `≤480px` | Smaller hero text, simplified stat grid, reduced price font size |

### Mobile-specific UI patterns
- Drawers/sheets slide up from bottom (`translateY(100%)` → `translateY(0)`)
- Leave ~60px of darkened page visible above the sheet
- Border-radius `12px 12px 0 0` on bottom sheets
- Padding reduced to `32px 24px 48px`
- All grids collapse to single column

---

## Noise Texture

A subtle SVG fractalNoise overlay sits at z-index 1, opacity 0.025 over the entire page. Do not remove or obscure this with new fixed elements.

---

## Section Alternation Pattern

| Section | Background |
|---|---|
| Hero | `--black` |
| Marquee | `--ink` |
| What is Dropshipping | `--black` |
| About | `--ink` |
| Pricing | `--ink` |
| Testimonials | `--black` |
| FAQ | `--black` |
| CTA | `--black` with radial gold glow |
| Footer | `--ink` |

---

## Component Checklist for New UI

When building any new component, verify:

- [ ] Uses CSS variables only — no hardcoded hex values
- [ ] `cursor: none` on all interactive elements (desktop)
- [ ] Buttons use `border-radius: 2px`, not rounded
- [ ] Headings use `--font-display` (Cormorant Garamond)
- [ ] Body copy uses `--font-body` (Syne)
- [ ] Italic emphasis in headings uses `color: var(--gold); font-style: italic`
- [ ] Eyebrow labels: 11px, 600 weight, 0.2em spacing, uppercase, gold
- [ ] Transitions use `cubic-bezier(.16,1,.3,1)` easing
- [ ] Overlays: `rgba(0,0,0,0.72–0.78)` + `backdrop-filter: blur(4–6px)`
- [ ] Z-index respects the layer table above
- [ ] Mobile: slide-up sheet pattern, not centred modal
- [ ] Desktop: slide-in drawer from right
- [ ] Feature lists use `—` (em-dash) prefix in gold
- [ ] Check marks use `✦` not `✓`
- [ ] Success/error states use `--urgent` / `--urgent-bg`
- [ ] No gradient text (`background-clip: text`)
- [ ] No bounce/elastic easing
- [ ] Light mode: variables flip automatically — no hardcoded dark values
