import FadeUp from "../components/FadeUp";
import Eyebrow from "../components/Eyebrow";
import { trackEvent } from "../utils/analytics";

const founders = [
  {
    name: "Brock Brown",
    initials: "BB",
    role: "Co-founder · Sourcing & Suppliers",
    // TODO: replace with real bio
    bio: "Brock built and scaled his own Depop store before any of this was a system. He spent years finding the suppliers, testing the products, and learning what actually sells, then turned that network into the backbone of what every client now gets access to.",
  },
  {
    name: "Dexter Bell",
    initials: "DB",
    role: "Co-founder · Strategy & Systems",
    // TODO: replace with real bio
    bio: "Dexter ran his own store to consistent monthly profit, then obsessed over making the process repeatable. He's the one who turned hard-won tactics into a step-by-step system, the same one we now hand to every client on day one.",
  },
];

export default function AboutPage() {
  return (
    <section className="section about-page" id="about">
      <div className="section-inner">
        {/* Page hero */}
        <FadeUp>
          <div className="about-page-hero">
            <Eyebrow text="About Sync Agency" />
            <h1 className="section-title">Two operators.<br />One <em>proven system.</em></h1>
            <p className="section-sub">
              We're not gurus selling a dream. We're two operators who built and scaled our
              own Depop stores, then turned what actually worked into a system and handed it
              to 1200+ clients.
            </p>
          </div>
        </FadeUp>

        {/* Our story */}
        <div className="about-page-block">
          <FadeUp>
            <Eyebrow text="Our story" />
            <h2 className="section-title about-page-h2">Built from the floor up,<br />not from a <em>textbook.</em></h2>
          </FadeUp>
          <FadeUp delay={2}>
            <div className="about-page-story">
              <p>
                Sync Agency didn't start as a course. It started as two Depop stores. We learned
                this the hard way, sourcing products, testing suppliers, listing, shipping, and
                figuring out what actually converts. No theory, no gurus, no recycled YouTube advice.
                Just what we proved worked with our own money on the line.
              </p>
              <p>
                Once the process was repeatable, people started asking how we did it. So we wrote it
                down, refined it, and turned it into a system anyone could follow. Today that system
                has a 100% success rate across 1200+ clients, real stores doing $300–$800/month, some
                more. That's why we exist: to hand you the shortcut we never had.
              </p>
            </div>
          </FadeUp>
        </div>

        {/* Meet the founders */}
        <div className="about-page-block">
          <FadeUp>
            <Eyebrow text="Meet the founders" />
            <h2 className="section-title about-page-h2">The people behind<br />the <em>system.</em></h2>
          </FadeUp>
          <div className="founder-grid">
            {founders.map((f, i) => (
              <FadeUp key={f.name} delay={i === 0 ? 0 : 2}>
                <div className="founder-card">
                  <div className="founder-avatar">{f.initials}</div>
                  <div className="founder-name">{f.name}</div>
                  <div className="founder-role">{f.role}</div>
                  <p className="founder-bio">{f.bio}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>

        {/* Mission / proof strip */}
        <div className="about-page-block">
          <FadeUp>
            <Eyebrow text="What we stand for" />
            <h2 className="section-title about-page-h2">Results-first.<br /><em>Always.</em></h2>
          </FadeUp>
          <FadeUp delay={2}>
            <div className="about-page-stats">
              {[
                { num: "1200+", label: "Clients onboarded" },
                { num: "100%", label: "Success rate" },
                { num: "$300–800", label: "Avg. client / month" },
                { num: "Direct", label: "Founder access" },
              ].map(({ num, label }) => (
                <div key={label} className="rep-stat-tile">
                  <div className="rep-stat-tile-num">{num}</div>
                  <div className="rep-stat-tile-label">{label}</div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>

        {/* Closing CTA */}
        <FadeUp>
          <div className="about-page-cta">
            <h2 className="section-title about-page-h2">Ready to build<br />your <em>store?</em></h2>
            <p>
              Same system. Same operators. Same 100% success rate. The only thing missing is you.
            </p>
            <a
              href="#pricing"
              className="btn-gold"
              onClick={() => trackEvent("discord_click", { source: "about" })}
            >
              Enrol Now →
            </a>
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
