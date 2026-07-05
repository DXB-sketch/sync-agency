import { useState } from "react";
import { Link } from "react-router-dom";
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

export default function CheckoutPage() {
  const { profile } = useAuth();
  const [items, setItems] = useState(loadCart());
  const [error, setError] = useState(null);
  const [paying, setPaying] = useState(false);

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

  if (items.length === 0) {
    return (
      <div className="portal-page">
        <div className="portal-page-head">
          <h1 className="portal-h1">Checkout</h1>
        </div>
        <div className="portal-empty">
          <p>Your order is empty.</p>
          <Link to="/portal/products" className="btn-gold" style={{ marginTop: 20 }}>
            Browse products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Checkout</h1>
        <p className="portal-sub">
          Each item ships to its own buyer — fill in the shipping address per item, then pay for
          everything in one payment.
        </p>
      </div>

      <div className="checkout-items">
        {items.map((item, idx) => (
          <div key={item.line_id} className="checkout-item">
            <div className="checkout-item-head">
              <div className="checkout-item-info">
                {item.image_url && <img src={item.image_url} alt="" className="checkout-thumb" />}
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
                        update(item.line_id, { quantity: Math.max(1, Number(e.target.value) || 1) })
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
        {incomplete && <p className="checkout-hint">Fill in every item's shipping address to pay.</p>}
        <button className="btn-gold" disabled={incomplete || paying} onClick={pay}>
          {paying ? "Preparing payment…" : "Pay once for everything"}
        </button>
      </div>
    </div>
  );
}
