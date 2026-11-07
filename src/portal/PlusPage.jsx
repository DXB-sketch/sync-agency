import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { isNativeApp } from "../lib/nativeApp";
import { PLUS, isPlus, canGetPlus } from "../lib/plus";

const PERKS = [
  {
    title: "10% off every purchase — no limits",
    body: "Every stock order and every course upgrade in the portal is 10% cheaper. There's no cap and no monthly spending limit: spend as much as you want and the discount applies to all of it. It stacks with the 7% wallet discount.",
  },
  {
    title: "+1 extra product slot",
    body: "An extra item in your store on top of your course tier's slots, stocked by the Sync team.",
  },
  {
    title: `Monthly $${PLUS.drawAmount} wallet credit draw`,
    body: `Every active ${PLUS.name} member is entered into a draw each month for $${PLUS.drawAmount} of wallet credit.`,
  },
];

function date(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
}

export default function PlusPage() {
  const { profile, refreshProfile } = useAuth();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const native = isNativeApp();
  const active = isPlus(profile);
  const justJoined = params.get("joined") === "1";

  // The webhook switches Sync Plus on a moment after Stripe redirects back
  useEffect(() => {
    if (!justJoined || active) return;
    const t = setTimeout(() => refreshProfile?.(), 3000);
    return () => clearTimeout(t);
  }, [justJoined, active, refreshProfile]);

  async function call(action) {
    setError(null);
    setBusy(true);
    const { data, error: fnErr } = await supabase.functions.invoke("plus-subscription", { body: { action } });
    if (fnErr || data?.error) {
      setError(data?.error ?? "Something went wrong — please try again.");
      setBusy(false);
      return;
    }
    if (data?.url) {
      window.location.assign(data.url);
      return;
    }
    await refreshProfile?.();
    setBusy(false);
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">{PLUS.name}</h1>
        <p className="portal-sub">
          ${PLUS.monthly} AUD per month. Cancel any time — you keep the perks until the end of the month you've paid for.
        </p>
      </div>

      {justJoined && !active && (
        <div className="portal-banner-ok">Payment received — your {PLUS.name} perks will switch on in a few seconds.</div>
      )}
      {error && <p className="auth-error">{error}</p>}

      <div className="plus-perks">
        {PERKS.map((p) => (
          <div key={p.title} className="dash-card">
            <h2 className="dash-card-title">{p.title}</h2>
            <p className="dash-card-sub">{p.body}</p>
          </div>
        ))}
      </div>

      <div className="dash-card plus-status-card">
        {active ? (
          <>
            <h2 className="dash-card-title">You're a {PLUS.name} member</h2>
            {profile.plus_current_period_end && (
              <p className="dash-card-sub">
                {profile.plus_cancel_at_period_end
                  ? `Cancelled — your perks end on ${date(profile.plus_current_period_end)}.`
                  : `Renews on ${date(profile.plus_current_period_end)}.`}
              </p>
            )}
            {!native && (
              <button
                className="btn-ghost"
                disabled={busy}
                onClick={() => call(profile.plus_cancel_at_period_end ? "resume" : "cancel")}
              >
                {busy ? "Saving…" : profile.plus_cancel_at_period_end ? "Keep my subscription" : "Cancel subscription"}
              </button>
            )}
          </>
        ) : !canGetPlus(profile) ? (
          <>
            <h2 className="dash-card-title">For course members</h2>
            <p className="dash-card-sub">{PLUS.name} is available once you own a Depop Coaching System course.</p>
            {!native && (
              <Link to="/portal/upgrade" className="btn-gold">
                Choose a course
              </Link>
            )}
          </>
        ) : native ? (
          <p className="dash-card-sub">
            {PLUS.name} isn't available in the app. Visit <strong>syncagency.org</strong> in your browser to join.
          </p>
        ) : (
          <>
            <h2 className="dash-card-title">Join {PLUS.name}</h2>
            <p className="dash-card-sub">${PLUS.monthly} AUD/month, billed monthly until you cancel.</p>
            <button className="btn-gold" disabled={busy} onClick={() => call("subscribe")}>
              {busy ? "Preparing…" : `Join for $${PLUS.monthly}/month`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
