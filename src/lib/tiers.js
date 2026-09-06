export const TIERS = {
  // 'free' is closed to new accounts: grandfathered members (profiles.
  // grandfathered_free) keep this tier's full old access; newer accounts on
  // 'free' have no plan yet and are locked to /portal/upgrade by Guards.
  free: { name: "Free Dashboard", short: "Free", rank: 0, productLimit: 6 },
  pro: { name: "Pro Accelerator", short: "Pro", rank: 1, lifetime: 189, monthly: 79, productLimit: 9 },
  elite: { name: "Elite Scale", short: "Elite", rank: 2, lifetime: 397, monthly: 127, productLimit: 12 },
  vip: { name: "VIP Inner Circle", short: "VIP", rank: 3, lifetime: 739, monthly: 349, productLimit: 15 },
};

// Course tiers, lowest first ('free' is legacy-only, closed to new accounts)
export const PAID_TIERS = ["pro", "elite", "vip"];

export function tierRank(tier) {
  return TIERS[tier]?.rank ?? 0;
}

// A node with min_tier is visible/unlockable only at that tier or above
export function meetsTier(memberTier, minTier) {
  if (!minTier) return true;
  return tierRank(memberTier) >= tierRank(minTier);
}
