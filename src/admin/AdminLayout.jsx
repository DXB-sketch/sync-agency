import { NavLink, Outlet, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

const LINKS = [
  { to: "/admin", label: "Clients", end: true },
  { to: "/admin/pool", label: "Product pool" },
  { to: "/admin/catalogue", label: "Catalogue" },
  { to: "/admin/orders", label: "Orders queue" },
  { to: "/admin/achievements", label: "Achievements review" },
  { to: "/admin/support", label: "Support" },
];

export default function AdminLayout() {
  return (
    <div className="portal portal-admin">
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
    </div>
  );
}
