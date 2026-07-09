import { NavLink, Outlet, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TIERS } from "../lib/tiers";
import { isNativeApp } from "../lib/nativeApp";
import { TutorialProvider, SaleNudges } from "./Tutorial";
import BottomTabBar from "../components/BottomTabBar";

// Desktop top-strip navigation — every destination.
const NAV_LINKS = [
  { to: "/portal", label: "Dashboard", end: true, icon: "dashboard" },
  { to: "/portal/pathway", label: "Pathway", icon: "pathway" },
  { to: "/portal/products", label: "Products", icon: "products" },
  { to: "/portal/checkout", label: "Checkout", icon: "checkout" },
  { to: "/portal/achievements", label: "Achievements", icon: "achievements" },
  { to: "/portal/support", label: "Support", icon: "support" },
  { to: "/portal/upgrade", label: "Upgrade", icon: "upgrade" },
].filter((l) => l.to !== "/portal/upgrade" || !isNativeApp());

// Mobile + native bottom tab bar — five icon tabs; the rest lives under More.
const TAB_LINKS = [
  { to: "/portal", label: "Dashboard", end: true, icon: "dashboard" },
  { to: "/portal/pathway", label: "Pathway", icon: "pathway" },
  { to: "/portal/products", label: "Products", icon: "products" },
  { to: "/portal/achievements", label: "Achieve", icon: "achievements" },
  { to: "/portal/more", label: "More", icon: "more", also: ["/portal/support", "/portal/upgrade", "/portal/checkout"] },
];

export default function PortalLayout() {
  const { profile } = useAuth();
  const tier = profile?.tier ? TIERS[profile.tier] : null;
  const native = isNativeApp();

  return (
    <TutorialProvider>
      <div className={`portal${native ? " portal-native" : ""}`}>
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
          {NAV_LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              data-nav={l.icon}
              className={({ isActive }) => `portal-nav-link${isActive ? " active" : ""}`}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <main className="portal-main">
          <Outlet />
        </main>
        <SaleNudges />
        <BottomTabBar links={TAB_LINKS} />
      </div>
    </TutorialProvider>
  );
}
