import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { isNativeApp } from "../lib/nativeApp";
import { TabIcon } from "../components/BottomTabBar";

const Chevron = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

export default function MorePage() {
  const { profile } = useAuth();
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
        {!isNativeApp() && (
          <Link to="/portal/upgrade" className="more-row" data-nav="upgrade">
            <span className="more-row-main">
              <TabIcon name="upgrade" size={17} />
              Upgrade plan
            </span>
            <Chevron />
          </Link>
        )}
        <Link to="/portal/checkout" className="more-row" data-nav="checkout">
          <span className="more-row-main">
            <TabIcon name="checkout" size={17} />
            Checkout &amp; orders
          </span>
          <Chevron />
        </Link>
        <Link to="/portal/support" className="more-row" data-nav="support">
          <span className="more-row-main">
            <TabIcon name="support" size={17} />
            Support
          </span>
          <Chevron />
        </Link>
        <button className="more-row" onClick={() => supabase.auth.signOut()}>
          <span className="more-row-main">
            <TabIcon name="signout" size={17} />
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
