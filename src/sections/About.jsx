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
              "We didn't learn this from a YouTube video. We built it, tested it,
              and refined it until it worked, then taught it to 1200+ clients."
            </blockquote>
            <p style={{ fontSize: 15, color: "var(--text-md)", lineHeight: 1.8 }}>
              Sync Agency was built from hands-on experience on Depop, not formal education,
              not theory. Every tactic in our system has been validated by real stores and real
              clients. That's why we have a 100% success rate. And that's why we're selective
              about who we work with.
            </p>
          </FadeUp>
          <FadeUp delay={2}>
            <div className="about-pillars">
              {[
                { n: "I", title: "Outcome-first", desc: "We don't sell courses, we sell results. Every part of our system is engineered to get your store profitable as fast as possible." },
                { n: "II", title: "Real numbers only", desc: "No fake screenshots. No inflated promises. Our clients average $300–$800/month. Some do more. None have done worse." },
                { n: "III", title: "We're in it with you", desc: "On every tier, you get direct access to us. We don't disappear after enrolment, we stay until your store is working." },
                { n: "IV", title: "Proven supplier network", desc: "Access to private suppliers our clients use every day. Lower costs, faster shipping, higher margins than anything public." },
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
