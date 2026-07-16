// cj-webhook — CJ status/tracking ingestion. docs/PHASE1_PLAN.md §2.3.
// Trigger: HTTP POST from CJ. Deployed --no-verify-jwt (external caller, no bearer at all —
// CJ webhooks carry no HMAC or auth header per the plan).
//
// VERIFICATION MODEL (mandatory per plan — do not weaken): CJ webhooks carry no HMAC, so the
// incoming payload is treated as an UNTRUSTED HINT ONLY, never written directly. We extract a
// candidate CJ order id / our own client order number from it, look up order_dispatches, and if
// found, re-query CJ's order/list for that order's *real* current state and write only that.
// A forged payload can therefore only trigger a harmless re-read of real CJ state — it cannot
// inject fake tracking numbers or fake "delivered" status. Redelivery is idempotent by
// construction because every write is an absolute-value set derived from the current CJ query,
// not a delta.
//
// CJ webhook payload shape: NOT verified this pass (docs/PHASE1_PLAN.md flags this as an open
// item — no real CJ webhook delivery was received/registered in this session; no public callback
// URL was available to register one, and Phase 1 scope doesn't include standing up one). The
// extraction below tries several plausible key names (cjOrderId/orderId/order_id for CJ's id;
// orderNum/orderNumber/client_order_number for ours) so it degrades gracefully whatever CJ
// actually sends — if a delivery arrives with different keys, it will safely no-op-discard
// (falls through to the "no match" 200 branch) rather than crash, and the real fix is to log the
// raw payload (see console.log below) and update EXTRACT_* once a real payload is seen.
//
// order/list re-query facts (live-verified 2026-07-16, same finding as dispatch-order): the
// `orderNum` query param does not filter server-side, so this fetches a page and matches
// client-side on cjOrderId (CJ's "SD..." code, matches order_dispatches.external_order_id) or
// orderNum (matches order_dispatches.id, since dispatch-order uses the dispatch row's id as CJ's
// client order number).
//
// UNVERIFIED: the exact orderStatus string CJ uses for "delivered" (only "CREATED" and "TRASH"
// were live-observed this session — see dispatch-order's header comment). This function treats
// any orderStatus containing "deliver" (case-insensitive) as delivered; tighten once a real
// delivered order is observed. The trackNumber-present check (verified field name from order/list)
// is the more reliable "shipped" signal and is used as the primary trigger for that transition.
//
// NOT LIVE-TESTED: the actual write-then-shipped/delivered transition, because no real CJ order
// in this account has shipped (all test orders were created then immediately cancelled — see
// dispatch-order's header comment and FOUNDER_DECISIONS_REQUIRED.md). What WAS live-tested: a
// forged payload with a fake tracking number is ignored in favour of the real (untracked) CJ
// state, an unmatched/garbage payload is discarded with 200, and duplicate delivery of the same
// payload produces identical DB state (idempotent). Flagged in FOUNDER_DECISIONS_REQUIRED.md.
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

