import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const { session, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (session && profile) {
      navigate(profile.role === "admin" ? "/admin" : "/portal", { replace: true });
    }
  }, [session, profile, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError(err.message);
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
          <button className="btn-gold auth-submit" type="submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="auth-alt">
          New here? <Link to="/signup">Create your free account</Link>
        </p>
      </div>
    </section>
  );
}
