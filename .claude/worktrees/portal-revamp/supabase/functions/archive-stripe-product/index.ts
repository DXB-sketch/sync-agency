// archive-stripe-product — admin-only. Called right before a catalogue entry
// is deleted from the store. Archives the Stripe Price(s) tied to the
// products rows being removed, and archives the parent Stripe Product too
// once it has no active prices left. Also clears the matching
// product_catalog claim row(s) so a future product with the same name/price
// creates a fresh Stripe object instead of resurrecting an archived one.
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_PLACEHOLDER");

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

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
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

  const { product_ids } = await req.json().catch(() => ({}));
  if (!Array.isArray(product_ids) || product_ids.length === 0) {
    return json({ error: "product_ids required" }, 400);
  }

  try {
    const { data: rows } = await admin
      .from("products")
      .select("stripe_price_id")
      .in("id", product_ids)
      .not("stripe_price_id", "is", null);
    const priceIds = [...new Set((rows ?? []).map((r) => r.stripe_price_id as string))];

    let archivedPrices = 0;
    let archivedProducts = 0;

    for (const priceId of priceIds) {
      let price: Stripe.Price;
      try {
        price = await stripe.prices.retrieve(priceId);
      } catch {
        continue; // already gone from Stripe
      }
      if (price.active) {
        await stripe.prices.update(priceId, { active: false });
        archivedPrices++;
      }
      const productId = typeof price.product === "string" ? price.product : price.product.id;
      const remaining = await stripe.prices.list({ product: productId, active: true, limit: 1 });
      if (remaining.data.length === 0) {
        await stripe.products.update(productId, { active: false });
        archivedProducts++;
      }
    }

    if (priceIds.length > 0) {
      await admin.from("product_catalog").delete().in("stripe_price_id", priceIds);
    }

    return json({ archived_prices: archivedPrices, archived_products: archivedProducts });
  } catch (err) {
    console.error(err);
    return json({ error: "Stripe archive failed — check the function logs" }, 500);
  }
});
