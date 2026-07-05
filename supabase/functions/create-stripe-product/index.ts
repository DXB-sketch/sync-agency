// create-stripe-product — admin-only. Links a store product to Stripe and saves
// stripe_price_id on the products row. Reuses the existing Stripe Product/Price
// when another store already sells the same item (same name), so giving one
// item to many members never duplicates it in Stripe.
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

  const { product_id } = await req.json().catch(() => ({}));
  const { data: product } = await admin.from("products").select("*").eq("id", product_id).single();
  if (!product) return json({ error: "Product not found" }, 404);

  if (product.stripe_price_id) return json({ stripe_price_id: product.stripe_price_id, reused: true });

  try {
    // Another store already sells this item? Reuse its Stripe Product/Price.
    const { data: twins } = await admin
      .from("products")
      .select("id, price, stripe_price_id")
      .neq("id", product.id)
      .not("stripe_price_id", "is", null)
      .ilike("name", product.name.replace(/[%_]/g, "\\$&"));

    const unit_amount = Math.round(Number(product.price) * 100);
    const samePrice = (twins ?? []).find((t) => Number(t.price) === Number(product.price));
    if (samePrice) {
      await admin
        .from("products")
        .update({ stripe_price_id: samePrice.stripe_price_id })
        .eq("id", product.id);
      return json({ stripe_price_id: samePrice.stripe_price_id, reused: true });
    }

    let stripeProductId: string;
    if (twins && twins.length > 0) {
      // Same item at a different price — new Price on the existing Stripe Product
      const twinPrice = await stripe.prices.retrieve(twins[0].stripe_price_id);
      stripeProductId =
        typeof twinPrice.product === "string" ? twinPrice.product : twinPrice.product.id;
    } else {
      const stripeProduct = await stripe.products.create({
        name: product.name,
        description: product.description ?? undefined,
        images: product.image_url ? [product.image_url] : undefined,
        metadata: { supabase_product_id: product.id, member_id: product.member_id },
      });
      stripeProductId = stripeProduct.id;
    }

    // Reuse an active one-off Price at this amount if one already exists
    const existing = await stripe.prices.list({ product: stripeProductId, active: true, limit: 100 });
    const match = existing.data.find(
      (p) => p.unit_amount === unit_amount && p.currency === "aud" && !p.recurring
    );
    const stripePrice =
      match ?? (await stripe.prices.create({ product: stripeProductId, currency: "aud", unit_amount }));
    await admin.from("products").update({ stripe_price_id: stripePrice.id }).eq("id", product.id);
    return json({ stripe_price_id: stripePrice.id });
  } catch (err) {
    console.error(err);
    // Product stays usable — checkout falls back to price_data until Stripe is configured
    return json({ error: "Stripe error — product saved without a Stripe price" }, 500);
  }
});
