import { useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TIERS } from "../lib/tiers";

// Shown (and enforced by RLS) when a monthly subscription lapses: the member
// can't reach any portal data until they reactivate by paying.
export default function ReactivatePage() {
  const { profile } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const tier = profile?.tier ? TIERS[profile.tier] : null;

  async function reactivate() {
    setError(null);
    setBusy(true);
    const { data, error: fnErr } = await supabase.functions.invoke("create-checkout-session", {
      body: { kind: "reactivate" },
    });
    if (fnErr || !data?.url) {
      setError(data?.error ?? "Could not start the reactivation checkout.");
      setBusy(false);
      return;
    }
    window.location.href = data.url;
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          <span className="eyebrow-text">Subscription Paused</span>
        </div>
        <h1 className="auth-title">
          Your access is <em>paused</em>
        </h1>
        <p className="auth-sub">
          Your monthly subscription is inactive — a payment failed or the plan was cancelled.
          Reactivate to get back into your pathway, products, and orders.
        </p>
        {tier && (
          <p className="auth-sub">
            Plan: <strong>{tier.name}</strong> — ${tier.monthly}/month
          </p>
        )}
        {error && <p className="auth-error">{error}</p>}
        <button className="btn-gold auth-submit" disabled={busy || !tier} onClick={reactivate}>
          {busy ? "Preparing…" : "Reactivate my subscription"}
        </button>
        <p className="auth-alt">
          Think this is a mistake? Contact <strong>confirmation@syncagency.org</strong>.
        </p>
      </div>
    </section>
  );
}
