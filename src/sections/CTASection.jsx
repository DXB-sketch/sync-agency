import Eyebrow from "../components/Eyebrow";
import FadeUp from "../components/FadeUp";
import { trackEvent } from "../utils/analytics";

const DISCORD_URL = "https://discord.gg/pVzjXumpbP";

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
            1200+ clients in. Zero failures. The system works — the only question
            is whether you'll use it.
          </p>
          <div className="cta-btns">
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noreferrer"
              className="btn-gold"
              style={{ fontSize: 15, padding: "18px 52px" }}
              onClick={() => trackEvent("discord_click", { source: "cta" })}
            >
              Enrol via Discord →
            </a>
            <a href="#pricing" className="btn-ghost">See Pricing</a>
          </div>
          <p className="discord-note">You'll be directed to our Discord to confirm your tier and get started.</p>
        </FadeUp>
      </div>
    </section>
  );
}
