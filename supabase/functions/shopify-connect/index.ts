// shopify-connect — member-facing. Custom-app token connection (build plan
// §3.1: member creates a custom app in their own Shopify admin, grants
// read_orders/write_fulfillments/read_products, pastes the Admin API access
// token here). Also carries the Product Linking screen's data needs (list the
// member's Shopify products, create/remove product_links rows) — grouped into
// this one function rather than a second edge function because both "read the
// live token" and "write product_links" are service-role-only operations
// (see migration comment), and the build brief scoped this phase to exactly
// two new functions (shopify-connect, shopify-health).
//
// NOT built here (intentionally, per Project Chronos Phase 3 scope): the
// shopify-webhook / shopify-fulfil functions and any wallet-debit logic —
// those depend on Phase 1's dispatch-order and Phase 2's wallet, both still
// in progress. This function only gets a store connected and its product
// catalogue linked.
//
// Shopify API notes: pinned to Admin REST API version 2026-01 (revisit
// quarterly per build plan §4.3 — REST Admin API is legacy as of Oct 2024 but
// still fully supported/versioned for existing custom apps; a public-app
// GraphQL migration is out of scope for the v1 custom-app-token model).
// UNVERIFIED LIVE: this environment has no real Shopify dev store/token to
// test against (see build report). The `connect`/`products` actions are
// written strictly to Shopify's documented REST Admin API shapes
// (GET /admin/api/{version}/shop.json and /products.json, header
// `X-Shopify-Access-Token: <token>`) — flag any live-connect failure to the
// exact response Shopify returns, since the shapes here are unverified against
// a real store.
import { createClient } from "npm:@supabase/supabase-js@2";

