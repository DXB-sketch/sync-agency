import FadeUp from "../components/FadeUp";
import StaggerGrid from "../components/StaggerGrid";
import Eyebrow from "../components/Eyebrow";
import Icon from "../components/SiteIcon";

const PERKS = [
  { icon: "box", title: "No inventory needed", desc: "Products ship direct from supplier to buyer. You're the middleman, and you keep the margin." },
  { icon: "phone", title: "Phone-based business", desc: "List products, manage orders, and grow your store entirely from your phone." },
  { icon: "profit", title: "Keep the difference", desc: "Buy from a supplier, list on Depop, and keep the margin left after fees, shipping and other costs." },
  { icon: "store", title: "Why Depop?", desc: "An established marketplace with a large built-in audience already searching for items to buy." },
];

const STEPS = [
  { n: "01", icon: "target", title: "Choose a product", desc: "Our research process looks at Depop search demand and supplier cost to help you choose products to test. We also share regular product drops." },
  { n: "02", icon: "tag", title: "List on your store", desc: "Create your listing using our frameworks for titles, photos, pricing and descriptions." },
  { n: "03", icon: "checkout", title: "Customer buys from you", desc: "When a buyer purchases your listing, Depop processes the payment and pays you out after its fees." },
  { n: "04", icon: "truck", title: "Order from supplier", desc: "You buy the item from the supplier and it ships directly to your buyer. What remains after all costs is your margin." },
  { n: "05", icon: "refresh", title: "Review & improve", desc: "Review what sells and what doesn't, adjust your listings, niches and pricing, and keep learning with our support." },
];

export default function WhatIsDropshipping() {
  return (
    <section className="s-section" id="how-it-works">
      <div className="wrap s-split">
        <div className="s-col">
          <FadeUp>
            <Eyebrow text="What is dropshipping?" />
            <h2 className="t-h1 s-title">Sell products. Never hold <em className="em">stock.</em></h2>
            <p className="t-body s-lede">
              Dropshipping is a simple business model to understand: you list products, take
              orders, buy from a supplier and keep whatever margin is left after costs. No warehouse
              and no upfront bulk inventory. Depop gives you access to a large, established
              marketplace of buyers. Your Sync dashboard walks you through the process, step by step.
              Like any business, it takes work, and results vary from person to person.
            </p>
          </FadeUp>
          <StaggerGrid className="s-cards2">
            {PERKS.map((c) => (
              <div key={c.title} className="card s-mini">
                <span className="icon-well"><Icon name={c.icon} /></span>
                <h3 className="s-mini-title">{c.title}</h3>
                <p className="t-small">{c.desc}</p>
              </div>
            ))}
          </StaggerGrid>
        </div>
        <div className="s-col">
          <FadeUp delay={2}>
            <Eyebrow text="The process" />
            <h2 className="t-h1 s-title">How it works, step by <em className="em">step.</em></h2>
            <ol className="s-steps">
              {STEPS.map((s) => (
                <li key={s.n} className="s-step">
                  <span className="s-step-icon"><Icon name={s.icon} /></span>
                  <div>
                    <div className="s-step-head">
                      <span className="t-label s-step-num">{s.n}</span>
                      <h3 className="t-h3">{s.title}</h3>
                    </div>
                    <p className="t-small s-step-desc">{s.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
