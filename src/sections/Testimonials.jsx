import Eyebrow from "../components/Eyebrow";
import FadeUp from "../components/FadeUp";
import StaggerGrid from "../components/StaggerGrid";
import { TESTIMONIALS } from "../data/testimonials";

export default function Testimonials() {
  return (
    <section className="section" id="results">
      <div className="section-inner">
        <FadeUp>
          <Eyebrow text="Client results" />
          <h2 className="section-title">Real people.<br /><em>Real income.</em></h2>
          <p className="section-sub">These aren't handpicked outliers — this is the standard.</p>
        </FadeUp>
        <StaggerGrid className="testi-grid" style={{ marginTop: 56 }}>
          {TESTIMONIALS.map((t) => (
            <div key={t.initials} className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <p className="testi-quote">"{t.quote}"</p>
              <div className="testi-divider" />
              <div className="testi-author">
                <div className="testi-avatar">{t.initials}</div>
                <div>
                  <div className="testi-name">{t.name}</div>
                  <div className="testi-meta">{t.meta}</div>
                  <div className="testi-result">{t.result}</div>
                </div>
              </div>
            </div>
          ))}
        </StaggerGrid>
      </div>
    </section>
  );
}
