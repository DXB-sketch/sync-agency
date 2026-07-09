import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
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

export default function AdminLayout() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const native = isNativeApp();

  // Close the mobile menu whenever the route changes
  useEffect(() => setMenuOpen(false), [location.pathname]);

  // Lock background scroll while the mobile nav overlay is open
  useEffect(() => {
    if (native) return;
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen, native]);

  const currentLabel =
    LINKS.find((l) => (l.end ? location.pathname === l.to : location.pathname.startsWith(l.to)))
      ?.label ?? "Menu";

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
          {!native && (
            <button
              className="portal-menu-btn"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? "✕" : "☰"} {currentLabel}
            </button>
          )}
        </div>
      </header>
      {!native && (
        <nav className={`portal-nav${menuOpen ? " open" : ""}`}>
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `portal-nav-link${isActive ? " active" : ""}`}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </NavLink>
          ))}
          <button
            className="portal-nav-link portal-signout-mobile"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </nav>
      )}
      <main className="portal-main">
        <Outlet />
      </main>
      {native && <BottomTabBar links={LINKS} />}
    </div>
  );
}
