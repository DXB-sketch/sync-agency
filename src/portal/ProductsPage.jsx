import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TIERS, tierRank } from "../lib/tiers";
import { addToCart, loadCart } from "../lib/cart";

const TIER_ORDER = ["pro", "elite", "vip"];

export default function ProductsPage() {
  const { profile } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(loadCart().length);

  useEffect(() => {
    supabase
      .from("products")
      .select("*")
      .eq("active", true)
      .order("created_at")
      .then(({ data }) => {
        setProducts(data ?? []);
        setLoading(false);
      });
  }, []);

  const myRank = tierRank(profile?.tier);
  const limit = TIERS[profile?.tier]?.productLimit ?? 0;
  const normal = products.filter((p) => !p.is_bonus);
  const bonus = products.filter((p) => p.is_bonus);
  const emptySlots = Math.max(limit - normal.length, 0);

  // Higher tiers appear as locked sections showing the extra slots an upgrade unlocks
  const lockedTiers = TIER_ORDER.filter((t) => TIERS[t].rank > myRank).map((t, i, arr) => {
    const prevLimit = i === 0 ? limit : TIERS[arr[i - 1]].productLimit;
    return { tier: t, extra: TIERS[t].productLimit - prevLimit };
  });

  function productCard(p) {
    return (
      <div key={p.id} className="product-card">
        {p.image_url ? (
          <img src={p.image_url} alt={p.name} className="product-img" />
        ) : (
          <div className="product-img product-img-empty" />
        )}
        <div className="product-body">
          <h2 className="product-name">
            {p.name}
            {p.is_bonus && <span className="bonus-badge">Bonus</span>}
          </h2>
          {p.description && <p className="product-desc">{p.description}</p>}
          <div className="product-foot">
            <span className="product-price">
              ${Number(p.price).toFixed(2)} <span className="price-currency">AUD</span>
            </span>
            <button
              className="btn-ghost product-add"
              onClick={() => setCartCount(addToCart(p).length)}
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
        <Link to="/portal/checkout" className="btn-gold">
          Checkout{cartCount > 0 ? ` (${cartCount})` : ""}
        </Link>
      </div>

      {loading ? (
        <p className="portal-sub">Loading catalogue…</p>
      ) : (
        <>
          {limit > 0 && (
            <div className="slot-section">
              <div className="slot-section-head">
                <span className="slot-section-title">{TIERS[profile.tier].name}</span>
                <span className="slot-count">
                  {normal.length}/{limit} product slots filled
                </span>
              </div>
              <div className="product-grid">
                {normal.map(productCard)}
                {bonus.map(productCard)}
                {Array.from({ length: emptySlots }, (_, i) => (
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

          {lockedTiers.map(({ tier, extra }) => (
            <div key={tier} className="slot-section slot-section-locked">
              <div className="slot-section-head">
                <span className="slot-section-title">
                  {TIERS[tier].name} <span className="slot-lock">🔒</span>
                </span>
                <span className="slot-count">+{extra} product slots</span>
              </div>
              <div className="product-grid">
                {Array.from({ length: extra }, (_, i) => (
                  <div key={`locked-${tier}-${i}`} className="product-slot-locked">
                    <span className="slot-lock-icon">🔒</span>
                  </div>
                ))}
              </div>
              <div className="slot-unlock-row">
                <span>
                  Upgrade to {TIERS[tier].name} to unlock {extra} more products in your store.
                </span>
                <Link to="/portal/upgrade" className="btn-gold slot-unlock-btn">
                  Upgrade to unlock
                </Link>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
