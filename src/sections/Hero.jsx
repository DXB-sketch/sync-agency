import HeroPanel from "../components/HeroPanel";
import Icon from "../components/SiteIcon";

export default function Hero() {
  const words = ["Start", "your", "ecommerce"];
  return (
    <section className="hero">
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <div className="t-eyebrow">The Depop coaching system</div>
          <h1 className="t-display hero-h1">
            {words.map((w, i) => (
              <span key={w} className="word" style={{ animationDelay: `${0.1 + i * 0.08}s`, marginRight: "0.25em" }}>{w}</span>
            ))}
            <em className="em word" style={{ animationDelay: "0.34s" }}>journey.</em>
          </h1>
          <p className="t-body hero-sub reveal" style={{ animationDelay: ".5s" }}>
            The Depop Coaching System gives you a step-by-step pathway, product slots stocked
            by our team, and hands-on coaching — everything you need to launch your first
            dropshipping store. Choose your level and start today.
          </p>
          <div className="hero-actions reveal" style={{ animationDelay: ".6s" }}>
            <a href="#pricing" className="btn btn-primary btn-lg">
              Choose your plan <Icon name="arrow" />
            </a>
            <a href="#how-it-works" className="btn btn-secondary btn-lg">See how it works</a>
          </div>
        </div>
        <div className="reveal" style={{ animationDelay: ".4s" }}>
          <HeroPanel />
        </div>
      </div>
    </section>
  );
}
