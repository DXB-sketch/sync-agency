import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { PLUS, isPlus } from "../lib/plus";

function date(iso) {
  return iso ? new Date(iso).toLocaleDateString() : "—";
}

// Sync Plus subscribers and the monthly $500 wallet-credit draw (draw_plus_winner RPC:
// admin-only, one draw per month, credits the winner through wallet_adjust).
export default function PlusAdminPage() {
  const [members, setMembers] = useState([]);
  const [draws, setDraws] = useState([]);
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
        supabase
          .from("plus_draws")
          .select("*, winner:profiles!plus_draws_winner_id_fkey(email, full_name)")
          .order("draw_month", { ascending: false }),
      ]).then(([m, d]) => {
        setMembers(m.data ?? []);
        setDraws(d.data ?? []);
      }),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  const active = members.filter(isPlus);

  async function draw() {
    if (
      !window.confirm(
        `Draw this month's winner from ${active.length} active ${PLUS.name} member${
          active.length === 1 ? "" : "s"
        }? $${PLUS.drawAmount} is credited to their wallet straight away.`
      )
    )
      return;
    setError(null);
    setNotice(null);
    setBusy(true);
    const { data, error: rpcErr } = await supabase.rpc("draw_plus_winner");
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
    } else if (data?.status === "already_drawn") {
      setError("This month's winner has already been drawn.");
    } else if (data?.status === "no_entrants") {
      setError(`There are no active ${PLUS.name} members to draw from.`);
    } else {
      const winner = members.find((m) => m.id === data.winner_id);
      setNotice(`Winner: ${winner?.full_name || winner?.email || data.winner_id} — $${PLUS.drawAmount} credited.`);
    }
    await load();
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">{PLUS.name}</h1>
        <p className="portal-sub">
          {active.length} active member{active.length === 1 ? "" : "s"} · ${PLUS.monthly}/month each.
        </p>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {notice && <p className="admin-notice">{notice}</p>}

      <div className="dash-card plus-status-card">
        <h2 className="dash-card-title">Monthly ${PLUS.drawAmount} draw</h2>
        <p className="dash-card-sub">
          Picks one active {PLUS.name} member at random and credits ${PLUS.drawAmount} to their wallet. Once per
          calendar month (Brisbane time).
        </p>
        <button className="btn-gold" disabled={busy || active.length === 0} onClick={draw}>
          {busy ? "Drawing…" : "Draw this month's winner"}
        </button>
      </div>

      {draws.length > 0 && (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Winner</th>
                <th>Entrants</th>
                <th>Drawn</th>
              </tr>
            </thead>
            <tbody>
              {draws.map((d) => (
                <tr key={d.id}>
                  <td>{new Date(d.draw_month).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</td>
                  <td>{d.winner?.full_name || d.winner?.email}</td>
                  <td>{d.entrants}</td>
                  <td>{date(d.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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
