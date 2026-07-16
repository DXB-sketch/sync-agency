import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { loadCart, saveCart, clearCart, cartTotal, EMPTY_ADDRESS } from "../lib/cart";

const ADDRESS_FIELDS = [
  ["ship_name", "Buyer name", true],
  ["ship_address1", "Address line 1", true],
  ["ship_address2", "Address line 2", false],
  ["ship_city", "City", true],
  ["ship_region", "State / Region", false],
  ["ship_postcode", "Postcode / ZIP", true],
  ["ship_country", "Country", true],
];

// Members never see raw fulfilment-engine statuses (dispatching/dispatched/exception) —
// dispatching/dispatched read as "sourcing", exception reads as "processing" (never the
// word "exception"). docs/PHASE1_PLAN.md §3.5.
const STATUS_LABELS = {
  pending_payment: "Awaiting payment",
  paid: "Paid — sourcing soon",
  sourcing: "Sourcing your stock",
  dispatching: "Sourcing your stock",
  dispatched: "Sourcing your stock",
  exception: "Processing your order",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const STATUS_FLOW = ["paid", "sourcing", "shipped", "delivered"];
// dispatching/dispatched map onto the same "sourcing" track step for progress purposes.
const TRACK_STATUS = { dispatching: "sourcing", dispatched: "sourcing" };

export default function CheckoutPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState(loadCart());
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [params] = useSearchParams();
  const justPaid = params.get("paid") === "1";

  useEffect(() => {
    supabase
      .from("orders")
      .select("*, order_items(*, products(name, image_url))")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setOrders(data ?? []);
        setLoadingOrders(false);
      });
  }, []);

  function update(lineId, patch) {
    const next = items.map((i) => (i.line_id === lineId ? { ...i, ...patch } : i));
    setItems(next);
    saveCart(next);
  }

  function updateAddress(lineId, field, value) {
    const next = items.map((i) =>
      i.line_id === lineId ? { ...i, address: { ...EMPTY_ADDRESS, ...i.address, [field]: value } } : i
    );
    setItems(next);
    saveCart(next);
  }

  function remove(lineId) {
    const next = items.filter((i) => i.line_id !== lineId);
    setItems(next);
    saveCart(next);
  }

  const incomplete = items.some((i) =>
    ADDRESS_FIELDS.some(([field, , required]) => required && !i.address?.[field]?.trim())
  );

  async function pay() {
    setError(null);
    setPaying(true);
    try {
      // 1. Draft order + items (per-item shipping lives HERE, not in Stripe)
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({ member_id: profile.id, total_amount: cartTotal(items) })
        .select()
        .single();
      if (orderErr) throw orderErr;

      const { error: itemsErr } = await supabase.from("order_items").insert(
        items.map((i) => ({
          order_id: order.id,
          product_id: i.product_id,
          product_name: i.name,
          quantity: i.quantity,
          unit_price: i.unit_price,
          ...Object.fromEntries(
            ADDRESS_FIELDS.map(([field]) => [field, i.address?.[field]?.trim() || null])
          ),
        }))
      );
      if (itemsErr) throw itemsErr;

      // 2. One lump-sum Stripe Checkout Session for the whole order
      const { data, error: fnErr } = await supabase.functions.invoke("create-checkout-session", {
        body: { kind: "stock_order", order_id: order.id },
      });
      if (fnErr || !data?.url) throw new Error(data?.error ?? "Could not start checkout");

      clearCart();
      window.location.href = data.url;
    } catch (err) {
      setError(err.message ?? "Something went wrong — nothing has been charged.");
      setPaying(false);
    }
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Checkout</h1>
        <p className="portal-sub">
          Pay for the items you're shipping, then track every order below.
        </p>
      </div>

      {justPaid && (
        <div className="portal-banner-ok">
          Payment received — your order is confirmed and will move to sourcing shortly.
        </div>
      )}

      <div data-tut="checkout-cart">
        {items.length === 0 ? (
          <div className="portal-empty">
            <p>Your order is empty.</p>
            <Link to="/portal/products" className="btn-gold" style={{ marginTop: 20 }}>
              Browse products
            </Link>
          </div>
        ) : (
          <>
            <div className="checkout-items">
              {items.map((item, idx) => (
                <div key={item.line_id} className="checkout-item">
                  <div className="checkout-item-head">
                    <div className="checkout-item-info">
                      {item.image_url && (
                        <img src={item.image_url} alt="" className="checkout-thumb" />
                      )}
                      <div>
                        <span className="checkout-item-name">
                          {idx + 1}. {item.name}
                        </span>
                        <span className="checkout-item-price">
                          ${item.unit_price.toFixed(2)} ×{" "}
                          <input
                            type="number"
                            min="1"
                            className="checkout-qty"
                            value={item.quantity}
                            onChange={(e) =>
                              update(item.line_id, {
                                quantity: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                          />
                        </span>
                      </div>
                    </div>
                    <button className="checkout-remove" onClick={() => remove(item.line_id)}>
                      Remove
                    </button>
                  </div>
                  <div className="checkout-address">
                    <span className="checkout-address-label">Ship this item to</span>
                    <div className="checkout-address-grid">
                      {ADDRESS_FIELDS.map(([field, label, required]) => (
                        <label key={field} className="auth-label">
                          {label}
                          {required ? "" : " (optional)"}
                          <input
                            className="auth-input"
                            value={item.address?.[field] ?? ""}
                            onChange={(e) => updateAddress(item.line_id, field, e.target.value)}
                            required={required}
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="checkout-footer">
              <span className="checkout-total">
                Total <strong>${cartTotal(items).toFixed(2)}</strong> AUD
              </span>
              {error && <p className="auth-error">{error}</p>}
              {incomplete && (
                <p className="checkout-hint">Fill in every item's shipping address to pay.</p>
              )}
              <button className="btn-gold" disabled={incomplete || paying} onClick={pay}>
                {paying ? "Preparing payment…" : "Pay once for everything"}
              </button>
            </div>
          </>
        )}
      </div>

      <div data-tut="order-tracking" className="checkout-orders">
        <h2 className="dash-card-title">Order tracking</h2>
        <p className="portal-sub">Every stock order and where it is right now.</p>

        {loadingOrders ? (
          <p className="portal-sub">Loading orders…</p>
        ) : orders.length === 0 ? (
          <div className="portal-empty">
            <p>No orders yet. When a Depop sale lands, order the stock here.</p>
          </div>
        ) : (
          orders.map((order) => {
            const trackStatus = TRACK_STATUS[order.status] ?? order.status;
            return (
            <div key={order.id} className="order-card">
              <div className="order-head">
                <div>
                  <span className={`order-status order-status-${order.status}`}>
                    {STATUS_LABELS[order.status] ?? order.status}
                  </span>
                  <span className="order-date">
                    {new Date(order.created_at).toLocaleDateString()}
                  </span>
                </div>
                <span className="order-total">${Number(order.total_amount).toFixed(2)}</span>
              </div>

              {STATUS_FLOW.includes(trackStatus) && (
                <div className="order-track">
                  {STATUS_FLOW.map((s, i) => (
                    <div
                      key={s}
                      className={`order-track-step${
                        STATUS_FLOW.indexOf(trackStatus) >= i ? " done" : ""
                      }`}
                    >
                      <span className="order-track-dot" />
                      <span className="order-track-label">{STATUS_LABELS[s].split(" —")[0]}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="order-items">
                {order.order_items.map((item) => (
                  <div key={item.id} className="order-item">
                    {item.products?.image_url && (
                      <img src={item.products.image_url} alt="" className="checkout-thumb" />
                    )}
                    <div className="order-item-info">
                      <span className="checkout-item-name">
                        {item.products?.name ?? item.product_name} × {item.quantity}
                      </span>
                      <span className="order-item-ship">
                        → {item.ship_name}, {item.ship_city}, {item.ship_country}
                      </span>
                      {item.tracking_number && (
                        <span className="order-item-tracking">
                          Tracking: {item.tracking_number}
                        </span>
                      )}
                    </div>
                    <span className="order-item-price">
                      ${(Number(item.unit_price) * item.quantity).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
}
