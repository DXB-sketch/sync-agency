export default function HeroPanel() {
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
            <div className="flow-node-tag">Step 2 - Sale received</div>
            <div className="flow-node-title">$85 lands in your account</div>
            <div className="flow-node-sub">Depop handles payment processing</div>
          </div>
          <div className="flow-connector">
            <div className="flow-conn-line" />
            <div className="flow-conn-label">you order from supplier ↓</div>
          </div>
          <div className="flow-node">
            <div className="flow-node-tag">Private supplier</div>
            <div className="flow-node-title">You pay $38, they ship direct</div>
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
