// cj-search — supplier product search/link, admin-only. The CJ token must
// never reach the browser, and supplier_products writes are service-role-only
// by design, so this has to be an edge function (docs/PHASE1_PLAN.md §2.6).
//
// Real CJ API shapes (live-verified 2026-07-16, see docs/PHASE1_PLAN.md
// "Execution notes" — this deviates from the plan's guessed shape in one
// important way):
//   - GET {api_base_url}/product/listV2?pageNum=&pageSize=&categoryId=&productNameEn=
//     returns data.content[0].productList[] items shaped
//     { id (pid), sku (top-level SKU), nameEn, sellPrice, bigImage, categoryId, ... }.
//     It does NOT return a variant id (vid) — the plan assumed listV2 would
//     return {pid,vid,productSku,name,image,sellPrice} directly; it doesn't.
//   - GET {api_base_url}/product/query?pid=<id> returns data.variants[], each
//     { pid, vid, variantSku, variantName, variantSellPrice, variantImage, ... }.
//     vid (needed by freightCalculate and order-create) only comes from here.
//   So this function adds a fourth action, "variants", between "search" and
//   "link": the admin picks a pid from search results, "variants" fetches the
//   per-SKU/colour vids, then "link" takes the chosen vid.
//   - getCategory endpoint/shape not independently re-verified this pass;
//     implemented per the plan's expected shape (GET {api_base_url}/product/getCategory).
import { createClient } from "npm:@supabase/supabase-js@2";

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
  const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin") return json({ error: "Admin only" }, 403);

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id, api_base_url")
    .eq("name", "CJ Dropshipping")
    .single();
  if (!supplier) return json({ error: "CJ Dropshipping supplier row missing" }, 500);

  // BUG FIX (2026-07-16, found while building dispatch-order): admin.functions.invoke sends
  // the service-role key as bearer by default, not the internal_trigger_secret cj-auth checks —
  // pass it explicitly, or every call 403s and this always falls through to "no access token".
  const { data: cjAuthSecret } = await admin.rpc("get_secret", { secret_name: "internal_trigger_secret" });
  const authResp = await admin.functions.invoke("cj-auth", {
    body: {},
    headers: { Authorization: `Bearer ${cjAuthSecret}` },
  });
  const accessToken = authResp.data?.accessToken;
  if (!accessToken) return json({ error: "Could not obtain CJ access token" }, 502);

  const payload = await req.json().catch(() => ({}));
  const action = payload.action;

  if (action === "categories") {
    const resp = await fetch(`${supplier.api_base_url}/product/getCategory`, {
      headers: { "CJ-Access-Token": accessToken },
    });
    if (!resp.ok) return json({ error: `CJ getCategory failed with status ${resp.status}` }, 502);
    const body = await resp.json();
    return json({ categories: body?.data ?? [] });
  }

  if (action === "search") {
    const params = new URLSearchParams({
      pageNum: String(payload.page || 1),
      pageSize: "20",
    });
    if (payload.keyword) params.set("productNameEn", payload.keyword);
    if (payload.category_id) params.set("categoryId", payload.category_id);

    const resp = await fetch(`${supplier.api_base_url}/product/listV2?${params.toString()}`, {
      headers: { "CJ-Access-Token": accessToken },
    });
    if (!resp.ok) return json({ error: `CJ listV2 failed with status ${resp.status}` }, 502);
    const body = await resp.json();
    const productList = body?.data?.content?.[0]?.productList ?? [];
    const results = productList.map((p: Record<string, unknown>) => ({
      pid: p.id,
      productSku: p.sku,
      name: p.nameEn,
      image: p.bigImage,
      sellPrice: p.sellPrice,
    }));
    return json({ results });
  }

  if (action === "variants") {
    const { pid } = payload;
    if (!pid) return json({ error: "pid required" }, 400);
    const resp = await fetch(`${supplier.api_base_url}/product/query?pid=${encodeURIComponent(pid)}`, {
      headers: { "CJ-Access-Token": accessToken },
    });
    if (!resp.ok) return json({ error: `CJ product/query failed with status ${resp.status}` }, 502);
    const body = await resp.json();
    const variants = (body?.data?.variants ?? []).map((v: Record<string, unknown>) => ({
      vid: v.vid,
      variantSku: v.variantSku,
      variantName: v.variantName,
      sellPrice: v.variantSellPrice,
      image: v.variantImage,
    }));
    return json({ variants });
  }

  if (action === "link") {
    const { product_id, pool_product_id, pid, vid, productSku, name, image, sell_price_usd } = payload;
    if (!vid || !pid) return json({ error: "pid and vid required" }, 400);
    if (!product_id && !pool_product_id) return json({ error: "product_id or pool_product_id required" }, 400);

    const { data: sp, error: upsertErr } = await admin
      .from("supplier_products")
      .upsert(
        {
          supplier_id: supplier.id,
          external_product_id: String(pid),
          external_variant_id: String(vid),
          external_sku: productSku ?? null,
          display_name: name ?? null,
          image_url: image ?? null,
          cost_price_live_cents: sell_price_usd != null ? Math.round(Number(sell_price_usd) * 100) : null,
          stock_state: "unknown",
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "supplier_id,external_variant_id" }
      )
      .select()
      .single();
    if (upsertErr) return json({ error: upsertErr.message }, 500);

    // Prime freight_live_cents via one freightCalculate call.
    let freightCents: number | null = null;
    try {
      const freightResp = await fetch(`${supplier.api_base_url}/logistic/freightCalculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "CJ-Access-Token": accessToken },
        body: JSON.stringify({
          startCountryCode: "CN",
          endCountryCode: "AU",
          products: [{ vid: String(vid), quantity: 1 }],
        }),
      });
      if (freightResp.ok) {
        const freightBody = await freightResp.json();
        const options = (freightBody?.data ?? []).filter((o: Record<string, unknown>) => o?.logisticPrice != null);
        if (options.length) {
          const cheapest = options.reduce((a: Record<string, number>, b: Record<string, number>) =>
            (b.logisticPrice as number) < (a.logisticPrice as number) ? b : a
          );
          freightCents = Math.round(Number(cheapest.logisticPrice) * 100);
          await admin
            .from("supplier_products")
            .update({ freight_live_cents: freightCents, freight_line: cheapest.logisticName })
            .eq("id", sp.id);
        }
      }
    } catch (err) {
      console.error("cj-search link: freight priming failed", err);
    }

    const table = product_id ? "products" : "pool_products";
    const rowId = product_id ?? pool_product_id;
    const { error: linkErr } = await admin.from(table).update({ supplier_product_id: sp.id }).eq("id", rowId);
    if (linkErr) return json({ error: linkErr.message }, 500);

    // Compute live margin for the linked row so the admin sees pass/fail vs floor at link time.
    const { data: row } = await admin
      .from(table)
      .select("listing_price, margin_floor_pct")
      .eq("id", rowId)
      .single();

    let marginPct: number | null = null;
    if (row?.listing_price && sell_price_usd != null) {
      // FX not fetched here (that's nightly-price-sync's job); this is an
      // at-link-time estimate using the day's last known price_sync_log.fx_rate,
      // falling back to null (UI shows "unknown" rather than a fabricated rate).
      const { data: lastSync } = await admin
        .from("price_sync_log")
        .select("fx_rate")
        .order("run_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const fx = lastSync?.fx_rate;
      if (fx) {
        const landedUsd = Number(sell_price_usd) + (freightCents != null ? freightCents / 100 : 0);
        const landedAud = landedUsd * Number(fx);
        marginPct = ((Number(row.listing_price) - landedAud) / Number(row.listing_price)) * 100;
      }
    }

    return json({
      supplier_product_id: sp.id,
      freight_live_cents: freightCents,
      margin_pct: marginPct,
      margin_floor_pct: row?.margin_floor_pct ?? null,
    });
  }

  return json({ error: "Unknown action" }, 400);
});
