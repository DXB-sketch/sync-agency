import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { TIERS, PAID_TIERS, tierRank } from "../lib/tiers";
import { isNativeApp } from "../lib/nativeApp";

export default function UpgradePage() {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const native = isNativeApp();

  const currentRank = tierRank(profile?.tier);
  const paid = profile?.tier_price_paid ?? 0;

  async function upgrade(tierKey) {
    setError(null);
    setBusy(tierKey);
    const { data, error: fnErr } = await supabase.functions.invoke("create-checkout-session", {
      body: { kind: "upgrade", target_tier: tierKey, target_billing: "lifetime" },
    });
    if (fnErr || !data?.url) {
      setError(data?.error ?? "Could not start the upgrade checkout.");
      setBusy(null);
      return;
    }
    window.location.assign(data.url);
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">
          {currentRank === 0 && !profile?.grandfathered_free ? "Choose your plan" : "Upgrade your dashboard"}
        </h1>
        <p className="portal-sub">
          {currentRank === 0
            ? profile?.grandfathered_free
              ? "You're on the Free Dashboard. The Depop Coaching System courses build on it — unlock more product slots, deeper pathway steps and hands-on help."
              : "Your account doesn't have a plan yet. Choose a Depop Coaching System tier to unlock your dashboard — pathway, product slots and hands-on help."
            : `You're on ${TIERS[profile.tier].name}. One-time upgrades credit the amount you've already paid. All prices are in AUD.`}
        </p>
      </div>

      {native ? (
        <div className="portal-empty">
          <p>
            Course upgrades aren't available in the app. Visit{" "}
            <strong>syncagency.org</strong> in your browser to manage your plan.
          </p>
        </div>
      ) : (
        <>
          {error && <p className="auth-error">{error}</p>}

          <div className="upgrade-grid">
            {PAID_TIERS.map((key) => {
              const t = TIERS[key];
              const isCurrent = profile?.tier === key;
              const isLower = t.rank < currentRank;
              // Credit what's already been paid; minimum charge $1, rounded to cents
              const prorated = Math.max(Math.round((t.lifetime - paid) * 100), 100) / 100;
              return (
                <div key={key} className={`upgrade-card${isCurrent ? " current" : ""}`}>
                  <span className={`tier-badge tier-${key}`}>{t.short}</span>
                  <h2 className="upgrade-name">{t.name}</h2>
                  <div className="upgrade-price">
                    <strong>${t.lifetime}</strong> AUD once
                  </div>
                  {isCurrent ? (
                    <span className="upgrade-current-label">Your current tier</span>
                  ) : isLower ? (
                    <span className="upgrade-current-label">Included in your tier</span>
                  ) : (
                    <>
                      {prorated !== t.lifetime && (
                        <p className="upgrade-prorate">
                          You pay <strong>${prorated.toFixed(2)}</strong> (${t.lifetime} − ${Number(paid).toFixed(2)} already paid)
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
        </>
      )}
    </div>
  );
}
