import { useInView } from "./FadeUp";

export default function StaggerGrid({ children, className = "" }) {
  const [ref, visible] = useInView(0.1);
  return (
    <div ref={ref} className={`stagger${visible ? " visible" : ""} ${className}`}>
      {children}
    </div>
  );
}
