// create-landing-checkout — public checkout for the marketing site's coaching tiers.
// No signed-in user required: Stripe collects the buyer's email, and stripe-webhook's
// course-purchase path (COURSE_PRICE_MAP) records the purchase and links/upgrades the
// matching profile by email. Replaces the dead /checkout.php endpoint from the old host.
import Stripe from "npm:stripe@18";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_PLACEHOLDER");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://syncagency.org";

// Must stay in sync with COURSE_PRICE_MAP in stripe-webhook/index.ts.
// Course access is purchased with a one-time payment.
const TIERS: Record<string, { price: string; name: string }> = {
  pro: {
    price: "price_1UF36jPDABwVk3W5A4RJnrro",
    name: "Pro Accelerator",
  },
  elite: {
    price: "price_1UF371PDABwVk3W5F336GwQC",
    name: "Elite Scale",
  },
  vip: {
    price: "price_1UF376PDABwVk3W5S6Qlld9v",
    name: "VIP Inner Circle",
  },
};

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
  const tier = TIERS[body.tier as string];
  const plan = (body.plan as string) ?? "lifetime";
  if (!Object.hasOwn(TIERS, body.tier) || (plan !== "lifetime" && plan !== "yearly")) {
    return json({ error: "Unknown tier or plan" }, 400);
  }

  // Same sanitisation as src/utils/affiliate.js — Stripe's client_reference_id rules.
  const affiliate =
    typeof body.affiliate === "string"
      ? body.affiliate.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 200)
      : "";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      allow_promotion_codes: true,
      line_items: [{ price: tier.price, quantity: 1 }],
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
