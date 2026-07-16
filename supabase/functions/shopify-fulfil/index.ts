// shopify-fulfil — pushes a Fulfillment (tracking number + carrier) to a member's Shopify
// store once CJ tracking has landed, so Shopify emails the buyer automatically.
// PROJECT_CHRONOS_BUILD_PLAN.md PART 3 §PHASE 3 / §3.3. Internal-only: deployed
// --no-verify-jwt, the only accepted caller is the internal_trigger_secret bearer (same
// pattern as cj-auth/shopify-health) — invoked by cj-webhook right after it writes a tracking
// number onto a dispatch whose order has source='shopify'.
//
// SHOPIFY API SHAPE: uses the FulfillmentOrder-based Fulfillment API (required since the REST
// Admin API deprecated direct order-level fulfillment creation) — GET
// /orders/{shopify_order_id}/fulfillment_orders.json to find open fulfillment orders, then POST
// /fulfillments.json with `line_items_by_fulfillment_order` (omitting per-item overrides
// fulfills every remaining line item on that fulfillment order, which is correct here: a
// Shopify order in this schema always maps 1:1 to one Sync order, and Sync doesn't do partial
// shipments). `notify_customer: true` is what makes Shopify send the buyer's shipping email —
// this is Shopify's own email, not Sync's (Sync sends no real email itself anywhere, per the
// founder go-ahead gate already logged).
//
// IDEMPOTENCY: no new DB column needed for this. A fulfillment_order's `status` flips from
// open/in_progress to `closed` once Shopify accepts a fulfillment against it — so re-running
// this function for an order that's already been fulfilled naturally finds zero open
// fulfillment_orders and no-ops. Safe to call redundantly (e.g. cj-webhook redelivery).
//
// RETRY: mirrors dispatch-order's policy — 3 attempts, 1s/5s/15s backoff on network error/5xx/
// 429; no retry on 4xx (won't self-heal). Exhausting retries writes a fulfilment_exceptions row
// (stage='webhook') rather than losing the failure silently.
//
// MULTI-DISPATCH CAVEAT (documented limitation, not expected in practice): if an order somehow
// has more than one order_dispatches row with different tracking numbers, this function uses
// the first tracked dispatch found for the single Shopify Fulfillment call (Shopify orders in
// this schema always carry one buyer address, so dispatch-order's address-key grouping should
// always produce exactly one dispatch per Shopify order — this is a defensive fallback, not the
// expected path).
//
// UNVERIFIED LIVE: no real Shopify dev store/token available in this build environment (same
// constraint as shopify-connect/shopify-webhook). Written strictly to Shopify's documented
// FulfillmentOrder API shape (2026-01, pinned to match shopify-connect/shopify-health).
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const BACKOFFS_MS = [1000, 5000, 15000];

// deno-lint-ignore no-explicit-any
type Admin = any;

