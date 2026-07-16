import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <nav className={`nav${scrolled ? " scrolled" : ""}`}>
      <div className="nav-left">
        <div className="nav-logo">Sync Agency</div>
        <Link to="/login" className="nav-login">Login</Link>
      </div>
      <div className="nav-links">
        <a href="/#how-it-works">How it works</a>
        <a href="/#pricing">Pricing</a>
        <a href="/#results">Results</a>
        <a href="/#faq">FAQ</a>
        <a href="/#about">About</a>
        <Link to="/competition" className="nav-btn-competition">Competition</Link>
        <Link to="/signup" className="nav-btn">Start Free →</Link>
      </div>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMenuOpen(v => !v)}
        style={{ display: "none", background: "none", border: "1px solid var(--border-md)", color: "var(--gold)", padding: "8px 12px", borderRadius: 2, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
        className="nav-hamburger"
        aria-label="Menu"
      >
        {menuOpen ? "✕" : "☰"}
      </button>
      {menuOpen && (
        <div style={{ position: "fixed", top: "calc(var(--banner-height, 0px) + 60px)", left: 0, right: 0, background: "rgba(8,8,8,0.97)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)", padding: "24px 20px", zIndex: 499, display: "flex", flexDirection: "column", gap: 0 }}>
          {["/#how-it-works", "/#pricing", "/#results", "/#faq", "/#about"].map((href, i) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} style={{ padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-md)", fontWeight: 500 }}>
              {["How it works", "Pricing", "Results", "FAQ", "About"][i]}
            </a>
          ))}
          <Link to="/competition" className="nav-btn-competition" style={{ marginTop: 20, textAlign: "center", width: "100%" }} onClick={() => setMenuOpen(false)}>
            Competition
          </Link>
          <Link to="/signup" className="btn-gold" style={{ marginTop: 12, justifyContent: "center" }} onClick={() => setMenuOpen(false)}>
            Start Free →
          </Link>
        </div>
      )}
    </nav>
  );
}
