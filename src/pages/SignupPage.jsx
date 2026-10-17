import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import ResendConfirmation from "../components/ResendConfirmation";

// Account creation for members — the portal requires a paid plan. Course
// purchases auto-link on confirmation when the signup email matches the
// email used at Stripe checkout; accounts without a plan are sent to the
// upgrade page to choose one.
export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [exists, setExists] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setExists(false);
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` },
    });
    setLoading(false);
    if (err) {
      setError(
        err.status === 429
          ? "Too many sign-up attempts — please wait a few minutes and try again."
          : err.message
      );
    } else if (data.user && data.user.identities?.length === 0) {
      // Supabase hides "already registered" (and sends no email) to stop
      // account probing — an empty identities list is the tell.
      setExists(true);
    } else if (data.session) {
      navigate("/portal", { replace: true });
    } else {
      setSent(true);
    }
  }

  if (sent) {
    return (
      <section className="auth-page">
        <div className="auth-card">
          <div className="eyebrow">
            <span className="eyebrow-line" />
            <span className="eyebrow-text">One More Step</span>
          </div>
          <h1 className="auth-title">
            Check your <em>email</em>
          </h1>
          <p className="auth-sub">
            We've sent a confirmation link to <strong>{email.trim()}</strong>. Click it to activate
            your account and open your dashboard. It usually arrives within a minute.
          </p>
          <ResendConfirmation email={email.trim()} />
          <p className="auth-alt">
            Wrong email?{" "}
            <button type="button" className="auth-link-btn" onClick={() => setSent(false)}>
              Start again
            </button>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="auth-page">
      <div className="auth-card">
        <div className="eyebrow">
          <span className="eyebrow-line" />
          <span className="eyebrow-text">Welcome to Sync</span>
        </div>
        <h1 className="auth-title">
          Create your <em>account</em>
        </h1>
        <p className="auth-sub">
          Bought a plan? Sign up with the <strong>same email you used at checkout</strong> and
          your purchase links automatically. Haven't joined yet? You can choose your plan
          right after creating your account.
        </p>
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
              autoComplete="new-password"
              minLength={8}
              required
            />
          </label>
          {error && <p className="auth-error">{error}</p>}
          {exists && (
            <p className="auth-error">
              An account with this email already exists. <Link to="/login">Sign in instead</Link>{" "}
              — if you never confirmed it, signing in lets you resend the confirmation email.
            </p>
          )}
          <button className="btn-gold auth-submit" type="submit" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
        <p className="auth-alt">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </section>
  );
}
