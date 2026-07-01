import FadeUp from "../components/FadeUp";
import StaggerGrid from "../components/StaggerGrid";
import Eyebrow from "../components/Eyebrow";

const TESTIMONIALS = [
  { initials: "JM", name: "Jordan M.", meta: "Pro Accelerator · Sydney", result: "↑ $500-$1,000 within 2 weeks", quote: "I was working a job I hated and had zero experience with resale. Within my first month I was making enough to cover rent. The daily product drops alone are worth the price of entry." },
  { initials: "AR", name: "Aisha R.", meta: "Elite Scale · Melbourne", result: "↑ $1,000/week consistently", quote: "I thought dropshipping was a scam until a friend referred me here. The 1-on-1 calls changed everything, they built my store and I just watched the sales roll in. Genuinely life-changing." },
  { initials: "TK", name: "Tyler K.", meta: "VIP Inner Circle · Brisbane", result: "↑ $1,500+ weekly", quote: "I'm a full-time uni student. With VIP they run the whole thing, I just approve products. Made over $1,200 last month doing almost nothing. I wish I'd done this sooner." },
];

export default function Testimonials() {
  return (
    <section className="section" id="results">
      <div className="section-inner">
        <FadeUp>
          <Eyebrow text="Client results" />
          <h2 className="section-title">Real people.<br /><em>Real income.</em></h2>
          <p className="section-sub">These aren't handpicked outliers, this is the standard.</p>
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
