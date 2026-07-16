// update-stripe-price — admin-only. Stripe Prices are immutable: create (or
// reuse) a Price at the new amount, point the products row at it, and archive
// the old one only if no other store product still uses it.
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

  const { product_id, new_price } = await req.json().catch(() => ({}));
  const price = Number(new_price);
  if (!product_id || !Number.isFinite(price) || price <= 0) {
    return json({ error: "product_id and a positive new_price required" }, 400);
  }

  const { data: product } = await admin.from("products").select("*").eq("id", product_id).single();
  if (!product) return json({ error: "Product not found" }, 404);

  // Always update the DB price (source of truth for the portal UI + order snapshots)
  await admin.from("products").update({ price }).eq("id", product_id);

  if (!product.stripe_price_id) return json({ price, stripe_price_id: null });

  try {
    const oldPrice = await stripe.prices.retrieve(product.stripe_price_id);
    const stripeProductId =
      typeof oldPrice.product === "string" ? oldPrice.product : oldPrice.product.id;
    const unit_amount = Math.round(price * 100);

    // Reuse an active one-off Price at this amount if one already exists
    const existing = await stripe.prices.list({ product: stripeProductId, active: true, limit: 100 });
    const match = existing.data.find(
      (p) => p.unit_amount === unit_amount && p.currency === "aud" && !p.recurring
    );
    const newStripePrice =
      match ?? (await stripe.prices.create({ product: stripeProductId, currency: "aud", unit_amount }));

    // Only archive the old Price if no other store product still points at it
    const { count: stillUsed } = await admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .neq("id", product_id)
      .eq("stripe_price_id", product.stripe_price_id);
    if (!stillUsed && newStripePrice.id !== product.stripe_price_id) {
      await stripe.prices.update(product.stripe_price_id, { active: false });
    }

    await admin
      .from("products")
      .update({ stripe_price_id: newStripePrice.id })
      .eq("id", product_id);
    return json({ price, stripe_price_id: newStripePrice.id });
  } catch (err) {
    console.error(err);
    return json({ error: "DB price updated, but Stripe price update failed" }, 500);
  }
});
