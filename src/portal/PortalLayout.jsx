import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { TIERS } from "../lib/tiers";
import { isNativeApp } from "../lib/nativeApp";
import { TutorialProvider } from "./Tutorial";
import { useTutorial } from "./tutorialSteps";
import BottomTabBar from "../components/BottomTabBar";
import Icon from "../components/portal/Icon";
import CartBar from "./CartBar";
import { walletEnabled } from "../lib/walletFlag";
import WalletPromoPopup from "./WalletPromoPopup";
import PlusPopup from "./PlusPopup";

// Desktop navigation (v2): 15px sentence-case links with icons; Upgrade sits at the right.
const NAV_LINKS = [
  { to: "/portal", label: "Dashboard", end: true, icon: "home", tut: "dashboard" },
  { to: "/portal/pathway", label: "Pathway", icon: "pathway", tut: "pathway" },
  { to: "/portal/products", label: "Products", icon: "products", tut: "products" },
  { to: "/portal/checkout", label: "Checkout", icon: "checkout", tut: "checkout" },
  { to: "/portal/rewards", label: "Rewards", icon: "rewards", tut: "rewards", wallet: true },
  { to: "/portal/achievements", label: "Achievements", icon: "achieve", tut: "achievements" },
  { to: "/portal/wallet", label: "Wallet", icon: "wallet", tut: "wallet", wallet: true },
  { to: "/portal/support", label: "Support", icon: "support", tut: "support" },
];

// Mobile + native tab bar, in this order. Pathway and Support live in More.
const TAB_LINKS = [
  { to: "/portal", label: "Dashboard", end: true, icon: "home", tut: "dashboard" },
  { to: "/portal/rewards", label: "Rewards", icon: "rewards", tut: "rewards", also: ["/portal/wallet"] },
  { to: "/portal/products", label: "Products", icon: "products", tut: "products" },
  { to: "/portal/achievements", label: "Achieve", icon: "achieve", tut: "achievements" },
  {
    to: "/portal/more",
    label: "More",
    icon: "more",
    tut: "more",
    also: ["/portal/support", "/portal/upgrade", "/portal/checkout", "/portal/plus", "/portal/pathway"],
  },
];

function initials(name, email) {
  const src = (name || email || "").trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "S";
}

// Small popover menu: closes on outside click, Escape, or picking an item
function Menu({ label, button, children, className = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className={`pt-menu ${className}`} ref={ref}>
      <button type="button" className="pt-icon-btn" aria-label={label} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)}>
        {button}
      </button>
      {open && (
        <div className="pt-menu-pop" role="menu" onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  );
}

function TopBar() {
  const { profile } = useAuth();
  const { start: startTour } = useTutorial();
  const [balance, setBalance] = useState(null);
  const [answered, setAnswered] = useState(0);
  const location = useLocation();
  const tier = profile?.tier ? TIERS[profile.tier] : null;
  const wallet = walletEnabled(profile);

  useEffect(() => {
    if (!profile?.id) return;
    if (wallet) {
      supabase
        .from("wallets")
        .select("balance_cents")
        .eq("member_id", profile.id)
        .maybeSingle()
        .then(({ data }) => setBalance(data?.balance_cents ?? 0));
    }
    // Notifications: support tickets the team has answered
    supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .eq("member_id", profile.id)
      .eq("status", "answered")
      .then(({ count }) => setAnswered(count ?? 0));
  }, [profile?.id, wallet, location.pathname]);

  const money = balance == null ? null : `$${(balance / 100).toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <header className="portal-topbar">
      <Link to="/portal" className="portal-logo" aria-label="Sync portal home">
        SYNC<span>Portal</span>
      </Link>
      <div className="portal-topbar-right">
        {wallet && money && (
          <Link to="/portal/wallet" className="pt-wallet" aria-label={`Wallet balance ${money} AUD. Top up`}>
            <Icon name="wallet" size={16} />
            <span>{money}</span>
            <span className="pt-wallet-plus" aria-hidden="true">
              <Icon name="plus" size={14} strokeWidth={2.5} />
            </span>
          </Link>
        )}
        <Menu label="Help and tours" className="pt-hide-sm" button={<Icon name="help" />}>
          <button type="button" role="menuitem" onClick={() => startTour("portal")}>
            <Icon name="target" size={18} />
            Replay the portal tour
          </button>
          {wallet && (
            <button type="button" role="menuitem" onClick={() => startTour("rewards")}>
              <Icon name="rewards" size={18} />
              Replay the Rewards tour
            </button>
          )}
          <Link to="/portal/support" role="menuitem">
            <Icon name="support" size={18} />
            Contact support
          </Link>
        </Menu>
        <Link to="/portal/support" className="pt-icon-btn pt-hide-sm" aria-label={answered ? `Notifications: ${answered} support repl${answered === 1 ? "y" : "ies"}` : "Notifications"}>
          <Icon name="bell" />
          {answered > 0 && <span className="pt-dot" aria-hidden="true" />}
        </Link>
        <Menu
          label="Account"
          className="pt-account"
          button={
            <>
              <span className="pt-avatar">{initials(profile?.full_name, profile?.email)}</span>
              <span className="pt-account-name">{profile?.full_name?.split(" ")[0] ?? "Account"}</span>
              {tier && <span className={`tier-badge tier-${profile.tier}`}>{tier.short}</span>}
            </>
          }
        >
          <div className="pt-menu-head">
            <strong>{profile?.full_name || profile?.email}</strong>
            {tier && <span>{tier.name}</span>}
          </div>
          <Link to="/portal/plus" role="menuitem">
            <Icon name="star" size={18} />
            Sync Plus
          </Link>
          {profile?.role === "admin" && (
            <Link to="/admin" role="menuitem">
              <Icon name="user" size={18} />
              Admin
            </Link>
          )}
          <button type="button" role="menuitem" onClick={() => supabase.auth.signOut()}>
            <Icon name="logout" size={18} />
            Sign out
          </button>
        </Menu>
      </div>
    </header>
  );
}

export default function PortalLayout() {
  const { profile } = useAuth();
  const native = isNativeApp();
  const navLinks = NAV_LINKS.filter((l) => !l.wallet || walletEnabled(profile));

  return (
    <TutorialProvider>
      <div className={`portal${native ? " portal-native" : ""}`}>
        <a href="#portal-main" className="skip-link">
          Skip to content
        </a>
        <TopBar />
        <nav className="portal-nav" aria-label="Portal">
          {navLinks.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              data-nav={l.tut}
              data-tut={`nav-${l.tut}`}
              className={({ isActive }) => `portal-nav-link${isActive ? " active" : ""}`}
            >
              <Icon name={l.icon} size={18} />
              {l.label}
            </NavLink>
          ))}
          <span className="portal-nav-spacer" />
          {!native && (
            <NavLink to="/portal/upgrade" className={({ isActive }) => `btn-ghost btn-sm portal-nav-upgrade${isActive ? " active" : ""}`}>
              <Icon name="upgrade" size={18} />
              Upgrade
            </NavLink>
          )}
        </nav>
        <main className="portal-main" id="portal-main" tabIndex={-1}>
          <Outlet />
        </main>
        <CartBar />
        <WalletPromoPopup />
        <PlusPopup />
        <BottomTabBar links={TAB_LINKS} />
      </div>
    </TutorialProvider>
  );
}
