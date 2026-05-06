import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { trackEvent } from "../utils/analytics";

const DISCORD_URL = "https://discord.gg/pVzjXumpbP";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const onHome = location.pathname === "/";

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  const handleDiscord = () => trackEvent("discord_click", { source: "nav" });

  return (
    <nav className={`nav${scrolled ? " scrolled" : ""}`}>
      <Link to="/" className="nav-logo">Sync Agency</Link>
      <div className="nav-links">
        {onHome ? (
          <>
            <a href="#how-it-works">How it works</a>
            <a href="#pricing">Pricing</a>
            <a href="#results">Results</a>
            <a href="#faq">FAQ</a>
          </>
        ) : (
          <>
            <Link to="/#how-it-works">How it works</Link>
            <Link to="/#pricing">Pricing</Link>
            <Link to="/#results">Results</Link>
            <Link to="/#faq">FAQ</Link>
          </>
        )}
        <Link to="/rep-list" className="nav-btn-ghost">Rep List</Link>
        <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="nav-btn" onClick={handleDiscord}>Enrol Now →</a>
      </div>
      <button
        onClick={() => setMenuOpen(v => !v)}
        style={{ display: "none", background: "none", border: "1px solid var(--border-md)", color: "var(--gold)", padding: "8px 12px", borderRadius: 2, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
        className="nav-hamburger"
        aria-label="Menu"
      >
        {menuOpen ? "✕" : "☰"}
      </button>
      {menuOpen && (
        <div style={{ position: "fixed", top: 60, left: 0, right: 0, background: "rgba(8,8,8,0.97)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)", padding: "24px 20px", zIndex: 499, display: "flex", flexDirection: "column", gap: 0 }}>
          {[
            { href: onHome ? "#how-it-works" : "/#how-it-works", label: "How it works", isHash: onHome },
            { href: onHome ? "#pricing" : "/#pricing", label: "Pricing", isHash: onHome },
            { href: onHome ? "#results" : "/#results", label: "Results", isHash: onHome },
            { href: onHome ? "#faq" : "/#faq", label: "FAQ", isHash: onHome },
          ].map(({ href, label, isHash }) => (
            isHash ? (
              <a key={label} href={href} onClick={() => setMenuOpen(false)} style={{ padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-md)", fontWeight: 500 }}>
                {label}
              </a>
            ) : (
              <Link key={label} to={href} onClick={() => setMenuOpen(false)} style={{ padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-md)", fontWeight: 500 }}>
                {label}
              </Link>
            )
          ))}
          <Link
            to="/rep-list"
            onClick={() => setMenuOpen(false)}
            className="nav-btn-ghost"
            style={{ marginTop: 20, textAlign: "center", display: "block" }}
          >
            Rep List
          </Link>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-gold"
            style={{ marginTop: 12, justifyContent: "center" }}
            onClick={() => { handleDiscord(); setMenuOpen(false); }}
          >
            Enrol Now →
          </a>
        </div>
      )}
    </nav>
  );
}
