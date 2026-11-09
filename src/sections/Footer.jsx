import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-logo">Sync Agency</div>
        <div className="footer-links">
          <a href="/#how-it-works">How it works</a>
          <a href="/#pricing">Pricing</a>
          <a href="/#expectations">Expectations</a>
          <a href="/#faq">FAQ</a>
          <a href="/#pricing">Enrol</a>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/privacy">Privacy Policy</Link>
          <a href="mailto:founder@syncagency.org">Contact</a>
        </div>
        <div className="footer-copy">
          © {new Date().getFullYear()} Sync Agency · All prices AUD · Education and coaching only.
          Results are not guaranteed and vary between individuals.
        </div>
      </div>
    </footer>
  );
}
