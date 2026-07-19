import { NavLink, Outlet, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { isNativeApp } from "../lib/nativeApp";
import BottomTabBar from "../components/BottomTabBar";
import SocialIcons from "../components/SocialIcons";
import { useChronosMode } from "../lib/ChronosModeContext";

const BASE_LINKS = [
  { to: "/admin", label: "Clients", end: true, icon: "clients" },
  { to: "/admin/products", label: "Products", icon: "products" },
  { to: "/admin/orders", label: "Orders queue", icon: "orders" },
  { to: "/admin/achievements", label: "Achievements review", icon: "achievements" },
  { to: "/admin/support", label: "Support", icon: "support" },
];

// Chronos-only admin nav — hidden unless Chronos Mode is on (route itself also
// redirects via RequireChronos, so this is visibility only, not the real gate).
const CHRONOS_LINKS = [
  { to: "/admin/exceptions", label: "Exceptions", icon: "exceptions" },
  { to: "/admin/margins", label: "Margins", icon: "margins" },
  { to: "/admin/chronos", label: "Chronos Preview", icon: "chronos" },
];

function labelForTab(label) {
  return { "Orders queue": "Orders", "Achievements review": "Achieve" }[label] ?? label;
}

export default function AdminLayout() {
  const native = isNativeApp();
  const { chronosMode, setChronosMode } = useChronosMode();

  const links = chronosMode ? [...BASE_LINKS, ...CHRONOS_LINKS] : BASE_LINKS;
  const tabLinks = links.map((l) => ({ ...l, label: labelForTab(l.label) }));

  return (
    <div className={`portal portal-admin${native ? " portal-native" : ""}`}>
      <header className="portal-topbar">
        <div className="portal-topbar-left">
          <Link to="/admin" className="portal-logo">
            SYNC<span>/ADMIN</span>
          </Link>
          <SocialIcons className="portal-social" />
        </div>
        <div className="portal-topbar-right">
          <label className="chronos-mode-switch">
            <span>Chronos Mode</span>
            <input
              type="checkbox"
              checked={chronosMode}
              onChange={(e) => setChronosMode(e.target.checked)}
            />
            <span className="chronos-mode-track" aria-hidden="true" />
          </label>
          <Link to="/portal" className="portal-admin-link">
            Member portal
          </Link>
          <button className="portal-signout" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <nav className="portal-nav">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.end}
            className={({ isActive }) => `portal-nav-link${isActive ? " active" : ""}`}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <main className="portal-main">
        <Outlet />
      </main>
      <BottomTabBar links={tabLinks} />
    </div>
  );
}
