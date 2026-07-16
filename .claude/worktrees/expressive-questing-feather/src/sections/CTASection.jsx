import { Link } from "react-router-dom";
import FadeUp from "../components/FadeUp";
import Eyebrow from "../components/Eyebrow";

export default function CTASection() {
  return (
    <section className="cta-section">
      <div className="cta-bg" />
      <div className="cta-border-top" />
      <div style={{ position: "relative", zIndex: 2 }}>
        <FadeUp>
          <Eyebrow text="Ready to start?" />
          <h2>Your journey starts<br /><em>with a free account.</em></h2>
          <p>
            The dashboard is free. The pathway is free. Your first product slots are free.
            1200+ clients in — the only question is when you start.
          </p>
          <div className="cta-btns">
            <Link to="/signup" className="btn-gold" style={{ fontSize: 15, padding: "18px 52px" }}>
              Create your free account →
            </Link>
            <a href="#pricing" className="btn-ghost">See course upgrades</a>
          </div>
          <p className="discord-note">No card required. Upgrade to the Depop Coaching System whenever you're ready.</p>
        </FadeUp>
      </div>
    </section>
  );
}
