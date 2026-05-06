import { useEffect, useState } from "react";
import { trackEvent } from "../utils/analytics";

const STORAGE_KEY = "stickyCtaDismissed";
const DISCORD_URL = "https://discord.gg/pVzjXumpbP";

export default function StickyCTABar() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    if (dismissed) return;
    const onScroll = () => {
      const heroEl = document.querySelector(".hero");
      const threshold = heroEl ? heroEl.offsetHeight - 80 : 600;
      setVisible(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [dismissed]);

  if (dismissed) return null;

  const handleClose = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };
  const handleClick = () => {
    trackEvent("sticky_bar_click");
    trackEvent("discord_click", { source: "sticky-bar" });
  };

  return (
    <div className={`sticky-cta${visible ? " visible" : ""}`} role="region" aria-label="Sticky enrolment bar">
      <div className="sticky-cta-text">
        <strong>Ready to start?</strong> Australia's #1 Depop system.
      </div>
      <div className="sticky-cta-actions">
        <a href={DISCORD_URL} target="_blank" rel="noreferrer" className="btn-gold" onClick={handleClick}>
          Enrol Now →
        </a>
        <button className="sticky-cta-close" onClick={handleClose} aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
