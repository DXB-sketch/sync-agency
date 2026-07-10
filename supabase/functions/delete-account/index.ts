// delete-account — permanently deletes the signed-in member's account.
// Required for App Store / Play Store listing: apps that offer account
// creation must offer in-app account deletion (Apple guideline 5.1.1(v)).
// Admins cannot be deleted this way.
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

  const { data: profile } = await admin
    .from("profiles")
    .select("id, role")
    .eq("id", user.id)
    .single();
  if (!profile) return json({ error: "No profile" }, 400);
  if (profile.role === "admin") return json({ error: "Admin accounts cannot self-delete" }, 403);

  const id = user.id;
  try {
    // Detach references that should survive (audit trail), remove the rest.
    await admin.from("purchases").update({ linked_member_id: null }).eq("linked_member_id", id);
    await admin
      .from("pool_products")
      .update({ assigned_member_id: null })
      .eq("assigned_member_id", id);
    await admin.from("member_pathway_progress").delete().eq("member_id", id);
    await admin.from("member_achievements").delete().eq("member_id", id);
    const { data: tickets } = await admin.from("support_tickets").select("id").eq("member_id", id);
    if (tickets?.length) {
      const ticketIds = tickets.map((t) => t.id);
      await admin.from("support_messages").delete().in("ticket_id", ticketIds);
      await admin.from("support_tickets").delete().in("id", ticketIds);
    }
    const { data: orders } = await admin.from("orders").select("id").eq("member_id", id);
    if (orders?.length) {
      await admin.from("order_items").delete().in("order_id", orders.map((o) => o.id));
      await admin.from("orders").delete().eq("member_id", id);
    }
    await admin.from("products").delete().eq("member_id", id);
    await admin.from("profiles").delete().eq("id", id);
    const { error: authErr } = await admin.auth.admin.deleteUser(id);
    if (authErr) throw authErr;
    return json({ deleted: true });
  } catch (err) {
    console.error(err);
    return json({ error: "Could not delete the account — contact support." }, 500);
  }
});
