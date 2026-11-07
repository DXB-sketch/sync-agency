// plus-subscription — member-facing Sync Plus ($34 AUD/month) actions.
// action "subscribe": Stripe Checkout Session in subscription mode. Course owners only.
//   The profile's plus_* columns are only ever switched on by stripe-webhook once Stripe
//   confirms the subscription — this function writes nothing for that path.
// action "cancel" / "resume": toggles cancel_at_period_end on the member's subscription, so
//   cancelling keeps the perks until the end of the paid month.
//
// Stripe product hygiene (docs/INCIDENT_2026-07-17): the one Sync Plus Price is found by its
// lookup_key (exact match, not the eventually-consistent Search API) and only created if
// it's missing — never a new Product/Price per checkout.
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_PLACEHOLDER");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://syncagency.org";

const PLUS_LOOKUP_KEY = "sync_plus_monthly";
const PLUS_AMOUNT_CENTS = 3400;
const COURSE_TIERS = ["pro", "elite", "vip"];
let cachedPriceId: string | null = null;

async function getOrCreatePlusPrice(): Promise<string> {
  if (cachedPriceId) return cachedPriceId;
  const found = await stripe.prices.list({ lookup_keys: [PLUS_LOOKUP_KEY], active: true, limit: 1 });
  if (found.data.length > 0) {
    cachedPriceId = found.data[0].id;
    return cachedPriceId;
  }
  const product = await stripe.products.create({
    name: "Sync Plus",
    description: "10% off every portal purchase, +1 product slot and a monthly $500 wallet credit draw.",
  });
  const price = await stripe.prices.create({
    product: product.id,
    currency: "aud",
    unit_amount: PLUS_AMOUNT_CENTS,
    recurring: { interval: "month" },
    lookup_key: PLUS_LOOKUP_KEY,
  });
  cachedPriceId = price.id;
  return cachedPriceId;
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

function isPlusActive(status: string | null) {
  return status === "active" || status === "trialing";
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
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return json({ error: "No profile" }, 400);

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  try {
    if (action === "subscribe") {
      if (!COURSE_TIERS.includes(profile.tier) || !profile.subscription_active) {
        return json({ error: "Sync Plus is available to course members only" }, 403);
      }
      if (isPlusActive(profile.plus_status)) {
        return json({ error: "You're already a Sync Plus member" }, 409);
      }
      const priceId = await getOrCreatePlusPrice();
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        ...(profile.stripe_customer_id
          ? { customer: profile.stripe_customer_id }
          : { customer_email: profile.email ?? undefined }),
        success_url: `${SITE_URL}/portal/plus?joined=1`,
        cancel_url: `${SITE_URL}/portal/plus`,
        metadata: { kind: "plus_subscription", member_id: user.id },
        subscription_data: { metadata: { kind: "plus", member_id: user.id } },
      });
      return json({ url: session.url });
    }

    if (action === "cancel" || action === "resume") {
      if (!profile.plus_subscription_id || !isPlusActive(profile.plus_status)) {
        return json({ error: "No active Sync Plus subscription" }, 404);
      }
      const cancel = action === "cancel";
      await stripe.subscriptions.update(profile.plus_subscription_id, { cancel_at_period_end: cancel });
      await admin.from("profiles").update({ plus_cancel_at_period_end: cancel }).eq("id", user.id);
      return json({ cancel_at_period_end: cancel });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: "Stripe error — please try again or contact support." }, 500);
  }
});
