import { useEffect, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TIERS } from "../lib/tiers";
import { isNativeApp } from "../lib/nativeApp";
import { TutorialProvider, SaleNudges } from "./Tutorial";
import BottomTabBar from "../components/BottomTabBar";

const LINKS = [
  { to: "/portal", label: "Dashboard", end: true, icon: "dashboard" },
  { to: "/portal/pathway", label: "Pathway", icon: "pathway" },
  { to: "/portal/products", label: "Products", icon: "products" },
  { to: "/portal/checkout", label: "Checkout", icon: "checkout" },
  { to: "/portal/achievements", label: "Achievements", icon: "achievements" },
  { to: "/portal/support", label: "Support", icon: "support" },
  { to: "/portal/upgrade", label: "Upgrade", icon: "upgrade" },
].filter((l) => l.to !== "/portal/upgrade" || !isNativeApp());

export default function PortalLayout() {
  const { profile } = useAuth();
  const tier = profile?.tier ? TIERS[profile.tier] : null;
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

  // The tutorial opens the menu when it highlights a nav tab (hidden on mobile)
  useEffect(() => {
    const onNav = (e) => setMenuOpen(Boolean(e.detail?.open));
    window.addEventListener("sync:portal-nav", onNav);
    return () => window.removeEventListener("sync:portal-nav", onNav);
  }, []);

  const currentLabel =
    LINKS.find((l) => (l.end ? location.pathname === l.to : location.pathname.startsWith(l.to)))
      ?.label ?? "Menu";

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
        <SaleNudges />
        {native && <BottomTabBar links={LINKS} />}
      </div>
    </TutorialProvider>
  );
}
