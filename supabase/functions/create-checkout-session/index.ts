// create-checkout-session — builds Stripe Checkout Sessions for signed-in members.
// kinds:
//   "stock_order" — one lump-sum payment for a draft order's items (per-item shipping
//                   already stored in order_items; NOT sent to Stripe).
//   "upgrade"     — prorated tier upgrade (difference between what was paid and the target tier).
// Sync Plus members (profiles.plus_status active/trialing) get 10% off both, with no cap.
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_PLACEHOLDER");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://syncagency.org";

const TIER_PRICES: Record<string, { lifetime: number }> = {
  pro: { lifetime: 97 },
  elite: { lifetime: 247 },
  vip: { lifetime: 689 },
};
const TIER_RANK: Record<string, number> = { free: 0, pro: 1, elite: 2, vip: 3 };
const TIER_NAMES: Record<string, string> = {
  pro: "Pro Accelerator",
  elite: "Elite Scale",
  vip: "VIP Inner Circle",
};

// Sync Plus perk: 10% off every portal purchase. Applied per line in cents.
const PLUS_DISCOUNT_RATE = 0.1;

// Stripe product hygiene (docs/INCIDENT_2026-07-17): never use price_data.product_data — that
// creates a brand-new Stripe Product on every single Checkout Session, which is exactly what ran
// the account up to 500+ products before. getOrCreateUpgradeProduct() creates one persistent
// product per tier a single time (found by metadata on every later call); the prorated diff is
// still charged correctly via a fresh (lightweight) Price each time — UpgradePage.jsx already
// shows the member the $X − $Y breakdown before they ever reach Stripe, so nothing is lost by the
// Stripe-hosted product name being static per tier instead of per-user.
const UPGRADE_PRODUCT_METADATA_KEY = "sync_tier_upgrade_product";
const cachedUpgradeProductIds: Record<string, string> = {};

