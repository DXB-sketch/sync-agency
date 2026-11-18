import { useEffect, useRef, useState } from "react";

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// A number that counts up to `value` (from whatever it showed last). While `value`
// is null it shows a gold shimmer placeholder; once it lands it glows briefly.
export default function CountUp({ value, format = (n) => Math.round(n).toLocaleString("en-AU"), duration = 1400, delay = 0, className = "" }) {
  const [shown, setShown] = useState(0);
  const [landed, setLanded] = useState(false);
  const from = useRef(0);

  useEffect(() => {
    if (value == null) return;
    const start = from.current;
    if (reduceMotion() || start === value) {
      from.current = value;
      setShown(value);
      return;
    }
    setLanded(false);
    let raf;
    let t0;
    const tick = (t) => {
      t0 ??= t + delay;
      const p = Math.min(1, Math.max(0, (t - t0) / duration));
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p); // ease-out expo
      const n = start + (value - start) * eased;
      from.current = n;
      setShown(n);
      if (p < 1) raf = requestAnimationFrame(tick);
      else setLanded(true);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, delay]);

  if (value == null) return <span className={`count-up is-loading ${className}`.trim()} aria-label="Loading" />;
  return <span className={`count-up${landed ? " is-landed" : ""} ${className}`.trim()}>{format(shown)}</span>;
}
