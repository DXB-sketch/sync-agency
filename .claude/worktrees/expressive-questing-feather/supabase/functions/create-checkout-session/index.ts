// create-checkout-session — builds Stripe Checkout Sessions for signed-in members.
// kinds:
//   "stock_order" — one lump-sum payment for a draft order's items (per-item shipping
//                   already stored in order_items; NOT sent to Stripe).
//   "upgrade"     — prorated tier upgrade (difference between what was paid and the target tier).
//   "reactivate"  — restart a lapsed monthly subscription for the member's current tier.
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_PLACEHOLDER");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://syncagency.org";

const TIER_PRICES: Record<string, { lifetime: number; monthly: number }> = {
  pro: { lifetime: 189, monthly: 79 },
  elite: { lifetime: 397, monthly: 127 },
  vip: { lifetime: 739, monthly: 349 },
};
const TIER_RANK: Record<string, number> = { free: 0, pro: 1, elite: 2, vip: 3 };
const TIER_NAMES: Record<string, string> = {
  pro: "Pro Accelerator",
  elite: "Elite Scale",
  vip: "VIP Inner Circle",
};

// ─── PLACEHOLDER: replace with the real MONTHLY Stripe Price IDs per tier ───
const MONTHLY_PRICE_IDS: Record<string, string> = {
  pro: "price_1TcdJaPDABwVk3W5hRkD3gyK",
  elite: "price_1TcdNBPDABwVk3W5rWIalCC2",
  vip: "price_1TcdNzPDABwVk3W5MVIkLkpj",
};
// ────────────────────────────────────────────────────────────────────────────

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
  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) return json({ error: "No profile" }, 400);

  const body = await req.json().catch(() => ({}));
  const kind = body.kind as string;

  try {
    // ── Stock order: single lump-sum payment, one line item per order item ──
    if (kind === "stock_order") {
      if (!profile.subscription_active) return json({ error: "Subscription inactive" }, 403);
      const { data: order } = await admin
        .from("orders")
        .select("*, order_items(*, products(name, stripe_price_id))")
        .eq("id", body.order_id)
        .eq("member_id", user.id)
        .eq("status", "pending_payment")
        .single();
      if (!order || !order.order_items?.length) return json({ error: "Order not found" }, 404);

      const line_items = order.order_items.map(
        (item: { quantity: number; unit_price: number; products: { name: string; stripe_price_id: string | null } }) =>
          item.products.stripe_price_id
            ? { price: item.products.stripe_price_id, quantity: item.quantity }
            : {
                // Fallback for products created before Stripe keys were configured
                price_data: {
                  currency: "aud",
                  product_data: { name: item.products.name },
                  unit_amount: Math.round(Number(item.unit_price) * 100),
                },
                quantity: item.quantity,
              }
      );

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items,
        customer_email: profile.email ?? undefined,
        success_url: `${SITE_URL}/portal/checkout?paid=1`,
        cancel_url: `${SITE_URL}/portal/checkout`,
        metadata: { kind: "stock_order", order_id: order.id, member_id: user.id },
      });
      await admin.from("orders").update({ stripe_session_id: session.id }).eq("id", order.id);
      return json({ url: session.url });
    }

    // ── Tier upgrade: pay the prorated difference ──
    if (kind === "upgrade") {
      const target = body.target_tier as string;
      const targetBilling = (body.target_billing as string) ?? "lifetime";
      if (!TIER_PRICES[target]) return json({ error: "Unknown tier" }, 400);
      // Free accounts (or legacy tier-less profiles) upgrade from rank 0 at full price
      if (TIER_RANK[target] <= (TIER_RANK[profile.tier] ?? 0)) {
        return json({ error: "Can only upgrade to a higher tier" }, 400);
      }

      if (targetBilling === "monthly") {
        // Switching onto a monthly plan: new subscription at the target tier's monthly price
        const session = await stripe.checkout.sessions.create({
          mode: "subscription",
          line_items: [{ price: MONTHLY_PRICE_IDS[target], quantity: 1 }],
          customer_email: profile.email ?? undefined,
          success_url: `${SITE_URL}/portal?upgraded=1`,
          cancel_url: `${SITE_URL}/portal/upgrade`,
          metadata: {
            kind: "upgrade",
            member_id: user.id,
            target_tier: target,
            target_billing: "monthly",
            new_price_paid: String(TIER_PRICES[target].monthly),
          },
        });
        return json({ url: session.url });
      }

      // Lifetime upgrade: one-time payment of (target lifetime price − what they already paid)
      const alreadyPaid = profile.tier_price_paid ?? 0;
      const diff = Math.max(TIER_PRICES[target].lifetime - alreadyPaid, 1);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "aud",
              product_data: {
                name: `Upgrade to ${TIER_NAMES[target]} (lifetime)`,
                description: `Prorated: $${TIER_PRICES[target].lifetime} minus $${alreadyPaid} already paid`,
              },
              unit_amount: diff * 100,
            },
            quantity: 1,
          },
        ],
        customer_email: profile.email ?? undefined,
        success_url: `${SITE_URL}/portal?upgraded=1`,
        cancel_url: `${SITE_URL}/portal/upgrade`,
        metadata: {
          kind: "upgrade",
          member_id: user.id,
          target_tier: target,
          target_billing: "lifetime",
          new_price_paid: String(TIER_PRICES[target].lifetime),
        },
      });
      return json({ url: session.url });
    }

    // ── Reactivate a lapsed monthly subscription ──
    if (kind === "reactivate") {
      if (!profile.tier || !MONTHLY_PRICE_IDS[profile.tier]) {
        return json({ error: "No paid tier on account" }, 400);
      }
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price: MONTHLY_PRICE_IDS[profile.tier], quantity: 1 }],
        customer_email: profile.email ?? undefined,
        success_url: `${SITE_URL}/portal?reactivated=1`,
        cancel_url: `${SITE_URL}/portal/reactivate`,
        metadata: { kind: "reactivate", member_id: user.id },
      });
      return json({ url: session.url });
    }

    return json({ error: "Unknown kind" }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: "Stripe error — are the Stripe keys configured yet?" }, 500);
  }
});
