// shopify-webhook — receives Shopify `orders/create` and `orders/cancelled` deliveries.
// PROJECT_CHRONOS_BUILD_PLAN.md PART 3 §PHASE 3 / §3.3. Deployed --no-verify-jwt (external
// caller — Shopify sends no Supabase auth at all, only a per-store HMAC signature).
//
// VERIFICATION MODEL (mandatory — do not weaken): every delivery's `X-Shopify-Hmac-Sha256`
// header is checked against HMAC-SHA256(raw request body, this store's webhook secret) before
// any DB write. The secret is the custom app's API secret key ("Client secret"), collected
// separately from the Admin API access token at connect time (see shopify-connect + the
// chronos_phase3_shopify_webhook_secret migration) and decrypted only inside this function via
// the shopify_store_get_webhook_secret() SECURITY DEFINER RPC. HMAC is computed over the exact
// raw bytes of the body — req.text() is read BEFORE any JSON.parse, and JSON.parse happens on
// that same captured string, never a re-serialised object (re-serialising can change byte-for-
// byte content and silently break verification on some payload shapes).
//
// IDEMPOTENCY: orders.shopify_order_id is unique at the DB level (belt) and this function also
// explicitly checks for an existing order with that shopify_order_id before doing anything
// (suspenders) — a redelivered orders/create webhook is a clean no-op, never a second order or
// a second wallet debit.
//
// UNMATCHED PRODUCTS: all-or-nothing per order, matching dispatch-order's existing
// `unlinked_product` posture for consistency. If ANY line item's variant has no product_links
// row for this store, NO order_items are created and NO wallet debit is attempted — an empty
// order shell (status='exception') is created purely so the delivery is idempotency-tracked by
// shopify_order_id, plus one fulfilment_exceptions row (stage='webhook') with the raw unmatched
// line items for an admin to read and ask the member to link the product. This is deliberate:
// partially fulfilling an order (ship what's linked, strand what isn't) would split a single
// Shopify sale into a confusing partial delivery — cleaner to hold the whole order until every
// item is linked. KNOWN GAP: the Exception Queue's existing "Retry" button re-invokes
// dispatch-order, which requires order_items to already exist — it will not resolve this class
// of exception (no items to dispatch). An admin must resolve these manually today (link the
// product with the member, then a follow-up pass would need a "replay this raw payload" action
// that does not exist yet). Flagged in FOUNDER_DECISIONS_REQUIRED.md.
//
// PRICING: uses the member's already-assigned `products.price` for the linked product — the
// exact same per-member curated price the Depop portal checkout already charges via
// order_items.unit_price (see CheckoutPage.jsx). No new pricing logic; Phase 3's "compute
// member price" is just "look up the price already on their catalogue assignment."
//
// ORDER CREATION: same `orders`/`order_items` shape and insert pattern as CheckoutPage.jsx's
// checkout flow (source defaults changed to 'shopify', shopify_order_id set) — status starts
// at 'pending_payment', not 'paid'; the wallet debit (Phase 2's debit_wallet_for_order RPC)
// is what advances it to 'paid', which is what the pre-existing `orders_paid_dispatch` trigger
// listens for. This function never sets status='paid' directly and never calls dispatch-order
// directly — that hand-off is 100% delegated to the RPC + trigger already proven in Phase 1/2.
//
// CANCELLATION: pending_payment/awaiting_funds → cancel + drop any wallet_order_holds row (no
// debit ever happened, nothing to refund). paid → refund the wallet via Phase 2's wallet_adjust
// RPC (type='refund') then cancel (small unavoidable race: the paid→dispatching claim happens
// asynchronously via the DB trigger, so a cancellation landing in the same instant as dispatch
// could theoretically lose the race — accepted as a documented known limitation, same class of
// risk dispatch-order's own sweep/stuck-order recovery already lives with). dispatching or
// later (dispatched/shipped/delivered) → no auto-refund (goods may already be committed at CJ
// or in transit) — writes a fulfilment_exceptions row instead so an admin makes the refund call
// via the existing exception queue, per the plan's refund playbook posture.
//
// UNVERIFIED LIVE: no real Shopify dev store/token is available in this build environment (see
// FOUNDER_DECISIONS_REQUIRED.md — same constraint noted for shopify-connect/shopify-health).
// The HMAC verification + order/wallet/idempotency/exception logic below WAS live-tested this
// pass by simulating a webhook delivery against the deployed function with a self-computed
// valid HMAC (the shared secret is known because the test shopify_stores row was created by
// this session) — see FOUNDER_DECISIONS_REQUIRED.md for the exact results. What remains
// genuinely unverified is Shopify's real payload shape matching what's assumed below
// (line_items[].variant_id, shipping_address.{name,address1,...}) and the real header names —
// both are Shopify's long-documented, stable webhook shapes, but "documented" isn't "observed."
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-shopify-hmac-sha256, x-shopify-shop-domain, x-shopify-topic",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// deno-lint-ignore no-explicit-any
type Admin = any;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function computeHmac(rawBody: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

const ADDRESS_MAP = (addr: Record<string, unknown> | null | undefined) => ({
  ship_name: (addr?.name as string) || [addr?.first_name, addr?.last_name].filter(Boolean).join(" ") || null,
  ship_address1: (addr?.address1 as string) ?? null,
  ship_address2: (addr?.address2 as string) ?? null,
  ship_city: (addr?.city as string) ?? null,
  ship_region: (addr?.province as string) ?? null,
  ship_postcode: (addr?.zip as string) ?? null,
  ship_country: (addr?.country as string) ?? (addr?.country_code as string) ?? null,
});

async function insertException(admin: Admin, orderId: string, reason: string, payload: unknown) {
  await admin
    .from("fulfilment_exceptions")
    .insert({ order_id: orderId, dispatch_id: null, stage: "webhook", reason, payload });
}

async function handleOrderCreate(admin: Admin, store: Record<string, unknown>, payload: Record<string, unknown>) {
  const shopifyOrderId = String(payload.id ?? "");
  if (!shopifyOrderId) return json({ received: true, note: "no order id in payload, discarded" });

  const { data: existing } = await admin
    .from("orders")
    .select("id")
    .eq("shopify_order_id", shopifyOrderId)
    .maybeSingle();
  if (existing) return json({ received: true, note: "duplicate delivery, already processed", order_id: existing.id });

  const lineItems = (payload.line_items as Array<Record<string, unknown>>) ?? [];
  if (!lineItems.length) {
    const { data: order } = await admin
      .from("orders")
      .insert({ member_id: store.member_id, status: "exception", source: "shopify", shopify_order_id: shopifyOrderId })
      .select("id")
      .single();
    if (order) await insertException(admin, order.id, "no_line_items", { shopify_order_id: shopifyOrderId });
    return json({ received: true, note: "no line items, exceptioned" });
  }

  const variantIds = lineItems.map((li) => String(li.variant_id ?? ""));
  const { data: links } = await admin
    .from("product_links")
    .select("shopify_variant_id, product_id")
    .eq("shopify_store_id", store.id)
    .in("shopify_variant_id", variantIds);
  const linkMap = new Map((links ?? []).map((l: Record<string, unknown>) => [l.shopify_variant_id, l.product_id]));

  const unmatched = lineItems.filter((li) => !li.variant_id || !linkMap.has(String(li.variant_id)));

  // All-or-nothing: any unmatched item exceptions the WHOLE order, no partial order_items.
  if (unmatched.length) {
    const { data: order } = await admin
      .from("orders")
      .insert({ member_id: store.member_id, status: "exception", source: "shopify", shopify_order_id: shopifyOrderId })
      .select("id")
      .single();
    if (order) {
      await insertException(admin, order.id, "unmatched_shopify_product", {
        shopify_order_id: shopifyOrderId,
        unmatched: unmatched.map((li) => ({
          shopify_product_id: li.product_id != null ? String(li.product_id) : null,
          shopify_variant_id: li.variant_id != null ? String(li.variant_id) : null,
          title: li.title ?? li.name ?? null,
          quantity: li.quantity ?? null,
        })),
      });
    }
    return json({ received: true, note: "unmatched product(s), exceptioned", order_id: order?.id });
  }

  const productIds = Array.from(new Set(Array.from(linkMap.values())));
  const { data: products } = await admin.from("products").select("id, name, price").in("id", productIds);
  const productMap = new Map((products ?? []).map((p: Record<string, unknown>) => [p.id, p]));

  const address = ADDRESS_MAP(payload.shipping_address as Record<string, unknown> | undefined);
  const orderItemsToInsert = lineItems.map((li) => {
    const productId = linkMap.get(String(li.variant_id));
    const product = productMap.get(productId) as Record<string, unknown> | undefined;
    const quantity = Number(li.quantity ?? 1);
    return {
      product_id: productId,
      product_name: product?.name ?? (li.title as string) ?? null,
      quantity,
      unit_price: product?.price ?? 0,
      ...address,
    };
  });
  const totalAmount = orderItemsToInsert.reduce(
    (sum, it) => sum + Number(it.unit_price) * Number(it.quantity),
    0
  );

  const { data: order, error: orderErr } = await admin
    .from("orders")
    .insert({
      member_id: store.member_id,
      status: "pending_payment",
      source: "shopify",
      shopify_order_id: shopifyOrderId,
      total_amount: totalAmount,
    })
    .select("id")
    .single();
  if (orderErr || !order) {
    console.error("shopify-webhook: order insert failed", orderErr);
    // Unique-violation race (two redeliveries at once) — treat as duplicate, not a hard error.
    if (orderErr?.message?.includes("shopify_order_id")) {
      return json({ received: true, note: "duplicate delivery (race), already processed" });
    }
    return json({ error: "could not create order" }, 500);
  }

  const { error: itemsErr } = await admin
    .from("order_items")
    .insert(orderItemsToInsert.map((it) => ({ ...it, order_id: order.id })));
  if (itemsErr) {
    console.error("shopify-webhook: order_items insert failed", itemsErr);
    await insertException(admin, order.id, "order_items_insert_failed", { message: itemsErr.message });
    await admin.from("orders").update({ status: "exception" }).eq("id", order.id);
    return json({ received: true, note: "order_items insert failed, exceptioned", order_id: order.id });
  }

  const amountCents = Math.round(totalAmount * 100);
  const { data: debitResult, error: debitErr } = await admin.rpc("debit_wallet_for_order", {
    p_order_id: order.id,
    p_amount_cents: amountCents,
  });
  if (debitErr || !debitResult) {
    console.error("shopify-webhook: debit_wallet_for_order failed", debitErr);
    await insertException(admin, order.id, "wallet_debit_call_failed", { message: debitErr?.message });
    return json({ received: true, note: "wallet debit call failed, exceptioned", order_id: order.id });
  }
  if (!["debited", "insufficient_funds"].includes(debitResult.status)) {
    // order_not_found / invalid_status / already_debited / no_amount — shouldn't happen on a
    // freshly-created pending_payment order, but exception rather than silently drop it.
    await insertException(admin, order.id, `wallet_debit_${debitResult.status}`, debitResult);
  }

  return json({ received: true, order_id: order.id, wallet: debitResult });
}

async function handleOrderCancelled(admin: Admin, store: Record<string, unknown>, payload: Record<string, unknown>) {
  const shopifyOrderId = String(payload.id ?? "");
  if (!shopifyOrderId) return json({ received: true, note: "no order id in payload, discarded" });

  const { data: order } = await admin
    .from("orders")
    .select("id, status, member_id, dispatch_id")
    .eq("shopify_order_id", shopifyOrderId)
    .eq("member_id", store.member_id)
    .maybeSingle();
  if (!order) return json({ received: true, note: "no matching order, discarded" });

  if (["pending_payment", "awaiting_funds"].includes(order.status)) {
    await admin.from("wallet_order_holds").delete().eq("order_id", order.id);
    await admin
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id)
      .in("status", ["pending_payment", "awaiting_funds"]);
    return json({ received: true, note: "cancelled pre-payment, no refund needed" });
  }

  if (order.status === "paid") {
    const { data: debitTxn } = await admin
      .from("wallet_transactions")
      .select("amount_cents")
      .eq("order_id", order.id)
      .eq("type", "debit")
      .maybeSingle();
    if (debitTxn) {
      const refundCents = Math.abs(debitTxn.amount_cents);
      await admin.rpc("wallet_adjust", {
        p_member_id: order.member_id,
        p_amount_cents: refundCents,
        p_type: "refund",
        p_reason: "Shopify order cancelled",
        p_actor: null,
        p_order_id: order.id,
      });
    }
    await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id).eq("status", "paid");
    return json({ received: true, note: "cancelled + refunded" });
  }

  if (["dispatching", "dispatched", "shipped", "delivered"].includes(order.status)) {
    // Goods may already be committed at CJ or in transit — do not auto-refund silently.
    await insertException(admin, order.id, "shopify_order_cancelled_after_dispatch", {
      shopify_order_id: shopifyOrderId,
      order_status_at_cancel: order.status,
    });
    return json({ received: true, note: "cancelled after dispatch, exceptioned for manual refund review" });
  }

  return json({ received: true, note: "no-op, order already terminal" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const shopDomain = (req.headers.get("X-Shopify-Shop-Domain") ?? "").toLowerCase();
  const topic = req.headers.get("X-Shopify-Topic") ?? "";
  const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256") ?? "";

  if (!shopDomain || !hmacHeader) {
    return json({ received: true, note: "missing shop domain or hmac header, discarded" });
  }

  const { data: store } = await admin
    .from("shopify_stores")
    .select("id, member_id, status")
    .eq("shop_domain", shopDomain)
    .maybeSingle();
  if (!store || store.status === "disconnected") {
    console.log("shopify-webhook: no active store for domain", shopDomain);
    return json({ received: true, note: "no active store for this domain, discarded" });
  }

  const rawBody = await req.text();

  const { data: secret } = await admin.rpc("shopify_store_get_webhook_secret", { p_store_id: store.id });
  if (!secret) {
    console.error("shopify-webhook: no webhook secret on file for store", store.id);
    return json({ error: "store not fully configured" }, 500);
  }

  const expected = await computeHmac(rawBody, secret);
  if (!timingSafeEqual(expected, hmacHeader)) {
    console.warn("shopify-webhook: HMAC mismatch for store", store.id, "topic", topic);
    return json({ error: "invalid signature" }, 401);
  }

  const payload = JSON.parse(rawBody || "{}") as Record<string, unknown>;

  if (topic === "orders/create") return handleOrderCreate(admin, store, payload);
  if (topic === "orders/cancelled") return handleOrderCancelled(admin, store, payload);

  console.log("shopify-webhook: unhandled topic, discarded", topic);
  return json({ received: true, note: `unhandled topic ${topic}, discarded` });
});
