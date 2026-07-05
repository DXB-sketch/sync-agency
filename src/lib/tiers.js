export const TIERS = {
  pro: { name: "Pro Accelerator", short: "Pro", rank: 1, lifetime: 189, monthly: 79, productLimit: 6 },
  elite: { name: "Elite Scale", short: "Elite", rank: 2, lifetime: 397, monthly: 127, productLimit: 9 },
  vip: { name: "VIP Inner Circle", short: "VIP", rank: 3, lifetime: 739, monthly: 349, productLimit: 12 },
};

export function tierRank(tier) {
  return TIERS[tier]?.rank ?? 0;
}

// A node with min_tier is visible/unlockable only at that tier or above
export function meetsTier(memberTier, minTier) {
  if (!minTier) return true;
  return tierRank(memberTier) >= tierRank(minTier);
}
