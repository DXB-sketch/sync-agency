// Wallet (store credit) is a live feature for every active member — no longer Shopify/Chronos
// pathway-gated. Only requirement is an active subscription, same gate stock-order checkout uses.
export function walletEnabled(profile) {
  return !!profile?.subscription_active;
}
