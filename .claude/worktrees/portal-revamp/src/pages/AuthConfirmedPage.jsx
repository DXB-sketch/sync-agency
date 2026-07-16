import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";

// Landing page for the email confirmation link. By the time the session
// arrives here, a DB trigger has already tried to match profiles.email to a
// purchases.email and set the tier. No matching purchase → support state.
export default function AuthConfirmedPage() {
  const { session, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) return; // still exchanging the token from the URL
    (async () => {
      const fresh = await refreshProfile();
      setChecked(true);
      if (fresh?.tier) navigate("/portal", { replace: true });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, session]);

  if (!checked || loading) {
    return (
      <section className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">
            Confirming<em>…</em>
          </h1>
          <p className="auth-sub">Hold tight — verifying your account.</p>
        </div>
      </section>
    );
  }

  if (!session) {
    return (
      <section className="auth-page">
        <div className="auth-card">
          <h1 className="auth-title">
            Link <em>expired</em>
          </h1>
          <p className="auth-sub">
            This confirmation link is invalid or expired. Try signing in — if that fails, sign up
            again to get a fresh link.
          </p>
          <button className="btn-gold auth-submit" onClick={() => navigate("/login")}>
            Go to sign in
          </button>
        </div>
      </section>
    );
  }

  // Confirmed but no tier: purchase email didn't match
  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          <span className="eyebrow-text">Account Confirmed</span>
        </div>
        <h1 className="auth-title">
          We couldn't match your <em>purchase</em>
        </h1>
        <p className="auth-sub">
          Your account ({profile?.email}) is confirmed, but we couldn't find a course purchase
          under this email. This usually means a different email was used at checkout.
          <br />
          <br />
          Contact us at <strong>confirmation@syncagency.org</strong> with your checkout email and
          we'll link your access manually.
        </p>
      </div>
    </section>
  );
}
