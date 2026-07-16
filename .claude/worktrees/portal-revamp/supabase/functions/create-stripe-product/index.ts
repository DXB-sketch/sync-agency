// create-stripe-product — admin-only. Links a store product to Stripe and saves
// stripe_price_id on the products row. Reuses the existing Stripe Product/Price
// when another store already sells the same item (same name + price), so
// giving one item to many members never duplicates it in Stripe.
//
// Reuse is coordinated through the product_catalog table via the
// claim_product_catalog() RPC, which atomically claims a (name, price) slot.
// Only the caller that wins the claim talks to Stripe; every other concurrent
// caller (e.g. a bulk assign firing many of these at once) reuses the result,
// closing the race that used to let concurrent inserts each create their own
// duplicate Stripe product.
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const key = product.name.trim().toLowerCase();
  const price = Number(product.price);

  try {
    const { data: claimRows, error: claimErr } = await admin.rpc("claim_product_catalog", {
      p_key: key,
      p_price: price,
      p_name: product.name,
    });
    if (claimErr) throw claimErr;
    const claim = claimRows[0];

    // Someone already resolved this exact item — reuse it, no Stripe call needed.
    if (!claim.claimed && claim.stripe_price_id) {
      await admin.from("products").update({ stripe_price_id: claim.stripe_price_id }).eq("id", product.id);
      return json({ stripe_price_id: claim.stripe_price_id, reused: true });
    }

    // Another concurrent request is creating it right now — wait for it
    // instead of racing to create a second Stripe product ourselves.
    if (!claim.claimed) {
      for (let i = 0; i < 15; i++) {
        await sleep(400);
        const { data: fresh } = await admin
          .from("product_catalog")
          .select("stripe_price_id")
          .eq("id", claim.id)
          .single();
        if (fresh?.stripe_price_id) {
          await admin.from("products").update({ stripe_price_id: fresh.stripe_price_id }).eq("id", product.id);
          return json({ stripe_price_id: fresh.stripe_price_id, reused: true });
        }
      }
      // Gave up waiting (the winning request likely failed) — fall through
      // and create it ourselves so the product doesn't stay unlinked forever.
    }

    const unit_amount = Math.round(price * 100);
    let stripeProductId: string | undefined;

    // First time this item is claimed: check for a pre-existing Stripe
    // product from before this table existed, so we don't spin up a fresh
    // one unnecessarily.
    if (claim.claimed) {
      const { data: twins } = await admin
        .from("products")
        .select("id, price, stripe_price_id")
        .neq("id", product.id)
        .not("stripe_price_id", "is", null)
        .ilike("name", product.name.replace(/[%_]/g, "\\$&"));
      const samePrice = (twins ?? []).find((t) => Number(t.price) === price);
      if (samePrice) {
        const twinPrice = await stripe.prices.retrieve(samePrice.stripe_price_id);
        stripeProductId = typeof twinPrice.product === "string" ? twinPrice.product : twinPrice.product.id;
      }
    }

    if (!stripeProductId) {
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

    await admin
      .from("product_catalog")
      .update({ stripe_product_id: stripeProductId, stripe_price_id: stripePrice.id })
      .eq("id", claim.id);
    await admin.from("products").update({ stripe_price_id: stripePrice.id }).eq("id", product.id);
    return json({ stripe_price_id: stripePrice.id });
  } catch (err) {
    console.error(err);
    // Product stays usable — checkout falls back to price_data until Stripe is configured
    return json({ error: "Stripe error — product saved without a Stripe price" }, 500);
  }
});
