// cj-auth — CJ Dropshipping token cache/refresh. Internal-only: called by other
// edge functions (dispatch-order, freight-quote, cj-search, nightly-price-sync),
// never by a member or admin directly. Deployed --no-verify-jwt; the only
// accepted caller is the internal_trigger_secret bearer (checked in-code below).
//
// CJ auth facts (live-verified 2026-07-16, see docs/PHASE1_PLAN.md "Execution
// notes"): POST {api_base_url}/authentication/getAccessToken, JSON body
// `{"apiKey": "<cj_api_key vault secret>"}` (NOT email+password — the single
// cj_api_key secret, format CJUserNum@api@hexkey, is the entire apiKey field).
// Response: { code, result, message, data: { openId, accessToken,
// accessTokenExpiryDate, refreshToken, refreshTokenExpiryDate, createDate },
// requestId, pointsInfo, success }. CORRECTION (re-verified 2026-07-16 while
// building dispatch-order): the field is accessTokenExpiryDate (WITH "y"),
// ISO 8601 with offset e.g. "2027-01-12T07:11:22+08:00". An earlier version of
// this function read accessTokenExpireDate (no "y", wrong) which meant
// expires_at was always undefined, the supplier_tokens upsert silently failed
// its NOT NULL constraint every time (logged, never surfaced), and every
// caller re-hit CJ's harshly-throttled getAccessToken instead of using the
// cache. Fixed here.
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

  const { data: its } = await admin.rpc("get_secret", { secret_name: "internal_trigger_secret" });
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!its || bearer !== its) return json({ error: "Internal only" }, 403);

  const { force } = await req.json().catch(() => ({}));

  const { data: supplier } = await admin
    .from("suppliers")
    .select("id, api_base_url")
    .eq("name", "CJ Dropshipping")
    .single();
  if (!supplier) return json({ error: "CJ Dropshipping supplier row missing" }, 500);

  const { data: cached } = await admin
    .from("supplier_tokens")
    .select("access_token, expires_at")
    .eq("supplier_id", supplier.id)
    .maybeSingle();

  const tenMinFromNow = new Date(Date.now() + 10 * 60 * 1000);
  if (!force && cached && new Date(cached.expires_at) > tenMinFromNow) {
    return json({ accessToken: cached.access_token });
  }

  const { data: apiKey } = await admin.rpc("get_secret", { secret_name: "cj_api_key" });
  if (!apiKey) return json({ error: "cj_api_key secret missing" }, 500);

  let resp: Response;
  try {
    resp = await fetch(`${supplier.api_base_url}/authentication/getAccessToken`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey }),
    });
  } catch (err) {
    console.error("cj-auth fetch failed", err);
    if (cached) return json({ accessToken: cached.access_token, warning: "CJ unreachable, returned cached token" });
    return json({ error: "CJ unreachable and no cached token" }, 502);
  }

  if (resp.status === 429 || !resp.ok) {
    console.warn("cj-auth getAccessToken non-OK status", resp.status);
    if (cached) return json({ accessToken: cached.access_token, warning: `CJ returned ${resp.status}, using cached token` });
    return json({ error: `CJ getAccessToken failed with status ${resp.status}` }, 502);
  }

  const body = await resp.json();
  if (!body?.success || !body?.data?.accessToken) {
    console.error("cj-auth unexpected response", body?.code, body?.message);
    if (cached) return json({ accessToken: cached.access_token, warning: "CJ auth call failed, using cached token" });
    return json({ error: body?.message ?? "CJ getAccessToken returned no token" }, 502);
  }

  const { accessToken, accessTokenExpiryDate, refreshToken, refreshTokenExpiryDate } = body.data;

  const { error: upsertErr } = await admin.from("supplier_tokens").upsert({
    supplier_id: supplier.id,
    access_token: accessToken,
    expires_at: accessTokenExpiryDate,
    refresh_token: refreshToken ?? null,
    refresh_expires_at: refreshTokenExpiryDate ?? null,
    updated_at: new Date().toISOString(),
  });
  if (upsertErr) console.error("cj-auth failed to cache token", upsertErr);

  return json({ accessToken });
});
