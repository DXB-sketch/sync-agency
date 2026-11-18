import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN") ?? "";
const WEBHOOK_SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET") ?? "";
const ALLOWED = new Set(
  (Deno.env.get("ALLOWED_TELEGRAM_USER_IDS") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

const ok = () => new Response("ok");

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function sendMessage(chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  const header = req.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
  if (!WEBHOOK_SECRET || !timingSafeEqual(header, WEBHOOK_SECRET)) {
    return new Response("unauthorized", { status: 401 });
  }

  const update = await req.json().catch(() => null);
  const message = update?.message;
  const fromId = message?.from?.id;

  // Anyone not on the allowlist is ignored silently. Always 200 so Telegram doesn't retry.
  if (!message || !fromId || !ALLOWED.has(String(fromId))) return ok();

  const { data: user } = await supabase
    .from("bot_users")
    .select("display_name")
    .eq("telegram_user_id", fromId)
    .maybeSingle();
  if (!user) return ok();

  await sendMessage(message.chat.id, `Hi ${user.display_name}, Sync Assistant is connected.`);
  return ok();
});
