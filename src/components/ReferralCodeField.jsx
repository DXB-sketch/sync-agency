import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { getAffiliate } from "../utils/affiliate.js";

// Creator code at checkout. A code remembered from a referral link is applied automatically;
// typing a code replaces it. Reports { code, typed } (or null) through onChange. The price
// shown is a preview only: checkout re-checks the code and prices the discount server-side.
export default function ReferralCodeField({ onChange, removeLabel = "Remove", appliedNote }) {
  const [applied, setApplied] = useState(null);
  const [input, setInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const linkCode = getAffiliate();
    if (!linkCode) return;
    let cancelled = false;
    supabase.rpc("referral_code_active", { p_code: linkCode }).then(({ data }) => {
      if (cancelled || !data) return;
      setApplied({ code: data, typed: false });
      onChange({ code: data, typed: false });
    });
    return () => {
      cancelled = true;
    };
    // Runs once: the remembered link code is read on open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function apply(e) {
    e.preventDefault();
    const code = input.trim();
    if (!code) return;
    setError(null);
    setChecking(true);
    const { data } = await supabase.rpc("referral_code_active", { p_code: code });
    setChecking(false);
    if (!data) {
      setError("That code isn't valid.");
      return;
    }
    setApplied({ code: data, typed: true });
    setInput("");
    onChange({ code: data, typed: true });
  }

  function remove() {
    setApplied(null);
    onChange(null);
  }

  if (applied) {
    return (
      <div className="referral-code">
        <p className="referral-code-applied">
          Code <strong>{applied.code}</strong> applied{appliedNote ? ` · ${appliedNote}` : ""}
        </p>
        <button type="button" className="referral-code-remove" onClick={remove}>
          {removeLabel}
        </button>
      </div>
    );
  }

  return (
    <form className="referral-code" onSubmit={apply}>
      <label className="referral-code-label" htmlFor="referral-code-input">
        Creator code (optional)
      </label>
      <div className="referral-code-row">
        <input
          id="referral-code-input"
          className="referral-code-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          maxLength={20}
        />
        <button type="submit" className="referral-code-apply" disabled={checking || !input.trim()}>
          {checking ? "Checking…" : "Apply"}
        </button>
      </div>
      {error && (
        <p className="referral-code-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