const SHOPIFY_API_VERSION = "2026-01";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return json({ error: "Not signed in" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Same gate as the shopify_stores/product_links RLS policies (has_active_access()).
  const { data: caller } = await admin
    .from("profiles")
    .select("subscription_active")
    .eq("id", user.id)
    .single();
  if (!caller?.subscription_active) return json({ error: "Active subscription required" }, 403);

  const payload = await req.json().catch(() => ({}));
  const action = payload.action;

  if (action === "connect") {
    const { shop_domain, access_token } = payload;
    if (!shop_domain || !access_token) {
      return json({ error: "shop_domain and access_token are required" }, 400);
    }
    const domain = String(shop_domain).trim().toLowerCase();
    if (!/^[a-z0-9-]+\.myshopify\.com$/.test(domain)) {
      return json({ error: "shop_domain must look like your-store.myshopify.com" }, 400);
    }

    let shopResp: Response;
    try {
      shopResp = await fetch(`https://${domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
        headers: { "X-Shopify-Access-Token": access_token },
      });
    } catch (err) {
      console.error("shopify-connect: shop.json fetch failed", err);
      return json({ error: "Could not reach that store. Check the domain and try again." }, 502);
    }
    if (shopResp.status === 401 || shopResp.status === 403) {
      return json(
        { error: "Shopify rejected that token. Check the custom app's Admin API access token and scopes." },
        401
      );
    }
    if (!shopResp.ok) {
      return json({ error: `Shopify returned status ${shopResp.status}` }, 502);
    }
    const shopBody = await shopResp.json().catch(() => null);
    const myshopifyDomain = shopBody?.shop?.myshopify_domain;
    if (!myshopifyDomain) return json({ error: "Unexpected response from Shopify" }, 502);

    const { data: storeId, error: upsertErr } = await admin.rpc("shopify_store_upsert", {
      p_member_id: user.id,
      p_shop_domain: myshopifyDomain,
      p_access_token: access_token,
    });
    if (upsertErr) {
      if (upsertErr.message?.includes("shopify_stores_shop_domain_key")) {
        return json({ error: "This Shopify store is already connected to a different Sync account." }, 409);
      }
      return json({ error: upsertErr.message }, 500);
    }

    return json({ store_id: storeId, shop_domain: myshopifyDomain, status: "connected" });
  }

  if (action === "disconnect") {
    const { data: store } = await admin
      .from("shopify_stores")
      .select("id")
      .eq("member_id", user.id)
      .maybeSingle();
    if (!store) return json({ error: "No connected store" }, 404);
    const { error } = await admin
      .from("shopify_stores")
      .update({ status: "disconnected", updated_at: new Date().toISOString() })
      .eq("id", store.id);
    if (error) return json({ error: error.message }, 500);
    return json({ status: "disconnected" });
  }

  if (action === "products") {
    const { data: store } = await admin
      .from("shopify_stores")
      .select("id, shop_domain, status")
      .eq("member_id", user.id)
      .maybeSingle();
    if (!store) return json({ error: "No connected store" }, 404);
    if (store.status !== "connected") return json({ error: "Store is not connected" }, 400);

    const { data: token } = await admin.rpc("shopify_store_get_token", { p_store_id: store.id });
    if (!token) return json({ error: "Could not decrypt store token" }, 500);

    let resp: Response;
    try {
      resp = await fetch(`https://${store.shop_domain}/admin/api/${SHOPIFY_API_VERSION}/products.json?limit=100`, {
        headers: { "X-Shopify-Access-Token": token },
      });
    } catch (err) {
      console.error("shopify-connect: products.json fetch failed", err);
      return json({ error: "Could not reach the store" }, 502);
    }
    if (!resp.ok) return json({ error: `Shopify returned status ${resp.status}` }, 502);
    const body = await resp.json().catch(() => ({}));
    const products = (body?.products ?? []).map((p: Record<string, unknown>) => ({
      shopify_product_id: String(p.id),
      title: p.title,
      image: (p.image as Record<string, unknown> | undefined)?.src ?? null,
      variants: ((p.variants as Record<string, unknown>[]) ?? []).map((v) => ({
        shopify_variant_id: String(v.id),
        title: v.title,
        sku: v.sku,
        price: v.price,
      })),
    }));
    return json({ products });
  }

  if (action === "link") {
    const { shopify_product_id, shopify_variant_id, product_id } = payload;
    if (!shopify_product_id || !shopify_variant_id || !product_id) {
      return json({ error: "shopify_product_id, shopify_variant_id and product_id are required" }, 400);
    }
    const { data: store } = await admin
      .from("shopify_stores")
      .select("id")
      .eq("member_id", user.id)
      .maybeSingle();
    if (!store) return json({ error: "No connected store" }, 404);

    // Product must belong to this member's own catalogue assignment.
    const { data: product } = await admin
      .from("products")
      .select("id")
      .eq("id", product_id)
      .eq("member_id", user.id)
      .maybeSingle();
    if (!product) return json({ error: "Product not found in your catalogue" }, 404);

    const { data: link, error } = await admin
      .from("product_links")
      .upsert(
        {
          shopify_store_id: store.id,
          shopify_product_id: String(shopify_product_id),
          shopify_variant_id: String(shopify_variant_id),
          product_id,
        },
        { onConflict: "shopify_store_id,shopify_variant_id" }
      )
      .select()
      .single();
    if (error) return json({ error: error.message }, 500);
    return json({ link });
  }

  if (action === "unlink") {
    const { link_id } = payload;
    if (!link_id) return json({ error: "link_id required" }, 400);
    const { data: store } = await admin
      .from("shopify_stores")
      .select("id")
      .eq("member_id", user.id)
      .maybeSingle();
    if (!store) return json({ error: "No connected store" }, 404);
    const { error } = await admin
      .from("product_links")
      .delete()
      .eq("id", link_id)
      .eq("shopify_store_id", store.id);
    if (error) return json({ error: error.message }, 500);
    return json({ unlinked: true });
  }

  return json({ error: "Unknown action" }, 400);
});
