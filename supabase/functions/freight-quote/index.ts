// freight-quote — CN->AU shipping options lookup for a CJ variant. Admin
// tooling (linker modal, margin checks) + internal callers. Stateless, no DB
// writes beyond the supplier_products lookup used to resolve
// supplier_product_id -> external_variant_id.
//
// CJ endpoint (live-verified 2026-07-16): POST {api_base_url}/logistic/freightCalculate,
// header CJ-Access-Token, JSON body { startCountryCode, endCountryCode,
// products: [{ vid, quantity }] }. Response: { code, data: [{ logisticName,
// logisticPrice, logisticAging, ... }], message, success }.
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

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Internal-caller pattern: service bearer OR admin JWT.
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: its } = await admin.rpc("get_secret", { secret_name: "internal_trigger_secret" });
  let authorized = !!its && bearer === its;

  if (!authorized) {
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );
    const {
      data: { user },
    } = await userClient.auth.getUser();
    if (user) {
      const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
      authorized = caller?.role === "admin";
    }
  }
  if (!authorized) return json({ error: "Admin only" }, 403);

  const { vid, supplier_product_id, quantity, country_code } = await req.json().catch(() => ({}));
  const qty = Number(quantity) || 1;
  const country = country_code || "AU";

  let resolvedVid = vid as string | undefined;
  if (!resolvedVid && supplier_product_id) {
    const { data: sp } = await admin
      .from("supplier_products")
      .select("external_variant_id")
      .eq("id", supplier_product_id)
      .single();
    resolvedVid = sp?.external_variant_id;
  }
  if (!resolvedVid) return json({ error: "vid or supplier_product_id required" }, 400);

  const { data: supplier } = await admin
    .from("suppliers")
    .select("api_base_url")
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

  const resp = await fetch(`${supplier.api_base_url}/logistic/freightCalculate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "CJ-Access-Token": accessToken },
    body: JSON.stringify({
      startCountryCode: "CN",
      endCountryCode: country,
      products: [{ vid: resolvedVid, quantity: qty }],
    }),
  });
  if (!resp.ok) return json({ error: `CJ freightCalculate failed with status ${resp.status}` }, 502);

  const body = await resp.json();
  if (!body?.success || !Array.isArray(body?.data)) {
    return json({ error: body?.message ?? "CJ freightCalculate returned no options" }, 502);
  }

  const options = body.data
    .filter((o: Record<string, unknown>) => o && o.logisticName && o.logisticPrice != null)
    .map((o: Record<string, unknown>) => ({
      logisticName: o.logisticName,
      logisticPrice: o.logisticPrice,
      logisticAging: o.logisticAging,
    }))
    .sort((a: { logisticPrice: number }, b: { logisticPrice: number }) => a.logisticPrice - b.logisticPrice);

  return json({ options });
});
