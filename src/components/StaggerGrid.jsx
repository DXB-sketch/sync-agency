import { useInView } from "../hooks/useInView";

export default function StaggerGrid({ children, className = "", style }) {
  const [ref, visible] = useInView(0.1);
  return (
    <div ref={ref} className={`stagger${visible ? " visible" : ""} ${className}`} style={style}>
      {children}
    </div>
  );
}
