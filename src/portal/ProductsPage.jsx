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
import Icon from "../components/portal/Icon";
import { useTutorial } from "./tutorialSteps";

const UNCATEGORISED = "Other";

function folderOf(p) {
  return CATEGORIES.includes(p.category) ? p.category : UNCATEGORISED;
}

const money = (n) => `$${n.toFixed(2)}`;
// List and discount prices drop ".00" so the pair fits on one line
const price = (n) => (Number.isInteger(n) ? `$${n}` : money(n));

export default function ProductsPage() {
  const { profile } = useAuth();
  const { active: touring, sim } = useTutorial();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState(loadCart);
  const [imgIdx, setImgIdx] = useState({}); // product id -> image shown on the card
  const [viewer, setViewer] = useState(null); // product open in the mobile viewer
  const [viewerIdx, setViewerIdx] = useState(0);
  const touchX = useRef(null);
  const [toast, setToast] = useState(null); // "added to order" confirmation
  const toastTimer = useRef(null);
  const [search, setSearch] = useState("");
  const [folder, setFolder] = useState(null); // open category folder | null = folder view
  const [filter, setFilter] = useState("all"); // all | tier | bonus | plus
  const [rewardSlots, setRewardSlots] = useState(0); // live Sync Rewards product slots

  function addAndConfirm(p) {
    setCart(addToCart(p));
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
  // The Sync Plus slot is counted on its own, separate from course-tier slots
  const tierProducts = plus ? normal.slice(0, limit) : normal;
  const plusProducts = plus ? normal.slice(limit) : [];
  const unlimited = !!TIERS[profile?.tier]?.unlimited;
  const emptySlots = unlimited ? 0 : Math.max(limit - tierProducts.length, 0);
  const emptyPlusSlots = plus ? Math.max(PLUS.bonusSlots - plusProducts.length, 0) : 0;
  const slotTotal = limit + (plus ? PLUS.bonusSlots : 0);
  const slotUsed = Math.min(tierProducts.length, limit) + (plus ? plusProducts.length : 0);
  const inCart = new Set(cart.map((i) => i.product_id));

  const mine = [...tierProducts, ...bonus, ...plusProducts];
  const groupOf = (p) => (p.is_bonus ? "bonus" : plusProducts.includes(p) ? "plus" : "tier");
  const counts = { all: mine.length, tier: tierProducts.length, bonus: bonus.length, plus: plusProducts.length };

  // Folders only appear once a member's products span more than one category,
  // and never during the tutorial (it needs a product card on screen).
  const folders = [...CATEGORIES, UNCATEGORISED]
    .map((name) => ({ name, items: mine.filter((p) => folderOf(p) === name) }))
    .filter((f) => f.items.length > 0);
  const q = search.trim().toLowerCase();
  const filtering = folder !== null || !!q || filter !== "all";
  const showFolders = folders.length > 1 && !filtering && !touring;
  const shown = mine.filter(
    (p) =>
      (filter === "all" || groupOf(p) === filter) &&
      (folder === null || folderOf(p) === folder) &&
      (!q || p.name.toLowerCase().includes(q) || (p.description ?? "").toLowerCase().includes(q))
  );

  function openFolder(name) {
    setFolder(name);
    setSearch("");
  }

  // The next course up: the upsell to more slots
  const nextTier = PAID_TIERS.find((t) => TIERS[t].rank > myRank);

  function stepImage(p, dir) {
    const count = productImages(p).length;
    setImgIdx((m) => ({ ...m, [p.id]: ((m[p.id] ?? 0) + dir + count) % count }));
  }

  function openViewer(p) {
    // Fullscreen product view is a phone behaviour; desktop browses via arrows
    if (!window.matchMedia("(max-width: 768px)").matches) return;
    setViewer(p);
    setViewerIdx(imgIdx[p.id] ?? 0);
  }

  // Profit leads; "List at → discount to" reads as one line; "You pay" underneath
  function priceBlock(p) {
    const cost = Number(p.price);
    const listing = p.listing_price != null ? Number(p.listing_price) : null;
    const discount = p.discount_price != null ? Number(p.discount_price) : null;
    const profit = discount != null ? discount - cost : null;
    return (
      <div className="pc-pricing">
        {profit != null && profit > 0 && (
          <div className="pc-profit">
            <span className="t-num">{money(profit)}</span>
            <span className="t-small">profit per sale</span>
          </div>
        )}
        <div className="pc-flow">
          {listing != null && discount != null && (
            <span className="pc-flow-line">
              <Icon name="tag" size={16} className="pc-flow-icon" />
              <span>
                List at <strong>{price(listing)}</strong>
              </span>
              <Icon name="arrow" size={14} className="pc-flow-arrow" />
              <span>
                discount to <strong>{price(discount)}</strong>
              </span>
            </span>
          )}
          <span className="t-small pc-pay">You pay {money(cost)} AUD when it sells</span>
        </div>
      </div>
    );
  }

  function addButton(p, first) {
    const simAdded = first && sim?.added;
    if (inCart.has(p.id) || simAdded) {
      return (
        <Link to="/portal/checkout" className="btn-ghost btn-sm pc-add is-added" onClick={(e) => e.stopPropagation()}>
          <Icon name="check" size={18} />
          In your order
        </Link>
      );
    }
    return (
      <button
        type="button"
        className="btn-ghost btn-sm pc-add"
        data-tut={first ? "add-first" : undefined}
        data-name={first ? p.name : undefined}
        data-price={first ? Number(p.price) : undefined}
        onClick={(e) => {
          e.stopPropagation();
          addAndConfirm(p);
        }}
      >
        <Icon name="plus" size={18} />
        Add to order
      </button>
    );
  }

  function productCard(p, i) {
    const imgs = productImages(p);
    const idx = Math.min(imgIdx[p.id] ?? 0, Math.max(imgs.length - 1, 0));
    return (
      <article key={p.id} className="pc" onClick={() => openViewer(p)}>
        <div className="pc-media">
          {imgs.length > 0 ? (
            <img src={imgs[idx]} alt={p.name} className="pc-img" loading="lazy" />
          ) : (
            <div className="pc-img pc-img-empty">
              <Icon name="products" size={36} strokeWidth={1.25} />
            </div>
          )}
          {p.is_bonus && <span className="chip chip-gold pc-badge">Bonus</span>}
          {imgs.length > 1 && (
            <>
              <button
                type="button"
                className="product-img-nav product-img-prev"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  stepImage(p, -1);
                }}
              >
                <Icon name="back" size={18} />
              </button>
              <button
                type="button"
                className="product-img-nav product-img-next"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  stepImage(p, 1);
                }}
              >
                <Icon name="chevron" size={18} />
              </button>
              <div className="product-dots" aria-hidden="true">
                {imgs.map((_, k) => (
                  <span key={k} className={`product-dot${k === idx ? " active" : ""}`} />
                ))}
              </div>
            </>
          )}
        </div>
        <div className="pc-body">
          <h2 className="pc-name">{p.name}</h2>
          {priceBlock(p)}
          {addButton(p, i === 0)}
        </div>
      </article>
    );
  }

  const chips = [
    ["all", "All"],
    ["tier", TIERS[profile?.tier]?.name ?? "Your plan"],
    ["bonus", "Bonus"],
    ["plus", PLUS.name],
  ].filter(([k]) => k === "all" || counts[k] > 0);

  return (
    <div className="portal-page">
      <div className="pc-head">
        <div>
          <h1 className="portal-h1">Products</h1>
          <p className="portal-sub">Made a sale on Depop? Find the item and add it to your order. We ship it straight to your buyer.</p>
        </div>
        <div className="pc-head-side">
          {limit > 0 && (
            <div className="pc-slots">
              <div className="pc-slots-row">
                <span className="t-label">{unlimited ? "Full catalogue" : "Product slots"}</span>
                <span className="t-label" style={{ color: "var(--text)" }}>
                  {unlimited ? `${mine.length} products` : `${slotUsed} of ${slotTotal}`}
                </span>
              </div>
              {!unlimited && (
                <div className="bar">
                  <span style={{ width: `${slotTotal ? (slotUsed / slotTotal) * 100 : 0}%` }} />
                </div>
              )}
            </div>
          )}
          <Link to="/portal/checkout" className="btn-gold pc-checkout">
            <Icon name="checkout" size={18} />
            Checkout
            {cart.length > 0 && <span className="pc-count">{cart.length}</span>}
          </Link>
        </div>
      </div>

      {loading ? (
        <p className="portal-sub">Loading your products…</p>
      ) : limit === 0 ? (
        <div className="portal-empty">
          <p>Your products appear here once your plan is active.</p>
        </div>
      ) : (
        <>
          {mine.length > 0 && (
            <div className="pc-tools">
              {chips.length > 1 && (
                <div className="pc-chips" role="group" aria-label="Filter products">
                  {chips.map(([k, label]) => (
                    <button
                      key={k}
                      type="button"
                      className={`chip ${filter === k ? "chip-gold" : "chip-plain"}`}
                      aria-pressed={filter === k}
                      onClick={() => setFilter(k)}
                    >
                      {label} {counts[k]}
                    </button>
                  ))}
                </div>
              )}
              <label className="pc-search">
                <Icon name="search" size={18} />
                <input
                  type="search"
                  aria-label="Search your products"
                  placeholder={folder === null ? `Search your ${mine.length} products` : `Search ${folder}`}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
            </div>
          )}

          {folder !== null && (
            <nav className="catalogue-crumbs" aria-label="Product location">
              <button type="button" className="catalogue-crumb-back" onClick={() => openFolder(null)}>
                <Icon name="back" size={16} />
                All categories
              </button>
              <span aria-hidden="true">/</span>
              <span className="catalogue-crumb-current" aria-current="page">
                {folder}
              </span>
            </nav>
          )}

          {showFolders ? (
            <div className="catalogue-folders">
              {folders.map((f) => (
                <button key={f.name} type="button" className="catalogue-folder" onClick={() => openFolder(f.name)}>
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
                    <Icon name="folder" size={18} className="catalogue-folder-icon" />
                    <span className="catalogue-folder-text">
                      <span className="catalogue-folder-name">{f.name}</span>
                      <span className="catalogue-folder-count">
                        {f.items.length} item{f.items.length === 1 ? "" : "s"}
                      </span>
                    </span>
                    <Icon name="chevron" size={16} className="catalogue-folder-chevron" />
                  </span>
                </button>
              ))}
            </div>
          ) : filtering && shown.length === 0 ? (
            <div className="portal-empty">
              <p>{q ? "No products match your search." : "No products here yet."}</p>
            </div>
          ) : null}

          <div className="pc-grid">
            {!showFolders && shown.map(productCard)}

            {!filtering && emptySlots + emptyPlusSlots > 0 && (
              <article className="pc-slot">
                <span className="icon-well">
                  <Icon name="box" />
                </span>
                <span className="t-h3">
                  {emptySlots + emptyPlusSlots} open slot{emptySlots + emptyPlusSlots === 1 ? "" : "s"}
                </span>
                <span className="t-small">New products drop every week. The Sync team stocks these for you.</span>
              </article>
            )}

            {!filtering && nextTier && (
              <article className="pc-slot pc-upsell">
                <span className="icon-well">
                  <Icon name="upgrade" />
                </span>
                <span className="t-h3">Want more products?</span>
                <span className="t-small">
                  {TIERS[nextTier].unlimited
                    ? `${TIERS[nextTier].name} unlocks the entire product catalogue.`
                    : `${TIERS[nextTier].name} gives you ${TIERS[nextTier].productLimit} slots.`}
                </span>
                {!isNativeApp() && (
                  <Link to="/portal/upgrade" className="btn-quiet">
                    Compare plans
                  </Link>
                )}
              </article>
            )}

            {!filtering && !plus && canGetPlus(profile) && (
              <article className="pc-slot pc-upsell">
                <span className="icon-well">
                  <Icon name="star" />
                </span>
                <span className="t-h3">{PLUS.name}</span>
                <span className="t-small">
                  {PLUS.bonusSlots} extra product slot, plus 10% off every purchase.
                </span>
                {!isNativeApp() && (
                  <Link to="/portal/plus" className="btn-quiet">
                    See {PLUS.name}
                  </Link>
                )}
              </article>
            )}
          </div>
        </>
      )}

      {toast && (
        <div className="cart-toast" key={toast.key} role="status">
          <Icon name="check" size={18} />
          {toast.name} added to your order
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
            <div className="product-viewer" role="dialog" aria-modal="true" aria-label={viewer.name}>
              <button className="pt-icon-btn product-viewer-close" aria-label="Close" onClick={() => setViewer(null)}>
                <Icon name="x" />
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
                  <div className="product-viewer-img pc-img-empty" />
                )}
                {imgs.length > 1 && (
                  <>
                    <button className="product-img-nav product-img-prev" aria-label="Previous image" onClick={() => step(-1)}>
                      <Icon name="back" size={18} />
                    </button>
                    <button className="product-img-nav product-img-next" aria-label="Next image" onClick={() => step(1)}>
                      <Icon name="chevron" size={18} />
                    </button>
                    <div className="product-dots" aria-hidden="true">
                      {imgs.map((_, i) => (
                        <span key={i} className={`product-dot${i === idx ? " active" : ""}`} />
                      ))}
                    </div>
                  </>
                )}
              </div>
              <div className="product-viewer-body">
                <h2 className="pc-name" style={{ fontSize: 24 }}>
                  {viewer.name}
                </h2>
                {viewer.description && <p className="t-small">{viewer.description}</p>}
                {priceBlock(viewer)}
                <button
                  className="btn-gold"
                  onClick={() => {
                    addAndConfirm(viewer);
                    setViewer(null);
                  }}
                >
                  Add to order
                </button>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
