import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { getAffiliate } from "../utils/affiliate.js";
import ReferralCodeField from "./ReferralCodeField";

function trackEvent(name, props) {
  if (typeof window.trackEvent === "function") window.trackEvent(name, props);
}

export default function CheckoutDrawer({ open, onClose, tier }) {
  // Keyed by tier so each open starts with fresh state (no reset effect needed)
  return open && tier ? <CheckoutDrawerInner key={tier.id} onClose={onClose} tier={tier} /> : null;
}

function CheckoutDrawerInner({ onClose, tier }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [animate, setAnimate] = useState(false);
  const [referral, setReferral] = useState(null);
  // Preview only — create-landing-checkout prices the 10% from the database
  const discounted = (Math.round(Number(tier.price.replace(/,/g, "")) * 90) / 100).toLocaleString("en-AU", {
    minimumFractionDigits: 2,
  });

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => setAnimate(true));
    return () => {
      cancelAnimationFrame(id);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  async function handleCTA() {
    setLoading(true);
    setError(null);
    trackEvent("checkout_initiated", { tier: tier.name, plan: "lifetime" });
    const { data, error: fnErr } = await supabase.functions.invoke("create-landing-checkout", {
      body: {
        tier: tier.id,
        plan: "lifetime",
        affiliate: getAffiliate(),
        code: referral?.typed ? referral.code : null,
        link_code: referral && !referral.typed ? referral.code : null,
      },
    });
    if (fnErr || !data?.url) {
      setError(data?.error || "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }
    window.location.href = data.url;
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
          <div className="exit-eyebrow">Choose your plan</div>
          <div className="checkout-tier-name">
            {tier.name}
          </div>
        </div>

        <div>
          <div className="checkout-price-display">
            {referral ? (
              <>
                <s className="checkout-price-was">${tier.price}</s> ${discounted}
              </>
            ) : (
              <>${tier.price}</>
            )}
            <span className="checkout-price-unit"> one-time</span>
          </div>
          <div className="checkout-price-period">AUD · lifetime access</div>
        </div>

        <ReferralCodeField
          onChange={setReferral}
          appliedNote="10% off"
          removeLabel="Have a different promo code? Use it instead"
        />

        <div>
          <button
            className="btn btn-primary btn-lg checkout-cta-btn"
            onClick={handleCTA}
            disabled={loading}
          >
            {loading ? "Processing..." : "Get lifetime access"}
          </button>
          {error && (
            <div className="checkout-error" role="alert" style={{ marginTop: 10 }}>
              {error}
            </div>
          )}
          <p className="checkout-smallprint" style={{ marginTop: 10 }}>
            One-time payment. Lifetime access, as defined in our Terms of Service.
          </p>
          <p className="checkout-smallprint" style={{ marginTop: 8 }}>
            By continuing you agree to our <Link to="/terms" onClick={onClose}>Terms of Service</Link>{" "}
            (including the refund policy) and <Link to="/privacy" onClick={onClose}>Privacy Policy</Link>.
            Coaching and education only; results are not guaranteed.
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
