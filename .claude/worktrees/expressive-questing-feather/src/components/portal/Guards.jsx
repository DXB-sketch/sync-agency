import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../lib/AuthContext";

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
