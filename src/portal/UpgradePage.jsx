import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { TIERS, PAID_TIERS, tierRank } from "../lib/tiers";
import { isNativeApp } from "../lib/nativeApp";
import { PLUS, isPlus, plusPrice } from "../lib/plus";
import { TIERS as PLAN_COPY } from "../data/pricing";

const EXECUTIVE = PLAN_COPY.find((t) => t.id === "executive");

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

  function card(key) {
    const t = TIERS[key];
    const isCurrent = profile?.tier === key;
    const isLower = t.rank < currentRank;
    // Credit what's already been paid; minimum charge $1, rounded to cents
    const prorated = Math.max(Math.round((t.lifetime - paid) * 100), 100) / 100;
    const youPay = plusPrice(Math.round(prorated * 100), profile) / 100;
    return (
      <div key={key} className={`upgrade-card${isCurrent ? " current" : ""}${t.unlimited ? " flagship" : ""}`}>
        <span className={`tier-badge tier-${key}`}>{t.unlimited ? "Flagship · The Ultimate Tier" : t.short}</span>
        <h2 className="upgrade-name">{t.name}</h2>
        {t.unlimited && <p className="upgrade-tagline">{EXECUTIVE.tagline}</p>}
        <div className="upgrade-price">
          <strong>${t.lifetime.toLocaleString("en-AU")}</strong> AUD once
        </div>
        {t.unlimited && (
          <ul className="upgrade-features">
            {EXECUTIVE.features.map((f) => <li key={f}>{f}</li>)}
          </ul>
        )}
        {isCurrent ? (
          <span className="upgrade-current-label">Your current tier</span>
        ) : isLower ? (
          <span className="upgrade-current-label">Included in your tier</span>
        ) : (
          <>
            {prorated !== t.lifetime && (
              <p className="upgrade-prorate">
                ${t.lifetime} − ${Number(paid).toFixed(2)} already paid = ${prorated.toFixed(2)}
              </p>
            )}
            {isPlus(profile) && (
              <p className="upgrade-prorate">{PLUS.name}: 10% off</p>
            )}
            {(prorated !== t.lifetime || isPlus(profile)) && (
              <p className="upgrade-prorate">
                You pay <strong>${youPay.toFixed(2)}</strong>
              </p>
            )}
            <button
              className="btn-gold"
              disabled={busy !== null}
              onClick={() => upgrade(key)}
            >
              {busy === key ? "Preparing…" : t.unlimited ? "Become an Executive Partner" : `Upgrade to ${t.short}`}
            </button>
          </>
        )}
        {t.unlimited && currentRank < TIERS.vip.rank && (
          <p className="upgrade-anchor-note">
            Not ready for the full partnership? {TIERS.vip.name} gets you a fully run store for under a fifth of the price.
          </p>
        )}
      </div>
    );
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
            {PAID_TIERS.filter((key) => !TIERS[key].unlimited).map(card)}
          </div>
          <div className="upgrade-flagship">{card("executive")}</div>
        </>
      )}
    </div>
  );
}
