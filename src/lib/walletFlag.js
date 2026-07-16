// PHASE 4: replace the allowlist with a member_pathways lookup (Shopify pathway active).
// Keep this list in sync with WALLET_MEMBER_IDS in supabase/functions/wallet-topup/index.ts
// (house no-shared-imports cost — two copies, noted in both files).
export const WALLET_MEMBER_IDS = []; // chronos-dev beta member UUIDs

export function walletEnabled(profile) {
  return !!profile && (WALLET_MEMBER_IDS.includes(profile.id) || profile.role === "admin");
}
