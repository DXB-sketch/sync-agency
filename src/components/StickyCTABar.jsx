import { useState, useEffect } from "react";

export default function StickyCTABar() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => { if (!dismissed) setShow(window.scrollY > 520); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [dismissed]);

  const dismiss = () => { setDismissed(true); setShow(false); };

  return (
    <div className={`sticky-cta${show ? " visible" : ""}`}>
      <div className="sticky-cta-inner">
        <p className="sticky-cta-text">
          <strong>1200+ clients · 100% success rate.</strong> Your Depop store won't build itself.
        </p>
        <div className="sticky-cta-actions">
          <a href="#pricing" className="btn-gold" style={{ padding: "11px 28px", fontSize: 12 }}>
            Enrol Now →
          </a>
          <a href="#pricing" className="btn-ghost" style={{ padding: "10px 20px", fontSize: 12 }}>
            See Pricing
          </a>
          <button className="sticky-close" onClick={dismiss} aria-label="Dismiss">×</button>
        </div>
      </div>
    </div>
  );
}
