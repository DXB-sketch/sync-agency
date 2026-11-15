// create-landing-checkout — public checkout for the marketing site's coaching tiers.
// No signed-in user required: Stripe collects the buyer's email, and stripe-webhook's
// course-purchase path (metadata kind "course") records the purchase and links/upgrades the
// matching profile by email.
// Prices come from public.course_tiers and are charged as inline price_data against the
// plan's existing Stripe Product — Supabase is the source of truth, no fixed Stripe Prices.
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_PLACEHOLDER");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://syncagency.org";

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

  const body = await req.json().catch(() => ({}));
  const plan = (body.plan as string) ?? "lifetime";
  if (typeof body.tier !== "string" || plan !== "lifetime") {
    return json({ error: "Unknown tier or plan" }, 400);
  }

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: tier } = await admin
    .from("course_tiers")
    .select("id, name, price_cents, stripe_product_id")
    .eq("id", body.tier)
    .maybeSingle();
  if (!tier) return json({ error: "Unknown tier or plan" }, 400);

  // Same sanitisation as src/utils/affiliate.js — Stripe's client_reference_id rules.
  const affiliate =
    typeof body.affiliate === "string"
      ? body.affiliate.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 200)
      : "";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      line_items: [
        {
          price_data: { currency: "aud", product: tier.stripe_product_id, unit_amount: tier.price_cents },
          quantity: 1,
        },
      ],
      payment_intent_data: { description: `${tier.name} coaching plan (lifetime access)` },
      metadata: { kind: "course", tier: tier.id },
      client_reference_id: affiliate || undefined,
      success_url: `${SITE_URL}/?checkout=success&tier=${encodeURIComponent(tier.name)}`,
      cancel_url: `${SITE_URL}/#pricing`,
    });
    return json({ url: session.url });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not start checkout — please try again." }, 500);
  }
});
