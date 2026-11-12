import { useEffect } from "react";

// Shared shell for the Terms of Service and Privacy Policy pages.
// `sections` is [{ id, title, body }] — rendered as a contents list plus numbered sections.
export default function LegalLayout({ title, updated, intro, sections }) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="legal-page">
      <div className="legal-inner">
        <div className="t-eyebrow">Legal</div>
        <h1 className="legal-title">{title}</h1>
        <p className="legal-updated">Last updated: {updated}</p>
        <div className="legal-intro">{intro}</div>

        <nav className="legal-toc" aria-label="Contents">
          <h2 className="legal-toc-label">Contents</h2>
          <ol>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="legal-section">
            <h2>
              {i + 1}. {s.title}
            </h2>
            {s.body}
          </section>
        ))}
      </div>
    </main>
  );
}
