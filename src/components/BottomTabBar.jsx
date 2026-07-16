import { NavLink, useLocation } from "react-router-dom";

// Minimal line icons in the brand stroke style, matching PathwayIcon's approach.
const GLYPHS = {
  dashboard: <path d="M4 13 L12 5 L20 13 M6 11 V20 H18 V11" />,
  pathway: <path d="M6 19 Q6 13 10 13 Q14 13 14 8 Q14 5 18 5 M6 19 A2 2 0 1 1 6 18.99 M18 5 A2 2 0 1 1 18 5.01" />,
  products: <path d="M5 8 L12 4 L19 8 V17 L12 21 L5 17 Z M5 8 L12 12 L19 8 M12 12 V21" />,
  checkout: <path d="M4 6 H6 L8.5 16 H18 L20 8 H7 M9 20 A1 1 0 1 1 9 19.99 M17 20 A1 1 0 1 1 17 19.99" />,
  achievements: <path d="M12 3 L14.5 8.5 L20 9.5 L16 13.5 L17 19.5 L12 16.5 L7 19.5 L8 13.5 L4 9.5 L9.5 8.5 Z" />,
  support: <path d="M4 12 Q4 5 12 5 Q20 5 20 12 Q20 17 15 17 H12 L8 20 V17 Q4 16.5 4 12 Z" />,
  upgrade: <path d="M12 20 V6 M6 12 L12 6 L18 12" />,
  clients: <path d="M9 11 A3 3 0 1 1 9 10.99 M17 12 A2.5 2.5 0 1 1 17 11.99 M3 20 Q3 14 9 14 Q15 14 15 20 M15 20 Q15 16 20 16 Q21.5 16 21 15" />,
  orders: <path d="M4 7 H20 M4 12 H20 M4 17 H14" />,
  more: <path d="M5 12 A1.4 1.4 0 1 1 5 11.99 M12 12 A1.4 1.4 0 1 1 12 11.99 M19 12 A1.4 1.4 0 1 1 19 11.99" />,
  signout: <path d="M9 21 H5 A2 2 0 0 1 3 19 V5 A2 2 0 0 1 5 3 H9 M16 17 L21 12 L16 7 M21 12 H9" />,
};

export function TabIcon({ name, size = 21 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {GLYPHS[name] ?? GLYPHS.dashboard}
    </svg>
  );
}

export default function BottomTabBar({ links }) {
  const location = useLocation();
  return (
    <nav className="bottom-tab-bar">
      {links.map((l) => {
        // A tab can also own extra routes (e.g. More owns Support/Upgrade/Checkout)
        const alsoActive = (l.also ?? []).some((p) => location.pathname.startsWith(p));
        return (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            data-nav={l.icon}
            className={({ isActive }) => `bottom-tab${isActive || alsoActive ? " active" : ""}`}
          >
            <TabIcon name={l.icon} />
            <span className="bottom-tab-label">{l.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
