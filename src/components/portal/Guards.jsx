import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../lib/useAuth";
import { useChronosMode } from "../../lib/useChronosMode";

function Loading() {
  return (
    <div className="portal-loading">
      <span className="portal-loading-ring" />
    </div>
  );
}

// Signed in, but the profile row couldn't be loaded (network drop, or the
// account's profile is missing) — offer a way out instead of spinning forever.
function ProfileProblem() {
  const { refreshProfile } = useAuth();
  const [retrying, setRetrying] = useState(false);
  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">
          We couldn't load your <em>account</em>
        </h1>
        <p className="auth-sub">
          Check your connection and try again. If this keeps happening, contact{" "}
          <a href="mailto:confirmation@syncagency.org">confirmation@syncagency.org</a>.
        </p>
        <button
          className="btn-gold auth-submit"
          disabled={retrying}
          onClick={async () => {
            setRetrying(true);
            await refreshProfile();
            setRetrying(false);
          }}
        >
          {retrying ? "Retrying…" : "Try again"}
        </button>
        <p className="auth-alt">
          <button className="auth-link-btn" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </p>
      </div>
    </section>
  );
}

function Pending() {
  const { profileError } = useAuth();
  return profileError ? <ProfileProblem /> : <Loading />;
}

// Authed + email-confirmed + active access. Paid members whose access is
// paused are locked out of everything except /portal/access-paused (RLS
// enforces this too). The free tier is closed to new accounts: members
// grandfathered in (profiles.grandfathered_free) keep their old free access,
// but any newer account without a paid plan only sees /portal/upgrade (and
// /portal/support so they can reach us) until a purchase links up.
export function RequireMember({ children }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!profile) return <Pending />;
  const unpaid =
    (!profile.tier || profile.tier === "free") &&
    !profile.grandfathered_free &&
    profile.role !== "admin";
  if (!unpaid && !profile.subscription_active && location.pathname !== "/portal/access-paused") {
    return <Navigate to="/portal/access-paused" replace />;
  }
  if (
    unpaid &&
    location.pathname !== "/portal/upgrade" &&
    location.pathname !== "/portal/support"
  ) {
    return <Navigate to="/portal/upgrade" replace />;
  }
  return children;
}

export function RequireAdmin({ children }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <Pending />;
  if (profile.role !== "admin") return <Navigate to="/portal" replace />;
  return children;
}

// Chronos admin sections: default OFF, admin opts in via the Chronos Mode switch
// (AdminLayout.jsx). Visibility only — always nested inside RequireAdmin/RequireMember,
// so a member session can never reach this check with profile.role !== "admin", and setting
// the localStorage key by hand does nothing without also being an authed admin.
export function RequireChronos({ children, redirectTo = "/admin" }) {
  const { session, profile, loading } = useAuth();
  const { chronosMode } = useChronosMode();

  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <Pending />;
  if (profile.role !== "admin" || !chronosMode) return <Navigate to={redirectTo} replace />;
  return children;
}
