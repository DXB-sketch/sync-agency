import FadeUp from "../components/FadeUp";
import StaggerGrid from "../components/StaggerGrid";
import Eyebrow from "../components/Eyebrow";
import Icon from "../components/SiteIcon";

const PILLARS = [
  { icon: "tools", title: "Practical, not theoretical", desc: "Everything we teach is hands-on: how to set up a store, choose products, list them and fulfil orders. You learn by doing, with us alongside you." },
  { icon: "scale", title: "Honest expectations", desc: "We don't promise income or results. Sales and profit depend on you, your products and the market, and some people make little or nothing. We'll tell you that up front." },
  { icon: "handshake", title: "We're in it with you", desc: "On every tier, you get direct access to us. We don't disappear after enrolment, we're here for the full length of your access." },
  { icon: "link", title: "Supplier network", desc: "Access to the suppliers we work with, with product slots stocked by our team and orders fulfilled through your dashboard." },
];

export default function About() {
  return (
    <section className="s-section s-section-alt">
      <div className="wrap s-split">
        <FadeUp>
          <Eyebrow text="About Sync Agency" />
          <h2 className="t-h1 s-title">Built by a practitioner, not a <em className="em">guru.</em></h2>
          <blockquote className="about-quote">
            “We didn't learn this from a YouTube video. We built it, tested it
            and refined it on Depop ourselves, and now we teach it.”
          </blockquote>
          <p className="t-body">
            Sync Agency was built from hands-on experience on Depop, not formal education,
            not theory. We teach the process we use, give you the tools and support to apply it,
            and we're honest about the rest: what you get out of it depends on your own effort,
            your decisions and the market.
          </p>
        </FadeUp>
        <StaggerGrid className="s-cards2">
          {PILLARS.map((p) => (
            <div key={p.title} className="card s-mini">
              <span className="icon-well"><Icon name={p.icon} /></span>
              <h3 className="s-mini-title">{p.title}</h3>
              <p className="t-small">{p.desc}</p>
            </div>
          ))}
        </StaggerGrid>
      </div>
    </section>
  );
}
