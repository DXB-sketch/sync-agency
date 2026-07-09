// merge-stripe-duplicates — admin-only, one-off cleanup. Groups active Stripe
// Products by name, keeps the oldest of each group as the canonical one,
// repoints every products row at an equivalent Price on the canonical Product,
// and archives the duplicate Products and their Prices.
import Stripe from "npm:stripe@18";
import { createClient } from "npm:@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "sk_test_PLACEHOLDER");

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
  const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role !== "admin") return json({ error: "Admin only" }, 403);

  try {
    // All active Stripe products, grouped by normalised name
    const all: Stripe.Product[] = [];
    for await (const p of stripe.products.list({ active: true, limit: 100 })) all.push(p);
    const groups = new Map<string, Stripe.Product[]>();
    for (const p of all) {
      const key = p.name.trim().toLowerCase();
      groups.set(key, [...(groups.get(key) ?? []), p]);
    }

    const { data: rows } = await admin
      .from("products")
      .select("id, stripe_price_id")
      .not("stripe_price_id", "is", null);

    let productsArchived = 0;
    let rowsRepointed = 0;

    for (const dupes of groups.values()) {
      if (dupes.length < 2) continue;
      dupes.sort((a, b) => a.created - b.created);
      const canonical = dupes[0];
      const duplicates = dupes.slice(1);

      // Prices on the canonical product, keyed by amount — reused when repointing
      const canonicalPrices = new Map<number, string>();
      for await (const pr of stripe.prices.list({ product: canonical.id, active: true, limit: 100 })) {
        if (pr.currency === "aud" && !pr.recurring && pr.unit_amount !== null) {
          canonicalPrices.set(pr.unit_amount, pr.id);
        }
      }

      // Prices belonging to the duplicate products (these need repointing)
      const dupePriceToAmount = new Map<string, number>();
      for (const dupe of duplicates) {
        for await (const pr of stripe.prices.list({ product: dupe.id, limit: 100 })) {
          if (pr.unit_amount !== null) dupePriceToAmount.set(pr.id, pr.unit_amount);
        }
      }

      for (const row of rows ?? []) {
        const amount = dupePriceToAmount.get(row.stripe_price_id);
        if (amount === undefined) continue;
        let priceId = canonicalPrices.get(amount);
        if (!priceId) {
          const created = await stripe.prices.create({
            product: canonical.id,
            currency: "aud",
            unit_amount: amount,
          });
          priceId = created.id;
          canonicalPrices.set(amount, priceId);
        }
        await admin.from("products").update({ stripe_price_id: priceId }).eq("id", row.id);
        row.stripe_price_id = priceId;
        rowsRepointed++;
      }

      // Point the create-stripe-product claim table at the surviving
      // canonical product/price(s) so future assignments never reuse an ID
      // this merge is about to archive below.
      const key = canonical.name.trim().toLowerCase();
      for (const [amount, priceId] of canonicalPrices) {
        await admin.from("product_catalog").upsert(
          {
            key,
            price: amount / 100,
            name: canonical.name,
            stripe_product_id: canonical.id,
            stripe_price_id: priceId,
          },
          { onConflict: "key,price" }
        );
      }

      // Archive the duplicates (a Product can't be archived with active Prices)
      for (const dupe of duplicates) {
        for await (const pr of stripe.prices.list({ product: dupe.id, active: true, limit: 100 })) {
          await stripe.prices.update(pr.id, { active: false });
        }
        await stripe.products.update(dupe.id, { active: false });
        productsArchived++;
      }
    }

    return json({ products_archived: productsArchived, rows_repointed: rowsRepointed });
  } catch (err) {
    console.error(err);
    return json({ error: "Merge failed — check the function logs" }, 500);
  }
});
