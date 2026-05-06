import { useInView } from "../hooks/useInView";
import { useCountUp } from "../hooks/useCountUp";

export default function StatCounter({ target, suffix = "", prefix = "" }) {
  const [ref, visible] = useInView(0.3);
  const val = useCountUp(target, 1600, visible);
  return (
    <span ref={ref}>
      {prefix}{visible || val > 0 ? val : 0}{suffix}
    </span>
  );
}
