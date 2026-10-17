import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";

// Landing page for the email confirmation link. Supabase confirms the email
// server-side before redirecting here, and a DB trigger has already tried to
// match profiles.email to a purchases.email and set the tier.
//
// The session normally arrives in the URL, but it won't if the link was opened
// in a different browser/app than the one used to sign up (common on phones),
// or if the link expired — so every state ends in a clear next step rather
// than an endless "Confirming…".
const WAIT_MS = 8000;

function readLink() {
  const hash = new URLSearchParams(window.location.hash.slice(1));
  const query = new URLSearchParams(window.location.search);
  return {
    error: hash.get("error_description") ?? query.get("error_description"),
    hasToken: hash.has("access_token") || query.has("code") || query.has("token_hash"),
  };
}

export default function AuthConfirmedPage() {
  const { session, profile, profileError, loading } = useAuth();
  const navigate = useNavigate();
  const [link] = useState(readLink);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setTimedOut(true), WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  const hasPlan =
    profile &&
    (profile.role === "admin" ||
      (profile.tier && profile.tier !== "free") ||
      profile.grandfathered_free);

  useEffect(() => {
    if (hasPlan) navigate(profile.role === "admin" ? "/admin" : "/portal", { replace: true });
  }, [hasPlan, profile, navigate]);

  const waitingForSession = !session && !link.error && (loading || (link.hasToken && !timedOut));
  const waitingForProfile = session && !profile && !profileError;

  if (waitingForSession || waitingForProfile || hasPlan) {
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
          {link.error ? (
            <>
              <h1 className="auth-title">
                Link <em>expired</em>
              </h1>
              <p className="auth-sub">
                This confirmation link is invalid or has expired. Sign in with your email and
                password — if your account still needs confirming, you can send yourself a fresh
                link from there.
              </p>
            </>
          ) : (
            <>
              <h1 className="auth-title">
                Email <em>confirmed</em>
              </h1>
              <p className="auth-sub">
                Your email is confirmed. Sign in with the email and password you signed up with
                to open your dashboard.
              </p>
            </>
          )}
          <button className="btn-gold auth-submit" onClick={() => navigate("/login")}>
            Go to sign in
          </button>
        </div>
      </section>
    );
  }

  // Confirmed, but no plan is linked to this email (or the profile couldn't load)
  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          <span className="eyebrow-text">Account Confirmed</span>
        </div>
        <h1 className="auth-title">
          You're <em>in</em>
        </h1>
        <p className="auth-sub">
          Your account{profile?.email ? ` (${profile.email})` : ""} is confirmed. Choose a plan to
          unlock your dashboard.
          <br />
          <br />
          Already bought one with a different email? Contact{" "}
          <strong>confirmation@syncagency.org</strong> with your checkout email and we'll link
          your access.
        </p>
        <div className="auth-actions">
          <Link className="btn-gold auth-submit" to="/portal/upgrade">
            Choose your plan
          </Link>
        </div>
      </div>
    </section>
  );
}
