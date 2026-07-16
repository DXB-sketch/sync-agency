// shopify-health — daily cron health check for connected Shopify stores.
// Internal-only, mirrors cj-auth's caller pattern: deployed --no-verify-jwt,
// the only accepted caller is the internal_trigger_secret bearer (checked
// in-code below), invoked by a pg_cron schedule via pg_net.
//
// Scope for this pass (Project Chronos Phase 3, built ahead of
// shopify-webhook): token validity only. Calls Shopify's shop.json with each
// connected store's decrypted token; a 401/403 flips the store to
// status='error' so the member sees a "reconnect your store" prompt in the
// portal. Webhook re-registration is NOT implemented — see the TODO below —
// because shopify-webhook (which is what actually registers webhook
// subscriptions) doesn't exist yet; there is nothing to re-register.
//
// UNVERIFIED LIVE: same caveat as shopify-connect — no real Shopify store
// available in this build environment to test the health-check call against.
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: its } = await admin.rpc("get_secret", { secret_name: "internal_trigger_secret" });
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!its || bearer !== its) return json({ error: "Internal only" }, 403);

  const { data: stores, error: storesErr } = await admin
    .from("shopify_stores")
    .select("id, shop_domain, status")
    .in("status", ["connected", "error"]);
  if (storesErr) return json({ error: storesErr.message }, 500);

  let checked = 0;
  let healthy = 0;
  let failed = 0;

  for (const store of stores ?? []) {
    checked++;
    const { data: token } = await admin.rpc("shopify_store_get_token", { p_store_id: store.id });
    if (!token) {
      failed++;
      console.error("shopify-health: no token for store", store.id);
      continue;
    }

    let resp: Response;
    try {
      resp = await fetch(`https://${store.shop_domain}/admin/api/${SHOPIFY_API_VERSION}/shop.json`, {
        headers: { "X-Shopify-Access-Token": token },
      });
    } catch (err) {
      // Transient network issue -- don't flip a working store to error over
      // one failed fetch; just skip it this cycle and let tomorrow's run retry.
      console.warn("shopify-health: network error checking", store.shop_domain, err);
      continue;
    }

    const now = new Date().toISOString();

    if (resp.status === 401 || resp.status === 403) {
      failed++;
      await admin
        .from("shopify_stores")
        .update({ status: "error", last_health_check_at: now })
        .eq("id", store.id);
      continue;
    }

    if (!resp.ok) {
      console.warn("shopify-health: non-OK status", resp.status, store.shop_domain);
      await admin.from("shopify_stores").update({ last_health_check_at: now }).eq("id", store.id);
      continue;
    }

    healthy++;
    await admin
      .from("shopify_stores")
      .update({ status: "connected", last_health_check_at: now })
      .eq("id", store.id);

    // TODO(Phase 3, post shopify-webhook): re-check store.webhook_state here
    // and re-register any subscription Shopify has dropped (build plan §3.3:
    // "Shopify removes webhooks that repeatedly fail — health check +
    // re-registration is mandatory, not optional"). No-op today because
    // nothing registers webhook_state yet.
  }

  return json({ checked, healthy, failed });
});
