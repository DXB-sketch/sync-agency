// wallet-topup — member-facing wallet actions. Wallet (store credit) is a live feature for
// every active member — no longer Shopify/Chronos pathway-gated.
// action "create_session" (default): Stripe Checkout Session for a wallet top-up. The wallet
//   itself is only ever credited by stripe-webhook -> wallet_topup_credit RPC; this function
//   makes no DB write for that path — an abandoned checkout leaves zero rows anywhere.
//   If a wallet promo is live and the amount qualifies, its id is pinned to the session
//   metadata so stripe-webhook grants the reward the member saw at checkout.
// action "set_threshold": service-role upsert of the member's low-balance alert preference.
//   Not money, but wallets is never client-writable (RLS has zero write policies), so even
//   this preference needs a service-role path.
//
// Stripe product hygiene (docs/INCIDENT_2026-07-17): never use price_data.product_data here —
// that creates a brand-new Stripe Product on every single Checkout Session, which is exactly
// what ran the account up to 500+ products before. getOrCreateTopupProduct() below reuses the
// one "Sync Wallet Top-up" product every time and every top-up references it by id via
// price_data.product — only a lightweight Price is created per session, never a duplicate Product.
//
// Lookup is coordinated through the product_catalog table via the claim_product_catalog() RPC
// (same atomic-claim pattern create-stripe-product uses), keyed on a fixed sentinel
// key/price rather than a real product name+price. This closes a race that a Stripe Search-based
// lookup can't: Stripe's Search API is eventually consistent, so two concurrent top-ups could
// each search before the other's product was indexed and both create one. The DB's unique
// (key, price) constraint makes the claim atomic instead.
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_PLACEHOLDER");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://syncagency.org";

const PRESET_AMOUNTS = [5000, 10000, 25000, 50000];

const TOPUP_CATALOG_KEY = "sync_wallet_topup_product";
const TOPUP_CATALOG_PRICE = 0;
let cachedTopupProductId: string | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getOrCreateTopupProduct(admin: ReturnType<typeof createClient>): Promise<string> {
  if (cachedTopupProductId) return cachedTopupProductId;

  const { data: claimRows, error: claimErr } = await admin.rpc("claim_product_catalog", {
    p_key: TOPUP_CATALOG_KEY,
    p_price: TOPUP_CATALOG_PRICE,
    p_name: "Sync Wallet Top-up",
  });
  if (claimErr) throw claimErr;
  const claim = claimRows[0];

  if (!claim.claimed && claim.stripe_product_id) {
    cachedTopupProductId = claim.stripe_product_id;
    return cachedTopupProductId;
  }

  if (!claim.claimed) {
    // Another concurrent request just claimed this and is creating it right
    // now — wait for it instead of racing to create a second Product.
    for (let i = 0; i < 15; i++) {
      await sleep(400);
      const { data: fresh } = await admin
        .from("product_catalog")
        .select("stripe_product_id")
        .eq("id", claim.id)
        .single();
      if (fresh?.stripe_product_id) {
        cachedTopupProductId = fresh.stripe_product_id;
        return cachedTopupProductId;
      }
    }
    // Gave up waiting (the winning request likely failed) — fall through
    // and create it ourselves so top-ups don't stay stuck forever.
  }

  const product = await stripe.products.create({
    name: "Sync Wallet Top-up",
    metadata: { [TOPUP_CATALOG_KEY]: "true" },
  });
  await admin
    .from("product_catalog")
    .update({ stripe_product_id: product.id })
    .eq("id", claim.id);
  cachedTopupProductId = product.id;
  return cachedTopupProductId;
}

// The one switched-on promo (wallet_promos_single_active), if its schedule covers now.
async function livePromo(admin: ReturnType<typeof createClient>) {
  const { data: promo } = await admin
    .from("wallet_promos")
    .select("id, min_topup_cents, starts_at, ends_at")
    .eq("active", true)
    .maybeSingle();
  if (!promo) return null;
  const now = Date.now();
  if (promo.starts_at && Date.parse(promo.starts_at) > now) return null;
  if (promo.ends_at && Date.parse(promo.ends_at) <= now) return null;
  return promo;
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
  if (!profile.subscription_active) return json({ error: "Subscription inactive" }, 403);

  const body = await req.json().catch(() => ({}));
  const action = (body.action as string) ?? "create_session";

  if (action === "set_threshold") {
    const raw = body.threshold_cents;
    if (raw !== null && (!Number.isInteger(raw) || raw < 1 || raw > 1000000)) {
      return json({ error: "threshold_cents must be null or an integer between 1 and 1,000,000" }, 400);
    }

    const { data: wallet } = await admin
      .from("wallets")
      .select("balance_cents")
      .eq("member_id", user.id)
      .maybeSingle();
    const balance = wallet?.balance_cents ?? 0;
    const flaggedAt = raw !== null && balance < raw ? new Date().toISOString() : null;

    const { data: updated, error } = await admin
      .from("wallets")
      .upsert(
        { member_id: user.id, low_balance_threshold_cents: raw, low_balance_flagged_at: flaggedAt },
        { onConflict: "member_id" }
      )
      .select("balance_cents, low_balance_threshold_cents, low_balance_flagged_at")
      .single();
    if (error) return json({ error: error.message }, 500);
    return json(updated);
  }

  if (action === "create_session") {
    const amount = body.amount_cents;
    const isPreset = PRESET_AMOUNTS.includes(amount);
    const isValidCustom = Number.isInteger(amount) && amount >= 1000 && amount <= 100000;
    if (!isPreset && !isValidCustom) {
      return json({ error: "amount_cents must be a preset ($50/$100/$250/$500) or between $10 and $1,000" }, 400);
    }

    try {
      const productId = await getOrCreateTopupProduct(admin);
      const promo = await livePromo(admin);
      const metadata: Record<string, string> = {
        kind: "wallet_topup",
        member_id: user.id,
        amount_cents: String(amount),
      };
      if (promo && amount >= promo.min_topup_cents) metadata.promo_id = promo.id;

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "aud",
              product: productId,
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        customer_email: profile.email ?? undefined,
        success_url: `${SITE_URL}/portal/wallet?topup=1`,
        cancel_url: `${SITE_URL}/portal/wallet`,
        metadata,
      });
      return json({ url: session.url });
    } catch (err) {
      console.error(err);
      return json({ error: "Stripe error — are the Stripe keys configured yet?" }, 500);
    }
  }

  return json({ error: "Unknown action" }, 400);
});
