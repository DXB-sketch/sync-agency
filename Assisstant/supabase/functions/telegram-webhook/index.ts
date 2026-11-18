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

const BRISBANE_OFFSET_MS = 10 * 3600e3; // Australia/Brisbane is UTC+10, no DST

const HELP = [
  "Commands:",
  "/add 25/11 14:00 Dentist (just you)",
  "/addshared 25/11 2:30pm Team call (both of you)",
  "/list (upcoming events)",
  "/delete 12 (remove event #12)",
  "",
  "Dates are DD/MM or DD/MM/YYYY. Reminders: 9pm the night before, 8:15am on the day, and 1 hour before.",
].join("\n");

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

const fmt = (d: Date) =>
  d.toLocaleString("en-AU", {
    timeZone: "Australia/Brisbane",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

// "25/11 14:00 Dentist", "25/11/2027 2:30pm Dentist". Returns an error message on failure.
function parseEvent(args: string): { startsAt: Date; title: string } | string {
  const m = args.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s+(.+)$/i);
  if (!m || (!m[5] && !m[6])) return `Couldn't read that.\n\n${HELP}`;
  const [, d, mo, y, h, mi, ap, title] = m;

  let hour = Number(h);
  const min = Number(mi ?? 0);
  if (ap) {
    if (hour < 1 || hour > 12) return "That time doesn't look right.";
    hour = (hour % 12) + (ap.toLowerCase() === "pm" ? 12 : 0);
  }
  if (hour > 23 || min > 59) return "That time doesn't look right.";

  const make = (year: number) => new Date(Date.UTC(year, Number(mo) - 1, Number(d), hour, min) - BRISBANE_OFFSET_MS);
  const thisYear = new Date(Date.now() + BRISBANE_OFFSET_MS).getUTCFullYear();
  let year = y ? (y.length === 2 ? 2000 + Number(y) : Number(y)) : thisYear;
  let startsAt = make(year);
  if (!y && startsAt.getTime() <= Date.now()) startsAt = make(++year);

  const local = new Date(startsAt.getTime() + BRISBANE_OFFSET_MS);
  if (local.getUTCDate() !== Number(d) || local.getUTCMonth() !== Number(mo) - 1) return "That date doesn't exist.";
  if (startsAt.getTime() <= Date.now()) return "That's in the past.";
  return { startsAt, title: title.trim() };
}

async function handle(user: { id: string; display_name: string }, text: string): Promise<string> {
  const [rawCmd, ...rest] = text.trim().split(/\s+/);
  const cmd = rawCmd.toLowerCase().replace(/@.*$/, "");
  const args = rest.join(" ");

  if (cmd === "/add" || cmd === "/addshared") {
    const parsed = parseEvent(args);
    if (typeof parsed === "string") return parsed;
    const shared = cmd === "/addshared";
    const { data, error } = await supabase
      .from("bot_events")
      .insert({ created_by: user.id, title: parsed.title, starts_at: parsed.startsAt.toISOString(), shared })
      .select("id")
      .single();
    if (error) return "Couldn't save that, try again.";
    return `Added #${data.id}: ${parsed.title}, ${fmt(parsed.startsAt)}${shared ? " (shared)" : ""}`;
  }

  if (cmd === "/list") {
    const { data } = await supabase
      .from("bot_events")
      .select("id, title, starts_at, shared")
      .gt("starts_at", new Date().toISOString())
      .or(`created_by.eq.${user.id},shared.eq.true`)
      .order("starts_at")
      .limit(30);
    if (!data?.length) return "No upcoming events.";
    return data
      .map((e) => `#${e.id}  ${fmt(new Date(e.starts_at))}  ${e.title}${e.shared ? " (shared)" : ""}`)
      .join("\n");
  }

  if (cmd === "/delete") {
    const id = Number(args);
    if (!Number.isInteger(id) || id <= 0) return "Usage: /delete 12";
    const { data } = await supabase
      .from("bot_events")
      .delete()
      .eq("id", id)
      .or(`created_by.eq.${user.id},shared.eq.true`)
      .select("title");
    return data?.length ? `Deleted #${id}: ${data[0].title}` : `No event #${id} found.`;
  }

  if (cmd === "/start") return `Hi ${user.display_name}, Sync Assistant is connected.\n\n${HELP}`;
  return HELP;
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
    .select("id, display_name")
    .eq("telegram_user_id", fromId)
    .maybeSingle();
  if (!user) return ok();

  await sendMessage(message.chat.id, await handle(user, message.text ?? ""));
  return ok();
});
