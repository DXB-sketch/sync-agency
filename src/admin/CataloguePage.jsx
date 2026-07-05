import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TIERS } from "../lib/tiers";

// Groups every product ever added to a client store into one catalogue row per
// distinct name + price, so the same item given to many members shows once.
function buildCatalogue(products, membersById) {
  const map = new Map();
  for (const p of products) {
    const key = `${p.name.trim().toLowerCase()}|${Number(p.price)}`;
    const entry = map.get(key);
    if (entry) {
      entry.ids.push(p.id);
      entry.storeCount += 1;
      if (!entry.image_url && p.image_url) entry.image_url = p.image_url;
      if (!entry.description && p.description) entry.description = p.description;
      if (!entry.stripe_price_id && p.stripe_price_id) entry.stripe_price_id = p.stripe_price_id;
    } else {
      map.set(key, {
        key,
        ids: [p.id],
        name: p.name,
        description: p.description,
        price: Number(p.price),
        image_url: p.image_url,
        stripe_price_id: p.stripe_price_id,
        storeCount: 1,
        firstMember: membersById[p.member_id]?.email ?? null,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export default function CataloguePage() {
  const { profile: admin } = useAuth();
  const [catalogue, setCatalogue] = useState([]);
  const [members, setMembers] = useState([]);
  const [fill, setFill] = useState({}); // member_id -> non-bonus active product count
  const [memberNames, setMemberNames] = useState({}); // member_id -> set of product names
  const [selected, setSelected] = useState({});
  const [target, setTarget] = useState("");
  const [asBonus, setAsBonus] = useState(false);
  const [busy, setBusy] = useState(null); // "add" | "merge" | null
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    const [{ data: prods }, { data: mem }] = await Promise.all([
      supabase
        .from("products")
        .select("id, member_id, name, description, price, image_url, is_bonus, active, stripe_price_id")
        .order("created_at"),
      supabase
        .from("profiles")
        .select("id, email, full_name, tier, subscription_active")
        .eq("role", "member")
        .not("tier", "is", null)
        .order("email"),
    ]);
    const membersById = Object.fromEntries((mem ?? []).map((m) => [m.id, m]));
    setCatalogue(buildCatalogue(prods ?? [], membersById));
    setMembers(mem ?? []);
    const counts = {};
    const names = {};
    (prods ?? []).forEach((p) => {
      if (p.active && !p.is_bonus) counts[p.member_id] = (counts[p.member_id] ?? 0) + 1;
      if (p.active) {
        (names[p.member_id] ??= new Set()).add(p.name.trim().toLowerCase());
      }
    });
    setFill(counts);
    setMemberNames(names);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const picked = catalogue.filter((c) => selected[c.key]);
  const targetMember = members.find((m) => m.id === target);
  const targetCap = targetMember ? TIERS[targetMember.tier].productLimit : 0;
  const targetUsed = targetMember ? fill[targetMember.id] ?? 0 : 0;
  const overCap =
    targetMember && !asBonus && targetUsed + picked.length > targetCap;

  async function addToStore(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (picked.length === 0) return setError("Select at least one product.");
    if (!targetMember) return setError("Choose a client store.");
    if (overCap) {
      return setError(
        `That's ${picked.length} product${picked.length === 1 ? "" : "s"} for ${
          targetCap - targetUsed
        } free slot${targetCap - targetUsed === 1 ? "" : "s"} — untick some, or add as bonus.`
      );
    }
    const owned = memberNames[targetMember.id] ?? new Set();
    const toAdd = picked.filter((c) => !owned.has(c.name.trim().toLowerCase()));
    const skipped = picked.length - toAdd.length;
    if (toAdd.length === 0) {
      return setError("This client already has all the selected products.");
    }
    setBusy("add");
    try {
      const { data: inserted, error: insErr } = await supabase
        .from("products")
        .insert(
          toAdd.map((c) => ({
            member_id: targetMember.id,
            name: c.name,
            description: c.description || null,
            price: c.price,
            image_url: c.image_url,
            is_bonus: asBonus,
            created_by: admin.id,
          }))
        )
        .select("id");
      if (insErr) throw insErr;
      // Links to the existing Stripe product/price — no duplicates created
      for (const row of inserted ?? []) {
        await supabase.functions.invoke("create-stripe-product", { body: { product_id: row.id } });
      }
      setNotice(
        `Added ${toAdd.length} product${toAdd.length === 1 ? "" : "s"} to ${
          targetMember.full_name || targetMember.email
        }'s store.${skipped ? ` Skipped ${skipped} already in their store.` : ""}`
      );
      setSelected({});
      setAsBonus(false);
      await load();
    } catch (err) {
      setError(err.message ?? "Could not add products");
    }
    setBusy(null);
  }

  async function deleteFromCatalogue(entry) {
    if (
      !window.confirm(
        `Delete "${entry.name}" from the catalogue and remove it from ${entry.storeCount} client store${
          entry.storeCount === 1 ? "" : "s"
        }? This can't be undone.`
      )
    )
      return;
    setError(null);
    setNotice(null);
    const { error: delErr } = await supabase.from("products").delete().in("id", entry.ids);
    if (delErr) {
      setError(delErr.message);
    } else {
      setNotice(`Deleted "${entry.name}" from the catalogue and all client stores.`);
      setSelected((s) => ({ ...s, [entry.key]: false }));
    }
    await load();
  }

  async function mergeDuplicates() {
    setError(null);
    setNotice(null);
    setBusy("merge");
    const { data, error: fnErr } = await supabase.functions.invoke("merge-stripe-duplicates", {
      body: {},
    });
    if (fnErr || data?.error) {
      setError(data?.error ?? "Merge failed — is the function deployed and Stripe configured?");
    } else {
      setNotice(
        `Stripe cleanup done: ${data.products_archived} duplicate product${
          data.products_archived === 1 ? "" : "s"
        } archived, ${data.rows_repointed} store product${
          data.rows_repointed === 1 ? "" : "s"
        } relinked.`
      );
      await load();
    }
    setBusy(null);
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head portal-page-head-row">
        <div>
          <h1 className="portal-h1">Catalogue</h1>
          <p className="portal-sub">
            Every product that's been added to any client's store. Tick one or more, pick a
            client, and add them to that store.
          </p>
        </div>
        <button
          className="btn-ghost admin-view-btn"
          type="button"
          disabled={busy === "merge"}
          onClick={mergeDuplicates}
        >
          {busy === "merge" ? "Merging…" : "Merge Stripe duplicates"}
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}
      {notice && <p className="admin-notice">{notice}</p>}

      <form className="admin-product-form" onSubmit={addToStore}>
        <h2 className="dash-card-title">Add selected to a client store</h2>
        <p className="dash-card-sub">
          {picked.length === 0
            ? "No products selected yet."
            : `${picked.length} selected.`}{" "}
          {targetMember &&
            `${targetUsed}/${targetCap} slots used (${TIERS[targetMember.tier].short}).`}
        </p>
        <div className="admin-form-grid">
          <label className="auth-label">
            Client store
            <select
              className="auth-input"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option value="">Choose a client…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email} — {TIERS[m.tier].short} · {fill[m.id] ?? 0}/
                  {TIERS[m.tier].productLimit} slots
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="pool-bonus-check">
          <input type="checkbox" checked={asBonus} onChange={(e) => setAsBonus(e.target.checked)} />
          Bonus products — don't count toward the slot limit
        </label>
        <button
          className="btn-gold"
          type="submit"
          disabled={busy === "add" || picked.length === 0 || !target || overCap}
        >
          {busy === "add"
            ? "Adding…"
            : `Add ${picked.length || ""} product${picked.length === 1 ? "" : "s"} to store`}
        </button>
        {overCap && (
          <p className="admin-warn">
            Not enough free slots — untick some products or add them as bonus.
          </p>
        )}
      </form>

      {catalogue.length === 0 ? (
        <div className="portal-empty">
          <p>No products have been added to any store yet.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th />
                <th>Product</th>
                <th>Price</th>
                <th>In stores</th>
                <th>Stripe</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {catalogue.map((c) => (
                <tr key={c.key}>
                  <td>
                    <input
                      type="checkbox"
                      checked={!!selected[c.key]}
                      onChange={(e) =>
                        setSelected((s) => ({ ...s, [c.key]: e.target.checked }))
                      }
                    />
                  </td>
                  <td>
                    <div className="admin-product-cell">
                      {c.image_url && <img src={c.image_url} alt="" />}
                      <div>
                        {c.name}
                        {c.description && <div className="portal-sub">{c.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td>${c.price.toFixed(2)}</td>
                  <td>{c.storeCount}</td>
                  <td>
                    {c.stripe_price_id ? "Linked" : <span className="admin-warn">Pending</span>}
                  </td>
                  <td>
                    <button
                      className="btn-ghost admin-view-btn"
                      type="button"
                      onClick={() => deleteFromCatalogue(c)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
