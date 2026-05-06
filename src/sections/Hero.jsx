import StatCounter from "../components/StatCounter";
import { trackEvent } from "../utils/analytics";

const DISCORD_URL = "https://discord.gg/pVzjXumpbP";

function HeroPanel() {
  return (
    <div className="hero-panel">
      <div className="hero-panel-header">
        <div className="panel-dot" style={{ background: "#FF5F57" }} />
        <div className="panel-dot" style={{ background: "#FFBD2E" }} />
        <div className="panel-dot" style={{ background: "#28CA41" }} />
        <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: 8, fontWeight: 500 }}>live_profit_model.sync</span>
      </div>
      <div className="hero-panel-body">
        <div className="flow-row panel-animate">
          <div className="flow-node accent">
            <div className="flow-node-tag">Your Depop store</div>
            <div className="flow-node-title">Product listed at $85</div>
            <div className="flow-node-sub">Optimised listing · private niche</div>
          </div>
          <div className="flow-connector">
            <div className="flow-conn-line" />
            <div className="flow-conn-label">buyer purchases ↓</div>
          </div>
          <div className="flow-node">
            <div className="flow-node-tag">Step 2 — Sale received</div>
            <div className="flow-node-title">$85 lands in your account</div>
            <div className="flow-node-sub">Depop handles payment processing</div>
          </div>
          <div className="flow-connector">
            <div className="flow-conn-line" />
            <div className="flow-conn-label">you order from supplier ↓</div>
          </div>
          <div className="flow-node">
            <div className="flow-node-tag">Private supplier</div>
            <div className="flow-node-title">You pay $38 — they ship direct</div>
            <div className="flow-node-sub">No stock held · no warehouse needed</div>
          </div>
          <div className="flow-profit">
            <div>
              <div className="flow-profit-label">Your profit per sale</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>$85 − $38 cost</div>
            </div>
            <div className="flow-profit-num">$47 ✦</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Hero() {
  const words = ["Turn", "Depop", "Into", "a"];
  return (
    <section className="hero">
      <div className="hero-bg-orb orb1" />
      <div className="hero-bg-orb orb2" />
      <div className="hero-line hero-line1" />
      <div className="hero-line hero-line2" />
      <div className="hero-grid">
        <div>
          <div className="hero-eyebrow">
            <div className="hero-eyebrow-line" />
            <span className="hero-eyebrow-text">Depop Dropshipping · Australia</span>
          </div>
          <h1 className="hero-h1">
            {words.map((w, i) => (
              <span key={w} className="word" style={{ animationDelay: `${0.1 + i * 0.08}s`, marginRight: "0.28em" }}>{w}</span>
            ))}
            <br />
            <em className="word" style={{ animationDelay: "0.44s" }}>Profitable Business.</em>
          </h1>
          <p className="hero-sub" style={{ animation: "wordReveal .8s .6s cubic-bezier(.16,1,.3,1) both" }}>
            We've helped 1200+ clients build real income on Depop. No guesswork. No theory.
            A practitioner-built system with a 100% success rate.
          </p>
          <div className="hero-actions" style={{ animation: "wordReveal .8s .75s cubic-bezier(.16,1,.3,1) both" }}>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-gold"
              onClick={() => trackEvent("discord_click", { source: "hero" })}
            >
              Enrol Now <span>→</span>
            </a>
            <a href="#pricing" className="btn-ghost">View Pricing</a>
          </div>
          <div className="hero-stats" style={{ animation: "wordReveal .8s .9s cubic-bezier(.16,1,.3,1) both" }}>
            <div className="hero-stat">
              <div className="hero-stat-num">
                <StatCounter target={1200} suffix="+" />
              </div>
              <div className="hero-stat-label">Clients helped</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">
                <StatCounter target={100} suffix="%" />
              </div>
              <div className="hero-stat-label">Success rate</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">
                $<StatCounter target={800} />
              </div>
              <div className="hero-stat-label">Avg monthly profit</div>
            </div>
          </div>
        </div>
        <div style={{ animation: "wordReveal .9s .5s cubic-bezier(.16,1,.3,1) both" }}>
          <HeroPanel />
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)" }}>
        <div className="scroll-indicator">
          <span>Scroll</span>
          <div className="scroll-indicator-arrow">↓</div>
        </div>
      </div>
    </section>
  );
}
