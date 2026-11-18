import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const time = (d: Date) =>
  d.toLocaleTimeString("en-AU", { timeZone: "Australia/Brisbane", hour: "numeric", minute: "2-digit" });

const LEAD: Record<string, (t: string) => string> = {
  night: (t) => `Tomorrow at ${t}`,
  morning: (t) => `Today at ${t}`,
  hour: (t) => `In 1 hour (${t})`,
};

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

// Called every minute by pg_cron (job "bot-reminders").
Deno.serve(async (req) => {
  const { data, error } = await supabase.rpc("bot_claim_due_reminders", {
    cron_secret: req.headers.get("x-cron-secret") ?? "",
  });
  if (error) return new Response("unauthorized", { status: 401 });

  for (const r of data ?? []) {
    const text = `⏰ ${LEAD[r.kind](time(new Date(r.starts_at)))}: ${r.title}${r.shared ? " (shared)" : ""}`;
    await Promise.all(r.chat_ids.map((id: number) => sendMessage(id, text)));
  }
  return new Response("ok");
});
