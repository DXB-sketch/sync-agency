import { useEffect, useState, useCallback } from "react";
import { AuthContext } from "./useAuth";
import { supabase } from "./supabase";

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileError, setProfileError] = useState(false); // signed in but no profile could be loaded
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .abortSignal(AbortSignal.timeout(15000))
      .maybeSingle();
    setProfile(data ?? null);
    setProfileError(!data);
    return data;
  }, []);

  useEffect(() => {
    let mounted = true;

    // onAuthStateChange also fires INITIAL_SESSION on subscribe, so it covers the
    // first load. supabase-js holds its auth lock while this callback runs, and
    // awaiting another Supabase call inside it can deadlock (members stuck on the
    // loading spinner) — so the profile fetch is deferred until after it returns.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mounted) return;
      setSession(s);
      if (!s) {
        setProfile(null);
        setProfileError(false);
        setLoading(false);
        return;
      }
      if (event === "TOKEN_REFRESHED") return; // same user, profile unchanged
      setTimeout(async () => {
        if (!mounted) return;
        await loadProfile(s.user.id);
        if (!mounted) return;
        setLoading(false);
        if (event === "SIGNED_IN") {
          supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", s.user.id).then(() => {});
        }
      }, 0);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const refreshProfile = useCallback(() => {
    if (session) return loadProfile(session.user.id);
  }, [session, loadProfile]);

  return (
    <AuthContext.Provider value={{ session, profile, profileError, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
