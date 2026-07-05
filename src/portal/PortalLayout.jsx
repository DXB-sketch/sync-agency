import { NavLink, Outlet, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TIERS } from "../lib/tiers";

const LINKS = [
  { to: "/portal", label: "Dashboard", end: true },
  { to: "/portal/pathway", label: "Pathway" },
  { to: "/portal/products", label: "Products" },
  { to: "/portal/checkout", label: "Checkout" },
  { to: "/portal/orders", label: "Orders" },
  { to: "/portal/achievements", label: "Achievements" },
  { to: "/portal/support", label: "Support" },
  { to: "/portal/upgrade", label: "Upgrade" },
];

export default function PortalLayout() {
  const { profile } = useAuth();
  const tier = profile?.tier ? TIERS[profile.tier] : null;

  return (
    <div className="portal">
      <header className="portal-topbar">
        <Link to="/portal" className="portal-logo">
          SYNC<span>/PORTAL</span>
        </Link>
        <div className="portal-topbar-right">
          {tier && <span className={`tier-badge tier-${profile.tier}`}>{tier.short}</span>}
          {profile?.role === "admin" && (
            <Link to="/admin" className="portal-admin-link">
              Admin
            </Link>
          )}
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
