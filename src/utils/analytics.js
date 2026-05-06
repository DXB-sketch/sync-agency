export function trackEvent(eventName, params = {}) {
  try {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", eventName, params);
    }
  } catch (err) {
    if (typeof window !== "undefined" && window.location.hostname === "localhost") {
      console.warn("[analytics] trackEvent failed:", err);
    }
  }
}

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

export function captureUTMParams() {
  try {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const captured = {};
    let any = false;
    UTM_KEYS.forEach((k) => {
      const v = params.get(k);
      if (v) { captured[k] = v; any = true; }
    });
    if (any) {
      sessionStorage.setItem("utm_params", JSON.stringify(captured));
    }
    return getStoredUTMParams();
  } catch {
    return null;
  }
}

export function getStoredUTMParams() {
  try {
    const raw = sessionStorage.getItem("utm_params");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isLocalhost() {
  return typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
}
