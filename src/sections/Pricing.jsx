import { useState } from "react";
import { useInView } from "../components/useInView";
import FadeUp from "../components/FadeUp";
import Eyebrow from "../components/Eyebrow";
import CheckoutDrawer from "../components/CheckoutDrawer";
import CheckoutSuccessNotification from "../components/CheckoutSuccessNotification";
import { TIERS } from "../data/pricing.js";
import { trackEvent } from "../utils/analytics.js";
import { isNativeApp } from "../lib/nativeApp.js";

const COMPARE_ROWS = [
  { feature: "Step-by-step pathway", pro: "✓ (extended)", elite: "✓ (extended)", vip: "✓ (full tree)", executive: "✓ (full tree)" },
  { feature: "Dashboard product slots", pro: "9", elite: "12", vip: "15", executive: "Entire catalogue" },
  { feature: "1-on-1 calls", pro: "Unlimited", elite: "Unlimited", vip: "Unlimited", executive: "Unlimited" },
  { feature: "Store setup", pro: "✓", elite: "✓", vip: "✓", executive: "✓" },
  { feature: "Store run for you", pro: "-", elite: "-", vip: "✓", executive: "✓" },
  { feature: "Daily product picks", pro: "✓ (drops)", elite: "✓ (drops)", vip: "✓ (personalised)", executive: "✓ (personalised)" },
  { feature: "Listings created for you", pro: "-", elite: "✓", vip: "✓", executive: "✓" },
  { feature: "Custom supplier sourcing", pro: "-", elite: "-", vip: "✓", executive: "✓" },
  { feature: "Priority support", pro: "-", elite: "✓", vip: "Top-priority", executive: "Executive priority" },
  { feature: "Store audits", pro: "-", elite: "-", vip: "On-demand", executive: "On-demand" },
  { feature: "Daily operations oversight", pro: "-", elite: "-", vip: "✓", executive: "✓" },
  { feature: "Sales specialists", pro: "-", elite: "-", vip: "-", executive: "Unlimited" },
  { feature: "Staff-level sales resources", pro: "-", elite: "-", vip: "-", executive: "✓" },
];

function CompareCell({ value }) {
  return (
    <td>
      {value === "✓" ? <span className="check">✦</span> : value === "-" ? <span className="dash">-</span> : value}
    </td>
  );
}

export default function Pricing() {
  const [showCompare, setShowCompare] = useState(false);
  const [ref, visible] = useInView(0.05);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTier, setDrawerTier] = useState(null);

  function card(tier) {
    return (
      <div key={tier.id} className={`price-card${tier.featured ? " featured" : ""}${tier.flagship ? " flagship" : ""}`}>
        {tier.featured && <div className="price-badge">Most Popular</div>}
        {tier.flagship && <div className="price-badge">The Ultimate Tier</div>}
        <div className="price-tier-label">{tier.tier}</div>
        <div className="price-name">{tier.name}</div>
        <div className="price-tagline">{tier.tagline}</div>
        <div className="price-amount-row">
          <span className="price-currency">$</span>
          <span className="price-amount">{tier.price}</span>
        </div>
        <div className="price-period">AUD, one-time payment</div>
        <div className="price-outcome">
          <strong style={{ color: "var(--gold)", fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>What you get: </strong>
          {tier.outcome}
        </div>
        <ul className="price-features">
          {tier.features.map((f) => <li key={f}>{f}</li>)}
        </ul>
        {!isNativeApp() && (
          <button
            className="btn-gold price-cta-btn"
            onClick={() => { setDrawerTier(tier); setDrawerOpen(true); trackEvent("pricing_cta_click", { tier: tier.name }); }}
          >
            {tier.flagship ? "Become an Executive Partner →" : "Choose Plan →"}
          </button>
        )}
        {tier.flagship && (
          <p className="price-anchor-note">
            Not ready for the full partnership? VIP Inner Circle gets you a fully run store for under a fifth of the price.
          </p>
        )}
      </div>
    );
  }

  return (
    <section className="section pricing-section" id="pricing">
      <div className="section-inner">
        <FadeUp>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 0" }}>
            <Eyebrow text="Pricing" />
            <h2 className="section-title">Choose your level.<br />Start <em>today.</em></h2>
            <p className="section-sub" style={{ margin: "16px auto 0" }}>
              The Depop Coaching System — three levels of hands-on coaching, plus the
              Executive Partner flagship, each with the full Sync dashboard included. All prices in AUD, paid securely via Stripe.
              Questions first? Email <a href="mailto:founder@syncagency.org">founder@syncagency.org</a>.
            </p>
          </div>
        </FadeUp>

        <div ref={ref} className={`pricing-grid stagger${visible ? " visible" : ""}`}>
          {TIERS.filter((t) => !t.flagship).map(card)}
        </div>

        <FadeUp>
          <div className="pricing-flagship">{TIERS.filter((t) => t.flagship).map(card)}</div>
        </FadeUp>

        <FadeUp>
          <div className="compare-wrap" style={{ marginTop: 40, maxWidth: "100%", overflowX: "auto" }}>
            <div className="compare-toggle" onClick={() => setShowCompare(v => !v)} style={{ cursor: "pointer" }}>
              <div className="compare-toggle-icon" style={{ transform: showCompare ? "rotate(45deg)" : "none", transition: "transform .3s" }}>+</div>
              <span className="compare-toggle-text">Compare all tiers side-by-side</span>
            </div>
            {showCompare && (
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    {TIERS.map((t) => <th key={t.id}>{t.name} - ${t.price} once</th>)}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      <CompareCell value={row.pro} />
                      <CompareCell value={row.elite} />
                      <CompareCell value={row.vip} />
                      <CompareCell value={row.executive} />
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </FadeUp>
      </div>
      <CheckoutDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} tier={drawerTier} />
      <CheckoutSuccessNotification />
    </section>
  );
}
