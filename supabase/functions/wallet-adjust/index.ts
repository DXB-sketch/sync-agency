// wallet-adjust — admin manual credit / refund-to-wallet / adjustment (Phase 2 Project Chronos).
// Also the future hook for Phase 1's Exception Queue "resolve as wallet refund" path for
// Shopify orders — NOT wired to ExceptionQueuePage in Phase 2 (Shopify orders don't exist yet).
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

  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
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

  const body = await req.json().catch(() => ({}));
  const { member_id, amount_cents, type, reason, order_id } = body;
  if (!member_id || !amount_cents || !type || !reason) {
    return json({ error: "member_id, amount_cents, type and reason are required" }, 400);
  }

  const { data, error } = await admin.rpc("wallet_adjust", {
    p_member_id: member_id,
    p_amount_cents: amount_cents,
    p_type: type,
    p_reason: reason,
    p_actor: user.id,
    p_order_id: order_id ?? null,
  });
  if (error) return json({ error: error.message }, 500);
  return json(data);
});
