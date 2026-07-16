// dispatch-order — paid order(s) -> CJ order(s). docs/PHASE1_PLAN.md §2.2.
// Triggers: (a) DB trigger orders_paid_dispatch {order_id}; (b) cron dispatch-sweep
// {sweep:true}; (c) admin retry from the Exception Queue {order_id, retry:true} (admin JWT).
// Deployed --no-verify-jwt; in-code auth: internal_trigger_secret bearer OR admin JWT.
//
// CJ order-create facts (live-verified 2026-07-16 with two real test orders against the
// live CJ account, both created then deleted via the API — see docs/FOUNDER_DECISIONS_REQUIRED.md
// for the full write-up):
//   POST {api_base_url}/shopping/order/createOrderV2, JSON body { orderNumber, shippingCountryCode,
//   shippingCountry, shippingProvince, shippingCity, shippingAddress, shippingCustomerName,
//   shippingZip, shippingPhone, email, logisticName, fromCountryCode, products:[{vid,quantity}] }.
//   Success: { code:200, success:true, data:{ orderNumber, orderId (CJ's "SD..." order code —
//   NOT the same as the numeric id order/list calls "orderId"; that numeric id is only obtainable
//   via GET order/list?orderNum=<our orderNumber>), postageAmount, productAmount, cjPayUrl,
//   payId, actualPayment, orderAmount (top-level, null until paid), productInfoList, ... } }.
//   Duplicate orderNumber (safe to treat as "already created, go look it up"): { success:false,
//   code:1603003, message:"Order exist, please do not duplicate create" }.
//   order/list's `orderNum` query param does NOT filter server-side (live-verified: passing a
//   nonexistent orderNum still returned the account's other recent orders) — the lookup below
//   fetches a page and filters client-side on row.orderNum instead of trusting the query param.
//   PAYMENT: order creation does NOT pay for the order (paymentDate/actualPayment/orderAmount
//   all null immediately after create in both live tests) — confirms plan §4.2. This function
//   does NOT call any pay-from-balance endpoint (none was found/tested — spending real CJ
//   account balance without founder sign-off is out of scope for this pass); ops pays manually
//   in the CJ dashboard for v1, per §4.2 option (b). See FOUNDER_DECISIONS_REQUIRED.md.
//   OPERATIONAL NOTE: createOrderV2 was observed taking 5-20s to respond even on success — a
//   client-side timeout must NOT be read as failure. The retry loop below treats the
//   "Order exist" duplicate response as the success-recovery path for exactly this reason.
//   Cancel/void: DELETE {api_base_url}/shopping/order/deleteOrder?orderId=<numeric id from
//   order/list> — live-verified working on unpaid CREATED orders (both test orders now show
//   orderStatus "TRASH"). Not used by this function (no cancel flow in Phase 1 scope); documented
//   here because it's how the two live test orders were cleaned up.
//
// SCHEMA GAP: order_items has no phone column (checkout's ADDRESS_FIELDS never collected one),
// so shippingPhone is sent as a fixed placeholder below. Flagged in FOUNDER_DECISIONS_REQUIRED.md.
// ship_country is free text (not an ISO code) — countryCode() below normalises a small known set
// and falls back to a naive 2-letter guess; flagged the same place.
//
// BUG FOUND + FIXED HERE (live-verified 2026-07-16 via the invalid-vid failure drill):
// admin.functions.invoke("cj-auth", ...) — where `admin` is a service-role client — sends
// `Authorization: Bearer <service_role_key>` by default, NOT the internal_trigger_secret that
// cj-auth actually checks. Every call was silently rejected 403, so every dispatch attempt
// failed with "no CJ token" regardless of CJ itself. This function passes the
// internal_trigger_secret explicitly as a header on every cj-auth invoke call below. The same
// bug exists in the already-deployed freight-quote and cj-search functions (same invoke
// pattern) — fixed there too as part of this pass.
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

const SHIPPING_PHONE_PLACEHOLDER = "0000000000"; // no phone field exists anywhere in the schema

