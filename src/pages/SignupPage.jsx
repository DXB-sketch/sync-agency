import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

// Post-purchase account creation. Stripe redirects here after a course
// purchase; the member MUST sign up with the same email used at checkout so
// the webhook-recorded purchase links to their account on confirmation.
export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` },
    });
    setLoading(false);
    if (err) setError(err.message);
    else setSent(true);
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
            We've sent a confirmation link to <strong>{email}</strong>. Click it to activate your
            account and enter the portal.
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
          Use the <strong>same email</strong> you used at checkout — that's how we match your
          purchase to your account.
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          <label className="auth-label">
            Email (same as checkout)
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
