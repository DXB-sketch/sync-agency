import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ProductLinkingPage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [shopifyProducts, setShopifyProducts] = useState([]);
  const [catalogue, setCatalogue] = useState([]);
  const [links, setLinks] = useState([]); // { id, shopify_variant_id, product_id }
  const [pendingChoice, setPendingChoice] = useState({}); // variant id -> chosen product id
  const [busyVariant, setBusyVariant] = useState(null);

  async function loadAll() {
    setLoading(true);
    setError(null);

    const { data: storeRow } = await supabase
      .from("shopify_stores")
      .select("id, shop_domain, status")
      .maybeSingle();
    setStore(storeRow ?? null);

    if (!storeRow || storeRow.status !== "connected") {
      setLoading(false);
      return;
    }

    const [{ data: catalogueRows }, { data: linkRows }, { data: fnData, error: fnErr }] = await Promise.all([
      supabase.from("products").select("id, name, image_url").eq("active", true).order("name"),
      supabase.from("product_links").select("id, shopify_variant_id, product_id"),
      supabase.functions.invoke("shopify-connect", { body: { action: "products" } }),
    ]);

    setCatalogue(catalogueRows ?? []);
    setLinks(linkRows ?? []);
    if (fnErr || fnData?.error) {
      setError(fnData?.error ?? "Could not load products from Shopify.");
    } else {
      setShopifyProducts(fnData?.products ?? []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  function linkFor(variantId) {
    return links.find((l) => l.shopify_variant_id === variantId);
  }

  async function linkVariant(shopifyProductId, variantId) {
    const productId = pendingChoice[variantId];
    if (!productId) return;
    setBusyVariant(variantId);
    setError(null);
    const { data, error: fnErr } = await supabase.functions.invoke("shopify-connect", {
      body: {
        action: "link",
        shopify_product_id: shopifyProductId,
        shopify_variant_id: variantId,
        product_id: productId,
      },
    });
    if (fnErr || data?.error) {
      setError(data?.error ?? "Could not link that product.");
      setBusyVariant(null);
      return;
    }
    setLinks((prev) => [...prev.filter((l) => l.shopify_variant_id !== variantId), data.link]);
    setBusyVariant(null);
  }

  async function unlinkVariant(linkId, variantId) {
    setBusyVariant(variantId);
    setError(null);
    const { data, error: fnErr } = await supabase.functions.invoke("shopify-connect", {
      body: { action: "unlink", link_id: linkId },
    });
    if (fnErr || data?.error) {
      setError(data?.error ?? "Could not unlink that product.");
      setBusyVariant(null);
      return;
    }
    setLinks((prev) => prev.filter((l) => l.id !== linkId));
    setBusyVariant(null);
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Link your products</h1>
        <p className="portal-sub">
          Match each Shopify product variant to the Sync catalogue item it should fulfil from. Orders
          for unlinked variants will need linking before they can dispatch.
        </p>
      </div>

      {loading ? (
        <p className="portal-sub">Loading…</p>
      ) : !store || store.status !== "connected" ? (
        <div className="portal-empty">
          <p>Connect your Shopify store first, then come back to link products.</p>
          <Link to="/portal/store" className="btn-gold" style={{ marginTop: 16, display: "inline-block" }}>
            Connect store
          </Link>
        </div>
      ) : (
        <>
          {error && <p className="auth-error">{error}</p>}

          {shopifyProducts.length === 0 ? (
            <p className="dash-card-sub">No products found in your Shopify store yet.</p>
          ) : (
            <div className="product-links-list">
              {shopifyProducts.map((p) => (
                <div key={p.shopify_product_id} className="dash-card product-link-card">
                  <div className="product-link-head">
                    {p.image && <img src={p.image} alt={p.title} className="product-link-img" />}
                    <h2 className="dash-card-title">{p.title}</h2>
                  </div>
                  {p.variants.map((v) => {
                    const existing = linkFor(v.shopify_variant_id);
                    const linkedProduct = existing
                      ? catalogue.find((c) => c.id === existing.product_id)
                      : null;
                    return (
                      <div key={v.shopify_variant_id} className="product-link-row">
                        <span className="product-link-variant">
                          {v.title} {v.sku ? <span className="dash-card-sub">({v.sku})</span> : null}
                        </span>
                        {existing ? (
                          <div className="product-link-linked">
                            <span className="order-status store-status-connected">
                              Linked → {linkedProduct?.name ?? "Sync product"}
                            </span>
                            <button
                              className="btn-ghost"
                              disabled={busyVariant === v.shopify_variant_id}
                              onClick={() => unlinkVariant(existing.id, v.shopify_variant_id)}
                            >
                              Unlink
                            </button>
                          </div>
                        ) : (
                          <div className="product-link-linked">
                            <select
                              className="auth-input"
                              value={pendingChoice[v.shopify_variant_id] ?? ""}
                              onChange={(e) =>
                                setPendingChoice((prev) => ({ ...prev, [v.shopify_variant_id]: e.target.value }))
                              }
                            >
                              <option value="">Choose Sync product…</option>
                              {catalogue.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                            <button
                              className="btn-gold"
                              disabled={
                                !pendingChoice[v.shopify_variant_id] || busyVariant === v.shopify_variant_id
                              }
                              onClick={() => linkVariant(p.shopify_product_id, v.shopify_variant_id)}
                            >
                              Link
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