const COUNTRY_CODE_MAP: Record<string, string> = {
  australia: "AU",
  au: "AU",
  "united states": "US",
  "united states of america": "US",
  usa: "US",
  us: "US",
  "united kingdom": "GB",
  uk: "GB",
  gb: "GB",
  "new zealand": "NZ",
  nz: "NZ",
};
function countryCode(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (/^[A-Za-z]{2}$/.test(v)) return v.toUpperCase();
  const mapped = COUNTRY_CODE_MAP[v.toLowerCase()];
  if (mapped) return mapped;
  return v.length >= 2 ? v.slice(0, 2).toUpperCase() : "AU";
}

// Spec (docs/PHASE1_PLAN.md §2.2) says address_key = md5(...); Deno's Web Crypto has no MD5,
// so SHA-256 is used instead — functionally identical as a stable idempotency key.
async function addressKey(item: Record<string, unknown>): Promise<string> {
  const tuple = [
    item.ship_name,
    item.ship_address1,
    item.ship_address2,
    item.ship_city,
    item.ship_region,
    item.ship_postcode,
    item.ship_country,
  ]
    .map((v) => String(v ?? "").trim().toLowerCase())
    .join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tuple));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// deno-lint-ignore no-explicit-any
type Admin = any;

async function insertException(
  admin: Admin,
  orderId: string,
  dispatchId: string | null,
  stage: string,
  reason: string,
  payload: unknown
) {
  await admin
    .from("fulfilment_exceptions")
    .insert({ order_id: orderId, dispatch_id: dispatchId, stage, reason, payload });
}

const BACKOFFS_MS = [1000, 5000, 15000];

