// create-stripe-product — retired. Store products live only in Supabase; stock checkout
// charges one total against a single generic Stripe Product (create-checkout-session), so
// nothing per-product is created in Stripe any more. Kept as a no-op so older admin builds
// that still call it don't error.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return new Response(JSON.stringify({ skipped: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
