import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { isNativeApp } from "../lib/nativeApp";
import Icon from "../components/portal/Icon";
import { walletEnabled } from "../lib/walletFlag";
import { useChronosMode } from "../lib/useChronosMode";

function Row({ to, icon, label }) {
  return (
    <Link to={to} className="more-row">
      <span className="more-row-main">
        <Icon name={icon} size={20} />
        {label}
      </span>
      <Icon name="chevron" size={18} />
    </Link>
  );
}

export default function MorePage() {
  const { profile } = useAuth();
  const { chronosMode } = useChronosMode();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  // App-store requirement: accounts must be deletable from inside the app.
  async function deleteAccount() {
    if (
      !window.confirm(
        "Permanently delete your Sync account? Your pathway progress, products, orders and tickets will be erased. This cannot be undone."
      )
    )
      return;
    setDeleting(true);
    setError(null);
    const { data, error: fnErr } = await supabase.functions.invoke("delete-account", { body: {} });
    if (fnErr || data?.error) {
      setError(data?.error ?? "Could not delete the account — contact support.");
      setDeleting(false);
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <div className="portal-page more-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">More</h1>
      </div>

      {error && <p className="auth-error">{error}</p>}

      <div className="more-list">
        <Row to="/portal/pathway" icon="pathway" label="Pathway" />
        <Row to="/portal/checkout" icon="checkout" label="Checkout & orders" />
        {walletEnabled(profile) && <Row to="/portal/wallet" icon="wallet" label="Wallet" />}
        <Row to="/portal/support" icon="support" label="Support" />
        {!isNativeApp() && <Row to="/portal/upgrade" icon="upgrade" label="Upgrade plan" />}
        <Row to="/portal/plus" icon="star" label="Sync Plus" />
        {/* Chronos preview: admin-only, and only when Chronos Mode is on — the route
            itself is also wrapped in RequireChronos (App.jsx), so this is
            belt-and-suspenders, not the only gate. */}
        {profile?.role === "admin" && chronosMode && <Row to="/portal/store" icon="store" label="Shopify store (Chronos preview)" />}
        {profile?.role === "admin" && <Row to="/admin" icon="user" label="Admin" />}
        <Row to="/terms" icon="info" label="Terms of Service" />
        <Row to="/privacy" icon="lock" label="Privacy Policy" />
        <button type="button" className="more-row" onClick={() => supabase.auth.signOut()}>
          <span className="more-row-main">
            <Icon name="logout" size={20} />
            Sign out
          </span>
        </button>
      </div>

      {profile?.role !== "admin" && (
        <div className="danger-zone">
          <div>
            <h2 className="danger-title">Delete account</h2>
            <p className="dash-card-sub">
              Permanently erase your account and all of its data. This can't be undone.
            </p>
          </div>
          <button className="btn-ghost danger-btn" disabled={deleting} onClick={deleteAccount}>
            {deleting ? "Deleting…" : "Delete my account"}
          </button>
        </div>
      )}
    </div>
  );
}
