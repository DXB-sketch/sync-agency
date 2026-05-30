import { useState, useEffect, useRef } from "react";
import Eyebrow from "../components/Eyebrow";
import FadeUp from "../components/FadeUp";
import StripeBuyButton from "../components/StripeBuyButton";
import { TIERS, COMPARE_ROWS } from "../data/pricing";
import { useInView } from "../hooks/useInView";
import { trackEvent } from "../utils/analytics";

const DISCORD_URL = "https://discord.gg/pVzjXumpbP";
const SPOTS_STORAGE_KEY = "spotsBaseByMonth";

function getMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

function daysInMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function loadOrInitBases() {
  const monthKey = getMonthKey();
  let stored = null;
  try { stored = JSON.parse(sessionStorage.getItem(SPOTS_STORAGE_KEY) || "null"); } catch { /* noop */ }

  if (stored && stored.monthKey === monthKey) return stored.bases;

  const monthIdx = new Date().getMonth();
  const isFirstMonthEver = stored == null;
  const bases = {};
  TIERS.forEach((t) => {
    if (isFirstMonthEver) {
      bases[t.id] = t.spotsBase;
    } else {
      bases[t.id] = randInt(t.spotsResetMin, t.spotsResetMax);
    }
  });

  try {
    sessionStorage.setItem(SPOTS_STORAGE_KEY, JSON.stringify({ monthKey, bases, monthIdx }));
  } catch { /* noop */ }
  return bases;
}

function computeRemaining(base) {
  const now = new Date();
  const total = daysInMonth(now);
  const dayOfMonth = now.getDate();
  const progress = Math.min(Math.max(dayOfMonth / total, 0), 1);
  const taken = Math.floor(base * progress);
  return Math.max(0, base - taken);
}

function SpotsBadge({ remaining }) {
  if (remaining === 0) {
    return (
      <div className="spots-badge full">
        <span className="spots-badge-dot" />
        <span>This tier is currently full — join waitlist</span>
      </div>
    );
  }
  if (remaining < 15) {
    return (
      <div className="spots-badge urgent">
        <span className="spots-badge-dot" />
        <span>Only {remaining} spots left — closes soon</span>
      </div>
    );
  }
  return (
    <div className="spots-badge">
      <span className="spots-badge-dot" />
      <span>{remaining} spots remaining this month</span>
    </div>
  );
}

export default function Pricing() {
  const [showCompare, setShowCompare] = useState(false);
  const [ref, visible] = useInView(0.05);
  const [bases, setBases] = useState({});
  const [, force] = useState(0);
  const sectionRef = useRef(null);
  const trackedViewRef = useRef(false);

  useEffect(() => {
    setBases(loadOrInitBases());
    const tick = setInterval(() => force((n) => n + 1), 60 * 60 * 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (!sectionRef.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !trackedViewRef.current) {
        trackedViewRef.current = true;
        trackEvent("pricing_view");
      }
    }, { threshold: 0.2 });
    obs.observe(sectionRef.current);
    return () => obs.disconnect();
  }, []);

  return (
    <section className="section pricing-section" id="pricing" ref={sectionRef}>
      <div className="section-inner">
        <FadeUp>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 0" }}>
            <Eyebrow text="Pricing" />
            <h2 className="section-title">One system.<br />Three levels of <em>access.</em></h2>
            <p className="section-sub" style={{ margin: "16px auto 0" }}>
              All prices in AUD. Pay securely via Stripe, or join our Discord to ask questions first.
            </p>
          </div>
        </FadeUp>

        <div ref={ref} className={`pricing-grid stagger${visible ? " visible" : ""}`}>
          {TIERS.map((tier) => {
            const base = bases[tier.id] ?? tier.spotsBase;
            const remaining = computeRemaining(base);
            const full = remaining === 0;
            return (
              <div key={tier.id} className={`price-card${tier.featured ? " featured" : ""}`}>
                {tier.featured && <div className="price-badge">Most Popular</div>}
                <div className="price-tier-label">{tier.tier}</div>
                <SpotsBadge remaining={remaining} />
                <div className="price-name">{tier.name}</div>
                <div className="price-tagline">{tier.tagline}</div>
                <div className="price-amount-row">
                  <span className="price-currency">$</span>
                  <span className="price-amount">{tier.price}</span>
                </div>
                <div className="price-period">AUD/month — 3-day free trial</div>
                <div className="price-outcome">
                  <strong style={{ color: "var(--gold)", fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Outcome: </strong>
                  {tier.outcome}
                </div>
                <ul className="price-features">
                  {tier.features.map((f) => <li key={f}>{f}</li>)}
                </ul>
                {full ? (
                  <a
                    href={DISCORD_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="price-waitlist-btn"
                    onClick={() => trackEvent("discord_click", { source: "waitlist", tier: tier.name })}
                  >
                    Join the Waitlist →
                  </a>
                ) : (
                  <div onClick={() => trackEvent("tier_click", { tier: tier.name })}>
                    <StripeBuyButton
                      buyButtonId={tier.stripeBtnId}
                      publishableKey={tier.stripeKey}
                    />
                  </div>
                )}
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="price-discord-btn"
                  onClick={() => trackEvent("discord_click", { source: "pricing-card" })}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                  Join Discord to discuss first
                </a>
              </div>
            );
          })}
        </div>

        <FadeUp>
          <div className="compare-wrap" style={{ marginTop: 40 }}>
            <div className="compare-toggle" onClick={() => setShowCompare(v => !v)} style={{ cursor: "pointer" }}>
              <div className="compare-toggle-icon" style={{ transform: showCompare ? "rotate(45deg)" : "none", transition: "transform .3s" }}>+</div>
              <span className="compare-toggle-text">Compare all tiers side-by-side</span>
            </div>
            {showCompare && (
              <>
                <table className="compare-table">
                  <thead>
                    <tr>
                      <th>Feature</th>
                      <th>Pro Accelerator — $79/mo</th>
                      <th>Elite Scale — $127/mo</th>
                      <th>VIP Inner Circle — $349/mo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_ROWS.map((row) => (
                      <tr key={row.feature}>
                        <td>{row.feature}</td>
                        <td>{row.pro === "✓" ? <span className="check">✦</span> : row.pro === "—" ? <span className="dash">—</span> : row.pro}</td>
                        <td>{row.elite === "✓" ? <span className="check">✦</span> : row.elite === "—" ? <span className="dash">—</span> : row.elite}</td>
                        <td>{row.vip === "✓" ? <span className="check">✦</span> : row.vip === "—" ? <span className="dash">—</span> : row.vip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="compare-cards">
                  <div className="compare-cards-head">
                    <div>Feature</div>
                    <div>Pro</div>
                    <div>Elite</div>
                    <div>VIP</div>
                  </div>
                  {COMPARE_ROWS.map((row) => (
                    <div key={row.feature} className="compare-card-row">
                      <div>{row.feature}</div>
                      <div>{row.pro === "✓" ? <span className="check">✦</span> : row.pro === "—" ? <span className="dash">—</span> : row.pro}</div>
                      <div>{row.elite === "✓" ? <span className="check">✦</span> : row.elite === "—" ? <span className="dash">—</span> : row.elite}</div>
                      <div>{row.vip === "✓" ? <span className="check">✦</span> : row.vip === "—" ? <span className="dash">—</span> : row.vip}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
