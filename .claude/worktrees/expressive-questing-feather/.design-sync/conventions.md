# Sync Agency — build conventions

Luxury dark-gold brand for a Depop dropshipping course site + member portal. Editorial serif display type over near-black, with gold as the only accent.

## Setup

Wrap every tree in `DSProvider` (exported from the bundle) — `Nav` renders react-router links and throws without it:

```jsx
<DSProvider>
  <Nav />
  {/* page content */}
</DSProvider>
```

## Styling idiom: CSS custom properties + the app's class vocabulary

No utility framework. Style with the shipped tokens and classes; never invent hex colors or new class names.

**Tokens** (defined on `:root` in `styles.css`; the sheet also ships a `prefers-color-scheme: light` variant that remaps them — always use tokens, never literal colors, so both themes work):
`--gold --gold-lt --gold-dk --gold-glow --gold-subtle` (accents) · `--black --ink --card --card2 --card3` (background depths, flat black → raised card) · `--text --text-md --text-dim` (foreground hierarchy) · `--border --border-md` (gold-tinted hairlines) · `--font-display` (Cormorant Garamond — headlines, prices, numerals) · `--font-body` (Syne — everything else, usually uppercase + letter-spaced at small sizes).

**Buttons**: `btn-gold` (solid gold, primary) · `btn-ghost` (outlined). **Marketing**: `eyebrow` label above a `section-title`. **Portal page scaffold**: `portal-page` > `portal-h1` + `portal-sub`, content in `dash-card` blocks titled with `dash-card-title`; empty states use `portal-empty`. **Commerce**: `product-grid` of `product-card` (image, `product-name`, `product-desc`, `product-price` + `price-currency`, `bonus-badge`); tier-gated areas use `slot-section` with `slot-section-head`. **Forms**: `auth-label` wrapping an `auth-input`, laid out in `admin-form-grid`; errors in `auth-error`. **Admin**: `admin-table` inside `admin-table-wrap`, forms in `admin-product-form`, order rows as `order-card` with `order-status`.

## Where the truth lives

Read `styles.css` (and its `_ds_bundle.css` import) before styling anything — it holds the complete class vocabulary, both color-scheme variants, and all keyframes. Per-component APIs are in each `components/<group>/<Name>/<Name>.prompt.md`.

## Idiomatic snippet

```jsx
<DSProvider>
  <div className="portal-page">
    <h1 className="portal-h1">Your Products</h1>
    <p className="portal-sub">Order sold stock here — we ship it straight to your buyer.</p>
    <div className="product-grid">
      <div className="product-card">
        <div className="product-body">
          <h2 className="product-name">Vintage windbreaker</h2>
          <div className="product-foot">
            <span className="product-price">$34.00 <span className="price-currency">AUD</span></span>
            <button className="btn-ghost product-add">Add to order</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</DSProvider>
```

Currency is always AUD. Content voice: confident, concrete seller language ("1200+ clients", "AU shipped") — never lorem ipsum.
