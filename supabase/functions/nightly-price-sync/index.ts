// nightly-price-sync — cost/stock refresh + margin flags. docs/PHASE1_PLAN.md §2.5.
// Trigger: cron (service bearer) nightly at 03:00 Australia/Sydney (17:00 UTC, DST drift
// accepted per plan). Deployed --no-verify-jwt; in-code auth: internal_trigger_secret bearer OR
// admin JWT (admin manual "Run sync now" from the Margin Alerts page).
//
// FX source (live-verified 2026-07-16): GET https://open.er-api.com/v6/latest/USD ->
// { result: "success", rates: { AUD: <number>, ... }, ... }. On failure, falls back to the most
// recent price_sync_log.fx_rate. This is the plan's §4.4 default (not yet founder-ratified —
// see FOUNDER_DECISIONS_REQUIRED.md).
//
// CJ re-query per SKU (same shapes verified for cj-search/dispatch-order): GET
// {api_base_url}/product/query?pid=<external_product_id> -> data.variants[] each with
// { vid, variantSellPrice, ... }; match by external_variant_id. freightCalculate as elsewhere.
// STOCK STATE: CJ's variant-level `inventoryNum` was observed null (not populated on this
// account/plan tier) — there is no verified numeric depletion signal. This function infers
// stock_state as: product/query fails or the pid/vid is missing from the response ->
// 'out_of_stock' (delisted/discontinued); otherwise -> 'in_stock'. This is a documented
// approximation, not a verified CJ "in stock" field — flagged in FOUNDER_DECISIONS_REQUIRED.md.
//
// Rate limit: CJ allows ~1 request/second (docs/PHASE1_PLAN.md §2). Two CJ calls per SKU
// (product/query + freightCalculate), throttled >=1.1s apart below. At the current small
// catalogue this is well under a minute; the plan flags >300 SKUs would need batching.
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// deno-lint-ignore no-explicit-any
type Admin = any;

