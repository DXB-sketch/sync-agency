import { useState } from "react";
import FadeUp from "../components/FadeUp";
import Eyebrow from "../components/Eyebrow";
import Icon from "../components/SiteIcon";
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

// The five things that matter per plan (design refresh v2 pricing board).
// Every line is taken verbatim from TIERS[].features; the rest are listed in
// the comparison panel.
const HIGHLIGHTS = {
  pro: ["1-on-1 execution calls (unlimited)", "Live store build from scratch", "Custom niche & positioning analysis", "Private supplier access", "Daily product drops"],
  elite: ["Scaling & optimisation strategy", "Advanced product testing", "Supplier margin optimisation", "Listings created & optimised", "Priority message access"],
  vip: ["Unlimited 1-on-1 calls", "Fully custom strategy", "Private VIP product list", "Store fully run for you", "Top-priority responses"],
};

const isBaseLine = (f) => f.startsWith("Everything in");

function CompareCell({ value }) {
  if (value === "-") {
    return <td><span className="cmp-no" aria-hidden="true">—</span><span className="sr-only">Not included</span></td>;
  }
  if (value.startsWith("✓")) {
    const rest = value.slice(1).trim();
    return (
      <td>
        <span className="cmp-yes"><Icon name="check" /><span className={rest ? "" : "sr-only"}>{rest || "Included"}</span></span>
      </td>
    );
  }
  return <td>{value}</td>;
}

export default function Pricing() {
  const [showCompare, setShowCompare] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTier, setDrawerTier] = useState(null);

  function choose(tier) {
    setDrawerTier(tier);
    setDrawerOpen(true);
    trackEvent("pricing_cta_click", { tier: tier.name });
  }

  const plans = TIERS.filter((t) => !t.flagship);
  const flagship = TIERS.find((t) => t.flagship);

  function card(tier, i) {
    const base = tier.features.find(isBaseLine);
    const picks = HIGHLIGHTS[tier.id];
    const more = tier.features.filter((f) => !isBaseLine(f)).length - picks.length;
    const lower = i > 0 ? plans[i - 1].name : null;
    return (
      <article key={tier.id} className={`price-card${tier.featured ? " featured" : ""}`}>
        {tier.featured && <span className="chip price-badge">Most popular</span>}
        <div>
          <div className="t-eyebrow price-tier">{tier.tier}</div>
          <h3 className="t-h2 price-name">{tier.name}</h3>
          <p className="t-small price-tagline">{tier.tagline}</p>
        </div>
        <div className="price-amount-row">
          <span className="t-num t-gold price-amount">${tier.price}</span>
          <span className="t-small">AUD, one-time payment</span>
        </div>
        <div className="price-outcome"><strong>What you get:</strong> <span>{tier.outcome}</span></div>
        <ul className="price-feats">
          {base && lower && <li className="feat feat-base">Everything in {lower}, plus:</li>}
          {picks.map((f) => <li key={f} className="feat"><Icon name="check" />{f}</li>)}
          {more > 0 && <li className="t-small t-muted feat-more">+ {more} more in the comparison</li>}
        </ul>
        {!isNativeApp() && (
          <button
            type="button"
            className={`btn ${tier.featured ? "btn-primary" : "btn-secondary"} price-cta`}
            onClick={() => choose(tier)}
          >
            Choose {tier.name}
          </button>
        )}
      </article>
    );
  }

  return (
    <section className="s-section" id="pricing">
      <div className="wrap s-stack">
        <FadeUp>
          <div className="s-head">
            <Eyebrow text="Pricing" />
            <h2 className="t-h1 s-title">Choose your level. Start <em className="em">today.</em></h2>
            <p className="t-body s-lede">
              The Depop Coaching System — three levels of hands-on coaching, plus the
              Executive Partner flagship, each with the full Sync dashboard included. All prices in AUD, paid securely via Stripe.
              Questions first? Email <a className="s-link" href="mailto:founder@syncagency.org">founder@syncagency.org</a>.
            </p>
          </div>
        </FadeUp>

        <div className="pricing-grid">{plans.map(card)}</div>

        {flagship && (
          <FadeUp>
            <article className="price-flagship">
              <span className="chip price-badge">The ultimate tier</span>
              <div className="flagship-top">
                <div className="flagship-intro">
                  <div className="t-eyebrow">{flagship.tier}</div>
                  <h3 className="t-h1 flagship-name">{flagship.name}</h3>
                  <p className="t-body">{flagship.tagline}</p>
                </div>
                <div className="price-amount-row">
                  <span className="t-num t-gold flagship-amount">${flagship.price}</span>
                  <span className="t-small">AUD, one-time payment</span>
                </div>
              </div>
              <div className="price-outcome flagship-outcome"><strong>What you get:</strong> <span>{flagship.outcome}</span></div>
              <ul className="flagship-feats">
                {flagship.features.map((f) => <li key={f} className="feat"><Icon name="check" />{f}</li>)}
              </ul>
              <div className="flagship-foot">
                {!isNativeApp() && (
                  <button type="button" className="btn btn-primary btn-lg" onClick={() => choose(flagship)}>
                    Become an Executive Partner <Icon name="arrow" />
                  </button>
                )}
                <p className="t-small">
                  Not ready for the full partnership? VIP Inner Circle gets you a fully run store for under a fifth of the price.
                </p>
              </div>
            </article>
          </FadeUp>
        )}

        <div className="compare">
          <button
            type="button"
            className="btn btn-secondary compare-toggle"
            aria-expanded={showCompare}
            aria-controls="compare-panel"
            onClick={() => setShowCompare((v) => !v)}
          >
            Compare all tiers side by side
            <Icon name="chevron" className={`icon s-chevron${showCompare ? " open" : ""}`} />
          </button>
          <div id="compare-panel" hidden={!showCompare}>
            <div className="compare-scroll" role="region" aria-label="Tier comparison" tabIndex={0}>
              <table className="compare-table">
                <thead>
                  <tr>
                    <th scope="col">Feature</th>
                    {TIERS.map((t) => <th scope="col" key={t.id}>{t.name}<span className="compare-price">${t.price} once</span></th>)}
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.feature}>
                      <th scope="row">{row.feature}</th>
                      <CompareCell value={row.pro} />
                      <CompareCell value={row.elite} />
                      <CompareCell value={row.vip} />
                      <CompareCell value={row.executive} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="compare-lists">
              {TIERS.map((t) => (
                <div key={t.id} className="card compare-list">
                  <h3 className="t-h3">{t.name}</h3>
                  <ul>
                    {t.features.map((f) => <li key={f} className="feat"><Icon name="check" />{f}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <CheckoutDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} tier={drawerTier} />
      <CheckoutSuccessNotification />
    </section>
  );
}
