import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Icon from "./SiteIcon";

const LINKS = [
  { href: "/#how-it-works", label: "How it works" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/#expectations", label: "Expectations" },
  { href: "/#faq", label: "FAQ" },
];

export default function Nav() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <header className="s-header">
      <div className="wrap s-header-row">
        <a href="/" className="logo s-logo">Sync Agency</a>
        <nav className="s-nav" aria-label="Main">
          {LINKS.map((l) => <a key={l.href} className="s-navlink" href={l.href}>{l.label}</a>)}
        </nav>
        <Link to="/login" className="s-navlink s-login">Log in</Link>
        <a href="/#pricing" className="btn btn-primary btn-sm">Join now</a>
        <button
          type="button"
          className="s-menu-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="site-menu"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
        >
          <Icon name={menuOpen ? "x" : "menu"} />
        </button>
      </div>
      {menuOpen && (
        <nav id="site-menu" className="s-menu" aria-label="Mobile">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="s-menu-link" onClick={close}>{l.label}</a>
          ))}
          <Link to="/login" className="s-menu-link" onClick={close}>Log in</Link>
        </nav>
      )}
    </header>
  );
}
