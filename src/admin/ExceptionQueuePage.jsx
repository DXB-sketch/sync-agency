import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";

// Exceptions the fulfilment engine couldn't resolve on its own (docs/PHASE1_PLAN.md §3.1).
const STAGE_LABELS = {
  dispatch: "Dispatch",
  webhook: "Webhook",
  price_sync: "Price sync",
  other: "Other",
};

export default function ExceptionQueuePage() {
  const { profile: admin } = useAuth();
  const [exceptions, setExceptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [busy, setBusy] = useState(null); // exception id currently acting on
  const [notes, setNotes] = useState({}); // exception id -> note draft
  const [expanded, setExpanded] = useState({}); // exception id -> payload shown
  const [error, setError] = useState(null);

  async function load() {
    const { data } = await supabase
      .from("fulfilment_exceptions")
      .select(
        "*, orders(*, profiles!orders_member_id_fkey(email), order_items(*, products(name))), order_dispatches(*)"
      )
      .order("created_at", { ascending: false });
    setExceptions(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function retry(exc) {
    setError(null);
    setBusy(exc.id);
    // Optimistic: mark retrying before the dispatch-order call resolves
    await supabase.from("fulfilment_exceptions").update({ status: "retrying" }).eq("id", exc.id);
    await load();
    const { data, error: fnErr } = await supabase.functions.invoke("dispatch-order", {
      body: { order_id: exc.order_id, retry: true },
    });
    if (fnErr || data?.error) {
      setError(
        data?.error ?? fnErr?.message ?? "Retry failed to invoke — dispatch-order may not be deployed yet."
      );
    }
    await load();
    setBusy(null);
  }

  async function resolve(exc, status) {
    const note = notes[exc.id]?.trim();
    if (status === "refunded" && !note) {
      setError("Add a note before marking refunded — record what happened for the ledger.");
      return;
    }
    setError(null);
    setBusy(exc.id);
    await supabase
      .from("fulfilment_exceptions")
      .update({
        status,
        resolved_by: admin.id,
        resolved_at: new Date().toISOString(),
        notes: note || null,
      })
      .eq("id", exc.id);
    setNotes((n) => ({ ...n, [exc.id]: "" }));
    await load();
    setBusy(null);
  }

  const visible = exceptions.filter((e) => (showDone ? true : ["open", "retrying"].includes(e.status)));

  return (
    <div className="portal-page">
      <div className="portal-page-head portal-page-head-row">
        <div>
          <h1 className="portal-h1">Exceptions</h1>
          <p className="portal-sub">
            Orders the fulfilment engine couldn't dispatch automatically — retry, resolve, or
            refund manually.
          </p>
        </div>
        <label className="admin-toggle-done">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show resolved/refunded
        </label>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="portal-sub">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="portal-empty">
          <p>No exceptions — the queue is clear.</p>
        </div>
      ) : (
        visible.map((exc) => {
          const order = exc.orders;
          const open = ["open", "retrying"].includes(exc.status);
          return (
            <div key={exc.id} className="order-card">
              <div className="order-head">
                <div>
                  <span className={`exception-status exception-status-${exc.status}`}>{exc.status}</span>
                  <span className="order-date">
                    {STAGE_LABELS[exc.stage] ?? exc.stage} · {new Date(exc.created_at).toLocaleString()}
                  </span>
                </div>
                {open && (
                  <div className="admin-order-actions">
                    <button
                      className="btn-gold admin-advance"
                      disabled={busy === exc.id}
                      onClick={() => retry(exc)}
                    >
                      {busy === exc.id ? "Retrying…" : "Retry dispatch"}
                    </button>
                  </div>
                )}
              </div>

              <p className="dash-card-sub">
                <strong>Reason:</strong> {exc.reason}
              </p>

              {order && (
                <div className="order-items">
                  <p className="portal-sub">
                    {order.profiles?.email} · ${Number(order.total_amount).toFixed(2)} ·{" "}
                    <span className={`order-status order-status-${order.status}`}>{order.status}</span>
                  </p>
                  {order.order_items?.map((item) => (
                    <div key={item.id} className="order-item admin-order-item">
                      <div className="order-item-info">
                        <span className="checkout-item-name">
                          {item.products?.name ?? item.product_name} × {item.quantity}
                        </span>
                        <span className="order-item-ship">
                          {item.ship_name} — {item.ship_address1}
                          {item.ship_address2 ? `, ${item.ship_address2}` : ""}, {item.ship_city}
                          {item.ship_region ? `, ${item.ship_region}` : ""} {item.ship_postcode},{" "}
                          {item.ship_country}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {exc.order_dispatches && (
                <p className="portal-sub">
                  Dispatch: {exc.order_dispatches.shipping_line ?? "—"} ·{" "}
                  {exc.order_dispatches.attempts} attempt{exc.order_dispatches.attempts === 1 ? "" : "s"}
                  {exc.order_dispatches.last_error ? ` · ${exc.order_dispatches.last_error}` : ""}
                </p>
              )}

              {exc.payload && (
                <>
                  <button
                    type="button"
                    className="btn-ghost admin-view-btn"
                    onClick={() => setExpanded((x) => ({ ...x, [exc.id]: !x[exc.id] }))}
                  >
                    {expanded[exc.id] ? "Hide" : "Show"} error payload
                  </button>
                  {expanded[exc.id] && <pre className="admin-payload">{JSON.stringify(exc.payload, null, 2)}</pre>}
                </>
              )}

              {open ? (
                <div className="admin-exception-resolve">
                  <input
                    className="auth-input"
                    placeholder="Note (required for refund)"
                    value={notes[exc.id] ?? ""}
                    onChange={(e) => setNotes((n) => ({ ...n, [exc.id]: e.target.value }))}
                  />
                  <button
                    className="btn-ghost admin-view-btn"
                    disabled={busy === exc.id}
                    onClick={() => resolve(exc, "resolved")}
                  >
                    Resolve manually
                  </button>
                  <button
                    className="btn-ghost admin-view-btn"
                    disabled={busy === exc.id}
                    onClick={() => resolve(exc, "refunded")}
                  >
                    Mark refunded
                  </button>
                  <p className="portal-sub admin-exception-hint">
                    Refunding here only records it — process the actual refund in the Stripe
                    dashboard.
                  </p>
                </div>
              ) : (
                <p className="portal-sub">
                  {exc.status === "resolved" ? "Resolved" : "Refunded"}
                  {exc.resolved_at ? ` on ${new Date(exc.resolved_at).toLocaleString()}` : ""}
                  {exc.notes ? ` — ${exc.notes}` : ""}
                </p>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
