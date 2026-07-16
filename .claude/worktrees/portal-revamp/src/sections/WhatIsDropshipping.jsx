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
                Dropshipping is one of the simplest business models online, you list products,
                take orders, buy from a supplier, keep the margin. No warehouse. No upfront inventory.
                Depop makes it even more powerful: millions of active buyers, less competition than
                Amazon, and higher margins on the right products. Your free Sync dashboard walks
                you through this exact process, step by step.
              </p>
            </FadeUp>
            <StaggerGrid className="ds-cards">
              {[
                { icon: "📦", title: "No inventory needed", desc: "Products ship direct from supplier to buyer. You're the middleman, and you keep the margin." },
                { icon: "📱", title: "Phone-based business", desc: "List products, manage orders, and grow your store entirely from your phone." },
                { icon: "💸", title: "Keep the difference", desc: "Buy low from private suppliers, sell higher on Depop. Clients average $300–$800/mo." },
                { icon: "🎯", title: "Why Depop?", desc: "Built-in audience of millions actively searching resale items. Less competition, better margins." },
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
                  { n: "01", title: "Find a winning product", desc: "Our research system identifies high-demand products with strong Depop search volume and low supplier cost. We also send daily winning product drops." },
                  { n: "02", title: "List on your store", desc: "Create an optimised listing using our proven frameworks, titles, photos, pricing, and descriptions engineered to convert." },
                  { n: "03", title: "Customer buys from you", desc: "Depop handles payment. A buyer purchases your listing and the money hits your account." },
                  { n: "04", title: "Order from supplier", desc: "You buy the item from your private supplier at cost and they ship directly to your buyer. You pocket the difference." },
                  { n: "05", title: "Scale & compound", desc: "More listings, better niches, smarter pricing. Your income grows as you do, and our team scales with you." },
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
