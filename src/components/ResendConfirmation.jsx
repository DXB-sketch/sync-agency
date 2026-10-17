import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const COOLDOWN_S = 60;

// "Didn't get it? Resend" for the signup confirmation email, with a cooldown
// so members can't trip Supabase's email rate limit by hammering the button.
export default function ResendConfirmation({ email, initialWait = COOLDOWN_S }) {
  const [wait, setWait] = useState(initialWait);
  const [status, setStatus] = useState(null); // "sending" | "sent" | error message

  useEffect(() => {
    if (wait <= 0) return undefined;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function resend() {
    setStatus("sending");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` },
    });
    if (error) {
      setStatus(
        error.status === 429
          ? "Too many emails sent — please wait a few minutes before trying again."
          : error.message
      );
    } else {
      setStatus("sent");
    }
    setWait(COOLDOWN_S);
  }

  return (
    <p className="auth-alt">
      Didn't get it? Check your spam or junk folder (Outlook and Hotmail often file it there),
      then{" "}
      <button
        type="button"
        className="auth-link-btn"
        disabled={wait > 0 || status === "sending"}
        onClick={resend}
      >
        {status === "sending" ? "sending…" : wait > 0 ? `resend in ${wait}s` : "resend the email"}
      </button>
      .
      {status === "sent" && <span className="auth-resend-note"> Sent — check your inbox.</span>}
      {status && status !== "sent" && status !== "sending" && (
        <span className="auth-error auth-resend-note"> {status}</span>
      )}
    </p>
  );
}
