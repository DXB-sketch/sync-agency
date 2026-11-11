import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { TIERS, PAID_TIERS, tierRank } from "../lib/tiers";
import { PLUS, isPlus, canGetPlus } from "../lib/plus";
import { addToCart, loadCart } from "../lib/cart";
import { productImages } from "../lib/productImages";
import { isNativeApp } from "../lib/nativeApp";
import { CATEGORIES } from "../lib/categories";
import { activeSlots } from "../lib/rewards";

const UNCATEGORISED = "Other";

function folderOf(p) {
  return CATEGORIES.includes(p.category) ? p.category : UNCATEGORISED;
}

export default function ProductsPage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(loadCart().length);
  const [imgIdx, setImgIdx] = useState({}); // product id -> image shown on the card
  const [viewer, setViewer] = useState(null); // product open in the mobile viewer
  const [viewerIdx, setViewerIdx] = useState(0);
  const touchX = useRef(null);
  const [toast, setToast] = useState(null); // "added to order" confirmation
  const toastTimer = useRef(null);
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState(null); // open category folder | null = folder view
  const [rewardSlots, setRewardSlots] = useState(0); // live Sync Rewards product slots

  function addAndConfirm(p) {
    setCartCount(addToCart(p).length);
    clearTimeout(toastTimer.current);
    setToast({ name: p.name, key: (toast?.key ?? 0) + 1 });
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  useEffect(() => {
    if (!profile?.id) return;
    // RLS already limits members to their own rows; the explicit filter keeps
    // admins (who can read every row) from seeing other members' stock here.
    supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .eq("member_id", profile.id)
      .order("created_at")
      .then(({ data }) => {
        setProducts(data ?? []);
        setLoading(false);
      });
    supabase
      .from("reward_grants")
      .select("kind, expires_at, clawed_back_at")
      .eq("member_id", profile.id)
      .eq("kind", "slot")
      .then(({ data }) => setRewardSlots(activeSlots(data)));
  }, [profile?.id]);

  const myRank = tierRank(profile?.tier);
  const tierLimit = TIERS[profile?.tier]?.productLimit ?? 0;
  const limit = tierLimit > 0 ? tierLimit + rewardSlots : 0;
  const normal = products.filter((p) => !p.is_bonus);
  const bonus = products.filter((p) => p.is_bonus);
  const plus = isPlus(profile);
  // The Sync Plus slot is shown on its own, separate from course-tier slots
  const tierProducts = plus ? normal.slice(0, limit) : normal;
  const plusProducts = plus ? normal.slice(limit) : [];
  const unlimited = !!TIERS[profile?.tier]?.unlimited;
  const emptySlots = unlimited ? 0 : Math.max(limit - tierProducts.length, 0);
  const emptyPlusSlots = plus ? Math.max(PLUS.bonusSlots - plusProducts.length, 0) : 0;

  // Folders only appear once a member's products span more than one category.
  // Search only ever filters the products already loaded for this member.
  const mine = [...tierProducts, ...bonus, ...plusProducts];
  const folders = [...CATEGORIES, UNCATEGORISED]
    .map((name) => ({ name, items: mine.filter((p) => folderOf(p) === name) }))
    .filter((f) => f.items.length > 0);
  const useFolders = folders.length > 1;
  const q = search.trim().toLowerCase();
  const filtering = folder !== null || !!q;
  const showFolders = useFolders && !filtering;
  const matches = (p) =>
    (folder === null || folderOf(p) === folder) &&
    (!q || p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q));
  const shownTier = tierProducts.filter(matches);
  const shownBonus = bonus.filter(matches);
  const shownPlus = plusProducts.filter(matches);
  const noMatches = filtering && shownTier.length + shownBonus.length + shownPlus.length === 0;

  function openFolder(name) {
    setFolder(name);
    setSearch("");
  }

  // Higher tiers appear as locked sections showing the extra slots an upgrade unlocks
  const lockedTiers = PAID_TIERS.filter((t) => TIERS[t].rank > myRank).map((t, i, arr) => {
    const prevLimit = i === 0 ? tierLimit : TIERS[arr[i - 1]].productLimit;
    return { tier: t, extra: TIERS[t].productLimit - prevLimit };
  });

  // Pricing block per the revamp: the price to list at, the price to discount
  // to on Depop, the profit that leaves, and (smaller) what the member pays.
  function priceBlock(p) {
    const cost = Number(p.price);
    const listing = p.listing_price != null ? Number(p.listing_price) : null;
    const discount = p.discount_price != null ? Number(p.discount_price) : null;
    const profit = discount != null ? discount - cost : null;
    return (
      <div className="product-pricing">
        {listing != null && discount != null ? (
          <>
            <div className="product-price-flow">
              <div className="product-price-step">
                <span className="product-price-step-label">1. List item for</span>
                <span className="product-price-list">${listing.toFixed(2)}</span>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="product-price-arrow" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
              <div className="product-price-step">
                <span className="product-price-step-label gold">2. Then discount to</span>
                <span className="product-price-discount">${discount.toFixed(2)}</span>
              </div>
            </div>
            {profit > 0 && (
              <span className="product-profit">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />
                </svg>
                Profit: ${profit.toFixed(2)} per sale
              </span>
            )}
            <span className="product-cost">
              You pay <strong>${cost.toFixed(2)}</strong> <span className="price-currency">AUD</span>
            </span>
          </>
        ) : (
          <span className="product-price">
            ${cost.toFixed(2)} <span className="price-currency">AUD</span>
          </span>
        )}
      </div>
    );
  }

  function stepImage(p, dir) {
    const count = productImages(p).length;
    setImgIdx((m) => ({ ...m, [p.id]: ((m[p.id] ?? 0) + dir + count) % count }));
  }

  function openViewer(p) {
    // Fullscreen product view is a mobile behaviour; desktop browses via arrows
    if (!window.matchMedia("(max-width: 768px)").matches) return;
    setViewer(p);
    setViewerIdx(imgIdx[p.id] ?? 0);
  }

  function productCard(p) {
    const imgs = productImages(p);
    const idx = Math.min(imgIdx[p.id] ?? 0, Math.max(imgs.length - 1, 0));
    return (
      <div key={p.id} className="product-card" onClick={() => openViewer(p)}>
        <div className="product-media">
          {imgs.length > 0 ? (
            <img src={imgs[idx]} alt={p.name} className="product-img" />
          ) : (
            <div className="product-img product-img-empty" />
          )}
          {imgs.length > 1 && (
            <>
              <button
                className="product-img-nav product-img-prev"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  stepImage(p, -1);
                }}
              >
                ‹
              </button>
              <button
                className="product-img-nav product-img-next"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  stepImage(p, 1);
                }}
              >
                ›
              </button>
              <div className="product-dots">
                {imgs.map((_, i) => (
                  <span key={i} className={`product-dot${i === idx ? " active" : ""}`} />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="product-body">
          <h2 className="product-name">
            {p.name}
            {p.is_bonus && <span className="bonus-badge">Bonus</span>}
          </h2>
          {p.description && <p className="product-desc">{p.description}</p>}
          <div className="product-foot">
            {priceBlock(p)}
            <button
              className="btn-ghost product-add"
              onClick={(e) => {
                e.stopPropagation();
                addAndConfirm(p);
              }}
            >
              Add to order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head portal-page-head-row">
        <div>
          <h1 className="portal-h1">Your Products</h1>
          <p className="portal-sub">
            Made a sale on Depop? Order that stock here — we ship it straight to your buyer.
          </p>
        </div>
        <Link to="/portal/checkout" className="btn-gold" data-nav="checkout">
          Checkout{cartCount > 0 ? ` (${cartCount})` : ""}
        </Link>
      </div>

      {loading ? (
        <p className="portal-sub">Loading catalogue…</p>
      ) : (
        <>
          {limit > 0 && mine.length > 0 && (
            <>
              {folder !== null && (
                <nav className="catalogue-crumbs" aria-label="Product location">
                  <button type="button" className="catalogue-crumb-back" onClick={() => openFolder(null)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
                    All categories
                  </button>
                  <span aria-hidden="true">/</span>
                  <span className="catalogue-crumb-current" aria-current="page">
                    {folder}
                  </span>
                </nav>
              )}
              <input
                type="search"
                className="auth-input admin-search"
                aria-label="Search your products"
                placeholder={folder === null ? `Search your ${mine.length} products…` : `Search ${folder}…`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </>
          )}

          {limit > 0 && showFolders && (
            <div className="slot-section">
              <div className="slot-section-head">
                <span className="slot-section-title">{TIERS[profile.tier].name}</span>
                <span className="slot-count">
                  {unlimited
                    ? `${tierProducts.length} products · full catalogue access`
                    : `${Math.min(tierProducts.length, limit)}/${limit} product slots filled`}
                </span>
              </div>
              <div className="catalogue-folders">
                {folders.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    className="catalogue-folder"
                    onClick={() => openFolder(f.name)}
                  >
                    <span className="catalogue-folder-thumbs" aria-hidden="true">
                      {f.items
                        .map((p) => productImages(p)[0])
                        .filter(Boolean)
                        .slice(0, 3)
                        .map((src, i) => (
                          <img key={i} src={src} alt="" loading="lazy" />
                        ))}
                    </span>
                    <span className="catalogue-folder-row">
                      <svg className="catalogue-folder-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      </svg>
                      <span className="catalogue-folder-text">
                        <span className="catalogue-folder-name">{f.name}</span>
                        <span className="catalogue-folder-count">
                          {f.items.length} item{f.items.length === 1 ? "" : "s"}
                        </span>
                      </span>
                      <svg className="catalogue-folder-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M9 6l6 6-6 6" />
                      </svg>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {noMatches && (
            <div className="portal-empty">
              <p>{q ? "No products match your search." : "No products in this category yet."}</p>
            </div>
          )}

          {limit > 0 && !showFolders && (!filtering || shownTier.length + shownBonus.length > 0) && (
            <div className="slot-section">
              <div className="slot-section-head">
                <span className="slot-section-title">{TIERS[profile.tier].name}</span>
                <span className="slot-count">
                  {unlimited
                    ? `${tierProducts.length} products · full catalogue access`
                    : `${Math.min(tierProducts.length, limit)}/${limit} product slots filled`}
                </span>
              </div>
              <div className="product-grid">
                {shownTier.map(productCard)}
                {shownBonus.map(productCard)}
                {Array.from({ length: filtering ? 0 : emptySlots }, (_, i) => (
                  <div key={`empty-${i}`} className="product-slot-empty">
                    <span className="slot-plus">+</span>
                    <span className="slot-empty-label">
                      Open slot — the Sync team stocks this for you
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {limit > 0 && plus && (showFolders ? emptyPlusSlots > 0 : !filtering || shownPlus.length > 0) && (
            <div className="slot-section">
              <div className="slot-section-head">
                <span className="slot-section-title">{PLUS.name}</span>
                <span className="slot-count">
                  {plusProducts.length}/{PLUS.bonusSlots} bonus slot filled
                </span>
              </div>
              <div className="product-grid">
                {!showFolders && shownPlus.map(productCard)}
                {Array.from({ length: filtering ? 0 : emptyPlusSlots }, (_, i) => (
                  <div key={`plus-empty-${i}`} className="product-slot-empty">
                    <span className="slot-plus">+</span>
                    <span className="slot-empty-label">
                      Sync Plus slot — the Sync team stocks this for you
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {limit > 0 && !plus && canGetPlus(profile) && (
            <div className="slot-section slot-section-locked">
              <div className="slot-section-head">
                <span className="slot-section-title">
                  {PLUS.name} <span className="slot-lock">🔒</span>
                </span>
                <span className="slot-count">+{PLUS.bonusSlots} product slot</span>
              </div>
              <div className="product-grid">
                <div className="product-slot-locked">
                  <span className="slot-lock-icon">🔒</span>
                </div>
              </div>
              <div className="slot-unlock-row">
                <span>
                  Join {PLUS.name} to unlock {PLUS.bonusSlots} extra product slot, plus 10% off every purchase.
                </span>
                {!isNativeApp() && (
                  <Link to="/portal/plus" className="btn-gold slot-unlock-btn">
                    See Sync Plus
                  </Link>
                )}
              </div>
            </div>
          )}

          {lockedTiers.map(({ tier, extra }) => (
            <div key={tier} className="slot-section slot-section-locked">
              <div className="slot-section-head">
                <span className="slot-section-title">
                  {TIERS[tier].name} <span className="slot-lock">🔒</span>
                </span>
                <span className="slot-count">
                  {TIERS[tier].unlimited ? "Full catalogue" : `+${extra} product slots`}
                </span>
              </div>
              <div className="product-grid">
                {Array.from({ length: TIERS[tier].unlimited ? 1 : extra }, (_, i) => (
                  <div key={`locked-${tier}-${i}`} className="product-slot-locked">
                    <span className="slot-lock-icon">🔒</span>
                  </div>
                ))}
              </div>
              <div className="slot-unlock-row">
                <span>
                  {TIERS[tier].unlimited
                    ? `Upgrade to ${TIERS[tier].name} to unlock the entire product catalogue — no slot limits.`
                    : `Upgrade to ${TIERS[tier].name} to unlock ${extra} more products in your store.`}
                </span>
                {!isNativeApp() && (
                  <Link to="/portal/upgrade" className="btn-gold slot-unlock-btn">
                    Upgrade to unlock
                  </Link>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {toast && (
        <div className="cart-toast" key={toast.key}>
          ✓ {toast.name} added to your order
          <Link to="/portal/checkout" className="cart-toast-link">
            Go to checkout
          </Link>
        </div>
      )}

      {viewer &&
        (() => {
          const imgs = productImages(viewer);
          const idx = Math.min(viewerIdx, Math.max(imgs.length - 1, 0));
          const step = (dir) => setViewerIdx((idx + dir + imgs.length) % imgs.length);
          return (
            <div className="product-viewer">
              <button
                className="product-viewer-close"
                aria-label="Close"
                onClick={() => setViewer(null)}
              >
                ✕
              </button>
              <div
                className="product-viewer-media"
                onTouchStart={(e) => {
                  touchX.current = e.touches[0].clientX;
                }}
                onTouchEnd={(e) => {
                  if (touchX.current === null || imgs.length < 2) return;
                  const dx = e.changedTouches[0].clientX - touchX.current;
                  touchX.current = null;
                  if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
                }}
              >
                {imgs.length > 0 ? (
                  <img src={imgs[idx]} alt={viewer.name} className="product-viewer-img" />
                ) : (
                  <div className="product-viewer-img product-img-empty" />
                )}
                {imgs.length > 1 && (
                  <>
                    <button
                      className="product-img-nav product-img-prev"
                      aria-label="Previous image"
                      onClick={() => step(-1)}
                    >
                      ‹
                    </button>
                    <button
                      className="product-img-nav product-img-next"
                      aria-label="Next image"
                      onClick={() => step(1)}
                    >
                      ›
                    </button>
                    <div className="product-dots">
                      {imgs.map((_, i) => (
                        <span key={i} className={`product-dot${i === idx ? " active" : ""}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="product-viewer-body">
                <h2 className="product-name">
                  {viewer.name}
                  {viewer.is_bonus && <span className="bonus-badge">Bonus</span>}
                </h2>
                {viewer.description && <p className="product-desc">{viewer.description}</p>}
                <div className="product-foot">
                  {priceBlock(viewer)}
                  <button
                    className="btn-gold product-viewer-add"
                    onClick={() => {
                      addAndConfirm(viewer);
                      setViewer(null);
                    }}
                  >
                    Add to order
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
