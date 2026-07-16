import { useRef, useState, useEffect } from "react";

export function useInView(threshold = 0.15, once = true) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); if (once) obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, once]);
  return [ref, visible];
}

export default function FadeUp({ children, delay = 0, className = "" }) {
  const [ref, visible] = useInView(0.1);
  return (
    <div ref={ref} className={`fade-up${visible ? " visible" : ""}${delay ? ` delay-${delay}` : ""} ${className}`}>
      {children}
    </div>
  );
}
