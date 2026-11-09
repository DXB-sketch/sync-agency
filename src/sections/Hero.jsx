import HeroPanel from "../components/HeroPanel";

export default function Hero() {
  const words = ["Start", "Your", "Ecommerce"];
  return (
    <section className="hero">
      <div className="hero-bg-orb orb1" />
      <div className="hero-bg-orb orb2" />
      <div className="hero-line hero-line1" />
      <div className="hero-line hero-line2" />
      <div className="hero-grid">
        <div>
          <div className="hero-eyebrow">
            <div className="hero-eyebrow-line" />
            <span className="hero-eyebrow-text">The Depop Coaching System</span>
          </div>
          <h1 className="hero-h1">
            {words.map((w, i) => (
              <span key={w} className="word" style={{ animationDelay: `${0.1 + i * 0.08}s`, marginRight: "0.28em" }}>{w}</span>
            ))}
            <br />
            <em className="word" style={{ animationDelay: "0.44s" }}>Journey.</em>
          </h1>
          <p className="hero-sub" style={{ animation: "wordReveal .8s .6s cubic-bezier(.16,1,.3,1) both" }}>
            The Depop Coaching System gives you a step-by-step pathway, product slots stocked
            by our team, and hands-on coaching — everything you need to launch your first
            dropshipping store. Choose your level and start today.
          </p>
          <div className="hero-actions" style={{ animation: "wordReveal .8s .75s cubic-bezier(.16,1,.3,1) both" }}>
            <a href="#pricing" className="btn-gold">
              Choose your plan <span>→</span>
            </a>
            <a href="#how-it-works" className="btn-ghost">See how it works</a>
          </div>
        </div>
        <div style={{ animation: "wordReveal .9s .5s cubic-bezier(.16,1,.3,1) both" }}>
          <HeroPanel />
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)" }}>
        <div className="scroll-indicator">
          <span>Scroll</span>
          <div className="scroll-indicator-arrow">↓</div>
        </div>
      </div>
    </section>
  );
}
