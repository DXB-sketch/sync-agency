// stripe-webhook — single Stripe webhook endpoint for the whole business.
// Handles BOTH course purchases (marketing site) and portal stock orders/upgrades/reactivations,
// plus monthly-subscription lifecycle (lockout on cancel / failed payment).
// Deployed with verify_jwt=false; authenticity comes from Stripe signature verification.
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_PLACEHOLDER");
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// ─── PLACEHOLDER: replace with the real Stripe Price IDs for each course tier ───
// These let the webhook recognise which checkout sessions are COURSE purchases
// (grant portal access + tier) vs stock orders (metadata-tagged by our own functions).
const COURSE_PRICE_MAP: Record<
  string,
  { tier: "pro" | "elite" | "vip"; billing_type: "lifetime" | "monthly"; amount: number }
> = {
  price_1TgJSTPDABwVk3W5i4YpTAdD: { tier: "pro", billing_type: "lifetime", amount: 189 },
  price_1TcdJaPDABwVk3W5hRkD3gyK: { tier: "pro", billing_type: "monthly", amount: 79 },
  price_1TgJSAPDABwVk3W5NnPCnL0W: { tier: "elite", billing_type: "lifetime", amount: 397 },
  price_1TcdNBPDABwVk3W5rWIalCC2: { tier: "elite", billing_type: "monthly", amount: 127 },
  price_1TgJRUPDABwVk3W5cbOkwqVs: { tier: "vip", billing_type: "lifetime", amount: 739 },
  price_1TcdNzPDABwVk3W5MVIkLkpj: { tier: "vip", billing_type: "monthly", amount: 349 },
};
// ────────────────────────────────────────────────────────────────────────────────

async function setSubscriptionActive(customerId: string, active: boolean) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  if (profile) {
    await supabase.from("profiles").update({ subscription_active: active }).eq("id", profile.id);
    return;
  }
  // Fall back to the Stripe customer's email
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer.deleted && customer.email) {
    await supabase
      .from("profiles")
      .update({ subscription_active: active, stripe_customer_id: customerId })
      .ilike("email", customer.email);
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const kind = session.metadata?.kind;

  // ── Portal stock order (created by create-checkout-session) ──
  if (kind === "stock_order" && session.metadata?.order_id) {
    await supabase
      .from("orders")
      .update({ status: "paid", stripe_session_id: session.id })
      .eq("id", session.metadata.order_id)
      .eq("status", "pending_payment");
    return;
  }

  // ── Tier upgrade paid from the portal ──
  if (kind === "upgrade" && session.metadata?.member_id) {
    const update: Record<string, unknown> = {
      tier: session.metadata.target_tier,
      billing_type: session.metadata.target_billing,
      tier_price_paid: Number(session.metadata.new_price_paid),
      subscription_active: true,
    };
    if (typeof session.customer === "string") update.stripe_customer_id = session.customer;
    await supabase.from("profiles").update(update).eq("id", session.metadata.member_id);
    return;
  }

  // ── Monthly subscription reactivation from the portal ──
  if (kind === "reactivate" && session.metadata?.member_id) {
    const update: Record<string, unknown> = { subscription_active: true };
    if (typeof session.customer === "string") update.stripe_customer_id = session.customer;
    await supabase.from("profiles").update(update).eq("id", session.metadata.member_id);
    return;
  }

  // ── Otherwise: a course purchase from the marketing site ──
  const email = session.customer_details?.email ?? session.customer_email;
  if (!email) return;

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  for (const item of lineItems.data) {
    const priceId = item.price?.id;
    const course = priceId ? COURSE_PRICE_MAP[priceId] : undefined;
    if (!course) continue;

    const { data: purchase } = await supabase
      .from("purchases")
      .insert({
        email,
        tier: course.tier,
        billing_type: course.billing_type,
        amount: course.amount,
        stripe_session_id: session.id,
      })
      .select()
      .single();

    // If the buyer already has a confirmed account with this email, link immediately.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (profile && purchase) {
      await supabase
        .from("purchases")
        .update({ linked_member_id: profile.id })
        .eq("id", purchase.id);
      const update: Record<string, unknown> = {
        tier: course.tier,
        billing_type: course.billing_type,
        tier_price_paid: course.amount,
        subscription_active: true,
      };
      if (typeof session.customer === "string") update.stripe_customer_id = session.customer;
      await supabase.from("profiles").update(update).eq("id", profile.id);
    }
  }
}

Deno.serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!signature || !webhookSecret) {
    return new Response("Webhook not configured", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error("Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        if (typeof sub.customer === "string") await setSubscriptionActive(sub.customer, false);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (typeof invoice.customer === "string") await setSubscriptionActive(invoice.customer, false);
        break;
      }
      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        if (typeof invoice.customer === "string") await setSubscriptionActive(invoice.customer, true);
        break;
      }
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
