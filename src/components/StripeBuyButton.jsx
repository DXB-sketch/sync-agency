import { useEffect, useRef } from "react";

export default function StripeBuyButton({ buyButtonId, publishableKey }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!document.getElementById("stripe-buy-btn-script")) {
      const script = document.createElement("script");
      script.id = "stripe-buy-btn-script";
      script.src = "https://js.stripe.com/v3/buy-button.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  return (
    <div
      ref={ref}
      className="stripe-btn-wrap"
      dangerouslySetInnerHTML={{
        __html: `<stripe-buy-button buy-button-id="${buyButtonId}" publishable-key="${publishableKey}"></stripe-buy-button>`,
      }}
    />
  );
}
