import FadeUp from "../components/FadeUp";
import Eyebrow from "../components/Eyebrow";

export default function About() {
  return (
    <section className="section about-section">
      <div className="section-inner">
        <div className="about-grid">
          <FadeUp>
            <Eyebrow text="About Sync Agency" />
            <h2 className="section-title">Built by a practitioner,<br />not a <em>guru.</em></h2>
            <blockquote className="about-quote">
              "We didn't learn this from a YouTube video. We built it, tested it
              and refined it on Depop ourselves, and now we teach it."
            </blockquote>
            <p style={{ fontSize: 15, color: "var(--text-md)", lineHeight: 1.8 }}>
              Sync Agency was built from hands-on experience on Depop, not formal education,
              not theory. We teach the process we use, give you the tools and support to apply it,
              and we're honest about the rest: what you get out of it depends on your own effort,
              your decisions and the market.
            </p>
          </FadeUp>
          <FadeUp delay={2}>
            <div className="about-pillars">
              {[
                { n: "I", title: "Practical, not theoretical", desc: "Everything we teach is hands-on: how to set up a store, choose products, list them and fulfil orders. You learn by doing, with us alongside you." },
                { n: "II", title: "Honest expectations", desc: "We don't promise income or results. Sales and profit depend on you, your products and the market, and some people make little or nothing. We'll tell you that up front." },
                { n: "III", title: "We're in it with you", desc: "On every tier, you get direct access to us. We don't disappear after enrolment, we're here for the full length of your access." },
                { n: "IV", title: "Supplier network", desc: "Access to the suppliers we work with, with product slots stocked by our team and orders fulfilled through your dashboard." },
              ].map((p) => (
                <div key={p.n} className="about-pillar">
                  <div className="about-pillar-num">{p.n}</div>
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}