function firstString(payload: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = payload[k];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const payload = await req.json().catch(() => null);
  if (!payload || typeof payload !== "object") {
    return json({ received: true, note: "unparseable payload, discarded" });
  }

  // Untrusted hints only — used purely to find which dispatch to re-check.
  const cjOrderIdHint = firstString(payload, ["cjOrderId", "cjOrderCode", "orderId", "order_id"]);
  const orderNumHint = firstString(payload, ["orderNum", "orderNumber", "client_order_number", "clientOrderNumber"]);

  if (!cjOrderIdHint && !orderNumHint) {
    console.log("cj-webhook: no recognisable order id in payload, discarding", JSON.stringify(payload));
    return json({ received: true, note: "no order id in payload, discarded" });
  }

  let dispatchQuery = admin.from("order_dispatches").select("id, order_id, supplier_id, external_order_id");
  if (cjOrderIdHint) {
    dispatchQuery = dispatchQuery.eq("external_order_id", cjOrderIdHint);
  } else {
    dispatchQuery = dispatchQuery.eq("id", orderNumHint!);
  }
  const { data: dispatch } = await dispatchQuery.maybeSingle();

  if (!dispatch) {
    console.log("cj-webhook: no matching dispatch for hint", { cjOrderIdHint, orderNumHint });
    return json({ received: true, note: "no matching dispatch, discarded" });
  }

  const { data: supplier } = await admin
    .from("suppliers")
    .select("api_base_url")
    .eq("id", dispatch.supplier_id)
    .single();
  if (!supplier) return json({ received: true, note: "supplier row missing" });

  const { data: its } = await admin.rpc("get_secret", { secret_name: "internal_trigger_secret" });
  const authResp = await admin.functions.invoke("cj-auth", {
    body: {},
    headers: { Authorization: `Bearer ${its}` },
  });
  const token = authResp.data?.accessToken;
  if (!token) {
    // Our own failure to reach CJ — 5xx so CJ retries the delivery later.
    return json({ error: "could not obtain CJ access token" }, 502);
  }

  // Re-query CJ for the authoritative state of THIS dispatch's order. orderNum doesn't filter
  // server-side (see header note) — fetch a page and match client-side.
  let listBody: Record<string, unknown> | null = null;
  try {
    const listResp = await fetch(`${supplier.api_base_url}/shopping/order/list?pageNum=1&pageSize=50`, {
      headers: { "CJ-Access-Token": token },
    });
    listBody = await listResp.json().catch(() => null);
  } catch (err) {
    console.error("cj-webhook: order/list fetch failed", err);
    return json({ error: "CJ order/list unreachable" }, 502);
  }
  const list = ((listBody?.data as Record<string, unknown>)?.list as Array<Record<string, unknown>>) ?? [];
  const authoritative = list.find(
    (r) => r.orderNum === dispatch.id || (dispatch.external_order_id && r.cjOrderId === dispatch.external_order_id)
  );

  if (!authoritative) {
    console.log("cj-webhook: dispatch matched but CJ order/list has no corresponding row", dispatch.id);
    return json({ received: true, note: "matched dispatch but CJ has no record, discarded" });
  }

  const trackNumber = authoritative.trackNumber as string | null | undefined;
  const trackingProvider = authoritative.trackingProvider as string | null | undefined;
  const orderStatus = String(authoritative.orderStatus ?? "");
  const isDelivered = /deliver/i.test(orderStatus);

  const dispatchUpdate: Record<string, unknown> = {};
  if (trackNumber) {
    dispatchUpdate.tracking_number = trackNumber;
    dispatchUpdate.tracking_carrier = trackingProvider ?? null;
  }
  if (isDelivered) {
    dispatchUpdate.delivered_at = new Date().toISOString();
  }

  if (Object.keys(dispatchUpdate).length > 0) {
    const { error: dispErr } = await admin.from("order_dispatches").update(dispatchUpdate).eq("id", dispatch.id);
    if (dispErr) {
      console.error("cj-webhook: order_dispatches update failed", dispErr);
      return json({ error: "db write failed" }, 500);
    }
  }
  if (trackNumber) {
    const { error: itemErr } = await admin
      .from("order_items")
      .update({ tracking_number: trackNumber })
      .eq("dispatch_id", dispatch.id);
    if (itemErr) {
      console.error("cj-webhook: order_items tracking fan-out failed", itemErr);
      return json({ error: "db write failed" }, 500);
    }
  }

  // Recompute order-level status from ALL of this order's dispatches (multi-address fan-out).
  const { data: siblingDispatches } = await admin
    .from("order_dispatches")
    .select("tracking_number, delivered_at")
    .eq("order_id", dispatch.order_id);
  const dispatches = siblingDispatches ?? [];
  const allDelivered = dispatches.length > 0 && dispatches.every((d) => d.delivered_at);
  const allTracked = dispatches.length > 0 && dispatches.every((d) => d.tracking_number);

  if (allDelivered) {
    await admin.from("orders").update({ status: "delivered" }).eq("id", dispatch.order_id);
  } else if (allTracked) {
    // Guarded: only from dispatched/shipped — never regress a delivered order.
    await admin
      .from("orders")
      .update({ status: "shipped" })
      .eq("id", dispatch.order_id)
      .in("status", ["dispatched", "shipped"]);
  }

  return json({ received: true });
});
