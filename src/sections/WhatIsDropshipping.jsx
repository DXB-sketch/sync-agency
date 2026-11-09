import FadeUp from "../components/FadeUp";
import StaggerGrid from "../components/StaggerGrid";
import Eyebrow from "../components/Eyebrow";

export default function WhatIsDropshipping() {
  return (
    <section className="section" id="how-it-works">
      <div className="section-inner">
        <div className="ds-grid">
          <div className="ds-left">
            <FadeUp>
              <Eyebrow text="What is dropshipping?" />
              <h2 className="section-title">Sell products.<br />Never hold <em>stock.</em></h2>
              <p className="section-sub">
                Dropshipping is a simple business model to understand: you list products, take
                orders, buy from a supplier and keep whatever margin is left after costs. No warehouse
                and no upfront bulk inventory. Depop gives you access to a large, established
                marketplace of buyers. Your Sync dashboard walks you through the process, step by step.
                Like any business, it takes work, and results vary from person to person.
              </p>
            </FadeUp>
            <StaggerGrid className="ds-cards">
              {[
                { icon: "📦", title: "No inventory needed", desc: "Products ship direct from supplier to buyer. You're the middleman, and you keep the margin." },
                { icon: "📱", title: "Phone-based business", desc: "List products, manage orders, and grow your store entirely from your phone." },
                { icon: "💸", title: "Keep the difference", desc: "Buy from a supplier, list on Depop, and keep the margin left after fees, shipping and other costs." },
                { icon: "🎯", title: "Why Depop?", desc: "An established marketplace with a large built-in audience already searching for items to buy." },
              ].map((c) => (
                <div key={c.title} className="ds-card">
                  <div className="ds-card-icon">{c.icon}</div>
                  <h3>{c.title}</h3>
                  <p>{c.desc}</p>
                </div>
              ))}
            </StaggerGrid>
          </div>
          <div className="ds-right">
            <FadeUp delay={2}>
              <div style={{ marginBottom: 32 }}>
                <Eyebrow text="The process" />
                <h3 className="section-title" style={{ fontSize: 36 }}>How it works<br />step by <em>step.</em></h3>
              </div>
              <div className="ds-steps">
                {[
                  { n: "01", title: "Choose a product", desc: "Our research process looks at Depop search demand and supplier cost to help you choose products to test. We also share regular product drops." },
                  { n: "02", title: "List on your store", desc: "Create your listing using our frameworks for titles, photos, pricing and descriptions." },
                  { n: "03", title: "Customer buys from you", desc: "When a buyer purchases your listing, Depop processes the payment and pays you out after its fees." },
                  { n: "04", title: "Order from supplier", desc: "You buy the item from the supplier and it ships directly to your buyer. What remains after all costs is your margin." },
                  { n: "05", title: "Review & improve", desc: "Review what sells and what doesn't, adjust your listings, niches and pricing, and keep learning with our support." },
                ].map((s) => (
                  <div key={s.n} className="ds-step">
                    <div className="ds-step-num">{s.n}</div>
                    <div className="ds-step-content">
                      <h3>{s.title}</h3>
                      <p>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
