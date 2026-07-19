// wallet-pay-order — pay an existing draft order entirely from wallet store credit.
// Mirrors create-checkout-session's "stock_order" contract (order_id, order/order_items already
// created client-side — see CheckoutPage.jsx) so the frontend diff between the Stripe path and
// this one stays small. create-checkout-session itself is untouched by this function.
//
// Money-safety: the order total is recomputed here from live products prices — the client-sent
// order_items.unit_price is never trusted for the amount actually debited. The heavy lifting
// (row lock, refuse-a-second-debit, insufficient-funds park) all lives in the existing
// debit_wallet_for_order SECURITY DEFINER RPC (supabase/migrations/..._chronos_phase2_member_wallet.sql),
// which already carries the unique index (wallet_transactions_order_debit_uniq) that makes a
// concurrent double-submit produce exactly one debit — nothing new needed there.
import { createClient } from "npm:@supabase/supabase-js@2";

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
  const orderId = body.order_id as string;
  if (!orderId) return json({ error: "order_id is required" }, 400);

  // Ownership + status check, and the real price source (products.price), never the client's
  // order_items.unit_price — the same defence-in-depth create-checkout-session's stock_order
  // branch already applies for Stripe.
  const { data: order } = await admin
    .from("orders")
    .select("*, order_items(*, products(price, listing_price, discount_price))")
    .eq("id", orderId)
    .eq("member_id", user.id)
    .single();
  if (!order || !order.order_items?.length) return json({ error: "Order not found" }, 404);
  if (!["pending_payment", "awaiting_funds"].includes(order.status)) {
    return json({ error: "Order is not awaiting payment" }, 409);
  }

  const totalCents = order.order_items.reduce(
    (sum: number, item: { quantity: number; products: { price: number; listing_price: number | null; discount_price: number | null } }) => {
      const unitPrice = Number(
        item.products.discount_price ?? item.products.listing_price ?? item.products.price
      );
      return sum + Math.round(unitPrice * 100) * item.quantity;
    },
    0
  );
  if (!Number.isFinite(totalCents) || totalCents <= 0) {
    return json({ error: "Could not price this order" }, 500);
  }

  const { data, error } = await admin.rpc("debit_wallet_for_order", {
    p_order_id: orderId,
    p_amount_cents: totalCents,
  });
  if (error) return json({ error: error.message }, 500);

  switch (data?.status) {
    case "debited":
      return json({ status: "paid", balance_cents: data.balance_cents });
    case "already_debited":
      // Idempotent: a concurrent/duplicate submit for an order already paid from wallet.
      return json({ status: "paid" });
    case "insufficient_funds":
      return json(
        { error: "Insufficient wallet balance", balance_cents: data.balance_cents, required_cents: data.required_cents },
        402
      );
    case "invalid_status":
      return json({ error: "Order is not awaiting payment" }, 409);
    case "order_not_found":
      return json({ error: "Order not found" }, 404);
    default:
      return json({ error: "Could not pay this order from wallet" }, 500);
  }
});
