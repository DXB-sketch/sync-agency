import { TIERS, PAID_TIERS } from "./tiers";

// Sync Plus — $34/month portal subscription for members who already own a course.
// Mirrors is_plus_active() / member_product_limit() in the database.
export const PLUS = {
  name: "Sync Plus",
  monthly: 34,
  discount: 0.1,
  bonusSlots: 1,
  drawAmount: 500,
};

export function isPlus(profile) {
  return ["active", "trialing"].includes(profile?.plus_status);
}

// Only course owners can subscribe
export function canGetPlus(profile) {
  return PAID_TIERS.includes(profile?.tier) && !!profile?.subscription_active;
}

// What a Sync Plus member actually pays for an amount in cents
export function plusPrice(cents, profile) {
  return isPlus(profile) ? Math.round(cents * (1 - PLUS.discount)) : cents;
}

// Course-tier slots plus the Sync Plus bonus slot
export function productLimit(member) {
  return (TIERS[member?.tier]?.productLimit ?? 0) + (isPlus(member) ? PLUS.bonusSlots : 0);
}
