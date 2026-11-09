import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { TIERS, PAID_TIERS } from "./tiers";

// Sync Plus — monthly portal subscription for members who already own a course.
// Mirrors is_plus_active() / member_product_limit() in the database. The monthly price lives
// in public.plus_settings (admin-editable) — read it with usePlusPrice(), never hardcode it.
export const PLUS = {
  name: "Sync Plus",
  discount: 0.1,
  bonusSlots: 1,
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

// Monthly price in dollars as a display string (e.g. "34" or "43.99"); null while loading.
export function usePlusPrice() {
  const [price, setPrice] = useState(null);
  useEffect(() => {
    supabase
      .from("plus_settings")
      .select("monthly_cents")
      .single()
      .then(({ data }) => {
        if (!data) return;
        const dollars = data.monthly_cents / 100;
        setPrice(Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2));
      });
  }, []);
  return price;
}
