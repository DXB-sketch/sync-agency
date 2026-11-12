import { Link } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="s-footer">
      <div className="wrap s-footer-inner">
        <a href="/" className="logo s-footer-logo">Sync Agency</a>
        <nav className="s-footer-links" aria-label="Footer">
          <a href="/#how-it-works">How it works</a>
          <a href="/#pricing">Pricing</a>
          <a href="/#expectations">Expectations</a>
          <a href="/#faq">FAQ</a>
          <a href="/#pricing">Enrol</a>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <a href="mailto:founder@syncagency.org">Contact</a>
        </nav>
        <p className="t-small t-muted s-footer-copy">
          © {year} Sync Agency · All prices AUD · Education and coaching only.
          Results are not guaranteed and vary between individuals.
        </p>
      </div>
    </footer>
  );
}
