import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";

// Shown (and enforced by RLS) when a member's access is paused: they can't
// reach any portal data until an admin restores it.
export default function ReactivatePage() {
  const { profile } = useAuth();

  if (profile?.subscription_active) return <Navigate to="/portal" replace />;

  return (
    <section className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">
          Your access is <em>paused</em>
        </h1>
        <p className="auth-sub">
          Contact <a href="mailto:confirmation@syncagency.org">confirmation@syncagency.org</a> for help restoring your access.
        </p>
      </div>
    </section>
  );
}
