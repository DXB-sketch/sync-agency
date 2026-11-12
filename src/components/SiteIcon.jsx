import { ICONS } from "../lib/icons";

// The v2 line-icon set (lib/icons.js), shared with the portal. On the site
// "chevron" means the down-pointing accordion/compare chevron.
const PATHS = { ...ICONS, chevron: ICONS.chevronDown };

export default function Icon({ name, className = "icon", style }) {
  return (
    <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
