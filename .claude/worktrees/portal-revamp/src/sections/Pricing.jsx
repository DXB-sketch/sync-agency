import { useState } from "react";
import { Link } from "react-router-dom";
import { useInView } from "../components/FadeUp";
import FadeUp from "../components/FadeUp";
import Eyebrow from "../components/Eyebrow";
import CheckoutDrawer from "../components/CheckoutDrawer";
import CheckoutSuccessNotification from "../components/CheckoutSuccessNotification";
import { TIERS } from "../data/pricing.js";
import { trackEvent } from "../utils/analytics.js";
import { isNativeApp } from "../lib/nativeApp.js";

const COMPARE_ROWS = [
  { feature: "Step-by-step pathway", free: "✓", pro: "✓ (extended)", elite: "✓ (extended)", vip: "✓ (full tree)" },
  { feature: "Dashboard product slots", free: "6", pro: "9", elite: "12", vip: "15" },
  { feature: "1-on-1 calls", free: "-", pro: "Unlimited", elite: "Unlimited", vip: "Unlimited" },
  { feature: "Store setup", free: "Self-serve", pro: "✓", elite: "✓", vip: "✓" },
  { feature: "Store run for you", free: "-", pro: "-", elite: "-", vip: "✓" },
  { feature: "Daily product picks", free: "-", pro: "✓ (drops)", elite: "✓ (drops)", vip: "✓ (personalised)" },
  { feature: "Listings created for you", free: "-", pro: "-", elite: "✓", vip: "✓" },
  { feature: "Custom supplier sourcing", free: "-", pro: "-", elite: "-", vip: "✓" },
  { feature: "Priority support", free: "-", pro: "-", elite: "✓", vip: "Top-priority" },
  { feature: "Store audits", free: "-", pro: "-", elite: "-", vip: "On-demand" },
  { feature: "Daily operations oversight", free: "-", pro: "-", elite: "-", vip: "✓" },
];

function CompareCell({ value }) {
  return (
    <td>
      {value === "✓" ? <span className="check">✦</span> : value === "-" ? <span className="dash">-</span> : value}
    </td>
  );
}

function SpotsBadge({ spots }) {
  return (
    <div className="spots-badge">
      <div className="spots-dot" />
      <span className="spots-text">
        <span className="spots-count">{spots} spot{spots !== 1 ? "s" : ""}</span> remaining this month
      </span>
    </div>
  );
}

export default function Pricing() {
  const [showCompare, setShowCompare] = useState(false);
  const [ref, visible] = useInView(0.05);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTier, setDrawerTier] = useState(null);

  return (
    <section className="section pricing-section" id="pricing">
      <div className="section-inner">
        <FadeUp>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 0" }}>
            <Eyebrow text="Upgrades" />
            <h2 className="section-title">Start free.<br />Upgrade when you're <em>ready.</em></h2>
            <p className="section-sub" style={{ margin: "16px auto 0" }}>
              The Sync dashboard is free forever. The Depop Coaching System — three levels of
              hands-on coaching — plugs straight into it. All prices in AUD, paid securely via
              Stripe, or join our Discord to ask questions first.
            </p>
          </div>
        </FadeUp>

        <FadeUp>
          <div className="price-free-banner">
            <div>
              <div className="price-tier-label">Tier 00 · Free forever</div>
              <div className="price-name">The Sync Dashboard</div>
              <div className="price-tagline">
                Step-by-step pathway, 6 product slots stocked by our team, achievements,
                order fulfilment and support — no card required.
              </div>
            </div>
            <Link to="/signup" className="btn-gold price-free-cta">
              Create your free account →
            </Link>
          </div>
        </FadeUp>

        <div ref={ref} className={`pricing-grid stagger${visible ? " visible" : ""}`}>
          {TIERS.map((tier) => (
            <div key={tier.id} className={`price-card${tier.featured ? " featured" : ""}`}>
              {tier.featured && <div className="price-badge">Most Popular</div>}
              <div className="price-tier-label">{tier.tier}</div>
              <div className="price-name">{tier.name}</div>
              <div className="price-tagline">{tier.tagline}</div>
              <div className="price-amount-row">
                <span className="price-currency">$</span>
                <span className="price-amount">{tier.price}</span>
              </div>
              <div className="price-period">AUD, per month · 3-day free trial</div>
              <SpotsBadge spots={tier.spotsBase} />
              <div className="price-outcome">
                <strong style={{ color: "var(--gold)", fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Outcome: </strong>
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
                  Choose Plan →
                </button>
              )}
              <a
                href="https://discord.gg/pVzjXumpbP"
                target="_blank"
                rel="noreferrer"
                className="price-discord-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                Join Discord to discuss first
              </a>
            </div>
          ))}
        </div>

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
                    <th>Free Dashboard - $0</th>
                    <th>Pro Accelerator - $79/mo</th>
                    <th>Elite Scale - $127/mo</th>
                    <th>VIP Inner Circle - $349/mo</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      <CompareCell value={row.free} />
                      <CompareCell value={row.pro} />
                      <CompareCell value={row.elite} />
                      <CompareCell value={row.vip} />
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
