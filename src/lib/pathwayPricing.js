// Phase 5 — pathway-scoped pricing (Project Chronos).
// PLACEHOLDER numbers, not ratified — see docs/FOUNDER_DECISIONS_REQUIRED.md,
// item 3. Extends src/lib/tiers.js: existing tier prices apply per pathway
// (Depop or Shopify), unchanged; a second pathway gets a bundle discount off
// its own tier price. Do not wire this into checkout until the founder
// ratifies the prices and discount %.
import { TIERS } from "./tiers.js";

export const PATHWAYS = ["depop", "shopify"];

// Placeholder — build plan 5.1 proposal, awaiting founder ratification.
export const BUNDLE_DISCOUNT_PCT = 0.4; // 40% off a second pathway's tier price

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Price for `tier`/`billing` on one pathway. Pass isSecondPathway: true when
// this pathway is the member's second (i.e. they already hold, or are
// bundling in the same purchase, a different pathway) — that's the one the
// discount applies to, per the build plan's proposal.
export function pathwayTierPrice(tier, billing, { isSecondPathway = false } = {}) {
  const base = TIERS[tier]?.[billing];
  if (base == null) return null;
  return isSecondPathway ? round2(base * (1 - BUNDLE_DISCOUNT_PCT)) : base;
}

// Total to buy both pathways at the same tier in one purchase: full price for
// the first pathway, bundle-discounted price for the second.
export function bundlePrice(tier, billing) {
  const base = TIERS[tier]?.[billing];
  if (base == null) return null;
  return round2(base + pathwayTierPrice(tier, billing, { isSecondPathway: true }));
}

// Prorated upgrade price for a tier change on one pathway — mirrors the
// lifetime-upgrade diff already used in
// supabase/functions/create-checkout-session/index.ts
// (target lifetime price − what's already been paid, floored at $1),
// extended so the target price respects the pathway's bundle status.
export function pathwayUpgradeDiff(targetTier, alreadyPaid, { isSecondPathway = false } = {}) {
  const targetPrice = pathwayTierPrice(targetTier, "lifetime", { isSecondPathway });
  if (targetPrice == null) return null;
  return Math.max(round2(targetPrice - (alreadyPaid ?? 0)), 1);
}
