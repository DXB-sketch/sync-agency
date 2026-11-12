import { ICONS } from "../../lib/icons";

// One line icon from the v2 set. Decorative by default; pass `label` to announce it.
export default function Icon({ name, size = 20, strokeWidth = 1.75, className = "", label, style }) {
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : "true"}
      role={label ? "img" : undefined}
      aria-label={label}
      // inline so the global .icon size/stroke rules don't override the props
      style={{ width: size, height: size, strokeWidth, ...style }}
    >
      <path d={ICONS[name] ?? ICONS.info} />
    </svg>
  );
}
