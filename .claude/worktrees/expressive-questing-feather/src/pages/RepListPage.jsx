import FadeUp from "../components/FadeUp";
import StaggerGrid from "../components/StaggerGrid";
import Eyebrow from "../components/Eyebrow";
import StripeBuyButton from "../components/StripeBuyButton";

export default function RepListPage() {
  return (
    <>
      {/* Divider with label */}
      <div className="rep-divider" style={{ paddingTop: 0 }}>
        <div className="rep-divider-inner">
          <div className="rep-divider-line" />
          <div className="rep-divider-label">
            <span className="rep-divider-badge">Also Available from Sync Agency</span>
          </div>
        </div>
      </div>

      {/* Intro strip */}
      <div className="rep-intro section" style={{ paddingBottom: 0 }}>
        <div className="rep-intro-inner">
          <FadeUp>
            <Eyebrow text="The Rep Spreadsheet" />
            <h2 className="section-title">5,000+ sourcing links.<br />One <em>subscription.</em></h2>
            <p className="section-sub">
              Whether you're a dedicated reseller or sourcing products for your Depop dropshipping store,
              this spreadsheet is the unfair advantage. Access 5,000+ verified links for high-rep items,
              updated regularly, with direct supplier access built in.
            </p>
            <p style={{ fontSize: 14, color: "var(--text-dim)", marginTop: 16, lineHeight: 1.7 }}>
              Used by Sync Agency clients to accelerate product research and find items that convert.
              Skip hours of hunting, the work's already done.
            </p>
          </FadeUp>
          <StaggerGrid className="rep-intro-visual">
            {[
              { num: "5,000+", label: "Rep item links" },
              { num: "Monthly", label: "New additions" },
              { num: "Direct", label: "Supplier access" },
              { num: "Instant", label: "Access on subscribe" },
            ].map(({ num, label }, i) => (
              <div key={label} className={`rep-stat-tile${i === 3 ? "" : ""}`}>
                <div className="rep-stat-tile-num">{num}</div>
                <div className="rep-stat-tile-label">{label}</div>
              </div>
            ))}
          </StaggerGrid>
        </div>
      </div>

      {/* Card section */}
      <div className="rep-card-section">
        <div className="rep-card-section-inner">
          <div className="rep-card-wrap">
            <FadeUp>
              <Eyebrow text="What's included" />
              <h3 className="section-title" style={{ fontSize: "clamp(28px, 3vw, 44px)" }}>
                Everything a serious<br />reseller <em>needs.</em>
              </h3>
              <div className="rep-features-list">
                {[
                  { icon: "🔗", title: "5,000+ verified item links", desc: "Direct links to high-rep products across multiple supplier platforms. Curated, tested, and ready to list." },
                  { icon: "📋", title: "Categorised & searchable", desc: "Items are sorted by category so you can find exactly what you need fast, no wading through noise." },
                  { icon: "🔄", title: "Monthly updates", desc: "New items are added every month. The spreadsheet stays current with what's selling and what's trending." },
                  { icon: "💰", title: "Built for profit", desc: "Every link is selected with margins in mind. Ideal for Depop dropshippers sourcing products at scale." },
                  { icon: "⚡", title: "Instant access", desc: "Subscribe and you're in immediately. No waiting, no approval. Access is delivered automatically." },
                ].map((f) => (
                  <div key={f.title} className="rep-feature">
                    <div className="rep-feature-icon">{f.icon}</div>
                    <div>
                      <h3>{f.title}</h3>
                      <p>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </FadeUp>

            <FadeUp delay={2}>
              <div className="rep-price-card">
                <div className="rep-price-card-label">Monthly Subscription</div>
                <div className="rep-price-card-name">The Rep Spreadsheet</div>
                <div className="rep-price-card-sub">5,000+ sourcing links for resellers & dropshippers. Updated monthly.</div>
                <div className="rep-price-row">
                  <span className="rep-price-currency">$</span>
                  <span className="rep-price-amount">47.95</span>
                </div>
                <div className="rep-price-period">AUD, billed monthly · cancel anytime</div>
                <div className="rep-price-outcome">
                  <strong style={{ color: "var(--gold)", fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>You get: </strong>
                  Instant access to 5,000+ rep item links, updated every month.
                </div>
                <ul className="rep-includes">
                  <li>5,000+ high-rep item links</li>
                  <li>Direct supplier URLs</li>
                  <li>Monthly new additions</li>
                  <li>Categorised by product type</li>
                  <li>Usable for dropshipping & resale</li>
                  <li>Instant access on subscribe</li>
                </ul>
                <StripeBuyButton
                  buyButtonId="buy_btn_1TSuH2PDABwVk3W5i9KMVmIi"
                  publishableKey="pk_live_51TKIROPDABwVk3W5w51MmfawDKkAMsyEjGoK6ZA5PZeBalPsJc36lz8gcPkpXKqqROKuve95rUmS1JclAIwTpzZ900qOf5I2Ne"
                />
                <p className="rep-cancel-note">Cancel any time. No lock-in contracts.</p>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </>
  );
}
