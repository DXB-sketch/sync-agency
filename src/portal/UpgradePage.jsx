import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TIERS, tierRank } from "../lib/tiers";

export default function UpgradePage() {
  const { profile } = useAuth();
  const [billing, setBilling] = useState("lifetime");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const currentRank = tierRank(profile?.tier);
  const paid = profile?.tier_price_paid ?? 0;

  async function upgrade(tierKey) {
    setError(null);
    setBusy(tierKey);
    const { data, error: fnErr } = await supabase.functions.invoke("create-checkout-session", {
      body: { kind: "upgrade", target_tier: tierKey, target_billing: billing },
    });
    if (fnErr || !data?.url) {
      setError(data?.error ?? "Could not start the upgrade checkout.");
      setBusy(null);
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Upgrade your tier</h1>
        <p className="portal-sub">
          {profile?.tier
            ? `You're on ${TIERS[profile.tier].name}. Lifetime upgrades are prorated — you only pay the difference.`
            : "No tier is linked to your account yet."}
        </p>
      </div>

      <div className="upgrade-toggle">
        <button
          className={`upgrade-toggle-btn${billing === "lifetime" ? " active" : ""}`}
          onClick={() => setBilling("lifetime")}
        >
          Lifetime
        </button>
        <button
          className={`upgrade-toggle-btn${billing === "monthly" ? " active" : ""}`}
          onClick={() => setBilling("monthly")}
        >
          Monthly
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="upgrade-grid">
        {Object.entries(TIERS).map(([key, t]) => {
          const isCurrent = profile?.tier === key;
          const isLower = t.rank < currentRank;
          const prorated =
            billing === "lifetime" && profile?.billing_type === "lifetime"
              ? Math.max(t.lifetime - paid, 1)
              : null;
          return (
            <div key={key} className={`upgrade-card${isCurrent ? " current" : ""}`}>
              <span className={`tier-badge tier-${key}`}>{t.short}</span>
              <h2 className="upgrade-name">{t.name}</h2>
              <div className="upgrade-price">
                {billing === "lifetime" ? (
                  <>
                    <strong>${t.lifetime}</strong> once
                  </>
                ) : (
                  <>
                    <strong>${t.monthly}</strong>/month
                  </>
                )}
              </div>
              {isCurrent ? (
                <span className="upgrade-current-label">Your current tier</span>
              ) : isLower ? (
                <span className="upgrade-current-label">Included in your tier</span>
              ) : (
                <>
                  {prorated !== null && (
                    <p className="upgrade-prorate">
                      You pay <strong>${prorated}</strong> (${t.lifetime} − ${paid} already paid)
                    </p>
                  )}
                  <button
                    className="btn-gold"
                    disabled={busy !== null}
                    onClick={() => upgrade(key)}
                  >
                    {busy === key ? "Preparing…" : `Upgrade to ${t.short}`}
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