async function fetchFxRate(admin: Admin): Promise<{ fxRate: number | null; error: string | null }> {
  try {
    const resp = await fetch("https://open.er-api.com/v6/latest/USD");
    const body = await resp.json();
    const aud = body?.rates?.AUD;
    if (body?.result === "success" && typeof aud === "number") {
      return { fxRate: aud, error: null };
    }
    throw new Error(`unexpected FX response: ${JSON.stringify(body).slice(0, 200)}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { data: lastRun } = await admin
      .from("price_sync_log")
      .select("fx_rate")
      .not("fx_rate", "is", null)
      .order("run_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastRun?.fx_rate) {
      return { fxRate: Number(lastRun.fx_rate), error: `FX fetch failed (${message}), used last known rate` };
    }
    return { fxRate: null, error: `FX fetch failed (${message}) and no prior rate to fall back to` };
  }
}

async function hideRow(admin: Admin, table: "products" | "pool_products", id: string) {
  if (table === "products") {
    await admin.from("products").update({ active: false, hidden_by_sync: true }).eq("id", id);
  }
  // pool_products has no active/hidden_by_sync columns (§1.2) — nothing to hide pre-assignment.
}

async function unhideRow(admin: Admin, id: string) {
  // Only re-activate rows WE hid — never resurrect an admin-hidden product.
  await admin.from("products").update({ active: true, hidden_by_sync: false }).eq("id", id).eq("hidden_by_sync", true);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: its } = await admin.rpc("get_secret", { secret_name: "internal_trigger_secret" });
  let authorized = !!its && bearer === its;

  if (!authorized) {
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (user) {
      const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
      authorized = caller?.role === "admin";
    }
  }
  if (!authorized) return json({ error: "Unauthorized" }, 403);

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id, api_base_url")
    .eq("name", "CJ Dropshipping")
    .single();
  if (!supplier) return json({ error: "CJ Dropshipping supplier row missing" }, 500);

  const { fxRate, error: fxError } = await fetchFxRate(admin);
  const errors: Array<Record<string, unknown>> = [];
  if (fxError) errors.push({ stage: "fx", message: fxError });

  const authResp = await admin.functions.invoke("cj-auth", {
    body: {},
    headers: { Authorization: `Bearer ${its}` },
  });
  const token = authResp.data?.accessToken;
  if (!token) {
    const { data: row } = await admin
      .from("price_sync_log")
      .insert({
        fx_rate: fxRate,
        products_checked: 0,
        price_changes: 0,
        margin_flags: 0,
        stock_flags: 0,
        details: [],
        errors: [...errors, { stage: "cj-auth", message: "could not obtain CJ access token" }],
      })
      .select()
      .single();
    return json(row);
  }

  const { data: supplierProducts } = await admin
    .from("supplier_products")
    .select("id, external_product_id, external_variant_id, stock_state")
    .eq("supplier_id", supplier.id);

  let productsChecked = 0;
  let priceChanges = 0;
  let stockFlags = 0;

  for (const sp of supplierProducts ?? []) {
    productsChecked++;
    await sleep(1100);
    let variant: Record<string, unknown> | undefined;
    let found = false;
    try {
      const resp = await fetch(`${supplier.api_base_url}/product/query?pid=${encodeURIComponent(sp.external_product_id)}`, {
        headers: { "CJ-Access-Token": token },
      });
      const body = await resp.json();
      const variants = (body?.data?.variants as Array<Record<string, unknown>>) ?? [];
      variant = variants.find((v) => String(v.vid) === sp.external_variant_id);
      found = !!variant;
    } catch (err) {
      errors.push({ stage: "price_sync", supplier_product_id: sp.id, message: `product/query failed: ${err instanceof Error ? err.message : String(err)}` });
    }

    const newStockState = found ? "in_stock" : "out_of_stock";
    if (newStockState !== sp.stock_state) stockFlags++;

    const update: Record<string, unknown> = { stock_state: newStockState, last_synced_at: new Date().toISOString() };
    if (found && variant?.variantSellPrice != null) {
      const newCents = Math.round(Number(variant.variantSellPrice) * 100);
      update.cost_price_live_cents = newCents;
      priceChanges++;
    }

    if (found) {
      await sleep(1100);
      try {
        const freightResp = await fetch(`${supplier.api_base_url}/logistic/freightCalculate`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "CJ-Access-Token": token },
          body: JSON.stringify({
            startCountryCode: "CN",
            endCountryCode: "AU",
            products: [{ vid: sp.external_variant_id, quantity: 1 }],
          }),
        });
        const freightBody = await freightResp.json();
        const options = (freightBody?.data ?? []).filter((o: Record<string, unknown>) => o?.logisticPrice != null);
        if (options.length) {
          const cheapest = options.reduce((a: Record<string, number>, b: Record<string, number>) =>
            (b.logisticPrice as number) < (a.logisticPrice as number) ? b : a
          );
          update.freight_live_cents = Math.round(Number(cheapest.logisticPrice) * 100);
          update.freight_line = cheapest.logisticName;
        }
      } catch (err) {
        errors.push({ stage: "price_sync", supplier_product_id: sp.id, message: `freightCalculate failed: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    await admin.from("supplier_products").update(update).eq("id", sp.id);

    // Stock-flip: out_of_stock -> hide; back in_stock -> unhide only rows WE hid.
    const { data: linkedProducts } = await admin.from("products").select("id, hidden_by_sync").eq("supplier_product_id", sp.id);
    for (const p of linkedProducts ?? []) {
      if (newStockState === "out_of_stock") await hideRow(admin, "products", p.id);
      else if (p.hidden_by_sync) await unhideRow(admin, p.id);
    }
  }

  // Margin check across products + pool_products linked to a supplier_product, using the
  // founder-ratified formula: (listing_price_AUD - (sellPrice_USD + freight_USD) * fx) / listing_price_AUD.
  const details: Array<Record<string, unknown>> = [];
  let marginFlags = 0;

  for (const table of ["products", "pool_products"] as const) {
    const { data: rows } = await admin
      .from(table)
      .select("id, name, listing_price, margin_floor_pct, auto_hide_below_floor, supplier_product_id, supplier_products(cost_price_live_cents, freight_live_cents)")
      .not("supplier_product_id", "is", null)
      .not("listing_price", "is", null);

    for (const row of rows ?? []) {
      const sp = row.supplier_products as { cost_price_live_cents: number | null; freight_live_cents: number | null } | null;
      if (!sp || sp.cost_price_live_cents == null || fxRate == null) continue;
      const landedUsd = sp.cost_price_live_cents / 100 + (sp.freight_live_cents ?? 0) / 100;
      const landedAud = landedUsd * fxRate;
      const listingPrice = Number(row.listing_price);
      const marginPct = ((listingPrice - landedAud) / listingPrice) * 100;
      const floor = Number(row.margin_floor_pct ?? 30);

      if (marginPct < floor) {
        marginFlags++;
        details.push({
          table,
          id: row.id,
          name: row.name,
          listing_price: listingPrice,
          landed_aud: Number(landedAud.toFixed(2)),
          margin_pct: Number(marginPct.toFixed(1)),
          floor,
        });
        // "if configured" margin-floor hide (default off, products table only — pool_products
        // has no active/auto_hide_below_floor concept until it's assigned).
        if (table === "products" && row.auto_hide_below_floor) {
          await hideRow(admin, "products", row.id);
        }
      }
    }
  }

  const { data: logRow } = await admin
    .from("price_sync_log")
    .insert({
      fx_rate: fxRate,
      products_checked: productsChecked,
      price_changes: priceChanges,
      margin_flags: marginFlags,
      stock_flags: stockFlags,
      details,
      errors,
    })
    .select()
    .single();

  return json(logRow);
});
