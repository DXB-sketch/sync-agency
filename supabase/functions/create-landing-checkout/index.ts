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

// Creator referral: an active creator code takes 10% off the course. The discount is priced here
// from public.creators, never from the client, which only ever sends a code string.
const REFERRAL_DISCOUNT_RATE = 0.1;

function cleanCode(raw: unknown) {
  return typeof raw === "string" ? raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 20) : "";
}

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

  // A typed code beats a remembered link. A typed code must be active; a stale link is ignored.
  const typedCode = cleanCode(body.code);
  const linkCode = cleanCode(body.link_code);
  let creator: { id: string; code: string } | null = null;
  if (typedCode || linkCode) {
    const { data } = await admin
      .from("creators")
      .select("id, code")
      .ilike("code", typedCode || linkCode)
      .eq("active", true)
      .maybeSingle();
    creator = data;
    if (typedCode && !creator) return json({ error: "That code isn't valid." }, 400);
  }

  const unitAmount = creator
    ? Math.round(tier.price_cents * (1 - REFERRAL_DISCOUNT_RATE))
    : tier.price_cents;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      // Existing Stripe promo codes win over creator codes and never stack: with a creator code
      // the promo field is off; the buyer can drop the creator code in the drawer to use one.
      allow_promotion_codes: !creator,
      line_items: [
        {
          price_data: { currency: "aud", product: tier.stripe_product_id, unit_amount: unitAmount },
          quantity: 1,
        },
      ],
      payment_intent_data: { description: `${tier.name} coaching plan (lifetime access)` },
      metadata: { kind: "course", tier: tier.id, ...(creator ? { creator_id: creator.id } : {}) },
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
