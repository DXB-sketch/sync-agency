import { useState, useEffect } from "react";

export default function CheckoutSuccessNotification() {
  const [visible, setVisible] = useState(false);
  const [tierName, setTierName] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      setTierName(params.get("tier") || null);
      setVisible(true);

      const clean = new URL(window.location.href);
      clean.searchParams.delete("checkout");
      clean.searchParams.delete("tier");
      window.history.replaceState({}, "", clean.toString());

      const timer = setTimeout(() => setVisible(false), 12000);
      return () => clearTimeout(timer);
    }
  }, []);

  if (!visible) return null;

  return (
    <div
      className="exit-overlay"
      onClick={(e) => e.target === e.currentTarget && setVisible(false)}
    >
      <div className="exit-modal">
        <button
          className="exit-close"
          onClick={() => setVisible(false)}
          aria-label="Close"
        >
          ✕
        </button>
        <div className="exit-eyebrow">Payment Confirmed</div>
        <h2>You're in. Welcome to <em>Sync Agency.</em></h2>
        <p>
          Check your email for access details. If you don't see it within 5 minutes,
          check your spam folder.
        </p>
        {tierName && (
          <p style={{ color: "var(--gold)", fontWeight: 600, fontSize: 14, marginBottom: 20 }}>
            Tier: {tierName}
          </p>
        )}
        <button
          className="btn-gold"
          style={{ display: "flex", width: "100%", justifyContent: "center" }}
          onClick={() => setVisible(false)}
        >
          Got it →
        </button>
      </div>
    </div>
  );
}
