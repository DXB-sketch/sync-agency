import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TIERS } from "../lib/tiers";
import { productImages, uploadProductImages } from "../lib/productImages";
import { CATEGORIES } from "../lib/categories";

const TIER_ORDER = ["free", "pro", "elite", "vip"];
const EMPTY_FORM = {
  name: "",
  description: "",
  price: "",
  listing_price: "",
  discount_price: "",
  category: "",
};
const EMPTY_DEST = { mode: "clients", tier: "pro", memberIds: {}, asBonus: false };

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
      if (entry.images.length === 0) entry.images = productImages(p);
      if (!entry.description && p.description) entry.description = p.description;
      if (!entry.stripe_price_id && p.stripe_price_id) entry.stripe_price_id = p.stripe_price_id;
      if (entry.listing_price == null && p.listing_price != null) entry.listing_price = Number(p.listing_price);
      if (entry.discount_price == null && p.discount_price != null) entry.discount_price = Number(p.discount_price);
      if (entry.category == null && p.category) entry.category = p.category;
      if (!entry.supplierProduct && p.supplier_products) entry.supplierProduct = p.supplier_products;
    } else {
      map.set(key, {
        key,
        ids: [p.id],
        name: p.name,
        description: p.description,
        price: Number(p.price),
        listing_price: p.listing_price != null ? Number(p.listing_price) : null,
        discount_price: p.discount_price != null ? Number(p.discount_price) : null,
        image_url: p.image_url,
        images: productImages(p),
        stripe_price_id: p.stripe_price_id,
        storeCount: 1,
        firstMember: membersById[p.member_id]?.email ?? null,
        category: p.category ?? null,
        supplierProduct: p.supplier_products ?? null,
      });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

// One place to pick where products go: specific client(s) or a tier's pool.
function DestinationPicker({ dest, onChange, members, fill }) {
  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();
  const shown = members.filter(
    (m) =>
      !q ||
      (m.full_name ?? "").toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q)
  );
  const pickedCount = members.filter((m) => dest.memberIds[m.id]).length;

  return (
    <>
      <div className="admin-form-grid">
        <label className="auth-label">
          Assign to
          <select
            className="auth-input"
            value={dest.mode}
            onChange={(e) => onChange({ ...dest, mode: e.target.value })}
          >
            <option value="clients">Specific client(s)</option>
            <option value="pool">Distribution pool</option>
          </select>
        </label>
        {dest.mode === "pool" && (
          <label className="auth-label">
            Pool tier
            <select
              className="auth-input"
              value={dest.tier}
              onChange={(e) => onChange({ ...dest, tier: e.target.value })}
            >
              {TIER_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TIERS[t].name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {dest.mode === "clients" && (
        <>
          <label className="pool-bonus-check">
            <input
              type="checkbox"
              checked={dest.asBonus}
              onChange={(e) => onChange({ ...dest, asBonus: e.target.checked })}
            />
            Bonus products — don't count toward slot limits
          </label>
          <input
            className="auth-input admin-search"
            placeholder={`Search ${members.length} clients…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="pool-member-list">
            {shown.map((m) => {
              const cap = TIERS[m.tier].productLimit;
              const used = fill[m.id] ?? 0;
              const atCap = used >= cap;
              const disabled = !dest.asBonus && atCap;
              return (
                <label
                  key={m.id}
                  className={`pool-member${disabled ? " pool-member-disabled" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={!!dest.memberIds[m.id] && !disabled}
                    disabled={disabled}
                    onChange={(e) =>
                      onChange({
                        ...dest,
                        memberIds: { ...dest.memberIds, [m.id]: e.target.checked },
                      })
                    }
                  />
                  <span className="pool-member-name">{m.full_name || m.email}</span>
                  <span className="pool-member-meta">
                    {TIERS[m.tier].short} · {used}/{cap} slots{atCap ? " · full" : ""}
                    {!m.subscription_active ? " · locked" : ""}
                  </span>
                </label>
              );
            })}
            {shown.length === 0 && <p className="portal-sub">No clients match.</p>}
          </div>
          <p className="dash-card-sub">
            {pickedCount} client{pickedCount === 1 ? "" : "s"} selected.
          </p>
        </>
      )}
    </>
  );
}

export default function ProductsAdminPage() {
  const { profile: admin } = useAuth();
  const [catalogue, setCatalogue] = useState([]);
  const [pool, setPool] = useState([]);
  const [members, setMembers] = useState([]);
  const [fill, setFill] = useState({}); // member_id -> non-bonus active product count
  const [memberNames, setMemberNames] = useState({}); // member_id -> set of product names
  const [selected, setSelected] = useState({});
  const [productSearch, setProductSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [busy, setBusy] = useState(null); // "assign" | "create" | "merge" | "delete" | "images" | "fill" | "dist-pro" | ... | null
  const [editingImages, setEditingImages] = useState(null); // catalogue entry key | null
  const [editingPrices, setEditingPrices] = useState(null); // { key, listing, discount } | null
  const [linkerTarget, setLinkerTarget] = useState(null); // supplier-link modal target | null
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const healedRef = useRef(false);

  // Tier filter for the bulk "fill members to capacity" action
  const [fillTier, setFillTier] = useState("all");

  // Destination for assigning selected catalogue products
  const [catDest, setCatDest] = useState(EMPTY_DEST);
  // New-product form and its destination
  const [newForm, setNewForm] = useState(EMPTY_FORM);
  const [newFiles, setNewFiles] = useState([]);
  const [newDest, setNewDest] = useState(EMPTY_DEST);

  const load = useCallback(async () => {
    const [{ data: prods }, { data: mem }, { data: pp }] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id, member_id, name, description, price, listing_price, discount_price, image_url, image_urls, is_bonus, active, stripe_price_id, category, supplier_product_id, supplier_products(external_sku, stock_state, display_name)"
        )
        .order("created_at"),
      supabase
        .from("profiles")
        .select("id, email, full_name, tier, subscription_active")
        .eq("role", "member")
        .not("tier", "is", null)
        .order("email"),
      supabase
        .from("pool_products")
        .select(
          "*, profiles!pool_products_assigned_member_id_fkey(email), supplier_products(external_sku, stock_state, display_name)"
        )
        .order("created_at", { ascending: false }),
    ]);
    const membersById = Object.fromEntries((mem ?? []).map((m) => [m.id, m]));
    setCatalogue(buildCatalogue(prods ?? [], membersById));
    setMembers(mem ?? []);
    setPool(pp ?? []);
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

    // Heal products still missing a Stripe price (e.g. auto-assigned by the
    // slot-opened trigger, which can't call Stripe). Once per visit, non-blocking.
    const unlinked = (prods ?? []).filter((p) => p.active && !p.stripe_price_id);
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

  const picked = catalogue.filter((c) => selected[c.key]);
  const q = productSearch.trim().toLowerCase();
  const shownCatalogue = catalogue.filter(
    (c) =>
      (categoryFilter === "all" || c.category === categoryFilter) &&
      (!q || c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q))
  );

  // Sends items (name/description/price/images) to the chosen destination:
  // pool -> pool_products rows; clients -> one products row per client, with
  // per-client duplicate and slot-limit checks. Returns true on success.
  async function assignItems(items, dest, busyKey) {
    setError(null);
    setNotice(null);
    if (items.length === 0) {
      setError("Select at least one product.");
      return false;
    }
    setBusy(busyKey);
    try {
      if (dest.mode === "pool") {
        const { error: insErr } = await supabase.from("pool_products").insert(
          items.map((it) => ({
            tier: dest.tier,
            name: it.name,
            description: it.description || null,
            price: it.price,
            listing_price: it.listing_price ?? null,
            discount_price: it.discount_price ?? null,
            image_url: it.images[0] ?? null,
            image_urls: it.images.length ? it.images : null,
            category: it.category ?? null,
            created_by: admin.id,
          }))
        );
        if (insErr) throw insErr;
        setNotice(
          `Added ${items.length} product${items.length === 1 ? "" : "s"} to the ${
            TIERS[dest.tier].short
          } pool — press Distribute when ready.`
        );
      } else {
        const chosen = members.filter((m) => dest.memberIds[m.id]);
        if (chosen.length === 0) throw new Error("Select at least one client.");
        const rows = [];
        let skippedDup = 0;
        let skippedFull = 0;
        for (const m of chosen) {
          const owned = memberNames[m.id] ?? new Set();
          const toAdd = items.filter((it) => !owned.has(it.name.trim().toLowerCase()));
          if (toAdd.length === 0) {
            skippedDup += 1;
            continue;
          }
          if (!dest.asBonus) {
            const free = TIERS[m.tier].productLimit - (fill[m.id] ?? 0);
            if (toAdd.length > free) {
              skippedFull += 1;
              continue;
            }
          }
          rows.push(
            ...toAdd.map((it) => ({
              member_id: m.id,
              name: it.name,
              description: it.description || null,
              price: it.price,
              listing_price: it.listing_price ?? null,
              discount_price: it.discount_price ?? null,
              image_url: it.images[0] ?? null,
              image_urls: it.images.length ? it.images : null,
              category: it.category ?? null,
              is_bonus: dest.asBonus,
              created_by: admin.id,
            }))
          );
        }
        if (rows.length === 0) {
          throw new Error(
            "Nothing to add — every selected client already has these products or lacks free slots."
          );
        }
        const { data: inserted, error: insErr } = await supabase
          .from("products")
          .insert(rows)
          .select("id");
        if (insErr) throw insErr;
        // Links to the existing Stripe product/price — no duplicates created
        for (const row of inserted ?? []) {
          await supabase.functions.invoke("create-stripe-product", { body: { product_id: row.id } });
        }
        const added = chosen.length - skippedDup - skippedFull;
        let msg = `Added ${rows.length} product${rows.length === 1 ? "" : "s"} across ${added} client${
          added === 1 ? "" : "s"
        }.`;
        if (skippedDup) msg += ` Skipped ${skippedDup} who already had them.`;
        if (skippedFull) msg += ` Skipped ${skippedFull} without enough free slots (tick bonus to bypass).`;
        setNotice(msg);
      }
      await load();
      setBusy(null);
      return true;
    } catch (err) {
      setError(err.message ?? "Could not assign products");
      setBusy(null);
      return false;
    }
  }

  async function assignSelected(e) {
    e.preventDefault();
    const ok = await assignItems(
      picked.map((c) => ({
        name: c.name,
        description: c.description,
        price: c.price,
        listing_price: c.listing_price,
        discount_price: c.discount_price,
        images: c.images,
        category: c.category,
      })),
      catDest,
      "assign"
    );
    if (ok) {
      setSelected({});
      setCatDest(EMPTY_DEST);
    }
  }

  // Tops every eligible member up to their tier's product limit with a random
  // mix of catalogue products, skipping any product a member already owns.
  // The same product can go to many different members — only per-member
  // duplicates are avoided.
  async function fillMembers(tierFilter) {
    setError(null);
    setNotice(null);
    if (catalogue.length === 0) {
      setError("No products in the catalogue to assign.");
      return;
    }
    setBusy("fill");
    try {
      const targets = members.filter(
        (m) => m.subscription_active && (tierFilter === "all" || m.tier === tierFilter)
      );
      const rows = [];
      let filledCount = 0;
      let partialCount = 0;
      for (const m of targets) {
        const free = TIERS[m.tier].productLimit - (fill[m.id] ?? 0);
        if (free <= 0) continue;
        const owned = memberNames[m.id] ?? new Set();
        const eligible = catalogue.filter((c) => !owned.has(c.name.trim().toLowerCase()));
        for (let i = eligible.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
        }
        const toAdd = eligible.slice(0, free);
        if (toAdd.length === 0) continue;
        filledCount += 1;
        if (toAdd.length < free) partialCount += 1;
        rows.push(
          ...toAdd.map((it) => ({
            member_id: m.id,
            name: it.name,
            description: it.description || null,
            price: it.price,
            listing_price: it.listing_price ?? null,
            discount_price: it.discount_price ?? null,
            image_url: it.images[0] ?? null,
            image_urls: it.images.length ? it.images : null,
            category: it.category ?? null,
            is_bonus: false,
            created_by: admin.id,
          }))
        );
      }
      if (rows.length === 0) {
        throw new Error(
          "Nobody needed products — everyone targeted is already full or owns every catalogue item."
        );
      }
      const { data: inserted, error: insErr } = await supabase
        .from("products")
        .insert(rows)
        .select("id");
      if (insErr) throw insErr;
      for (const row of inserted ?? []) {
        await supabase.functions.invoke("create-stripe-product", { body: { product_id: row.id } });
      }
      let msg = `Filled ${filledCount} member${filledCount === 1 ? "" : "s"} with ${rows.length} product${
        rows.length === 1 ? "" : "s"
      }.`;
      if (partialCount)
        msg += ` ${partialCount} couldn't be fully filled (not enough distinct catalogue products left).`;
      setNotice(msg);
      await load();
    } catch (err) {
      setError(err.message ?? "Fill failed");
    }
    setBusy(null);
  }

  async function createProduct(e) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setBusy("create");
    let images;
    try {
      images = await uploadProductImages(newFiles, "pool");
    } catch (err) {
      setError(err.message ?? "Image upload failed");
      setBusy(null);
      return;
    }
    const ok = await assignItems(
      [
        {
          name: newForm.name,
          description: newForm.description,
          price: Number(newForm.price),
          listing_price: newForm.listing_price === "" ? null : Number(newForm.listing_price),
          discount_price: newForm.discount_price === "" ? null : Number(newForm.discount_price),
          images,
          category: newForm.category || null,
        },
      ],
      newDest,
      "create"
    );
    if (ok) {
      setNewForm(EMPTY_FORM);
      setNewFiles([]);
      setNewDest(EMPTY_DEST);
    }
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
    setBusy("delete");
    const { data: archData, error: archErr } = await supabase.functions.invoke(
      "archive-stripe-product",
      { body: { product_ids: entry.ids } }
    );
    if (archErr || archData?.error) {
      setError(archData?.error ?? "Could not archive it in Stripe — deletion cancelled.");
      setBusy(null);
      return;
    }
    const { error: delErr } = await supabase.from("products").delete().in("id", entry.ids);
    if (delErr) {
      setError(delErr.message);
    } else {
      setNotice(`Deleted "${entry.name}" from the catalogue, all client stores, and Stripe.`);
      setSelected((s) => ({ ...s, [entry.key]: false }));
    }
    await load();
    setBusy(null);
  }

  // Writes the member-facing listing/discount prices to every store copy,
  // plus any same-named pool items still waiting to be distributed.
  async function savePrices(entry, listing, discount) {
    setError(null);
    setBusy("prices");
    const prices = {
      listing_price: listing === "" ? null : Number(listing),
      discount_price: discount === "" ? null : Number(discount),
    };
    const { error: upErr } = await supabase.from("products").update(prices).in("id", entry.ids);
    if (upErr) {
      setError(upErr.message);
    } else {
      await supabase
        .from("pool_products")
        .update(prices)
        .eq("name", entry.name)
        .is("assigned_member_id", null);
      setEditingPrices(null);
    }
    await load();
    setBusy(null);
  }

  // Writes the category to every store copy, plus any same-named pool items
  // still waiting to be distributed (same pattern as savePrices).
  async function saveCategory(entry, category) {
    setError(null);
    setBusy("category");
    const value = category || null;
    const { error: upErr } = await supabase
      .from("products")
      .update({ category: value })
      .in("id", entry.ids);
    if (upErr) {
      setError(upErr.message);
    } else {
      await supabase
        .from("pool_products")
        .update({ category: value })
        .eq("name", entry.name)
        .is("assigned_member_id", null);
    }
    await load();
    setBusy(null);
  }

  // Clears the supplier link across every row a catalogue entry spans (or the
  // single pool row). Linking itself happens in the SupplierLinkerModal via
  // the cj-search edge function — this is a direct write under the existing
  // admin write policy, same as unassigning any other field.
  async function unlinkSupplier(target) {
    setError(null);
    setBusy("unlink");
    await supabase.from(target.table).update({ supplier_product_id: null }).in("id", target.allIds);
    await load();
    setBusy(null);
  }

  // Propagates a fresh supplier link (set by the modal on one row) across the
  // rest of a merged catalogue entry's store copies.
  async function onSupplierLinked(target, supplierProductId) {
    if (target.allIds.length > 1) {
      await supabase
        .from(target.table)
        .update({ supplier_product_id: supplierProductId })
        .in("id", target.allIds);
    }
    await load();
  }

  // Writes the new gallery to every store copy; first image is the cover.
  async function saveImages(entry, images) {
    setError(null);
    setBusy("images");
    const { error: upErr } = await supabase
      .from("products")
      .update({ image_urls: images.length ? images : null, image_url: images[0] ?? null })
      .in("id", entry.ids);
    if (upErr) setError(upErr.message);
    await load();
    setBusy(null);
  }

  async function addImages(entry, fileList) {
    const files = [...(fileList ?? [])];
    if (files.length === 0) return;
    setError(null);
    setBusy("images");
    try {
      const uploaded = await uploadProductImages(files, "catalogue");
      await saveImages(entry, [...entry.images, ...uploaded]);
    } catch (err) {
      setError(err.message ?? "Image upload failed");
      setBusy(null);
    }
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

  // Link badge + link/unlink buttons for one catalogue/pool row (docs/PHASE1_PLAN.md §3.3).
  function supplierCell(target) {
    const sp = target.supplierProduct;
    return (
      <div className="admin-supplier-cell">
        {sp ? (
          <span className="admin-supplier-linked">
            {sp.external_sku ?? sp.display_name ?? "linked"} · {sp.stock_state}
          </span>
        ) : (
          <span className="admin-warn">Not linked</span>
        )}
        <div>
          <button
            className="btn-ghost admin-view-btn"
            type="button"
            onClick={() => setLinkerTarget(target)}
          >
            {sp ? "Relink" : "Link supplier"}
          </button>{" "}
          {sp && (
            <button
              className="btn-ghost admin-view-btn"
              type="button"
              disabled={busy === "unlink"}
              onClick={() => unlinkSupplier(target)}
            >
              Unlink
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head portal-page-head-row">
        <div>
          <h1 className="portal-h1">Products</h1>
          <p className="portal-sub">
            Every product in one place. Tick catalogue products and send them to specific
            clients or a tier's distribution pool — or create a new product below.
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

      <div className="admin-product-form">
        <h2 className="dash-card-title">Fill members to capacity</h2>
        <p className="dash-card-sub">
          Tops up every eligible member's store with a random mix of catalogue products —
          skipping anything they already own — until they hit their tier's product limit. The
          same product can go to many different members.
        </p>
        <div className="admin-form-grid">
          <label className="auth-label">
            Tier
            <select
              className="auth-input"
              value={fillTier}
              onChange={(e) => setFillTier(e.target.value)}
            >
              <option value="all">All tiers</option>
              {TIER_ORDER.map((t) => (
                <option key={t} value={t}>
                  {TIERS[t].name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="btn-gold"
          type="button"
          disabled={busy === "fill"}
          onClick={() => fillMembers(fillTier)}
        >
          {busy === "fill" ? "Filling…" : "Fill now"}
        </button>
      </div>

      <form className="admin-product-form" onSubmit={assignSelected}>
        <h2 className="dash-card-title">Assign selected products</h2>
        <p className="dash-card-sub">
          {picked.length === 0
            ? "No products selected yet — tick them in the catalogue below."
            : `${picked.length} selected.`}
        </p>
        <DestinationPicker dest={catDest} onChange={setCatDest} members={members} fill={fill} />
        <button
          className="btn-gold"
          type="submit"
          disabled={busy === "assign" || picked.length === 0}
        >
          {busy === "assign"
            ? "Assigning…"
            : `Assign ${picked.length || ""} product${picked.length === 1 ? "" : "s"}`}
        </button>
      </form>

      <div className="admin-search-row">
        <input
          className="auth-input admin-search"
          placeholder={`Search ${catalogue.length} products…`}
          value={productSearch}
          onChange={(e) => setProductSearch(e.target.value)}
        />
        <select
          className="auth-input admin-category-filter"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {shownCatalogue.length === 0 ? (
        <div className="portal-empty">
          <p>
            {catalogue.length === 0
              ? "No products have been added to any store yet."
              : "No products match your search."}
          </p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th />
                <th>Product</th>
                <th>Cost</th>
                <th>List → discount</th>
                <th>Category</th>
                <th>Supplier</th>
                <th>In stores</th>
                <th>Stripe</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shownCatalogue.map((c) => (
                <Fragment key={c.key}>
                  <tr>
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
                        {c.images[0] && <img src={c.images[0]} alt="" />}
                        <div>
                          {c.name}
                          {c.description && <div className="portal-sub">{c.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td>${c.price.toFixed(2)}</td>
                    <td>
                      {editingPrices?.key === c.key ? (
                        <div className="admin-price-edit">
                          <input
                            className="auth-input admin-price-input"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="List"
                            value={editingPrices.listing}
                            onChange={(e) =>
                              setEditingPrices({ ...editingPrices, listing: e.target.value })
                            }
                          />
                          <span>→</span>
                          <input
                            className="auth-input admin-price-input"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Discount"
                            value={editingPrices.discount}
                            onChange={(e) =>
                              setEditingPrices({ ...editingPrices, discount: e.target.value })
                            }
                          />
                          <button
                            className="btn-gold admin-view-btn"
                            type="button"
                            disabled={busy === "prices"}
                            onClick={() => savePrices(c, editingPrices.listing, editingPrices.discount)}
                          >
                            {busy === "prices" ? "Saving…" : "Save"}
                          </button>
                          <button
                            className="btn-ghost admin-view-btn"
                            type="button"
                            onClick={() => setEditingPrices(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          className="btn-ghost admin-view-btn"
                          type="button"
                          onClick={() =>
                            setEditingPrices({
                              key: c.key,
                              listing: c.listing_price ?? "",
                              discount: c.discount_price ?? "",
                            })
                          }
                        >
                          {c.listing_price != null && c.discount_price != null
                            ? `$${c.listing_price.toFixed(2)} → $${c.discount_price.toFixed(2)}`
                            : "Set prices"}
                        </button>
                      )}
                    </td>
                    <td>
                      <select
                        className="auth-input admin-category-filter"
                        value={c.category ?? ""}
                        disabled={busy === "category"}
                        onChange={(e) => saveCategory(c, e.target.value)}
                      >
                        <option value="">No category</option>
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {supplierCell({
                        table: "products",
                        allIds: c.ids,
                        singleId: c.ids[0],
                        label: c.name,
                        supplierProduct: c.supplierProduct,
                      })}
                    </td>
                    <td>{c.storeCount}</td>
                    <td>
                      {c.stripe_price_id ? "Linked" : <span className="admin-warn">Pending</span>}
                    </td>
                    <td>
                      <button
                        className="btn-ghost admin-view-btn"
                        type="button"
                        onClick={() =>
                          setEditingImages(editingImages === c.key ? null : c.key)
                        }
                      >
                        Images ({c.images.length})
                      </button>{" "}
                      <button
                        className="btn-ghost admin-view-btn"
                        type="button"
                        disabled={busy === "delete"}
                        onClick={() => deleteFromCatalogue(c)}
                      >
                        {busy === "delete" ? "Deleting…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                  {editingImages === c.key && (
                    <tr>
                      <td colSpan={9}>
                        <div className="catalogue-images">
                          {c.images.map((url, i) => (
                            <div key={url} className="catalogue-image">
                              <img src={url} alt="" />
                              {i === 0 ? (
                                <span className="catalogue-image-cover">Cover</span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn-ghost admin-view-btn"
                                  disabled={busy === "images"}
                                  onClick={() =>
                                    saveImages(c, [url, ...c.images.filter((u) => u !== url)])
                                  }
                                >
                                  Make cover
                                </button>
                              )}
                              <button
                                type="button"
                                className="btn-ghost admin-view-btn"
                                disabled={busy === "images"}
                                onClick={() =>
                                  saveImages(c, c.images.filter((u) => u !== url))
                                }
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                          <label className="auth-label catalogue-image-add">
                            {busy === "images" ? "Saving…" : "Add images"}
                            <input
                              className="auth-input"
                              type="file"
                              accept="image/*"
                              multiple
                              disabled={busy === "images"}
                              onChange={(e) => {
                                addImages(c, e.target.files);
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form className="admin-product-form pool-tier" onSubmit={createProduct}>
        <div className="pool-tier-head">
          <h2 className="dash-card-title">Create a new product</h2>
          <span className="pool-tier-stats">Goes straight to clients or a tier's pool</span>
        </div>
        <div className="admin-form-grid">
          <label className="auth-label">
            Name
            <input
              className="auth-input"
              value={newForm.name}
              onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
              required
            />
          </label>
          <label className="auth-label">
            Price (AUD) — what the member pays
            <input
   