import { useState } from "react";
import Eyebrow from "../components/Eyebrow";
import FadeUp from "../components/FadeUp";
import { FAQS } from "../data/faqs";
import { trackEvent } from "../utils/analytics";

const DISCORD_URL = "https://discord.gg/pVzjXumpbP";

export default function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <section className="section" style={{ background: "var(--ink)" }} id="faq">
      <div className="section-inner">
        <div className="faq-grid">
          <div>
            <FadeUp>
              <Eyebrow text="FAQ" />
              <h2 className="section-title">Got questions?<br /><em>Good.</em></h2>
            </FadeUp>
            <div className="faq-list" style={{ marginTop: 48 }}>
              {FAQS.map((faq, i) => (
                <div key={i} className={`faq-item${open === i ? " open" : ""}`}>
                  <div className="faq-q" onClick={() => setOpen(open === i ? null : i)} style={{ cursor: "pointer" }}>
                    <span className="faq-q-text">{faq.q}</span>
                    <div className="faq-icon">+</div>
                  </div>
                  <div className="faq-a">{faq.a}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="faq-aside">
            <FadeUp delay={2}>
              <div className="faq-aside-card">
                <div className="faq-aside-label">Still unsure?</div>
                <h3>Ask us directly.</h3>
                <p>
                  Jump into our Discord and ask anything before you commit. We answer
                  every question — no sales pressure, no scripts. Just straight answers
                  from the people running the programme.
                </p>
                <a
                  href={DISCORD_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-gold"
                  style={{ display: "flex", width: "100%", justifyContent: "center" }}
                  onClick={() => trackEvent("discord_click", { source: "faq" })}
                >
                  Join our Discord →
                </a>
                <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
                  {[
                    { label: "Response time", value: "< 2 hours" },
                    { label: "Clients enrolled", value: "1200+" },
                    { label: "Success rate", value: "100%" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13 }}>
                      <span style={{ color: "var(--text-dim)" }}>{label}</span>
                      <span style={{ color: "var(--gold)", fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}
