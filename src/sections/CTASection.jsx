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
          <h2>Your journey starts<br /><em>with one decision.</em></h2>
          <p>
            The pathway, the product slots, the coaching — it's all waiting inside.
            1200+ clients in — the only question is when you start.
          </p>
          <div className="cta-btns">
            <a href="#pricing" className="btn-gold" style={{ fontSize: 15, padding: "18px 52px" }}>
              Choose your plan →
            </a>
            <a href="#faq" className="btn-ghost">Read the FAQ</a>
          </div>
          <p className="discord-note">Questions first? Join our Discord and ask us anything before you commit.</p>
        </FadeUp>
      </div>
    </section>
  );
}
