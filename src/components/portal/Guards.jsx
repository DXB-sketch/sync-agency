import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";
import { useChronosMode } from "../../lib/ChronosModeContext";

function Loading() {
  return (
    <div className="portal-loading">
      <span className="portal-loading-ring" />
    </div>
  );
}

// Authed + email-confirmed + active subscription. Inactive monthly subs are
// locked out of everything except /portal/reactivate (RLS enforces this too).
export function RequireMember({ children }) {
  const { session, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!profile) return <Loading />;
  if (!profile.subscription_active && location.pathname !== "/portal/reactivate") {
    return <Navigate to="/portal/reactivate" replace />;
  }
  return children;
}

export function RequireAdmin({ children }) {
  const { session, profile, loading } = useAuth();

  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <Loading />;
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
  if (!profile) return <Loading />;
  if (profile.role !== "admin" || !chronosMode) return <Navigate to={redirectTo} replace />;
  return children;
}
