import Icon from "./SiteIcon";

const STEPS = [
  { icon: "tag", tag: "Your Depop store", title: "Product listed at $85", sub: "Optimised listing · private niche" },
  { icon: "checkout", tag: "Step 2 - Sale received", title: "Buyer pays $85", sub: "Depop processes the payment and deducts its fees" },
  { icon: "truck", tag: "Private supplier", title: "You pay $38, they ship direct", sub: "No stock held · no warehouse needed" },
];

export default function HeroPanel() {
  return (
    <div className="card-feature hero-panel">
      <div className="hero-panel-head">
        <span className="t-label">How one sale works</span>
        <span className="chip chip-plain">Illustrative example</span>
      </div>
      {STEPS.map((s) => (
        <div key={s.title} className="card hero-panel-row">
          <span className="icon-well"><Icon name={s.icon} /></span>
          <span className="hero-panel-text">
            <span className="hero-panel-tag">{s.tag}</span>
            <span className="hero-panel-title">{s.title}</span>
            <span className="t-small">{s.sub}</span>
          </span>
        </div>
      ))}
      <div className="hero-panel-margin">
        <span>
          <span className="hero-panel-title">Example margin, before fees</span>
          <span className="t-small">$85 − $38 cost</span>
        </span>
        <span className="t-num t-gold hero-panel-num">$47</span>
      </div>
      <p className="t-small t-muted hero-panel-note">
        Illustrative example only. Not a typical or expected result. Depop, payment and
        shipping fees, returns and other costs reduce your actual margin, and many listings
        never sell.
      </p>
    </div>
  );
}
