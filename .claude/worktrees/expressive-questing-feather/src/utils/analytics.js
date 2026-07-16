export function trackEvent(name, props) {
  if (typeof window.trackEvent === "function") window.trackEvent(name, props);
}