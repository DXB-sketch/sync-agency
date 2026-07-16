import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// Fulfilment queue: every paid order across clients, with each item's
// shipping address, tracking entry, and status advancement.
// `paid` is no longer manually advanced — the fulfilment engine (dispatch-order)
// owns paid -> dispatching -> dispatched automatically. Manual advance stays only
// for pre-engine orders sitting in `sourcing` and the shipped -> delivered step.
// See docs/PHASE1_PLAN.md §3.5.
const NEXT_STATUS = { sourcing: "shipped", shipped: "delivered" };

export default function OrdersQueuePage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState({});
  const [showDone, setShowDone] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("orders")
      .select("*, profiles!orders_member_id_fkey(email), order_items(*, products(name))")
      .neq("status", "pending_payment")
      .order("created_at", { ascending: false });
    setOrders(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function advance(order) {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    await supabase.from("orders").update({ status: next }).eq("id", order.id);
    await load();
  }

  async function cancel(order) {
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    await load();
  }

  async function saveTracking(itemId) {
    const value = tracking[itemId]?.trim();
    if (!value) return;
    await supabase.from("order_items").update({ tracking_number: value }).eq("id", itemId);
    setTracking((t) => ({ ...t, [itemId]: undefined }));
    await load();
  }

  const visible = orders.filter((o) =>
    showDone ? true : !["delivered", "cancelled"].includes(o.status)
  );

  return (
    <div className="portal-page">
      <div className="portal-page-head portal-page-head-row">
        <div>
          <h1 className="portal-h1">Orders queue</h1>
          <p className="portal-sub">
            Paid stock orders to fulfil — source each item and ship to its listed address.
          </p>
        </div>
        <label className="admin-toggle-done">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} />
          Show delivered/cancelled
        </label>
      </div>

      {loading ? (
        <p className="portal-sub">Loading…</p>
      ) : visible.length === 0 ? (
        <div className="portal-empty">
          <p>Queue is clear.</p>
        </div>
      ) : (
        visible.map((order) => (
          <div key={order.id} className="order-card">
            <div className="order-head">
              <div>
                <span className={`order-status order-status-${order.status}`}>{order.status}</span>
                <span className="order-date">
                  {order.profiles?.email} · {new Date(order.created_at).toLocaleString()}
                </span>
              </div>
              <div className="admin-order-actions">
                <span className="order-total">${Number(order.total_amount).toFixed(2)}</span>
                {NEXT_STATUS[order.status] && (
                  <button className="btn-gold admin-advance" onClick={() => advance(order)}>
                    Mark {NEXT_STATUS[order.status]}
                  </button>
                )}
                {order.status !== "cancelled" && order.status !== "delivered" && (
                  <button className="btn-ghost admin-view-btn" onClick={() => cancel(order)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
            <div className="order-items">
              {order.order_items.map((item) => (
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
                    {item.tracking_number && (
                      <span className="order-item-tracking">Tracking: {item.tracking_number}</span>
                    )}
                  </div>
                  <div className="admin-tracking">
                    <input
                      className="auth-input admin-tracking-input"
                      placeholder="Tracking number"
                      value={tracking[item.id] ?? ""}
                      onChange={(e) => setTracking((t) => ({ ...t, [item.id]: e.target.value }))}
                    />
                    <button className="btn-ghost admin-view-btn" onClick={() => saveTracking(item.id)}>
                      Save
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
