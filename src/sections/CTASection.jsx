import FadeUp from "../components/FadeUp";
import Eyebrow from "../components/Eyebrow";

export default function CTASection() {
  return (
    <section className="s-section cta-section">
      <FadeUp className="wrap cta-inner">
        <Eyebrow text="Ready to start?" />
        <h2 className="t-display cta-title">Your journey starts <em className="em">with one decision.</em></h2>
        <p className="t-body cta-text">
          The pathway, the product slots, the coaching — it's all waiting inside.
          Results depend on you and aren't guaranteed, so ask us anything before you commit.
        </p>
        <div className="cta-btns">
          <a href="#pricing" className="btn btn-primary btn-lg">Choose your plan</a>
          <a href="#faq" className="btn btn-secondary btn-lg">Read the FAQ</a>
        </div>
        <p className="t-small">
          Questions first? Email us at <a className="s-link" href="mailto:founder@syncagency.org">founder@syncagency.org</a> before you commit.
        </p>
      </FadeUp>
    </section>
  );
}
