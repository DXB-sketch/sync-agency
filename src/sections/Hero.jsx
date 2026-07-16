import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useInView } from "../components/FadeUp";
import HeroPanel from "../components/HeroPanel";
import SocialIcons from "../components/SocialIcons";

function useCountUp(target, duration = 1800, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const prog = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setVal(Math.floor(ease * target));
      if (prog < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);
  return val;
}

function StatCounter({ target, suffix = "", prefix = "" }) {
  const [ref, visible] = useInView(0.3);
  const val = useCountUp(target, 1600, visible);
  return (
    <span ref={ref}>
      {prefix}{visible || val > 0 ? val : 0}{suffix}
    </span>
  );
}

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
            <span className="hero-eyebrow-text">The Sync Dashboard · Free Forever</span>
          </div>
          <h1 className="hero-h1">
            {words.map((w, i) => (
              <span key={w} className="word" style={{ animationDelay: `${0.1 + i * 0.08}s`, marginRight: "0.28em" }}>{w}</span>
            ))}
            <br />
            <em className="word" style={{ animationDelay: "0.44s" }}>Journey — Free.</em>
          </h1>
          <p className="hero-sub" style={{ animation: "wordReveal .8s .6s cubic-bezier(.16,1,.3,1) both" }}>
            The Sync dashboard gives you a step-by-step pathway, product slots stocked by our
            team, and everything you need to launch your first dropshipping store — completely
            free. Ready for more? Upgrade with our Depop Coaching System.
          </p>
          <div className="hero-actions" style={{ animation: "wordReveal .8s .75s cubic-bezier(.16,1,.3,1) both" }}>
            <Link to="/signup" className="btn-gold">
              Create your free account <span>→</span>
            </Link>
            <a href="#pricing" className="btn-ghost">See course upgrades</a>
          </div>
          <SocialIcons className="hero-social hero-social-mobile" />
          <div className="hero-stats" style={{ animation: "wordReveal .8s .9s cubic-bezier(.16,1,.3,1) both" }}>
            <div className="hero-stat">
              <div className="hero-stat-num">
                <StatCounter target={1200} suffix="+" />
              </div>
              <div className="hero-stat-label">Clients helped</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">
                <StatCounter target={100} suffix="%" />
              </div>
              <div className="hero-stat-label">Success rate</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">
                $<StatCounter target={800} />
              </div>
              <div className="hero-stat-label">Avg monthly profit</div>
            </div>
          </div>
        </div>
        <div style={{ animation: "wordReveal .9s .5s cubic-bezier(.16,1,.3,1) both" }}>
          <SocialIcons className="hero-social hero-social-desktop" />
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