async function insertException(admin: Admin, orderId: string, dispatchId: string | null, reason: string, payload: unknown) {
  await admin
    .from("fulfilment_exceptions")
    .insert({ order_id: orderId, dispatch_id: dispatchId, stage: "webhook", reason, payload });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: its } = await admin.rpc("get_secret", { secret_name: "internal_trigger_secret" });
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!its || bearer !== its) return json({ error: "Internal only" }, 403);

  const body = await req.json().catch(() => ({}));
  const orderId = body.order_id as string | undefined;
  if (!orderId) return json({ error: "order_id required" }, 400);

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, member_id, source, shopify_order_id")
    .eq("id", orderId)
    .maybeSingle();
  if (orderErr || !order) return json({ error: "order not found" }, 404);
  if (order.source !== "shopify" || !order.shopify_order_id) {
    return json({ skipped: true, note: "not a shopify-sourced order" });
  }

  const { data: dispatches } = await admin
    .from("order_dispatches")
    .select("id, tracking_number, tracking_carrier")
    .eq("order_id", orderId)
    .not("tracking_number", "is", null);
  const tracked = (dispatches ?? [])[0];
  if (!tracked) return json({ skipped: true, note: "no tracked dispatch yet" });

  const { data: store } = await admin
    .from("shopify_stores")
    .select("id, shop_domain, status")
    .eq("member_id", order.member_id)
    .maybeSingle();
  if (!store) {
    await insertException(admin, orderId, tracked.id, "no_shopify_store", { member_id: order.member_id });
    return json({ error: "no connected store for this member" }, 500);
  }

  const { data: token } = await admin.rpc("shopify_store_get_token", { p_store_id: store.id });
  if (!token) {
    await insertException(admin, orderId, tracked.id, "no_shopify_token", { store_id: store.id });
    return json({ error: "could not decrypt store token" }, 500);
  }

  let attempts = 0;
  let lastError: string | null = null;

  while (attempts < 3) {
    let foResp: Response;
    try {
      foResp = await fetch(
        `https://${store.shop_domain}/admin/api/${SHOPIFY_API_VERSION}/orders/${order.shopify_order_id}/fulfillment_orders.json`,
        { headers: { "X-Shopify-Access-Token": token } }
      );
    } catch (err) {
      attempts++;
      lastError = `fulfillment_orders fetch failed: ${err instanceof Error ? err.message : String(err)}`;
      if (attempts < 3) await sleep(BACKOFFS_MS[attempts - 1]);
      continue;
    }
    if (!foResp.ok) {
      if (foResp.status >= 500 || foResp.status === 429) {
        attempts++;
        lastError = `fulfillment_orders returned ${foResp.status}`;
        if (attempts < 3) await sleep(BACKOFFS_MS[attempts - 1]);
        continue;
      }
      lastError = `fulfillment_orders returned ${foResp.status}`;
      break; // 4xx — won't self-heal
    }

    const foBody = await foResp.json().catch(() => null);
    const fulfillmentOrders = (foBody?.fulfillment_orders as Array<Record<string, unknown>>) ?? [];
    const open = fulfillmentOrders.filter((fo) => fo.status === "open" || fo.status === "in_progress");

    if (!open.length) {
      // Nothing left to fulfil — either already fulfilled by a prior run (idempotent no-op) or
      // Shopify has no open fulfillment orders for another reason.
      return json({ fulfilled: false, note: "no open fulfillment orders (already fulfilled or none exist)" });
    }

    const createBodyReq = {
      fulfillment: {
        line_items_by_fulfillment_order: open.map((fo) => ({ fulfillment_order_id: fo.id })),
        tracking_info: {
          number: tracked.tracking_number,
          company: tracked.tracking_carrier || undefined,
        },
        notify_customer: true,
      },
    };

    let createResp: Response;
    let createBody: Record<string, unknown> | null = null;
    try {
      createResp = await fetch(`https://${store.shop_domain}/admin/api/${SHOPIFY_API_VERSION}/fulfillments.json`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify(createBodyReq),
      });
      createBody = await createResp.json().catch(() => null);
    } catch (err) {
      attempts++;
      lastError = `fulfillments.json fetch failed: ${err instanceof Error ? err.message : String(err)}`;
      if (attempts < 3) await sleep(BACKOFFS_MS[attempts - 1]);
      continue;
    }

    if (createResp.ok && (createBody?.fulfillment as Record<string, unknown> | undefined)?.id) {
      return json({ fulfilled: true, fulfillment_id: (createBody!.fulfillment as Record<string, unknown>).id });
    }

    if (createResp.status >= 500 || createResp.status === 429) {
      attempts++;
      lastError = (createBody?.errors as string) ?? `fulfillments.json returned ${createResp.status}`;
      if (attempts < 3) await sleep(BACKOFFS_MS[attempts - 1]);
      continue;
    }

    // 4xx — won't self-heal (e.g. already fulfilled between the GET and POST — treat as
    // informational, not a hard failure, since the desired end state already holds).
    lastError = (createBody?.errors ? JSON.stringify(createBody.errors) : null) ?? `fulfillments.json returned ${createResp.status}`;
    break;
  }

  await insertException(admin, orderId, tracked.id, "shopify_fulfil_failed", {
    shopify_order_id: order.shopify_order_id,
    last_error: lastError,
  });
  return json({ fulfilled: false, error: lastError ?? "unknown error", exceptioned: true });
});
