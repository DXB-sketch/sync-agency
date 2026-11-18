import { NavLink, Outlet, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { isNativeApp } from "../lib/nativeApp";
import BottomTabBar from "../components/BottomTabBar";

const BASE_LINKS = [
  { to: "/admin", label: "Analytics", end: true, icon: "analytics" },
  { to: "/admin/clients", label: "Clients", icon: "clients" },
  { to: "/admin/products", label: "Products", icon: "products" },
  { to: "/admin/orders", label: "Orders queue", icon: "orders" },
  { to: "/admin/achievements", label: "Achievements review", icon: "achievements" },
  { to: "/admin/support", label: "Support", icon: "support" },
  { to: "/admin/promos", label: "Promos", icon: "wallet" },
  { to: "/admin/plus", label: "Sync Plus", icon: "plus" },
  { to: "/admin/creators", label: "Creators", icon: "megaphone" },
];

function labelForTab(label) {
  return { "Orders queue": "Orders", "Achievements review": "Achieve", Analytics: "Stats" }[label] ?? label;
}

export default function AdminLayout() {
  const native = isNativeApp();
  const tabLinks = BASE_LINKS.map((l) => ({ ...l, label: labelForTab(l.label) }));

  return (
    <div className={`portal portal-admin${native ? " portal-native" : ""}`}>
      <header className="portal-topbar">
        <div className="portal-topbar-left">
          <Link to="/admin" className="portal-logo">
            SYNC<span>/ADMIN</span>
          </Link>
        </div>
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
        {BASE_LINKS.map((l) => (
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
