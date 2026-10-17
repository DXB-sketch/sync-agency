import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import ResendConfirmation from "../components/ResendConfirmation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const { session, profile, profileError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname;

  // Once signed in, hand off to the portal; the route guards show a retry
  // screen if the profile itself couldn't be loaded.
  useEffect(() => {
    if (session && (profile || profileError)) {
      navigate(profile?.role === "admin" ? "/admin" : from ?? "/portal", { replace: true });
    }
  }, [session, profile, profileError, from, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setUnconfirmed(false);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err?.code === "email_not_confirmed") setUnconfirmed(true);
    else if (err) setError(err.message);
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          <span className="eyebrow-text">Member Access</span>
        </div>
        <h1 className="auth-title">
          Sign <em>in</em>
        </h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label">
            Email
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </label>
          <label className="auth-label">
            Password
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          {unconfirmed && (
            <div className="auth-error">
              Your email isn't confirmed yet — open the link we emailed to {email.trim()}.
              <ResendConfirmation email={email.trim()} initialWait={0} />
            </div>
          )}
          <button className="btn-gold auth-submit" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="auth-alt">
          New here? <Link to="/signup">Create your account</Link>
        </p>
      </div>
    </section>
  );
}
