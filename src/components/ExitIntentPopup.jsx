import { useEffect, useState } from "react";
import { trackEvent } from "../utils/analytics";

const STORAGE_KEY = "exitIntentShown";
const READY_DELAY_MS = 3000;
const DISCORD_URL = "https://discord.gg/pVzjXumpbP";

function isMobile() {
  return typeof window !== "undefined" && (window.matchMedia("(max-width: 768px)").matches || "ontouchstart" in window);
}

export default function ExitIntentPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(STORAGE_KEY)) return;
    if (isMobile()) return;

    let ready = false;
    const readyTimer = setTimeout(() => { ready = true; }, READY_DELAY_MS);

    const onMouseLeave = (e) => {
      if (!ready) return;
      if (e.clientY > 0) return;

      const pricingEl = document.getElementById("pricing");
      if (!pricingEl) return;
      const rect = pricingEl.getBoundingClientRect();
      const pastPricing = rect.top + rect.height < 0 || window.scrollY > pricingEl.offsetTop;
      if (!pastPricing) return;

      sessionStorage.setItem(STORAGE_KEY, "1");
      trackEvent("exit_intent_shown");
      setOpen(true);
      document.removeEventListener("mouseleave", onMouseLeave);
    };

    document.addEventListener("mouseleave", onMouseLeave);
    return () => {
      clearTimeout(readyTimer);
      document.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  const close = () => setOpen(false);
  const handlePricingClick = () => {
    trackEvent("exit_intent_converted");
    close();
    const pricingEl = document.getElementById("pricing");
    if (pricingEl) pricingEl.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className={`exit-overlay${open ? " visible" : ""}`} onClick={close} aria-hidden={!open}>
      <div className="exit-popup" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="exit-close" onClick={close} aria-label="Close">✕</button>
        <div className="exit-eyebrow">Hold On</div>
        <h2>Wait — before you <em>go.</em></h2>
        <p className="exit-sub">You're one decision away from your first sale on Depop.</p>
        <p className="exit-body">1,200+ Australians have already started. The only difference between them and you is this moment.</p>
        <div className="exit-actions">
          <button className="btn-gold" onClick={handlePricingClick}>Show Me the Pricing →</button>
          <a
            href={DISCORD_URL}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost"
            style={{ display: "none" }}
          >
            Talk to us on Discord
          </a>
          <button className="btn-ghost" onClick={close} style={{ background: "transparent" }}>
            No thanks, I'll figure it out myself
          </button>
        </div>
      </div>
    </div>
  );
}
