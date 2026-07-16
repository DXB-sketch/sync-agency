import { useState, useEffect } from "react";
import { getAffiliate } from "../utils/affiliate.js";

function trackEvent(name, props) {
  if (typeof window.trackEvent === "function") window.trackEvent(name, props);
}

export default function CheckoutDrawer({ open, onClose, tier }) {
  const [plan, setPlan] = useState("monthly");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      setPlan("monthly");
      setError(null);
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    } else {
      document.body.style.overflow = "";
      setAnimate(false);
      return undefined;
    }
  }, [open]);

  useEffect(() => {
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!open || !tier) return null;

  const isMonthly = plan === "monthly";
  const priceId = isMonthly ? tier.stripeMonthlyPriceId : tier.stripeYearlyPriceId;
  const mode = isMonthly ? "subscription" : "payment";

  async function handleCTA() {
    setLoading(true);
    setError(null);
    trackEvent("checkout_initiated", { tier: tier.name, plan: isMonthly ? "monthly" : "yearly" });
    try {
      const res = await fetch("/checkout.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, mode, tierName: tier.name, affiliate: getAffiliate() }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Something went wrong. Please try again.");
        setLoading(false);
      }
    } catch {
      setError("Unable to connect. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      <div
        className={`checkout-overlay${animate ? " open" : ""}`}
        onClick={onClose}
      />
      <div
        className={`checkout-drawer${animate ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`Checkout for ${tier.name}`}
      >
        <button className="exit-close" onClick={onClose} aria-label="Close">✕</button>

        <div>
          <div className="exit-eyebrow">Choose Your Plan</div>
          <div style={{
            fontFamily: "var(--font-display)",
            fontSize: 28,
            fontWeight: 700,
            color: "var(--gold)",
            fontStyle: "italic",
            lineHeight: 1.1,
            marginTop: 4,
          }}>
            {tier.name}
          </div>
        </div>

        <div className="checkout-plan-toggle">
          <button
            className={`checkout-plan-btn${isMonthly ? " active" : ""}`}
            onClick={() => setPlan("monthly")}
          >
            Monthly
          </button>
          <button
            className={`checkout-plan-btn${!isMonthly ? " active" : ""}`}
            onClick={() => setPlan("yearly")}
          >
            3-Year Access
          </button>
        </div>

        <div>
          {isMonthly ? (
            <>
              <div className="checkout-price-display">
                ${tier.price}
                <span style={{ fontSize: 22, fontFamily: "var(--font-body)", fontWeight: 400 }}>/mo</span>
              </div>
              <div className="checkout-price-period">AUD · billed monthly · cancel anytime</div>
              <div className="checkout-trial-badge">✦ 3-Day Free Trial Included</div>
            </>
          ) : (
            <>
              <div className="checkout-price-display">
                ${tier.priceYearly}
                <span style={{ fontSize: 22, fontFamily: "var(--font-body)", fontWeight: 400 }}> one-time</span>
              </div>
              <div className="checkout-price-period">AUD · 3 years access · renew after 3 years</div>
              <div className="checkout-savings-badge">
                ✦ Save {tier.savingsPct}% vs monthly, ${tier.monthlyTotal36} over 3 years
              </div>
            </>
          )}
        </div>

        <div>
          <button
            className="checkout-cta-btn"
            onClick={handleCTA}
            disabled={loading}
          >
            {loading ? "Processing..." : isMonthly ? "Start Free Trial →" : "Get 3-Year Access →"}
          </button>
          {error && (
            <div className="checkout-error" style={{ marginTop: 10 }}>
              {error}
            </div>
          )}
          <p className="checkout-smallprint" style={{ marginTop: 10 }}>
            {isMonthly
              ? "3-day free trial. Card required. Cancel any time before trial ends."
              : "One-time payment. Access valid for 3 years from purchase date."}
          </p>
        </div>

        <div className="checkout-secure">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Secure checkout via Stripe
        </div>
      </div>
    </>
  );
}
