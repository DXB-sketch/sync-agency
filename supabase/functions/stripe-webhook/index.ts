// stripe-webhook — single Stripe webhook endpoint for the whole business.
// Handles BOTH course purchases (marketing site) and portal stock orders/upgrades,
// plus wallet top-ups and Sync Plus subscriptions. Course access is independent of
// recurring billing.
// Deployed with verify_jwt=false; authenticity comes from Stripe signature verification.
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_PLACEHOLDER");
const cryptoProvider = Stripe.createSubtleCryptoProvider();

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const COURSE_PRICE_MAP: Record<
  string,
  { tier: "pro" | "elite" | "vip"; billing_type: "lifetime" | "monthly" }
> = {
  price_1UF3SzPDABwVk3W5M1291uCy: { tier: "pro", billing_type: "lifetime" },
  price_1UF3T7PDABwVk3W5BABdHHA0: { tier: "elite", billing_type: "lifetime" },
  price_1UF3TIPDABwVk3W5JpGUu6vE: { tier: "vip", billing_type: "lifetime" },
  price_1UF36jPDABwVk3W5A4RJnrro: { tier: "pro", billing_type: "lifetime" },
  price_1UF371PDABwVk3W5F336GwQC: { tier: "elite", billing_type: "lifetime" },
  price_1UF376PDABwVk3W5S6Qlld9v: { tier: "vip", billing_type: "lifetime" },
  // Historical IDs remain recognizable for delayed events and payment records.
  price_1TgJSTPDABwVk3W5i4YpTAdD: { tier: "pro", billing_type: "lifetime" },
  price_1TcdJaPDABwVk3W5hRkD3gyK: { tier: "pro", billing_type: "monthly" },
  price_1TgJSAPDABwVk3W5NnPCnL0W: { tier: "elite", billing_type: "lifetime" },
  price_1TcdNBPDABwVk3W5rWIalCC2: { tier: "elite", billing_type: "monthly" },
  price_1TgJRUPDABwVk3W5cbOkwqVs: { tier: "vip", billing_type: "lifetime" },
  price_1TcdNzPDABwVk3W5MVIkLkpj: { tier: "vip", billing_type: "monthly" },
};

// Top-up packs with bonus credit (top-up cents -> bonus cents). Mirrored in WalletPage.jsx.
const TOPUP_BONUSES: Record<number, number> = { 50000: 8000 };

function isPlusActive(status: string | null | undefined) {
  return status === "active" || status === "trialing";
}

// Mirrors a Sync Plus subscription onto the member's profile. Always re-reads the
// subscription from Stripe so out-of-order webhook deliveries can't apply stale state.
async function syncPlus(subscriptionId: string, memberIdHint?: string) {
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  if (sub.metadata?.kind !== "plus") return;

  const memberId = sub.metadata.member_id ?? memberIdHint;
  if (!memberId) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("plus_subscription_id, plus_status")
    .eq("id", memberId)
    .single();
  if (!profile) return;
  // A newer active subscription wins over an older one ending
  if (
    profile.plus_subscription_id &&
    profile.plus_subscription_id !== sub.id &&
    isPlusActive(profile.plus_status) &&
    !isPlusActive(sub.status)
  ) {
    return;
  }

  const periodEnd =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    sub.items.data[0]?.current_period_end;
  const update: Record<string, unknown> = {
    plus_status: sub.status,
    plus_subscription_id: sub.id,
    plus_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    plus_cancel_at_period_end: sub.cancel_at_period_end,
  };
  const { error } = await supabase.from("profiles").update(update).eq("id", memberId);
  if (error) throw error;
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") return;
  const kind = session.metadata?.kind;

  if (kind === "stock_order" && session.metadata?.order_id) {
    await supabase
      .from("orders")
      .update({ status: "paid", stripe_session_id: session.id })
      .eq("id", session.metadata.order_id)
      .eq("status", "pending_payment");
    return;
  }

  if (kind === "plus_subscription" && session.metadata?.member_id && typeof session.subscription === "string") {
    await syncPlus(session.subscription, session.metadata.member_id);
    if (typeof session.customer === "string") {
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: session.customer })
        .eq("id", session.metadata.member_id)
        .is("stripe_customer_id", null);
    }
    return;
  }

  if (kind === "upgrade" && session.metadata?.member_id) {
    const update: Record<string, unknown> = {
      tier: session.metadata.target_tier,
      billing_type: "lifetime",
      tier_price_paid: Number(session.metadata.new_price_paid),
      subscription_active: true,
    };
    if (typeof session.customer === "string") update.stripe_customer_id = session.customer;
    await supabase.from("profiles").update(update).eq("id", session.metadata.member_id);
    return;
  }

  // ── Wallet top-up (Shopify members) — credit is ledgered atomically by the RPC ──
  if (kind === "wallet_topup" && session.metadata?.member_id) {
    const amountCents = session.amount_total ?? Number(session.metadata.amount_cents);
    const stripeRef =
      typeof session.payment_intent === "string" ? session.payment_intent : session.id;
    const { error } = await supabase.rpc("wallet_topup_credit", {
      p_member_id: session.metadata.member_id,
      p_amount_cents: amountCents,
      p_stripe_ref: stripeRef,
    });
    if (error) throw error;

    // Pack bonus is decided here from the amount actually paid, never from client input.
    const bonusCents = TOPUP_BONUSES[amountCents];
    if (bonusCents) {
      const { error: bonusErr } = await supabase.rpc("wallet_topup_bonus", {
        p_member_id: session.metadata.member_id,
        p_bonus_cents: bonusCents,
        p_stripe_ref: stripeRef,
        p_reason: `Top-up bonus: $${bonusCents / 100} on $${amountCents / 100}`,
      });
      if (bonusErr) throw bonusErr;
    }

    // Promo pinned by wallet-topup at checkout. Idempotent per top-up, so a retried
    // webhook (after the credit above already landed) just grants any missing reward.
    if (session.metadata.promo_id) {
      const { error: promoErr } = await supabase.rpc("wallet_promo_reward", {
        p_member_id: session.metadata.member_id,
        p_promo_id: session.metadata.promo_id,
        p_topup_cents: amountCents,
        p_stripe_ref: stripeRef,
      });
      if (promoErr) throw promoErr;
    }
    return;
  }

  const email = session.customer_details?.email ?? session.customer_email;
  if (!email) return;

  const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 10 });
  for (const item of lineItems.data) {
    const priceId = item.price?.id;
    const course = priceId ? COURSE_PRICE_MAP[priceId] : undefined;
    if (!course) continue;
    const amountPaid = item.amount_total / 100;

    const { data: purchase } = await supabase
      .from("purchases")
      .insert({
        email,
        tier: course.tier,
        billing_type: course.billing_type,
        amount: amountPaid,
        stripe_session_id: session.id,
      })
      .select()
      .single();

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
        billing_type: "lifetime",
        tier_price_paid: amountPaid,
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
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await syncPlus((event.data.object as Stripe.Subscription).id);
        break;
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err);
    return new Response("Handler error", { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
