import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TIERS } from "../lib/tiers";
import { uploadProductImages } from "../lib/productImages";
import { CATEGORIES } from "../lib/categories";

const TABS = ["Account", "Products", "Orders", "Pathway", "Achievements"];
const TIER_OPTIONS = [
  ["free", "Free Dashboard"],
  ["pro", "Pro Accelerator"],
  ["elite", "Elite Scale"],
  ["vip", "VIP Inner Circle"],
];

export default function ClientDetailPage() {
  const { id } = useParams();
  const { profile: admin } = useAuth();
  const [client, setClient] = useState(null);
  const [tab, setTab] = useState("Account");
  const [account, setAccount] = useState(null);
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountSaved, setAccountSaved] = useState(false);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [progress, setProgress] = useState([]);
  const [achievements, setAchievements] = useState([]);
  const [error, setError] = useState(null);

  // Product form state
  const [form, setForm] = useState({ name: "", description: "", price: "" });
  const [isBonus, setIsBonus] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [priceEdits, setPriceEdits] = useState({});
  const [categoryFilter, setCategoryFilter] = useState("all");

  const load = useCallback(async () => {
    const [{ data: c }, { data: pr }, { data: o }, { data: pg }, { data: ma }] =
      await Promise.all([
        supabase.from("profiles").select("*").eq("id", id).single(),
        supabase.from("products").select("*").eq("member_id", id).order("created_at"),
        supabase
          .from("orders")
          .select("*, order_items(*, products(name))")
          .eq("member_id", id)
          .order("created_at", { ascending: false }),
        supabase
          .from("member_pathway_progress")
          .select("*, pathway_nodes(title, phase)")
          .eq("member_id", id),
        supabase
          .from("member_achievements")
          .select("*, achievements(title)")
          .eq("member_id", id),
      ]);
    setClient(c);
    if (c) {
      setAccount({
        tier: c.tier ?? "free",
        billing_type: c.billing_type ?? "lifetime",
        tier_price_paid: c.tier_price_paid ?? "",
        subscription_active: c.subscription_active,
      });
    }
    setProducts(pr ?? []);
    setOrders(o ?? []);
    setProgress(pg ?? []);
    setAchievements(ma ?? []);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveAccount(e) {
    e.preventDefault();
    setError(null);
    setAccountSaved(false);
    setAccountSaving(true);
    const isPaid = account.tier !== "free";
    const { error: rpcErr } = await supabase.rpc("admin_set_member_tier", {
      p_member_id: id,
      p_tier: account.tier,
      p_billing: isPaid ? account.billing_type : null,
      p_price_paid:
        !isPaid || account.tier_price_paid === "" ? null : Number(account.tier_price_paid),
      p_active: account.subscription_active,
    });
    if (rpcErr) setError(rpcErr.message);
    else setAccountSaved(true);
    await load();
    setAccountSaving(false);
  }

  async function addProduct(e) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const image_urls = await uploadProductImages(imageFiles, id);
      const { data: product, error: insErr } = await supabase
        .from("products")
        .insert({
          member_id: id,
          name: form.name,
          description: form.description || null,
          price: Number(form.price),
          image_url: image_urls[0] ?? null,
          image_urls: image_urls.length ? image_urls : null,
          is_bonus: isBonus,
          created_by: admin.id,
        })
        .select()
        .single();
      if (insErr) throw insErr;

      // Create the Stripe Product/Price (non-fatal until Stripe keys are configured)
      const { data: fnData, error: fnErr } = await supabase.functions.invoke(
        "create-stripe-product",
        { body: { product_id: product.id } }
      );
      if (fnErr || fnData?.error) {
        setError("Product saved. Stripe price not created yet (Stripe keys not configured?).");
      }
      setForm({ name: "", description: "", price: "" });
      setIsBonus(false);
      setImageFiles([]);
      await load();
    } catch (err) {
      setError(err.message ?? "Could not add product");
    }
    setSaving(false);
  }

  async function savePrice(productId) {
    const newPrice = Number(priceEdits[productId]);
    if (!Number.isFinite(newPrice) || newPrice <= 0) return;
    setError(null);
    const { data, error: fnErr } = await supabase.functions.invoke("update-stripe-price", {
      body: { product_id: productId, new_price: newPrice },
    });
    if (fnErr || data?.error) {
      setError(data?.error ?? "Price update failed");
    }
    setPriceEdits((p) => ({ ...p, [productId]: undefined }));
    await load();
  }

  async function toggleActive(product) {
    await supabase.from("products").update({ active: !product.active }).eq("id", product.id);
    await load();
  }

  async function deleteProduct(product) {
    if (!window.confirm(`Delete "${product.name}" from this client's store? This can't be undone.`))
      return;
    setError(null);
    const { error: delErr } = await supabase.from("products").delete().eq("id", product.id);
    if (delErr) setError(delErr.message);
    await load();
  }

  if (!client) {
    return (
      <div className="portal-page">
        <p className="portal-sub">Loading client…</p>
      </div>
    );
  }

  return (
    <div className="portal-page">
      <Link to="/admin" className="admin-back">
        ← All clients
      </Link>
      <div className="portal-page-head portal-page-head-row">
        <div>
          <h1 className="portal-h1">{client.full_name || client.email}</h1>
          <p className="portal-sub">
            {client.email} ·{" "}
            {client.tier
              ? `${TIERS[client.tier].name}${client.billing_type ? ` (${client.billing_type})` : ""}`
              : "No tier linked"}{" "}
            · {client.subscription_active ? "Active" : "Subscription inactive"}
          </p>
        </div>
      </div>

      <div className="admin-tabs">
        {TABS.map((t) => (
          <button
            key={t}
            className={`admin-tab${tab === t ? " active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <p className="auth-error">{error}</p>}

      {tab === "Account" && account && (
        <form className="admin-product-form" onSubmit={saveAccount}>
          <h2 className="dash-card-title">Membership</h2>
          <p className="dash-card-sub">
            Manually set this member's tier — for purchases made before the portal existed,
            email mismatches, or comped accounts. Saving also links any waiting purchase
            records under their email.
          </p>
          <div className="admin-form-grid">
            <label className="auth-label">
              Tier
              <select
                className="auth-input"
                value={account.tier}
                onChange={(e) => setAccount({ ...account, tier: e.target.value })}
              >
                {TIER_OPTIONS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="auth-label">
              Billing type
              <select
                className="auth-input"
                value={account.billing_type}
                onChange={(e) => setAccount({ ...account, billing_type: e.target.value })}
                disabled={account.tier === "free"}
              >
                <option value="lifetime">Lifetime</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
            <label className="auth-label">
              Price paid (AUD) — drives upgrade proration
              <input
                className="auth-input"
                type="number"
                min="0"
                value={account.tier_price_paid}
                onChange={(e) => setAccount({ ...account, tier_price_paid: e.target.value })}
                disabled={account.tier === "free"}
              />
            </label>
            <label className="auth-label">
              Portal access
              <select
                className="auth-input"
                value={account.subscription_active ? "active" : "inactive"}
                onChange={(e) =>
                  setAccount({ ...account, subscription_active: e.target.value === "active" })
                }
              >
                <option value="active">Active</option>
                <option value="inactive">Locked (subscription inactive)</option>
              </select>
            </label>
          </div>
          <div className="admin-order-actions">
            <button className="btn-gold" type="submit" disabled={accountSaving}>
              {accountSaving ? "Saving…" : "Save membership"}
            </button>
            {accountSaved && <span className="ach-status ach-status-verified">Saved ✓</span>}
          </div>
        </form>
      )}

      {tab === "Products" && (() => {
        const cap = client.tier ? TIERS[client.tier].productLimit : 0;
        const used = products.filter((p) => p.active && !p.is_bonus).length;
        const atCap = client.tier && used >= cap;
        const shownProducts = products.filter(
          (p) => categoryFilter === "all" || p.category === categoryFilter
        );
        return (
        <>
          <form className="admin-product-form" onSubmit={addProduct}>
            <h2 className="dash-card-title">Add a product to this client's store</h2>
            <p className="dash-card-sub">
              {client.tier
                ? `${used}/${cap} slots used (${TIERS[client.tier].short} limit).`
                : "No tier linked — slot limit unknown."}
              {atCap && !isBonus && " Slot limit reached — tick Bonus to add anyway."}
            </p>
            <div className="admin-form-grid">
              <label className="auth-label">
                Name
                <input
                  className="auth-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </label>
              <label className="auth-label">
                Price (AUD) — what the member pays
                <input
                  className="auth-input"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                />
              </label>
              <label className="auth-label">
                Description
                <input
                  className="auth-input"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <label className="auth-label">
                Images (first = cover)
                <input
                  className="auth-input"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setImageFiles([...(e.target.files ?? [])])}
                />
              </label>
            </div>
            <label className="pool-bonus-check">
              <input
                type="checkbox"
                checked={isBonus}
                onChange={(e) => setIsBonus(e.target.checked)}
              />
              Bonus product — doesn't count toward their slot limit
            </label>
            <button className="btn-gold" type="submit" disabled={saving || (atCap && !isBonus)}>
              {saving ? "Adding…" : isBonus ? "Add bonus product" : "Add product"}
            </button>
          </form>

          <select
            className="auth-input admin-category-filter"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ marginBottom: 14 }}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Stripe</th>
                  <th>Active</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shownProducts.map((p) => (
                  <tr key={p.id} className={p.active ? "" : "admin-row-inactive"}>
                    <td>
                      <div className="admin-product-cell">
                        {p.image_url && <img src={p.image_url} alt="" />}
                        {p.name}
                        {p.is_bonus && <span className="bonus-badge">Bonus</span>}
                      </div>
                    </td>
                    <td>
                      <div className="admin-price-edit">
                        <input
                          className="auth-input admin-price-input"
                          type="number"
                          step="0.01"
                          value={priceEdits[p.id] ?? Number(p.price)}
                          onChange={(e) =>
                            setPriceEdits((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                        />
                        {priceEdits[p.id] !== undefined &&
                          Number(priceEdits[p.id]) !== Number(p.price) && (
                            <button className="btn-ghost admin-view-btn" onClick={() => savePrice(p.id)}>
                              Save
                            </button>
                          )}
                      </div>
                    </td>
                    <td>{p.stripe_price_id ? "Linked" : <span className="admin-warn">Pending</span>}</td>
                    <td>{p.active ? "Yes" : "No"}</td>
                    <td>
                      <button className="btn-ghost admin-view-btn" onClick={() => toggleActive(p)}>
                        {p.active ? "Deactivate" : "Activate"}
                      </button>{" "}
                      <button className="btn-ghost admin-view-btn" onClick={() => deleteProduct(p)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
        );
      })()}

      {tab === "Orders" &&
        (orders.length === 0 ? (
          <div className="portal-empty">
            <p>No orders from this client.</p>
          </div>
        ) : (
          orders.map((o) => (
            <div key={o.id} className="order-card">
              <div className="order-head">
                <span className={`order-status order-status-${o.status}`}>{o.status}</span>
                <span className="order-total">${Number(o.total_amount).toFixed(2)}</span>
              </div>
              <div className="order-items">
                {o.order_items.map((it) => (
                  <div key={it.id} className="order-item">
                    <div className="order-item-info">
                      <span className="checkout-item-name">
                        {it.products?.name ?? it.product_name} × {it.quantity}
                      </span>
                      <span className="order-item-ship">
                        → {it.ship_name}, {it.ship_address1}, {it.ship_city} {it.ship_postcode},{" "}
                        {it.ship_country}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ))}

      {tab === "Pathway" &&
        (progress.length === 0 ? (
          <div className="portal-empty">
            <p>No pathway progress yet.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th>Step</th>
                  <th>Status</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {progress
                  .sort((a, b) => (a.pathway_nodes?.phase ?? 0) - (b.pathway_nodes?.phase ?? 0))
                  .map((row) => (
                    <tr key={row.node_id}>
                      <td>{row.pathway_nodes?.phase}</td>
                      <td>{row.pathway_nodes?.title}</td>
                      <td>{row.status}</td>
                      <td>
                        {row.completed_at ? new Date(row.completed_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}

      {tab === "Achievements" &&
        (achievements.length === 0 ? (
          <div className="portal-empty">
            <p>No achievement activity yet.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Achievement</th>
                  <th>Status</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {achievements.map((row) => (
                  <tr key={row.id}>
                    <td>{row.achievements?.title}</td>
                    <td>{row.status}</td>
                    <td>
                      {row.submitted_at ? new Date(row.submitted_at).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}
