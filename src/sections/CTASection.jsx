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
          <h2>Your store won't<br /><em>build itself.</em></h2>
          <p>
            1200+ clients in. Zero failures. The system works, the only question
            is whether you'll use it.
          </p>
          <div className="cta-btns">
            <a href="#pricing" className="btn-gold" style={{ fontSize: 15, padding: "18px 52px" }}>
              Enrol Now →
            </a>
            <a href="#pricing" className="btn-ghost">See Pricing</a>
          </div>
          <p className="discord-note">You'll be directed to our Discord to confirm your tier and get started.</p>
        </FadeUp>
      </div>
    </section>
  );
}
