import { Link, useLocation } from "react-router-dom";
import { trackEvent } from "../utils/analytics";

const DISCORD_URL = "https://discord.gg/pVzjXumpbP";

export default function Footer() {
  const location = useLocation();
  const onHome = location.pathname === "/";
  return (
    <footer>
      <div className="footer-inner">
        <Link to="/" className="footer-logo">Sync Agency</Link>
        <div className="footer-links">
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
          <Link to="/rep-list">Rep List</Link>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => trackEvent("discord_click", { source: "footer" })}
          >Discord</a>
        </div>
        <div className="footer-copy">© 2025 Sync Agency · All prices AUD</div>
      </div>
    </footer>
  );
}
