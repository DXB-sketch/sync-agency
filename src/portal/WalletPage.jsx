import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { walletEnabled } from "../lib/walletFlag";
import { useAuth } from "../lib/AuthContext";

const PRESETS = [2500, 5000, 10000, 25000];

const TYPE_LABELS = {
  topup: "Top-up",
  debit: "Order debit",
  credit: "Credit",
  adjustment: "Adjustment",
  refund: "Refund",
};

function money(cents) {
  return `$${(Math.abs(cents) / 100).toFixed(2)}`;
}

export default function WalletPage() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const justToppedUp = params.get("topup") === "1";

  const [wallet, setWallet] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [holds, setHolds] = useState([]);
  const [loading, setLoading] = useState(true);

  const [customAmount, setCustomAmount] = useState("");
  const [toppingUp, setToppingUp] = useState(false);
  const [thresholdInput, setThresholdInput] = useState("");
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [error, setError] = useState(null);

  function load() {
    return Promise.all([
      supabase.from("wallets").select("*").maybeSingle(),
      supabase
        .from("wallet_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50),
      supabase.from("wallet_order_holds").select("*, orders(id, created_at, status)"),
    ]).then(([w, t, h]) => {
      setWallet(w.data ?? null);
      setLedger(t.data ?? []);
      setHolds(h.data ?? []);
      setThresholdInput(w.data?.low_balance_threshold_cents ? String(w.data.low_balance_threshold_cents / 100) : "");
      setLoading(false);
    });
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (justToppedUp) {
      const t = setTimeout(() => load(), 3000);
      return () => clearTimeout(t);
    }
  }, [justToppedUp]);

  async function topUp(amountCents) {
    setError(null);
    setToppingUp(true);
    const { data, error: fnErr } = await supabase.functions.invoke("wallet-topup", {
      body: { amount_cents: amountCents },
    });
    if (fnErr || !data?.url) {
      setError(data?.error ?? "Could not start the top-up checkout.");
      setToppingUp(false);
      return;
    }
    window.location.href = data.url;
  }

  async function saveThreshold(e) {
    e.preventDefault();
    setError(null);
    setSavingThreshold(true);
    const dollars = thresholdInput.trim();
    const threshold_cents = dollars === "" ? null : Math.round(Number(dollars) * 100);
    const { data, error: fnErr } = await supabase.functions.invoke("wallet-topup", {
      body: { action: "set_threshold", threshold_cents },
    });
    if (fnErr || data?.error) {
      setError(data?.error ?? "Could not save the alert threshold.");
    } else {
      setWallet((prev) => ({ ...prev, ...data }));
    }
    setSavingThreshold(false);
  }

  if (!walletEnabled(profile)) {
    return (
      <div className="portal-page">
        <div className="portal-page-head">
          <h1 className="portal-h1">Wallet</h1>
        </div>
        <div className="portal-empty">
          <p>Wallet isn't enabled for your account.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="portal-page">
        <p className="portal-sub">Loading wallet…</p>
      </div>
    );
  }

  const balanceCents = wallet?.balance_cents ?? 0;
  const customValid = customAmount !== "" && Number.isInteger(Math.round(Number(customAmount) * 100))
    ? Math.round(Number(customAmount) * 100) >= 1000 && Math.round(Number(customAmount) * 100) <= 100000
    : false;

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Wallet</h1>
        <p className="portal-sub">Pre-funded balance for your Shopify store orders.</p>
      </div>

      {justToppedUp && (
        <div className="portal-banner-ok">
          Top-up received — your balance will update within a few seconds.
        </div>
      )}
      {wallet?.low_balance_flagged_at && (
        <div className="wallet-banner-warn">Balance below your alert threshold.</div>
      )}
      {error && <p className="auth-error">{error}</p>}

      <div className="dash-card wallet-balance-card">
        <h2 className="dash-card-title">Balance</h2>
        <div className="wallet-balance-amount">{money(balanceCents)} AUD</div>
      </div>

      {holds.length > 0 && (
        <div className="wallet-holds">
          <h2 className="dash-card-title">Awaiting funds</h2>
          {holds.map((h) => (
            <div key={h.order_id} className="order-card wallet-hold-card">
              <div className="order-head">
                <div>
                  <span className="order-status order-status-exception">Awaiting funds</span>
                  <span className="order-date">
                    {h.orders?.created_at ? new Date(h.orders.created_at).toLocaleDateString() : ""}
                  </span>
                </div>
                <span className="order-total">{money(h.amount_cents)}</span>
              </div>
              <p className="dash-card-sub" style={{ marginTop: 10 }}>
                Shortfall: {money(Math.max(h.amount_cents - balanceCents, 0))}. Top up to release
                this order automatically.
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="dash-card wallet-topup-card">
        <h2 className="dash-card-title">Top up</h2>
        <div className="wallet-preset-row">
          {PRESETS.map((p) => (
            <button
              key={p}
              className="btn-ghost"
              disabled={toppingUp}
              onClick={() => topUp(p)}
            >
              {money(p)}
            </button>
          ))}
        </div>
        <div className="wallet-custom-row">
          <label className="auth-label">
            Custom amount (AUD, $10–$1,000)
            <input
              className="auth-input"
              type="number"
              min="10"
              max="1000"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
            />
          </label>
          <button
            className="btn-gold"
            disabled={!customValid || toppingUp}
            onClick={() => topUp(Math.round(Number(customAmount) * 100))}
          >
            {toppingUp ? "Preparing…" : "Top up"}
          </button>
        </div>
      </div>

      <div className="dash-card wallet-threshold-card">
        <h2 className="dash-card-title">Low-balance alert</h2>
        <p className="dash-card-sub">
          Alerts are shown here in the portal; email alerts are coming later.
        </p>
        <form className="wallet-custom-row" onSubmit={saveThreshold}>
          <label className="auth-label">
            Alert me when balance drops below (AUD, leave blank to disable)
            <input
              className="auth-input"
              type="number"
              min="0.01"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
            />
          </label>
          <button className="btn-ghost" type="submit" disabled={savingThreshold}>
            {savingThreshold ? "Saving…" : "Save"}
          </button>
        </form>
      </div>

      <div className="wallet-ledger">
        <h2 className="dash-card-title">Recent activity</h2>
        {ledger.length === 0 ? (
          <div className="portal-empty">
            <p>No wallet activity yet.</p>
          </div>
        ) : (
          <table className="wallet-ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((t) => (
                <tr key={t.id}>
                  <td>{new Date(t.created_at).toLocaleDateString()}</td>
                  <td>{TYPE_LABELS[t.type] ?? t.type}</td>
                  <td className={t.amount_cents < 0 ? "wallet-amount-neg" : "wallet-amount-pos"}>
                    {t.amount_cents < 0 ? "−" : "+"}
                    {money(t.amount_cents)}
                  </td>
                  <td>
                    {t.reason}
                    {t.order_id && (
                      <span className="order-date"> · Order #{t.order_id.slice(0, 8)}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
