import { useRef, useEffect } from "react";
import { getAffiliate } from "../utils/affiliate.js";

export default function StripeBuyButton({ buyButtonId, publishableKey }) {
  const ref = useRef(null);
  const aff = getAffiliate();
  const affAttr = aff ? ` client-reference-id="${aff}"` : "";

  useEffect(() => {
    // Inject Stripe script once globally
    if (!document.getElementById("stripe-buy-btn-script")) {
      const script = document.createElement("script");
      script.id = "stripe-buy-btn-script";
      script.src = "https://js.stripe.com/v3/buy-button.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // Use dangerouslySetInnerHTML to render the custom web component
  // because React doesn't natively support custom element attributes with hyphens
  return (
    <div
      ref={ref}
      className="stripe-btn-wrap"
      dangerouslySetInnerHTML={{
        __html: `<stripe-buy-button buy-button-id="${buyButtonId}" publishable-key="${publishableKey}"${affAttr}></stripe-buy-button>`,
      }}
    />
  );
}
