import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabase";

const AuthContext = createContext({ session: null, profile: null, loading: true, refreshProfile: () => {} });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
    setProfile(data ?? null);
    return data;
  }, []);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s) {
        await loadProfile(s.user.id);
        if (event === "SIGNED_IN") {
          supabase.from("profiles").update({ last_login: new Date().toISOString() }).eq("id", s.user.id).then(() => {});
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
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
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
