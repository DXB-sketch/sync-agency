const steps = [
  { num: "1", title: "Enrol", desc: "Become a paying member of Sync Agency on any tier." },
  { num: "2", title: "Build", desc: "Launch and grow your Depop dropshipping store using our system." },
  { num: "3", title: "Win", desc: "Have the highest-earning store by 22nd July 2026 and claim $10,000 AUD." },
];

export default function CompetitionPage() {
  return (
    <main className="comp-page">
      {/* HERO */}
      <section className="comp-hero">
        <h1 className="comp-hero-h1">
          We're giving YOU <span className="comp-amount">$10,000</span>.
        </h1>
        <p className="comp-hero-sub">
          To celebrate the growth of Sync Agency and expand into new territory, we're
          hosting the Sync Store Competition.
        </p>
        <p className="comp-hero-descriptor">
          Have the top-earning Depop store by 22nd July 2026 and walk away with ten
          thousand dollars.
        </p>
        <a href="/#pricing" className="btn-gold comp-hero-cta">Get Started →</a>
      </section>

      {/* HOW IT WORKS */}
      <section className="comp-section">
        <div className="comp-section-head">
          <h2>How it works</h2>
        </div>
        <div className="comp-steps">
          {steps.map((s) => (
            <div key={s.num} className="comp-step">
              <div className="comp-step-num">{s.num}</div>
              <div className="comp-step-title">{s.title}</div>
              <p className="comp-step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ELIGIBILITY */}
      <section className="comp-section">
        <div className="comp-eligibility">
          <h2>Eligibility</h2>
          <p>
            This competition is open exclusively to paying members of Sync Agency. You
            must be enrolled on an active tier at the time of judging. Store earnings will
            be verified. One winner. $10,000 AUD, paid directly.
          </p>
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="comp-final">
        <h2>Ready to compete?</h2>
        <p>Enrol now and your store is automatically entered.</p>
        <a href="/#pricing" className="btn-gold">Enter the Competition →</a>
        <p className="comp-final-smallprint">
          Must be a paying Sync Agency member to be eligible.
        </p>
      </section>
    </main>
  );
}
