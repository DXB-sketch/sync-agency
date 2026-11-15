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

// Tier names, ranks and prices live in public.course_tiers (Supabase is the source of truth).
type CourseTier = { id: string; name: string; rank: number; price_cents: number };

// Sync Plus perk: 10% off every portal purchase. Applied per line in cents.
const PLUS_DISCOUNT_RATE = 0.1;

// Creator referral: an upgrade is credited to the creator who referred the member's first
// referred purchase. A member with no referrer can enter a creator code on an upgrade: that
// creator is credited and the member gets 10% off, unless the Sync Plus discount already
// applies (existing discounts win, they never stack).
const REFERRAL_DISCOUNT_RATE = 0.1;

function cleanCode(raw: unknown) {
  return typeof raw === "string" ? raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 20) : "";
}

// Stripe product hygiene (docs/INCIDENT_2026-07-17): never use price_data.product_data — that
// creates a brand-new Stripe Product on every single Checkout Session, which is exactly what ran
// the account up to 500+ products before. getOrCreateUpgradeProduct() creates one persistent
// product per tier a single time (found by metadata on every later call); the prorated diff is
// still charged correctly via a fresh (lightweight) Price each time — UpgradePage.jsx already
// shows the member the $X − $Y breakdown before they ever reach Stripe, so nothing is lost by the
// Stripe-hosted product name being static per tier instead of per-user.
const UPGRADE_PRODUCT_METADATA_KEY = "sync_tier_upgrade_product";
const cachedUpgradeProductIds: Record<string, string> = {};

async function getOrCreateUpgradeProduct(tier: string, tierName: string): Promise<string> {
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
    name: `Upgrade to ${tierName} (lifetime)`,
    metadata: { [UPGRADE_PRODUCT_METADATA_KEY]: tier },
  });
  cachedUpgradeProductIds[tier] = product.id;
  return cachedUpgradeProductIds[tier];
}

// Every stock order is charged as one total against a single generic Stripe Product (the
// wallet top-up pattern). Item names, descriptions and photos stay in Supabase only.
const STOCK_ORDER_PRODUCT_METADATA_KEY = "sync_stock_order_product";
let cachedStockOrderProductId: string | null = null;

async function getOrCreateStockOrderProduct(): Promise<string> {
  if (cachedStockOrderProductId) return cachedStockOrderProductId;
  const found = await stripe.products.search({
    query: `active:'true' AND metadata['${STOCK_ORDER_PRODUCT_METADATA_KEY}']:'true'`,
    limit: 1,
  });
  cachedStockOrderProductId =
    found.data[0]?.id ??
    (
      await stripe.products.create({
        name: "Sync stock order",
        metadata: { [STOCK_ORDER_PRODUCT_METADATA_KEY]: "true" },
      })
    ).id;
  return cachedStockOrderProductId;
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
    // ── Stock order: single lump-sum payment ──
    // Amount is always resolved server-side from the DB (never trusts the client-sent
    // unit_price) and charged as one inline price_data line against the generic stock-order
    // Product — never product_data, which would mint a new Stripe Product per checkout
    // (docs/INCIDENT_2026-07-17). Itemisation stays in order_items.
    if (kind === "stock_order") {
      if (!profile.subscription_active) return json({ error: "Portal access paused" }, 403);
      const { data: order } = await admin
        .from("orders")
        .select(
          "*, order_items(*, products(name, price))"
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
        };
      };

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

      const expectedTotal = order.order_items.reduce(
        (sum: number, item: OrderItem, i: number) => sum + amounts[i] * item.quantity,
        0
      );
      const itemCount = order.order_items.reduce((n: number, item: OrderItem) => n + item.quantity, 0);
      const orderRef = String(order.id).slice(0, 8).toUpperCase();

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "aud",
              product: await getOrCreateStockOrderProduct(),
              unit_amount: expectedTotal,
            },
            quantity: 1,
          },
        ],
        payment_intent_data: {
          description: `Stock order ${orderRef} (${itemCount} item${itemCount === 1 ? "" : "s"})`,
        },
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
      const { data: tiers } = await admin.from("course_tiers").select("id, name, rank, price_cents");
      const tierById = Object.fromEntries((tiers ?? []).map((t: CourseTier) => [t.id, t]));
      const targetTier: CourseTier | undefined = tierById[target];
      if (!targetTier) return json({ error: "Unknown tier" }, 400);
      // Free accounts (or legacy tier-less profiles) upgrade from rank 0 at full price
      if (targetTier.rank <= (tierById[profile.tier]?.rank ?? 0)) {
        return json({ error: "Can only upgrade to a higher tier" }, 400);
      }

      if (targetBilling !== "lifetime") {
        return json({ error: "Courses only support one-time payments" }, 400);
      }

      // A typed code beats a remembered link; a typed code must be active, a stale link is ignored.
      const { data: referrerId } = await admin.rpc("member_referrer", { p_member: user.id });
      const typedCode = cleanCode(body.code);
      const linkCode = cleanCode(body.link_code);
      let creatorId: string | null = null;
      let referralRate = 1;
      if (referrerId) {
        if (typedCode) {
          return json({ error: "Your account is already linked to a creator, so codes can't be applied." }, 400);
        }
        const { data: c } = await admin.from("creators").select("id").eq("id", referrerId).eq("active", true).maybeSingle();
        creatorId = c?.id ?? null;
      } else if (typedCode || linkCode) {
        const { data: c } = await admin
          .from("creators")
          .select("id")
          .ilike("code", typedCode || linkCode)
          .eq("active", true)
          .maybeSingle();
        if (typedCode && !c) return json({ error: "That code isn't valid." }, 400);
        creatorId = c?.id ?? null;
        if (creatorId && plusRate === 1) referralRate = 1 - REFERRAL_DISCOUNT_RATE;
      }

      // Lifetime upgrade: one-time payment of (target lifetime price − what they already paid),
      // less the Sync Plus discount for members
      const alreadyPaid = profile.tier_price_paid ?? 0;
      const targetPrice = targetTier.price_cents / 100;
      const diff = Math.max(targetPrice - alreadyPaid, 1);
      const unitAmount = Math.round(Math.round(diff * 100) * plusRate * referralRate);
      const upgradeProductId = await getOrCreateUpgradeProduct(target, targetTier.name);
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
          new_price_paid: String(targetPrice),
          ...(creatorId ? { creator_id: creatorId } : {}),
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
