import { useInView } from "../hooks/useInView";

export default function FadeUp({ children, delay = 0, className = "" }) {
  const [ref, visible] = useInView(0.1);
  return (
    <div ref={ref} className={`fade-up${visible ? " visible" : ""}${delay ? ` delay-${delay}` : ""} ${className}`}>
      {children}
    </div>
  );
}
