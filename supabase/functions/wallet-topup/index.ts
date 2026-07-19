// wallet-topup — member-facing wallet actions. Wallet (store credit) is a live feature for
// every active member — no longer Shopify/Chronos pathway-gated.
// action "create_session" (default): Stripe Checkout Session for a wallet top-up. The wallet
//   itself is only ever credited by stripe-webhook -> wallet_topup_credit RPC; this function
//   makes no DB write for that path — an abandoned checkout leaves zero rows anywhere.
// action "set_threshold": service-role upsert of the member's low-balance alert preference.
//   Not money, but wallets is never client-writable (RLS has zero write policies), so even
//   this preference needs a service-role path.
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_PLACEHOLDER");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://syncagency.org";

const PRESET_AMOUNTS = [5000, 10000, 25000];

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
      return json({ error: "amount_cents must be a preset ($50/$100/$250) or between $10 and $1,000" }, 400);
    }

    try {
      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "aud",
              product_data: { name: "Sync wallet top-up" },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        customer_email: profile.email ?? undefined,
        success_url: `${SITE_URL}/portal/wallet?topup=1`,
        cancel_url: `${SITE_URL}/portal/wallet`,
        metadata: { kind: "wallet_topup", member_id: user.id, amount_cents: String(amount) },
      });
      return json({ url: session.url });
    } catch (err) {
      console.error(err);
      return json({ error: "Stripe error — are the Stripe keys configured yet?" }, 500);
    }
  }

  return json({ error: "Unknown action" }, 400);
});
