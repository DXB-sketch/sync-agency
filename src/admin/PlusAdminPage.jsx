import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { PLUS, isPlus } from "../lib/plus";

function date(iso) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

// Sync Plus subscribers and the admin-editable monthly price.
export default function PlusAdminPage() {
  const { profile: admin } = useAuth();
  const [members, setMembers] = useState([]);
  const [monthlyCents, setMonthlyCents] = useState(null);
  const [priceInput, setPriceInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(
    () =>
      Promise.all([
        supabase
          .from("profiles")
          .select("id, email, full_name, plus_status, plus_current_period_end, plus_cancel_at_period_end")
          .not("plus_status", "is", null)
          .order("email"),
        supabase.from("plus_settings").select("monthly_cents").single(),
      ]).then(([m, s]) => {
        setMembers(m.data ?? []);
        setMonthlyCents(s.data?.monthly_cents ?? null);
        setPriceInput(s.data ? String(s.data.monthly_cents / 100) : "");
      }),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const active = members.filter(isPlus);

  async function savePrice(e) {
    e.preventDefault();
    const cents = Math.round(Number(priceInput) * 100);
    if (!Number.isFinite(cents) || cents < 100 || cents > 100000) {
      setError("Enter a monthly price between $1 and $1,000.");
      return;
    }
    if (
      !window.confirm(
        `Change ${PLUS.name} to $${(cents / 100).toFixed(2)}/month? New members pay the new price straight away. Existing members stay on the price they joined at.`
      )
    )
      return;
    setError(null);
    setNotice(null);
    setBusy(true);
    const { error: upErr } = await supabase
      .from("plus_settings")
      .update({ monthly_cents: cents, updated_by: admin.id, updated_at: new Date().toISOString() })
      .eq("id", true);
    setBusy(false);
    if (upErr) setError(upErr.message);
    else setNotice(`${PLUS.name} is now $${(cents / 100).toFixed(2)}/month for new members.`);
    await load();
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">{PLUS.name}</h1>
        <p className="portal-sub">
          {active.length} active member{active.length === 1 ? "" : "s"}
          {monthlyCents !== null && ` · $${(monthlyCents / 100).toFixed(2)}/month for new members`}.
        </p>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {notice && <p className="admin-notice">{notice}</p>}

      <form className="dash-card plus-status-card" onSubmit={savePrice}>
        <h2 className="dash-card-title">Monthly price</h2>
        <p className="dash-card-sub">
          Updates the portal and Stripe checkout immediately — no site upload needed. Existing members keep the
          price they joined at.
        </p>
        <label className="auth-label">
          AUD per month
          <input
            className="auth-input"
            type="number"
            min="1"
            max="1000"
            step="0.01"
            required
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
          />
        </label>
        <button className="btn-gold" type="submit" disabled={busy}>
          Save price
        </button>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Status</th>
              <th>Current period ends</th>
            </tr>
          </thead>
          <tbody>
            {members.length === 0 && (
              <tr>
                <td colSpan={3}>No {PLUS.name} members yet.</td>
              </tr>
            )}
            {members.map((m) => (
              <tr key={m.id} className={isPlus(m) ? "" : "admin-row-inactive"}>
                <td>{m.full_name || m.email}</td>
                <td>
                  {m.plus_status}
                  {m.plus_cancel_at_period_end && isPlus(m) ? " (cancelling)" : ""}
                </td>
                <td>{date(m.plus_current_period_end)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