async function getOrCreateUpgradeProduct(tier: string): Promise<string> {
  if (cachedUpgradeProductIds[tier]) return cachedUpgradeProductIds[tier];

  const found = await stripe.products.search({
    query: `active:'true' AND metadata['${UPGRADE_PRODUCT_METADATA_KEY}']:'${tier}'`,
    limit: 1,
  });
  if (found.data.length > 0) {
    cachedUpgradeProductIds[tier] = found.data[0].id;
    return cachedUpgradeProductIds[tier];
  }

  const product = await stripe.products.create({
    name: `Upgrade to ${TIER_NAMES[tier]} (lifetime)`,
    metadata: { [UPGRADE_PRODUCT_METADATA_KEY]: tier },
  });
  cachedUpgradeProductIds[tier] = product.id;
  return cachedUpgradeProductIds[tier];
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
  const plusRate =
    profile.plus_status === "active" || profile.plus_status === "trialing" ? 1 - PLUS_DISCOUNT_RATE : 1;

  try {
    // ── Stock order: single lump-sum payment, one line item per order item ──
    // Amount is always resolved server-side from the DB (never trusts the client-sent
    // unit_price) and passed as inline price_data referencing the product's existing
    // canonical Stripe Product — never product_data, which would mint a new Stripe
    // Product per checkout (docs/INCIDENT_2026-07-17). No stored Stripe Price is used
    // or required for this path anymore.
    if (kind === "stock_order") {
      if (!profile.subscription_active) return json({ error: "Portal access paused" }, 403);
      const { data: order } = await admin
        .from("orders")
        .select(
          "*, order_items(*, products(name, price, stripe_product_id))"
        )
        .eq("id", body.order_id)
        .eq("member_id", user.id)
        .eq("status", "pending_payment")
        .single();
      if (!order || !order.order_items?.length) return json({ error: "Order not found" }, 404);

      type OrderItem = {
        quantity: number;
        products: {
          name: string;
          price: number;
          stripe_product_id: string | null;
        };
      };

      const unlinked = order.order_items.find((item: OrderItem) => !item.products.stripe_product_id);
      if (unlinked) {
        return json(
          { error: `"${unlinked.products.name}" isn't linked to Stripe yet — contact support` },
          409
        );
      }

      // Charge = client sell price ONLY (less the Sync Plus discount for members). Never add
      // profit/margin/resale/fees here. products.listing_price / products.discount_price are
      // Depop resale marketplace prices — NEVER use them here (docs/INCIDENT_2026-07-21
      // overcharge). products.price is the only column that reflects what the member actually
      // agreed to pay.
      const amounts = order.order_items.map((item: OrderItem) => {
        return Math.round(Number(item.products.price) * 100 * plusRate);
      });
      const invalidIndex = amounts.findIndex((a: number, i: number) => {
        const expected = Math.round(Number(order.order_items[i].products.price) * 100 * plusRate);
        const full = Math.round(Number(order.order_items[i].products.price) * 100);
        return !Number.isFinite(a) || a <= 0 || a !== expected || a > full;
      });
      if (invalidIndex !== -1) {
        return json(
          { error: `Invalid price for product "${order.order_items[invalidIndex].products.name}"` },
          400
        );
      }

      const line_items = order.order_items.map((item: OrderItem, i: number) => ({
        price_data: {
          currency: "aud",
          product: item.products.stripe_product_id as string,
          unit_amount: amounts[i],
        },
        quantity: item.quantity,
      }));

      const expectedTotal = order.order_items.reduce(
        (sum: number, item: OrderItem, i: number) => sum + amounts[i] * item.quantity,
        0
      );

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items,
        customer_email: profile.email ?? undefined,
        success_url: `${SITE_URL}/portal/checkout?paid=1`,
        cancel_url: `${SITE_URL}/portal/checkout`,
        metadata: { kind: "stock_order", order_id: order.id, member_id: user.id },
      });

      // Tripwire: if Stripe's own total ever diverges from the sum of our line amounts (a
      // stray fee, tax, shipping, or profit inflating the total), refuse to hand the session
      // to the client — an overcharge must never silently reach a member.
      if (session.amount_total !== expectedTotal) {
        await stripe.checkout.sessions.expire(session.id).catch((e) => console.error("expire failed", e));
        console.error("amount_total mismatch", {
          order_id: order.id,
          expectedTotal,
          amount_total: session.amount_total,
        });
        return json({ error: "Pricing verification failed — order not charged. Contact support." }, 500);
      }

      // Keep the order's recorded total in sync with what's actually charged.
      await admin
        .from("orders")
        .update({ stripe_session_id: session.id, total_amount: expectedTotal / 100 })
        .eq("id", order.id);
      return json({ url: session.url });
    }

    // ── Tier upgrade: pay the prorated difference ──
    if (kind === "upgrade") {
      const target = body.target_tier as string;
      const targetBilling = (body.target_billing as string) ?? "lifetime";
      if (!Object.hasOwn(TIER_PRICES, target)) return json({ error: "Unknown tier" }, 400);
      // Free accounts (or legacy tier-less profiles) upgrade from rank 0 at full price
      if (TIER_RANK[target] <= (TIER_RANK[profile.tier] ?? 0)) {
        return json({ error: "Can only upgrade to a higher tier" }, 400);
      }

      if (targetBilling !== "lifetime") {
        return json({ error: "Courses only support one-time payments" }, 400);
      }

      // Lifetime upgrade: one-time payment of (target lifetime price − what they already paid),
      // less the Sync Plus discount for members
      const alreadyPaid = profile.tier_price_paid ?? 0;
      const diff = Math.max(TIER_PRICES[target].lifetime - alreadyPaid, 1);
      const unitAmount = Math.round(Math.round(diff * 100) * plusRate);
      const upgradeProductId = await getOrCreateUpgradeProduct(target);
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "aud",
              product: upgradeProductId,
              unit_amount: unitAmount,
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

    return json({ error: "Unknown kind" }, 400);
  } catch (err) {
    console.error(err);
    return json({ error: "Stripe error — are the Stripe keys configured yet?" }, 500);
  }
});
