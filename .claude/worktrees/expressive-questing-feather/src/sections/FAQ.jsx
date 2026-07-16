import { useState } from "react";
import FadeUp from "../components/FadeUp";
import Eyebrow from "../components/Eyebrow";

const FAQS = [
  { q: "Is the dashboard really free?", a: "Yes — completely. Your free account includes the step-by-step pathway, 6 product slots stocked by our team, achievements, order fulfilment and support. No card required, no trial that expires. The Depop Coaching System courses are optional upgrades on top." },
  { q: "Do I need any experience to start?", a: "Zero experience needed. Most of our clients had never sold anything online before joining. The free pathway walks you through every single step, from creating your account to making your first sale, and we're there whenever questions come up." },
  { q: "How long until I start making money?", a: "Most clients make their first sale within 1–2 weeks. Consistent monthly income typically comes within 30–45 days. Speed depends on how quickly you implement, which is why we handle the heavy lifting in our higher tiers." },
  { q: "What's the difference between the tiers?", a: "The Free Dashboard gets you launched on your own. Pro Accelerator adds coaching + guidance and extra product slots, you execute with our direction. Elite Scale adds done-for-you store management. VIP Inner Circle is maximum access, daily personal picks, real-time oversight, and a fully operated store." },
  { q: "Do I need capital to run the business?", a: "Since you only pay the supplier after a buyer pays you, you can start with very little. A small buffer of $100–$200 AUD is recommended so you can move fast when orders come in, but there's no bulk inventory to buy upfront." },
  { q: "Is Depop dropshipping allowed?", a: "Yes, reselling on Depop is completely allowed and it's what the platform is built for. Our system is fully compliant with Depop's terms of service. We've helped 1200+ clients do this without any platform issues." },
  { q: "How much time does it take per week?", a: "Pro Accelerator: 1–3 hours/day to start. Elite Scale reduces this significantly as we handle most tasks. VIP Inner Circle can be as little as 20–30 minutes per day to approve decisions, we handle the rest." },
];

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
                  every question, no sales pressure, no scripts. Just straight answers
                  from the people running the programme.
                </p>
                <a href="/signup" className="btn-gold" style={{ display: "flex", width: "100%", justifyContent: "center" }}>
                  Start Free →
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
