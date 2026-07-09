import { NavLink, Outlet, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { isNativeApp } from "../lib/nativeApp";
import BottomTabBar from "../components/BottomTabBar";

const LINKS = [
  { to: "/admin", label: "Clients", end: true, icon: "clients" },
  { to: "/admin/products", label: "Products", icon: "products" },
  { to: "/admin/orders", label: "Orders queue", icon: "orders" },
  { to: "/admin/achievements", label: "Achievements review", icon: "achievements" },
  { to: "/admin/support", label: "Support", icon: "support" },
];

// Short labels for the bottom tab bar
const TAB_LINKS = LINKS.map((l) => ({
  ...l,
  label: { "Orders queue": "Orders", "Achievements review": "Achieve" }[l.label] ?? l.label,
}));

export default function AdminLayout() {
  const native = isNativeApp();

  return (
    <div className={`portal portal-admin${native ? " portal-native" : ""}`}>
      <header className="portal-topbar">
        <Link to="/admin" className="portal-logo">
          SYNC<span>/ADMIN</span>
        </Link>
        <div className="portal-topbar-right">
          <Link to="/portal" className="portal-admin-link">
            Member portal
          </Link>
          <button className="portal-signout" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>
      <nav className="portal-nav">
        {LINKS.map((l) => (
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
      <BottomTabBar links={TAB_LINKS} />
    </div>
  );
}
