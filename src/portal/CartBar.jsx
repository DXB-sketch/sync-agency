import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { loadCart } from "../lib/cart";
import Icon from "../components/portal/Icon";
import { useTutorial } from "./tutorialSteps";

// Phones: a slim "1 item in your order · Checkout" bar above the tab bar whenever
// the order has items. Replaces the old "Got a sale?" popover. The tutorial's
// practice item shows here too, without touching the real cart.
export default function CartBar() {
  const location = useLocation();
  const { sim } = useTutorial();
  const [count, setCount] = useState(() => loadCart().length);

  useEffect(() => {
    const sync = () => setCount(loadCart().length);
    sync();
    window.addEventListener("sync:cart-add", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("sync:cart-add", sync);
      window.removeEventListener("storage", sync);
    };
  }, [location.pathname]);

  const shown = count + (sim?.added ? 1 : 0);
  if (shown === 0 || location.pathname.startsWith("/portal/checkout")) return null;

  return (
    <Link to="/portal/checkout" className="cart-bar" data-tut="cart-bar">
      <Icon name="checkout" size={18} />
      <span className="cart-bar-text">
        {shown} item{shown === 1 ? "" : "s"} in your order
      </span>
      <span className="cart-bar-go">
        Checkout
        <Icon name="arrow" size={16} />
      </span>
    </Link>
  );
}
