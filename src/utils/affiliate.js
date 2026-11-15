import { supabase } from "../lib/supabase";

const STORAGE_KEY = "syncAffiliate";
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30-day attribution window

// Strip to characters that are safe inside an HTML attribute and accepted by
// Stripe's client_reference_id (alphanumeric, dash, underscore; max 200 chars).
function sanitize(raw) {
  return raw.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 200);
}

// Read ?ref= (creator referral links) or the older ?aff= from the current URL.
// Call once on app load.
export function captureAffiliate() {
  let code;
  try {
    const params = new URLSearchParams(window.location.search);
    code = params.get("ref") ?? params.get("aff");
  } catch {
    return;
  }
  if (code) trackReferral(code);
}

// Sanitize and persist a referral code, and count the visit for an active creator code.
// A new code overwrites an older one (most recent link wins). Checkout re-validates it
// server-side, so nothing stored here can unlock a discount on its own.
export function trackReferral(code) {
  const clean = sanitize(code);
  if (!clean) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code: clean, ts: Date.now() }));
  } catch {
    // localStorage unavailable (private mode / disabled) — nothing to persist.
  }
  supabase.rpc("record_referral_click", { p_code: clean }).then(() => {});
}

// Return the stored affiliate code if still within the attribution window,
// otherwise null.
export function getAffiliate() {
  let stored;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!stored) return null;
  try {
    const { code, ts } = JSON.parse(stored);
    if (!code || !ts || Date.now() - ts > WINDOW_MS) return null;
    return code;
  } catch {
    return null;
  }
}
