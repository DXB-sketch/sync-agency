import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const EMPTY_FORM = { name: "", code: "", commission_rate: "", contact: "", payout_notes: "" };

const STATUSES = ["pending", "approved", "paid", "voided"];
const KIND_LABELS = { new_purchase: "New purchase", renewal: "Renewal", upgrade: "Upgrade" };

function money(cents) {
  return `$${(cents / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// Creator referral program: creators, their link/code stats, and the commissions they've earned.
// Commissions are created by stripe-webhook; this page only marks approved ones paid
// (mark_commissions_paid). Payouts themselves happen outside the system.
export default function CreatorsAdminPage() {
  const [creators, setCreators] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [clicks, setClicks] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [filterCreator, setFilterCreator] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [paidDate, setPaidDate] = useState(today);
  const [paidNote, setPaidNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(
    () =>
      Promise.all([
        supabase.from("creators").select("*").order("created_at", { ascending: false }),
        supabase.from("referral_commissions_view").select("*").order("created_at", { ascending: false }),
        supabase.from("creator_click_counts").select("*"),
      ]).then(([c, rc, cl]) => {
        setCreators(c.data ?? []);
        setCommissions(rc.data ?? []);
        setClicks(Object.fromEntries((cl.data ?? []).map((r) => [r.creator_id, r.clicks])));
      }),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  function edit(c) {
    setEditingId(c.id);
    setForm({
      name: c.name,
      code: c.code,
      commission_rate: String(Number(c.commission_rate)),
      contact: c.contact ?? "",
      payout_notes: c.payout_notes ?? "",
    });
    setError(null);
    setNotice(null);
  }

  function reset() {
    setEditingId(null);
    setForm(EMPTY_FORM);
  }

  async function save(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const fields = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      commission_rate: Number(form.commission_rate),
      contact: form.contact.trim() || null,
      payout_notes: form.payout_notes.trim() || null,
      updated_at: new Date().toISOString(),
    };
    setBusy(true);
    const { error: saveErr } = editingId
      ? await supabase.from("creators").update(fields).eq("id", editingId)
      : await supabase.from("creators").insert(fields);
    setBusy(false);
    if (saveErr) {
      setError(saveErr.code === "23505" ? `The code ${fields.code} is already taken.` : saveErr.message);
      return;
    }
    setNotice(
      editingId
        ? "Creator updated. Rate changes apply to new payments only."
        : `Creator added. Their link: ${window.location.origin}/r/${fields.code.toLowerCase()}`
    );
    reset();
    await load();
  }

  async function setActive(c, active) {
    const msg = active
      ? `Reactivate ${c.name}? Their code and link will work again.`
      : `Deactivate ${c.name}? Their code and link stop working (no discount, no new commissions). History is kept.`;
    if (!window.confirm(msg)) return;
    setError(null);
    setNotice(null);
    const { error: upErr } = await supabase
      .from("creators")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", c.id);
    if (upErr) setError(upErr.message);
    await load();
  }

  async function markPaid() {
    setError(null);
    setNotice(null);
    setBusy(true);
    const { data, error: rpcErr } = await supabase.rpc("mark_commissions_paid", {
      p_ids: [...selected],
      p_paid_at: new Date(`${paidDate}T12:00:00`).toISOString(),
      p_note: paidNote,
    });
    setBusy(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    setNotice(`${data} commission${data === 1 ? "" : "s"} marked paid.`);
    setPaidNote("");
    setSelected(new Set());
    await load();
  }

  function stats(creatorId) {
    const rows = commissions.filter((r) => r.creator_id === creatorId);
    const live = rows.filter((r) => r.effective_status !== "voided");
    const total = (status) =>
      rows.filter((r) => r.effective_status === status).reduce((s, r) => s + r.commission_cents, 0);
    return {
      sales: live.length,
      revenue: live.reduce((s, r) => s + r.amount_paid_cents, 0),
      pending: total("pending"),
      approved: total("approved"),
      paid: total("paid"),
      voided: total("voided"),
      owed: rows
        .filter((r) => r.effective_status === "approved" && !r.needs_attention)
        .reduce((s, r) => s + r.commission_cents, 0),
      attention: rows.filter((r) => r.needs_attention).length,
    };
  }

  const creatorName = Object.fromEntries(creators.map((c) => [c.id, `${c.name} (${c.code})`]));
  const shown = commissions.filter(
    (r) => (!filterCreator || r.creator_id === filterCreator) && (!filterStatus || r.effective_status === filterStatus)
  );
  const payable = (r) => r.effective_status === "approved" && !r.needs_attention;
  const selectedTotal = commissions
    .filter((r) => selected.has(r.id))
    .reduce((s, r) => s + r.commission_cents, 0);

  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Creators</h1>
        <p className="portal-sub">
          Creator links and codes give buyers 10% off their first course purchase. Creators earn their rate on
          every course payment they drove (new purchases and upgrades). Commissions are pending for 14 days, then
          approved. Pay them outside the system, then mark them paid here.
        </p>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {notice && <p className="admin-notice">{notice}</p>}

      <form className="dash-card admin-create-form" onSubmit={save}>
        <h2 className="dash-card-title">{editingId ? "Edit creator" : "New creator"}</h2>
        <div className="admin-form-grid">
          <label className="auth-label">
            Name
            <input
              className="auth-input"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="auth-label">
            Code (letters and numbers, 2–20)
            <input
              className="auth-input"
              required
              pattern="[A-Za-z0-9]{2,20}"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              placeholder="JAKE"
            />
          </label>
          <label className="auth-label">
            Commission (%)
            <input
              className="auth-input"
              type="number"
              required
              min="0"
              max="100"
              step="0.01"
              value={form.commission_rate}
              onChange={(e) => setForm({ ...form, commission_rate: e.target.value })}
            />
          </label>
        </div>
        <div className="admin-form-grid">
          <label className="auth-label">
            Contact
            <input
              className="auth-input"
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="Email, phone or handle"
            />
          </label>
          <label className="auth-label">
            Payout notes
            <input
              className="auth-input"
              value={form.payout_notes}
              onChange={(e) => setForm({ ...form, payout_notes: e.target.value })}
              placeholder="PayID or bank details"
            />
          </label>
        </div>
        {editingId && (
          <p className="dash-card-sub">
            Changing the code breaks links already shared. Changing the rate only affects new payments.
          </p>
        )}
        <div className="tut-pop-btns">
          {editingId && (
            <button type="button" className="btn-ghost" onClick={reset}>
              Cancel
            </button>
          )}
          <button className="btn-gold" type="submit" disabled={busy}>
            {busy ? "Saving…" : editingId ? "Save changes" : "Add creator"}
          </button>
        </div>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table admin-table-stack">
          <thead>
            <tr>
              <th>Creator</th>
              <th>Link</th>
              <th>Rate</th>
              <th>Clicks</th>
              <th>Sales</th>
              <th>Revenue</th>
              <th>Pending</th>
              <th>Approved</th>
              <th>Paid</th>
              <th>Voided</th>
              <th>Owed now</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {creators.length === 0 && (
              <tr>
                <td colSpan={12}>No creators yet.</td>
              </tr>
            )}
            {creators.map((c) => {
              const s = stats(c.id);
              return (
                <tr key={c.id} className={c.active ? "" : "admin-row-inactive"}>
                  <td data-label="Creator">
                    {c.name} · <strong>{c.code}</strong>
                    {!c.active && " (inactive)"}
                    {s.attention > 0 && ` · ⚠ ${s.attention} need${s.attention === 1 ? "s" : ""} attention`}
                  </td>
                  <td data-label="Link">/r/{c.code.toLowerCase()}</td>
                  <td data-label="Rate">{Number(c.commission_rate)}%</td>
                  <td data-label="Clicks">{clicks[c.id] ?? 0}</td>
                  <td data-label="Sales">{s.sales}</td>
                  <td data-label="Revenue">{money(s.revenue)}</td>
                  <td data-label="Pending">{money(s.pending)}</td>
                  <td data-label="Approved">{money(s.approved)}</td>
                  <td data-label="Paid">{money(s.paid)}</td>
                  <td data-label="Voided">{money(s.voided)}</td>
                  <td data-label="Owed now">
                    <strong>{money(s.owed)}</strong>
                  </td>
                  <td>
                    <div className="admin-order-actions">
                      <button className="btn-ghost" onClick={() => edit(c)}>
                        Edit
                      </button>
                      <button className="btn-ghost" onClick={() => setActive(c, !c.active)}>
                        {c.active ? "Deactivate" : "Reactivate"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h2 className="dash-card-title" style={{ marginTop: 32 }}>
        Commissions
      </h2>
      <div className="admin-form-grid">
        <label className="auth-label">
          Creator
          <select className="auth-input" value={filterCreator} onChange={(e) => setFilterCreator(e.target.value)}>
            <option value="">All creators</option>
            {creators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.code})
              </option>
            ))}
          </select>
        </label>
        <label className="auth-label">
          Status
          <select className="auth-input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {selected.size > 0 && (
        <div className="dash-card admin-create-form">
          <h2 className="dash-card-title">
            Mark {selected.size} commission{selected.size === 1 ? "" : "s"} paid ({money(selectedTotal)})
          </h2>
          <div className="admin-form-grid">
            <label className="auth-label">
              Paid date
              <input
                className="auth-input"
                type="date"
                required
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
              />
            </label>
            <label className="auth-label">
              Note or reference (optional)
              <input className="auth-input" value={paidNote} onChange={(e) => setPaidNote(e.target.value)} />
            </label>
          </div>
          <div className="tut-pop-btns">
            <button className="btn-ghost" onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <button className="btn-gold" disabled={busy || !paidDate} onClick={markPaid}>
              {busy ? "Saving…" : "Mark paid"}
            </button>
          </div>
        </div>
      )}

      <div className="admin-table-wrap">
        <table className="admin-table admin-table-stack">
          <thead>
            <tr>
              <th />
              <th>Date</th>
              <th>Creator</th>
              <th>Customer</th>
              <th>Tier</th>
              <th>Type</th>
              <th>Amount paid</th>
              <th>Rate</th>
              <th>Commission</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 && (
              <tr>
                <td colSpan={10}>No commissions.</td>
              </tr>
            )}
            {shown.map((r) => (
              <tr key={r.id} className={r.effective_status === "voided" ? "admin-row-inactive" : ""}>
                <td>
                  {payable(r) && (
                    <input
                      type="checkbox"
                      aria-label="Select to mark paid"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                    />
                  )}
                </td>
                <td data-label="Date">{new Date(r.created_at).toLocaleDateString("en-AU")}</td>
                <td data-label="Creator">{creatorName[r.creator_id]}</td>
                <td data-label="Customer">{r.customer_email ?? "—"}</td>
                <td data-label="Tier">{r.tier ?? "—"}</td>
                <td data-label="Type">{KIND_LABELS[r.kind]}</td>
                <td data-label="Amount paid">{money(r.amount_paid_cents)}</td>
                <td data-label="Rate">{Number(r.commission_rate)}%</td>
                <td data-label="Commission">{money(r.commission_cents)}</td>
                <td data-label="Status">
                  {r.effective_status[0].toUpperCase() + r.effective_status.slice(1)}
                  {r.effective_status === "paid" && r.paid_at && ` ${new Date(r.paid_at).toLocaleDateString("en-AU")}`}
                  {r.payout_note && ` · ${r.payout_note}`}
                  {r.effective_status === "voided" && r.void_reason && ` · ${r.void_reason}`}
                  {r.needs_attention && <strong> · ⚠ Needs attention: {r.attention_reason}</strong>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
