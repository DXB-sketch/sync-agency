import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TIERS } from "../lib/tiers";

const TIER_ORDER = ["pro", "elite", "vip"];
const EMPTY_FORM = { name: "", description: "", price: "" };

async function uploadImage(file, folder) {
  if (!file) return null;
  const path = `${folder}/${Date.now()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error } = await supabase.storage
    .from("product-images")
    .upload(path, file, { contentType: file.type });
  if (error) throw error;
  return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
}

export default function ProductPoolPage() {
  const { profile: admin } = useAuth();
  const [pool, setPool] = useState([]);
  const [members, setMembers] = useState([]);
  const [fill, setFill] = useState({}); // member_id -> non-bonus active product count
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const healedRef = useRef(false);

  // Per-tier pool add form
  const [forms, setForms] = useState({ pro: EMPTY_FORM, elite: EMPTY_FORM, vip: EMPTY_FORM });
  const [files, setFiles] = useState({});
  const [busy, setBusy] = useState(null); // "add-pro" | "dist-pro" | "give" | null

  // Give-to-members form
  const [give, setGive] = useState(EMPTY_FORM);
  const [giveFile, setGiveFile] = useState(null);
  const [giveBonus, setGiveBonus] = useState(false);
  const [selected, setSelected] = useState({});

  const load = useCallback(async () => {
    const [{ data: pp }, { data: mem }, { data: prods }] = await Promise.all([
      supabase.from("pool_products").select("*, profiles!pool_products_assigned_member_id_fkey(email)").order("created_at", { ascending: false }),
      supabase
        .from("profiles")
        .select("id, email, full_name, tier, subscription_active")
        .eq("role", "member")
        .not("tier", "is", null)
        .order("email"),
      supabase.from("products").select("id, member_id, is_bonus, stripe_price_id").eq("active", true),
    ]);
    setPool(pp ?? []);
    setMembers(mem ?? []);
    const counts = {};
    (prods ?? []).forEach((p) => {
      if (!p.is_bonus) counts[p.member_id] = (counts[p.member_id] ?? 0) + 1;
    });
    setFill(counts);

    // Heal products still missing a Stripe price (e.g. auto-assigned by the
    // slot-opened trigger, which can't call Stripe). Once per visit, non-blocking.
    const unlinked = (prods ?? []).filter((p) => !p.stripe_price_id);
    if (!healedRef.current && unlinked.length > 0) {
      healedRef.current = true;
      (async () => {
        for (const p of unlinked) {
          await supabase.functions.invoke("create-stripe-product", { body: { product_id: p.id } });
        }
      })();
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function addToPool(e, tier) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(`add-${tier}`);
    try {
      const form = forms[tier];
      const image_url = await uploadImage(files[tier], "pool");
      const { error: insErr } = await supabase.from("pool_products").insert({
        tier,
        name: form.name,
        description: form.description || null,
        price: Number(form.price),
        image_url,
        created_by: admin.id,
      });
      if (insErr) throw insErr;
      setForms((f) => ({ ...f, [tier]: EMPTY_FORM }));
      setFiles((f) => ({ ...f, [tier]: null }));
      await load();
    } catch (err) {
      setError(err.message ?? "Could not add product to pool");
    }
    setBusy(null);
  }

  async function distribute(tier) {
    setError(null);
    setNotice(null);
    setBusy(`dist-${tier}`);
    try {
      const { data: assignedIds, error: rpcErr } = await supabase.rpc("admin_distribute_pool", {
        p_tier: tier,
      });
      if (rpcErr) throw rpcErr;
      // Link each newly assigned product to Stripe (non-fatal, same as manual adds)
      for (const productId of assignedIds ?? []) {
        await supabase.functions.invoke("create-stripe-product", {
          body: { product_id: productId },
        });
      }
      const n = assignedIds?.length ?? 0;
      setNotice(
        n === 0
          ? `No ${TIERS[tier].short} members have a free slot right now — products stay pooled and auto-assign when a slot opens.`
          : `Distributed ${n} product${n === 1 ? "" : "s"} to ${TIERS[tier].short} members.`
      );
      await load();
    } catch (err) {
      setError(err.message ?? "Distribution failed");
    }
    setBusy(null);
  }

  async function giveToMembers(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const ids = Object.keys(selected).filter((id) => selected[id]);
    if (ids.length === 0) {
      setError("Select at least one member.");
      return;
    }
    setBusy("give");
    try {
      const image_url = await uploadImage(giveFile, "give");
      const { data: inserted, error: insErr } = await supabase
        .from("products")
        .insert(
          ids.map((member_id) => ({
            member_id,
            name: give.name,
            description: give.description || null,
            price: Number(give.price),
            image_url,
            is_bonus: giveBonus,
            created_by: admin.id,
          }))
        )
        .select("id");
      if (insErr) throw insErr;
      for (const row of inserted ?? []) {
        await supabase.functions.invoke("create-stripe-product", { body: { product_id: row.id } });
      }
      setNotice(`Gave "${give.name}" to ${ids.length} member${ids.length === 1 ? "" : "s"}.`);
      setGive(EMPTY_FORM);
      setGiveFile(null);
      setGiveBonus(false);
      setSelected({});
      await load();
    } catch (err) {
      setError(err.message ?? "Could not give product");
    }
    setBusy(null);
  }

  function formFields(form, setter, fileSetter, actions = null) {
    return (
      <div className="admin-form-grid">
        <label className="auth-label">
          Name
          <input
            className="auth-input"
            value={form.name}
            onChange={(e) => setter({ ...form, name: e.target.value })}
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
            onChange={(e) => setter({ ...form, price: e.target.value })}
            required
          />
        </label>
        <label className="auth-label">
          Description
          <input
            className="auth-input"
            value={form.description}
            onChange={(e) => setter({ ...form, description: e.target.value })}
          />
        </label>
        <label className="auth-label">
          Image
          <input
            className="auth-input"
            type="file"
            accept="image/*"
            onChange={(e) => fileSetter(e.target.files?.[0] ?? null)}
          />
        </label>
        {actions}
      </div>
    );
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Product Pool</h1>
        <p className="portal-sub">
          Drop products into a tier's pool, then press Distribute — each product goes to one
          member, prioritising whoever has the lowest share of their slot limit filled. Products
          that can't be placed wait in the pool and auto-assign when a slot opens.
        </p>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {notice && <p className="admin-notice">{notice}</p>}

      {TIER_ORDER.map((tier) => {
        const waiting = pool.filter((p) => p.tier === tier && !p.assigned_member_id);
        const assigned = pool.filter((p) => p.tier === tier && p.assigned_member_id).slice(0, 8);
        const tierMembers = members.filter((m) => m.tier === tier && m.subscription_active);
        const openSlots = tierMembers.reduce(
          (sum, m) => sum + Math.max(TIERS[tier].productLimit - (fill[m.id] ?? 0), 0),
          0
        );
        return (
          <div key={tier} className="admin-product-form pool-tier">
            <div className="pool-tier-head">
              <h2 className="dash-card-title">{TIERS[tier].name} pool</h2>
              <span className="pool-tier-stats">
                {waiting.length} waiting · {tierMembers.length} eligible members · {openSlots} open
                slots
              </span>
            </div>

            <form onSubmit={(e) => addToPool(e, tier)}>
              {formFields(
                forms[tier],
                (next) => setForms((f) => ({ ...f, [tier]: next })),
                (file) => setFiles((f) => ({ ...f, [tier]: file })),
                <>
                  <div className="pool-form-action">
                    <button className="btn-ghost admin-view-btn" type="submit" disabled={busy === `add-${tier}`}>
                      {busy === `add-${tier}` ? "Adding…" : "Add to pool"}
                    </button>
                  </div>
                  <div className="pool-form-action">
                    <button
                      className="btn-gold"
                      type="button"
                      disabled={busy === `dist-${tier}` || waiting.length === 0}
                      onClick={() => distribute(tier)}
                    >
                      {busy === `dist-${tier}` ? "Distributing…" : `Distribute now (${waiting.length})`}
                    </button>
                  </div>
                </>
              )}
            </form>

            {(waiting.length > 0 || assigned.length > 0) && (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Price</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {waiting.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div className="admin-product-cell">
                            {p.image_url && <img src={p.image_url} alt="" />}
                            {p.name}
                          </div>
                        </td>
                        <td>${Number(p.price).toFixed(2)}</td>
                        <td>
                          {p.released ? (
                            <span className="admin-warn">Waiting for a free slot</span>
                          ) : (
                            "In pool — not distributed yet"
                          )}
                        </td>
                      </tr>
                    ))}
                    {assigned.map((p) => (
                      <tr key={p.id} className="admin-row-inactive">
                        <td>
                          <div className="admin-product-cell">
                            {p.image_url && <img src={p.image_url} alt="" />}
                            {p.name}
                          </div>
                        </td>
                        <td>${Number(p.price).toFixed(2)}</td>
                        <td>→ {p.profiles?.email ?? "assigned"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      <form className="admin-product-form pool-tier" onSubmit={giveToMembers}>
        <div className="pool-tier-head">
          <h2 className="dash-card-title">Give a product to specific members</h2>
          <span className="pool-tier-stats">Creates a copy for every member you tick</span>
        </div>
        {formFields(give, setGive, setGiveFile)}
        <label className="pool-bonus-check">
          <input
            type="checkbox"
            checked={giveBonus}
            onChange={(e) => setGiveBonus(e.target.checked)}
          />
          Bonus product — doesn't count toward their slot limit
        </label>
        <div className="pool-member-list">
          {members.map((m) => {
            const cap = TIERS[m.tier].productLimit;
            const used = fill[m.id] ?? 0;
            const atCap = used >= cap;
            const disabled = !giveBonus && atCap;
            return (
              <label key={m.id} className={`pool-member${disabled ? " pool-member-disabled" : ""}`}>
                <input
                  type="checkbox"
                  checked={!!selected[m.id] && !disabled}
                  disabled={disabled}
                  onChange={(e) => setSelected((s) => ({ ...s, [m.id]: e.target.checked }))}
                />
                <span className="pool-member-name">{m.full_name || m.email}</span>
                <span className="pool-member-meta">
                  {TIERS[m.tier].short} · {used}/{cap} slots{atCap ? " · full" : ""}
                  {!m.subscription_active ? " · locked" : ""}
                </span>
              </label>
            );
          })}
          {members.length === 0 && <p className="portal-sub">No members with a tier yet.</p>}
        </div>
        <button className="btn-gold" type="submit" disabled={busy === "give"}>
          {busy === "give" ? "Giving…" : giveBonus ? "Give as bonus product" : "Give product"}
        </button>
      </form>
    </div>
  );
}
