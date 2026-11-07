import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { REWARD_TYPES, isLive, rewardText, requirementText } from "../lib/walletPromo";

const EMPTY_FORM = {
  title: "",
  body: "",
  cta_label: "Top up wallet",
  min_topup: "",
  reward_type: "bonus_credit",
  reward_value: "",
  starts_at: "",
  ends_at: "",
};

// timestamptz <-> <input type="datetime-local"> (local time, no seconds)
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function fromLocalInput(value) {
  return value ? new Date(value).toISOString() : null;
}

function status(promo) {
  if (!promo.active) return "Off";
  if (isLive(promo)) return "Live";
  if (promo.ends_at && Date.parse(promo.ends_at) <= Date.now()) return "Ended";
  return "Scheduled";
}

// Wallet top-up promos: the popup members see in the portal, and the reward
// stripe-webhook grants when a qualifying top-up clears. Only one promo can be
// switched on at a time; its optional start/end decide when it's live.
export default function PromosAdminPage() {
  const { profile: admin } = useAuth();
  const [promos, setPromos] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(
    () =>
      supabase
        .from("wallet_promos")
        .select("*")
        .order("created_at", { ascending: false })
        .then(({ data }) => setPromos(data ?? [])),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  function edit(promo) {
    setEditingId(promo.id);
    setForm({
      title: promo.title,
      body: promo.body,
      cta_label: promo.cta_label,
      min_topup: String(promo.min_topup_cents / 100),
      reward_type: promo.reward_type,
      reward_value: String(Number(promo.reward_value)),
      starts_at: toLocalInput(promo.starts_at),
      ends_at: toLocalInput(promo.ends_at),
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
      title: form.title.trim(),
      body: form.body.trim(),
      cta_label: form.cta_label.trim() || "Top up wallet",
      min_topup_cents: Math.round(Number(form.min_topup) * 100),
      reward_type: form.reward_type,
      reward_value: Number(form.reward_value),
      starts_at: fromLocalInput(form.starts_at),
      ends_at: fromLocalInput(form.ends_at),
      updated_at: new Date().toISOString(),
    };
    if (fields.starts_at && fields.ends_at && fields.ends_at <= fields.starts_at) {
      setError("End time must be after the start time.");
      return;
    }
    setBusy(true);
    const { error: saveErr } = editingId
      ? await supabase.from("wallet_promos").update(fields).eq("id", editingId)
      : await supabase.from("wallet_promos").insert({ ...fields, created_by: admin.id });
    setBusy(false);
    if (saveErr) {
      setError(saveErr.message);
      return;
    }
    setNotice(editingId ? "Promo updated." : "Promo created. Switch it on to send it to members.");
    reset();
    await load();
  }

  async function setActive(promo, active) {
    setError(null);
    setNotice(null);
    setBusy(true);
    if (active) {
      // Only one promo can be on at a time (wallet_promos_single_active)
      await supabase.from("wallet_promos").update({ active: false }).eq("active", true);
    }
    const { error: upErr } = await supabase
      .from("wallet_promos")
      .update({ active, updated_at: new Date().toISOString() })
      .eq("id", promo.id);
    setBusy(false);
    if (upErr) setError(upErr.message);
    else setNotice(active ? `"${promo.title}" is switched on.` : `"${promo.title}" is switched off.`);
    await load();
  }

  async function remove(promo) {
    if (!window.confirm(`Delete "${promo.title}"? Rewards already granted are kept.`)) return;
    setError(null);
    setNotice(null);
    const { error: delErr } = await supabase.from("wallet_promos").delete().eq("id", promo.id);
    if (delErr) setError(delErr.message);
    if (editingId === promo.id) reset();
    await load();
  }

  const isPercent = form.reward_type !== "bonus_credit";

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Wallet promos</h1>
        <p className="portal-sub">
          The popup members see in the portal (up to twice a day, 6+ hours apart) and the reward they get
          for a qualifying wallet top-up. Changes go live immediately — no site upload needed.
        </p>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {notice && <p className="admin-notice">{notice}</p>}

      <form className="dash-card admin-create-form" onSubmit={save}>
        <h2 className="dash-card-title">{editingId ? "Edit promo" : "New promo"}</h2>
        <div className="admin-form-grid">
          <label className="auth-label">
            Popup title
            <input
              className="auth-input"
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Add $100 wallet credit today and get $20 free"
            />
          </label>
          <label className="auth-label">
            Button text
            <input
              className="auth-input"
              value={form.cta_label}
              onChange={(e) => setForm({ ...form, cta_label: e.target.value })}
            />
          </label>
        </div>
        <label className="auth-label">
          Popup message
          <textarea
            className="auth-input"
            required
            rows={3}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />
        </label>
        <div className="admin-form-grid">
          <label className="auth-label">
            Minimum top-up (AUD, $10–$1,000)
            <input
              className="auth-input"
              type="number"
              required
              min="10"
              max="1000"
              step="0.01"
              value={form.min_topup}
              onChange={(e) => setForm({ ...form, min_topup: e.target.value })}
            />
          </label>
          <label className="auth-label">
            Reward
            <select
              className="auth-input"
              value={form.reward_type}
              onChange={(e) => setForm({ ...form, reward_type: e.target.value })}
            >
              {Object.entries(REWARD_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="auth-label">
            {isPercent ? "Reward percent (%)" : "Reward amount (AUD)"}
            <input
              className="auth-input"
              type="number"
              required
              min="0.01"
              max={isPercent ? "100" : undefined}
              step="0.01"
              value={form.reward_value}
              onChange={(e) => setForm({ ...form, reward_value: e.target.value })}
            />
          </label>
        </div>
        <div className="admin-form-grid">
          <label className="auth-label">
            Starts (optional — blank = as soon as it's switched on)
            <input
              className="auth-input"
              type="datetime-local"
              value={form.starts_at}
              onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
            />
          </label>
          <label className="auth-label">
            Ends (optional — blank = until switched off)
            <input
              className="auth-input"
              type="datetime-local"
              value={form.ends_at}
              onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
            />
          </label>
        </div>
        {form.min_topup && form.reward_value && (
          <p className="dash-card-sub">
            Members will see: {requirementText({ min_topup_cents: Math.round(Number(form.min_topup) * 100) })} to
            get{" "}
            {rewardText({ reward_type: form.reward_type, reward_value: form.reward_value })}. Every qualifying
            top-up earns it.
          </p>
        )}
        <div className="tut-pop-btns">
          {editingId && (
            <button type="button" className="btn-ghost" onClick={reset}>
              Cancel
            </button>
          )}
          <button className="btn-gold" type="submit" disabled={busy}>
            {busy ? "Saving…" : editingId ? "Save changes" : "Create promo"}
          </button>
        </div>
      </form>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Title</th>
              <th>Offer</th>
              <th>Schedule</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {promos.length === 0 && (
              <tr>
                <td colSpan={5}>No promos yet.</td>
              </tr>
            )}
            {promos.map((p) => (
              <tr key={p.id} className={p.active ? "" : "admin-row-inactive"}>
                <td>{status(p)}</td>
                <td>{p.title}</td>
                <td>
                  {requirementText(p)} → {rewardText(p)}
                </td>
                <td>
                  {p.starts_at ? new Date(p.starts_at).toLocaleString() : "Now"} –{" "}
                  {p.ends_at ? new Date(p.ends_at).toLocaleString() : "Until off"}
                </td>
                <td>
                  <div className="admin-order-actions">
                    <button className="btn-ghost" disabled={busy} onClick={() => setActive(p, !p.active)}>
                      {p.active ? "Switch off" : "Switch on"}
                    </button>
                    <button className="btn-ghost" onClick={() => edit(p)}>
                      Edit
                    </button>
                    <button className="btn-ghost" onClick={() => remove(p)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
