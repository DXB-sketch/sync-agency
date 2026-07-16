// True when running inside the Capacitor iOS/Android shell. Apple's guideline
// 3.1.1 forbids selling digital content (course upgrades) outside IAP, so
// purchase CTAs for tiers are hidden in the native apps — physical stock
// checkout is unaffected.
export function isNativeApp() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}
