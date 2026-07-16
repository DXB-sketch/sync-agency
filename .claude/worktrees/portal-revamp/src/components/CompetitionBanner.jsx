import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

export default function CompetitionBanner() {
  const [visible, setVisible] = useState(
    () => sessionStorage.getItem("compBannerDismissed") !== "1"
  );

  useEffect(() => {
    if (!visible) return;
    document.documentElement.style.setProperty("--banner-height", "44px");
    document.body.classList.add("banner-visible");
    document.body.style.paddingTop = "44px";
    return () => {
      document.documentElement.style.removeProperty("--banner-height");
      document.body.classList.remove("banner-visible");
      document.body.style.paddingTop = "";
    };
  }, [visible]);

  if (!visible) return null;

  const dismiss = () => {
    sessionStorage.setItem("compBannerDismissed", "1");
    setVisible(false);
  };

  return (
    <div className="comp-banner">
      <span className="comp-banner-text">
        🏆 $10,000 Sync Store Competition — 22nd July deadline
      </span>
      <div className="comp-banner-right">
        <Link to="/competition" className="comp-banner-link">See Details →</Link>
        <button onClick={dismiss} className="comp-banner-close" aria-label="Dismiss">✕</button>
      </div>
    </div>
  );
}
