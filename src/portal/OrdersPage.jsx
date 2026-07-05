import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const STATUS_LABELS = {
  pending_payment: "Awaiting payment",
  paid: "Paid — sourcing soon",
  sourcing: "Sourcing your stock",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};
const STATUS_FLOW = ["paid", "sourcing", "shipped", "delivered"];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [params] = useSearchParams();
  const justPaid = params.get("paid") === "1";

  useEffect(() => {
    supabase
      .from("orders")
      .select("*, order_items(*, products(name, image_url))")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setOrders(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Your Orders</h1>
        <p className="portal-sub">Every stock order and where it is right now.</p>
      </div>

      {justPaid && (
        <div className="portal-banner-ok">
          Payment received — your order is confirmed and will move to sourcing shortly.
        </div>
      )}

      {loading ? (
        <p className="portal-sub">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="portal-empty">
          <p>No orders yet. When a Depop sale lands, order the stock here.</p>
        </div>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="order-card">
            <div className="order-head">
              <div>
                <span className={`order-status order-status-${order.status}`}>
                  {STATUS_LABELS[order.status]}
                </span>
                <span className="order-date">
                  {new Date(order.created_at).toLocaleDateString()}
                </span>
              </div>
              <span className="order-total">${Number(order.total_amount).toFixed(2)}</span>
            </div>

            {STATUS_FLOW.includes(order.status) && (
              <div className="order-track">
                {STATUS_FLOW.map((s, i) => (
                  <div
                    key={s}
                    className={`order-track-step${
                      STATUS_FLOW.indexOf(order.status) >= i ? " done" : ""
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
                      <span className="order-item-tracking">Tracking: {item.tracking_number}</span>
                    )}
                  </div>
                  <span className="order-item-price">
                    ${(Number(item.unit_price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