// Handles one address-group's CJ order: freight quote -> createOrderV2, with the
// spec'd retry policy (3 attempts, 1s/5s/15s backoff on 5xx/network/429; one free
// re-auth-and-retry on 401; no retry on 4xx validation errors).
async function dispatchGroup(
  admin: Admin,
  apiBaseUrl: string,
  internalSecret: string,
  // deno-lint-ignore no-explicit-any
  dispatchRow: any,
  // deno-lint-ignore no-explicit-any
  groupItems: any[],
  memberEmail: string | undefined
): Promise<{ success: boolean; lastError: string | null; rawResponse: unknown }> {
  const shipCountryCode = countryCode(groupItems[0].ship_country);

  const vidQty = new Map<string, number>();
  for (const it of groupItems) {
    const vid = it.products.supplier_products.external_variant_id as string;
    vidQty.set(vid, (vidQty.get(vid) ?? 0) + Number(it.quantity));
  }
  const products = Array.from(vidQty, ([vid, quantity]) => ({ vid, quantity }));

  let attempts = 0;
  let reauthUsed = false;
  let lastError: string | null = null;

  while (attempts < 3) {
    let token: string | undefined;
    try {
      const tokenResp = await admin.functions.invoke("cj-auth", {
        body: {},
        headers: { Authorization: `Bearer ${internalSecret}` },
      });
      token = tokenResp.data?.accessToken;
    } catch (err) {
      lastError = `cj-auth call failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    if (!token) {
      attempts++;
      await admin.from("order_dispatches").update({ attempts, last_error: lastError ?? "no CJ token" }).eq("id", dispatchRow.id);
      if (attempts < 3) await sleep(BACKOFFS_MS[attempts - 1]);
      continue;
    }

    await sleep(1200);
    let freightBody: Record<string, unknown> | null = null;
    try {
      const freightResp = await fetch(`${apiBaseUrl}/logistic/freightCalculate`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "CJ-Access-Token": token },
        body: JSON.stringify({ startCountryCode: "CN", endCountryCode: shipCountryCode, products }),
      });
      freightBody = await freightResp.json().catch(() => null);
    } catch (err) {
      lastError = `freightCalculate fetch failed: ${err instanceof Error ? err.message : String(err)}`;
    }
    const options = (
      (freightBody?.data as Array<Record<string, unknown>>) ?? []
    ).filter((o) => o?.logisticPrice != null);
    if (!options.length) {
      attempts++;
      lastError = lastError ?? (freightBody?.message as string) ?? "CJ freightCalculate returned no options";
      await admin.from("order_dispatches").update({ attempts, last_error: lastError }).eq("id", dispatchRow.id);
      if (attempts < 3) await sleep(BACKOFFS_MS[attempts - 1]);
      continue;
    }
    const cheapest = options.reduce((a, b) => ((b.logisticPrice as number) < (a.logisticPrice as number) ? b : a));

    await sleep(1200);
    const first = groupItems[0];
    const createBodyReq = {
      orderNumber: dispatchRow.id,
      shippingCountryCode: shipCountryCode,
      shippingCountry: first.ship_country || shipCountryCode,
      shippingProvince: first.ship_region || "",
      shippingCity: first.ship_city,
      shippingAddress: [first.ship_address1, first.ship_address2].filter(Boolean).join(", "),
      shippingCustomerName: first.ship_name,
      shippingZip: first.ship_postcode,
      shippingPhone: SHIPPING_PHONE_PLACEHOLDER,
      email: memberEmail || "orders@syncagency.org",
      logisticName: cheapest.logisticName,
      fromCountryCode: "CN",
      products,
    };

    let createResp: Response;
    let createBody: Record<string, unknown> | null = null;
    try {
      createResp = await fetch(`${apiBaseUrl}/shopping/order/createOrderV2`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "CJ-Access-Token": token },
        body: JSON.stringify(createBodyReq),
      });
      createBody = await createResp.json().catch(() => null);
    } catch (err) {
      attempts++;
      lastError = `createOrderV2 fetch failed: ${err instanceof Error ? err.message : String(err)}`;
      await admin.from("order_dispatches").update({ attempts, last_error: lastError }).eq("id", dispatchRow.id);
      if (attempts < 3) await sleep(BACKOFFS_MS[attempts - 1]);
      continue;
    }

    if (createBody?.success && (createBody?.data as Record<string, unknown>)?.orderId) {
      const data = createBody.data as Record<string, unknown>;
      await admin
        .from("order_dispatches")
        .update({
          external_order_id: data.orderId,
          shipping_line: cheapest.logisticName,
          freight_cost_cents: Math.round(Number(cheapest.logisticPrice) * 100),
          dispatched_at: new Date().toISOString(),
          raw_response: createBody,
          attempts: attempts + 1,
          last_error: null,
        })
        .eq("id", dispatchRow.id);
      await admin
        .from("order_items")
        .update({ dispatch_id: dispatchRow.id })
        .in("id", groupItems.map((i) => i.id));
      return { success: true, lastError: null, rawResponse: createBody };
    }

    if (createBody?.code === 1603003) {
      // CJ says this orderNumber already exists — a prior attempt got through even though
      // we may not have seen its response (see the timeout note at the top of this file).
      await sleep(1200);
      let listBody: Record<string, unknown> | null = null;
      try {
        // orderNum query param doesn't filter server-side (see file-header note) — fetch a
        // page and match client-side.
        const listResp = await fetch(`${apiBaseUrl}/shopping/order/list?pageNum=1&pageSize=50`, {
          headers: { "CJ-Access-Token": token },
        });
        listBody = await listResp.json().catch(() => null);
      } catch (err) {
        lastError = `order/list lookup failed: ${err instanceof Error ? err.message : String(err)}`;
      }
      const list = ((listBody?.data as Record<string, unknown>)?.list as Array<Record<string, unknown>>) ?? [];
      const row = list.find((r) => r.orderNum === dispatchRow.id);
      if (row) {
        await admin
          .from("order_dispatches")
          .update({
            external_order_id: row.cjOrderId,
            shipping_line: row.logisticName,
            freight_cost_cents: row.postageAmount != null ? Math.round(Number(row.postageAmount) * 100) : null,
            dispatched_at: new Date().toISOString(),
            raw_response: row,
            attempts: attempts + 1,
            last_error: null,
          })
          .eq("id", dispatchRow.id);
        await admin
          .from("order_items")
          .update({ dispatch_id: dispatchRow.id })
          .in("id", groupItems.map((i) => i.id));
        return { success: true, lastError: null, rawResponse: row };
      }
      attempts++;
      lastError = "CJ reports duplicate order but the lookup returned nothing";
      await admin.from("order_dispatches").update({ attempts, last_error: lastError }).eq("id", dispatchRow.id);
      if (attempts < 3) await sleep(BACKOFFS_MS[attempts - 1]);
      continue;
    }

    if ((createResp!.status === 401 || createBody?.code === 1600001) && !reauthUsed) {
      reauthUsed = true;
      await admin.functions.invoke("cj-auth", {
        body: { force: true },
        headers: { Authorization: `Bearer ${internalSecret}` },
      });
      continue; // does not consume an attempt
    }

    if (createResp!.status >= 500 || createResp!.status === 429 || !createResp!.ok) {
      attempts++;
      lastError = (createBody?.message as string) ?? `CJ createOrderV2 failed with status ${createResp!.status}`;
      await admin.from("order_dispatches").update({ attempts, last_error: lastError }).eq("id", dispatchRow.id);
      if (attempts < 3) await sleep(BACKOFFS_MS[attempts - 1]);
      continue;
    }

    // 4xx validation error — won't self-heal, no retry.
    attempts++;
    lastError = (createBody?.message as string) ?? `CJ createOrderV2 validation error ${createResp!.status}`;
    await admin.from("order_dispatches").update({ attempts, last_error: lastError }).eq("id", dispatchRow.id);
    return { success: false, lastError, rawResponse: createBody };
  }

  return { success: false, lastError, rawResponse: null };
}

async function dispatchOrder(
  admin: Admin,
  apiBaseUrl: string,
  internalSecret: string,
  supplierId: string,
  orderId: string
): Promise<{ dispatched: number; failed: number }> {
  const { data: order, error: loadErr } = await admin
    .from("orders")
    .select(
      `id, member_id,
       order_items ( id, product_id, quantity, ship_name, ship_address1, ship_address2, ship_city, ship_region, ship_postcode, ship_country,
         products ( id, supplier_product_id, supplier_products ( id, external_variant_id ) ) )`
    )
    .eq("id", orderId)
    .single();

  if (loadErr || !order) {
    await insertException(admin, orderId, null, "dispatch", "order_load_failed", { message: loadErr?.message });
    await admin.from("orders").update({ status: "exception" }).eq("id", orderId).eq("status", "dispatching");
    return { dispatched: 0, failed: 1 };
  }

  // deno-lint-ignore no-explicit-any
  const items = (order.order_items ?? []) as any[];
  if (!items.length) {
    await insertException(admin, orderId, null, "dispatch", "no_items", {});
    await admin.from("orders").update({ status: "exception" }).eq("id", orderId).eq("status", "dispatching");
    return { dispatched: 0, failed: 1 };
  }

  const unlinked = items.filter(
    (it) => !it.products?.supplier_product_id || !it.products?.supplier_products?.external_variant_id
  );
  if (unlinked.length) {
    await insertException(admin, orderId, null, "dispatch", "unlinked_product", {
      item_ids: unlinked.map((i) => i.id),
    });
    await admin.from("orders").update({ status: "exception" }).eq("id", orderId).eq("status", "dispatching");
    return { dispatched: 0, failed: 1 };
  }

  const { data: member } = await admin.from("profiles").select("email").eq("id", order.member_id).maybeSingle();

  const groups = new Map<string, typeof items>();
  for (const item of items) {
    const key = await addressKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  let anyFailed = false;
  const dispatchIds: string[] = [];

  for (const [key, groupItems] of groups) {
    await admin
      .from("order_dispatches")
      .upsert(
        { order_id: orderId, supplier_id: supplierId, address_key: key },
        { onConflict: "order_id,address_key", ignoreDuplicates: true }
      );
    const { data: dispatchRow } = await admin
      .from("order_dispatches")
      .select("*")
      .eq("order_id", orderId)
      .eq("address_key", key)
      .single();

    if (dispatchRow.external_order_id) {
      // Already dispatched by a prior (partial) attempt — retry resumes the rest.
      dispatchIds.push(dispatchRow.id);
      continue;
    }

    const result = await dispatchGroup(admin, apiBaseUrl, internalSecret, dispatchRow, groupItems, member?.email);
    if (!result.success) {
      anyFailed = true;
      await insertException(admin, orderId, dispatchRow.id, "dispatch", result.lastError ?? "unknown_error", {
        raw: result.rawResponse ?? null,
      });
    } else {
      dispatchIds.push(dispatchRow.id);
    }
  }

  if (anyFailed) {
    await admin.from("orders").update({ status: "exception" }).eq("id", orderId).eq("status", "dispatching");
    return { dispatched: 0, failed: 1 };
  }

  // orders.dispatch_id semantics (§1.2): set only when there's exactly one dispatch.
  const update: Record<string, unknown> = { status: "dispatched" };
  if (dispatchIds.length === 1) update.dispatch_id = dispatchIds[0];
  await admin.from("orders").update(update).eq("id", orderId).eq("status", "dispatching");
  return { dispatched: 1, failed: 0 };
}

async function runSweep(
  admin: Admin,
  apiBaseUrl: string,
  internalSecret: string,
  supplierId: string
): Promise<{ dispatched: number; failed: number; stuck: number }> {
  let dispatched = 0;
  let failed = 0;
  let stuck = 0;

  // (a) stuck in 'dispatching' — the function crashed mid-run last time.
  const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: stuckOrders } = await admin
    .from("orders")
    .select("id, created_at")
    .eq("status", "dispatching")
    .lt("created_at", fifteenMinAgo);
  for (const o of stuckOrders ?? []) {
    const { data: updated } = await admin
      .from("orders")
      .update({ status: "exception" })
      .eq("id", o.id)
      .eq("status", "dispatching")
      .select("id");
    if (updated?.length) {
      await insertException(admin, o.id, null, "dispatch", "stuck_dispatching", { created_at: o.created_at });
      stuck++;
    }
  }

  // (b) 'paid' with zero dispatch rows — the trigger fired but pg_net (or the function) never
  // ran; missed-trigger recovery.
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: paidOrders } = await admin
    .from("orders")
    .select("id")
    .eq("status", "paid")
    .lt("created_at", fiveMinAgo);
  for (const o of paidOrders ?? []) {
    const { data: existing } = await admin.from("order_dispatches").select("id").eq("order_id", o.id).limit(1);
    if (existing?.length) continue;
    const { data: claimed } = await admin
      .from("orders")
      .update({ status: "dispatching" })
      .eq("id", o.id)
      .eq("status", "paid")
      .select("id");
    if (!claimed?.length) continue;
    try {
      const result = await dispatchOrder(admin, apiBaseUrl, internalSecret, supplierId, o.id);
      dispatched += result.dispatched;
      failed += result.failed;
    } catch (err) {
      console.error("dispatch-order sweep: dispatchOrder threw", err);
      await insertException(admin, o.id, null, "dispatch", "internal_error", { message: String(err) });
      await admin.from("orders").update({ status: "exception" }).eq("id", o.id).eq("status", "dispatching");
      failed++;
    }
  }

  return { dispatched, failed, stuck };
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
  if (!its) return json({ error: "internal_trigger_secret not configured" }, 500);

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id, api_base_url")
    .eq("name", "CJ Dropshipping")
    .single();
  if (!supplier) return json({ error: "CJ Dropshipping supplier row missing" }, 500);

  const body = await req.json().catch(() => ({}));

  if (body.sweep) {
    const result = await runSweep(admin, supplier.api_base_url, its, supplier.id);
    return json(result);
  }

  const orderId = body.order_id as string | undefined;
  if (!orderId) return json({ error: "order_id required" }, 400);

  const claimStatuses = body.retry ? ["paid", "exception"] : ["paid"];
  const { data: claimed } = await admin
    .from("orders")
    .update({ status: "dispatching" })
    .eq("id", orderId)
    .in("status", claimStatuses)
    .select("id");
  if (!claimed?.length) {
    return json({ dispatched: 0, failed: 0, note: "no-op: order not in a claimable state" });
  }

  try {
    const result = await dispatchOrder(admin, supplier.api_base_url, its, supplier.id, orderId);
    return json(result);
  } catch (err) {
    console.error("dispatch-order fatal error", err);
    await insertException(admin, orderId, null, "dispatch", "internal_error", { message: String(err) });
    await admin.from("orders").update({ status: "exception" }).eq("id", orderId).eq("status", "dispatching");
    return json({ dispatched: 0, failed: 1, error: "internal error, recorded as exception" });
  }
});
