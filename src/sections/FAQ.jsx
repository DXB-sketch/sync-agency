import { useState } from "react";
import FadeUp from "../components/FadeUp";
import Eyebrow from "../components/Eyebrow";

const FAQS = [
  { q: "What do I get when I join?", a: "Every plan includes the Sync dashboard — a step-by-step pathway, product slots stocked by our team, achievements, order fulfilment and support — plus the hands-on coaching for your tier. You get access as soon as your payment goes through." },
  { q: "Do I need any experience to start?", a: "No experience is needed to start. The pathway walks you through each step, from creating your account to listing products and fulfilling orders, and we're there whenever questions come up." },
  { q: "Will I make money?", a: "We can't promise that, and nobody honestly can. Sync Agency provides education, coaching and tools, not a business opportunity or an income. Your results depend on your own effort and decisions, product choice, pricing, fees, competition and Depop itself. Many people who try dropshipping make little or no profit, and you could lose money on products, fees and costs. Please only join if you're comfortable with that." },
  { q: "What's the difference between the tiers?", a: "Pro Accelerator is coaching + guidance — you execute with our direction. Elite Scale adds done-for-you store management. VIP Inner Circle is maximum access, daily personal picks, real-time oversight, and a fully operated store." },
  { q: "Do I need capital to run the business?", a: "Since you only pay the supplier after a buyer pays you, you can start with very little. A small buffer of $100–$200 AUD is recommended so you can move fast when orders come in, but there's no bulk inventory to buy upfront." },
  { q: "Can I get a refund?", a: "Plans are generally non-refundable, including for change of mind or because you didn't get the results you hoped for. If you believe something has genuinely gone wrong with what we provided, email founder@syncagency.org to discuss it, with evidence supporting your claim. Nothing in our policy limits your rights under the Australian Consumer Law. See our Terms of Service for the full policy." },
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
                  Email us and ask anything before you commit. We answer
                  every question, no sales pressure, no scripts. Just straight answers
                  from the people running the programme.
                </p>
                <a href="mailto:founder@syncagency.org" className="btn-gold" style={{ display: "flex", width: "100%", justifyContent: "center" }}>
                  Email us →
                </a>
                <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
                  {[
                    { label: "Typical response time", value: "< 2 hours" },
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
