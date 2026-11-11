// Sync Rewards rules (sync-rewards/SPEC.md). Mirrors the database functions in
// supabase/migrations/20261111000000_sync_rewards.sql: the server is the source of
// truth for every award; these copies only drive what the screens show.
import { tierRank } from "./tiers";

export const XP_PER_DOLLAR = 10;
export const LEVEL_XP = 1000; // = $100 of credit
export const STREAK_WEEKS = 3; // weeks in a row (top-up or paid stock order) for the bonus
export const STREAK_BONUS = 5; // % extra XP on top-ups while the streak is live

export const PACKS = [
  { cents: 5000, bonus: 0 },
  { cents: 10000, bonus: 5 },
  { cents: 25000, bonus: 10, tag: "Most popular" },
  { cents: 50000, bonus: 15, tag: "Best value" },
  { cents: 100000, bonus: 20 },
];

export const RANKS = [
  { key: "bronze", name: "Bronze", minCents: 0, level: 1, perks: "Rewards access and the weekly streak bonus." },
  { key: "silver", name: "Silver", minCents: 50000, level: 6, course: "elite", perks: "Elite Scale course and a crate at every level." },
  { key: "gold", name: "Gold", minCents: 150000, level: 16, course: "vip", perks: "VIP Inner Circle course and priority stock drops." },
  { key: "platinum", name: "Platinum", minCents: 400000, level: 41, perks: "Quarterly 1:1 strategy call and 3% back as credit." },
  { key: "black", name: "Black", minCents: 1000000, level: 101, perks: "Founders' mastermind, 5% back as credit, free express shipping." },
];

// Level milestone extras on top of the crate
export const MILESTONES = {
  14: { kind: "credit", cents: 500, label: "$5 wallet credit" },
  15: { kind: "slot", label: "+1 product slot" },
  20: { kind: "credit", cents: 1000, label: "$10 wallet credit" },
};

export const CRATES = {
  silver: { name: "Silver", top: "Up to $30 credit", when: "Every level at Silver" },
  gold: { name: "Gold", top: "Up to $50 credit", when: "Every level at Gold and above" },
};

export function packBonusPct(cents) {
  return [...PACKS].reverse().find((p) => cents >= p.cents)?.bonus ?? 0;
}

export function topupXp(cents, streakLive = false) {
  const pct = packBonusPct(cents) + (streakLive ? STREAK_BONUS : 0);
  return Math.round((cents / 100) * XP_PER_DOLLAR * (1 + pct / 100));
}

export function levelOf(xp) {
  return Math.floor(xp / LEVEL_XP) + 1;
}

export function rankOf(cents) {
  return [...RANKS].reverse().find((r) => cents >= r.minCents);
}

export function rankByKey(key) {
  return RANKS.find((r) => r.key === key) ?? RANKS[0];
}

export function nextRank(key) {
  return RANKS[RANKS.findIndex((r) => r.key === key) + 1] ?? null;
}

// Crate type follows the rank the level sits in (Silver 6–15, Gold from 16)
export function crateForLevel(level) {
  if (level >= 16) return "gold";
  if (level >= 6) return "silver";
  return null;
}

// What a level pays out, for the reward track and the top-up preview
export function rewardsAtLevel(level) {
  const out = [];
  const crate = crateForLevel(level);
  if (crate) out.push({ kind: "crate", crate, label: level >= 16 ? "Gold crate" : "Mystery crate" });
  if (MILESTONES[level]) out.push(MILESTONES[level]);
  const rank = RANKS.find((r) => r.level === level && r.level > 1);
  if (rank) out.push({ kind: "rank", rank: rank.key, label: `${rank.name} rank` });
  return out;
}

// The course a rank unlocks, combined with the member's paid plan. Billing keeps
// owning profile.tier; this only widens which course content is visible.
export function courseTier(profileTier, rankKey) {
  const fromRank = RANKS.slice(0, RANKS.findIndex((r) => r.key === rankKey) + 1)
    .map((r) => r.course)
    .filter(Boolean)
    .pop();
  if (!fromRank) return profileTier;
  return tierRank(fromRank) > tierRank(profileTier) ? fromRank : profileTier;
}

// Live reward product slots, added to the tier's product limit
export function activeSlots(grants) {
  const now = Date.now();
  return (grants ?? []).filter(
    (g) => g.kind === "slot" && !g.clawed_back_at && g.expires_at && Date.parse(g.expires_at) > now
  ).length;
}

export function dollars(cents, { decimals = false } = {}) {
  return (
    "$" +
    (cents / 100).toLocaleString("en-AU", {
      minimumFractionDigits: decimals ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    })
  );
}

export function num(n) {
  return n.toLocaleString("en-AU");
}
