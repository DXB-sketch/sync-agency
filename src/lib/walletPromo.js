import { supabase } from "./supabase";

export const REWARD_TYPES = {
  bonus_credit: "Bonus wallet credit ($)",
  bonus_percent: "Bonus wallet credit (% of top-up)",
  order_discount: "% off next wallet order",
};

// The one switched-on promo, if its schedule covers now. Members can only read live
// rows (RLS), but admins can read every row, so the window is re-checked here too.
export async function fetchLivePromo() {
  const { data } = await supabase.from("wallet_promos").select("*").eq("active", true).maybeSingle();
  return data && isLive(data) ? data : null;
}

export function isLive(promo, now = Date.now()) {
  return (
    promo.active &&
    (!promo.starts_at || Date.parse(promo.starts_at) <= now) &&
    (!promo.ends_at || Date.parse(promo.ends_at) > now)
  );
}

export function rewardText(promo) {
  const v = Number(promo.reward_value);
  if (promo.reward_type === "bonus_credit") return `$${v.toFixed(2)} bonus wallet credit`;
  if (promo.reward_type === "bonus_percent") return `${v}% bonus wallet credit`;
  return `${v}% off your next order paid with wallet credit`;
}

export function requirementText(promo) {
  return `Top up $${(promo.min_topup_cents / 100).toFixed(2)} or more`;
}
