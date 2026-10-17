import { createContext, useContext } from "react";

// Kept apart from AuthContext.jsx so that file only exports a component
// (react-refresh/only-export-components).
export const AuthContext = createContext({
  session: null,
  profile: null,
  profileError: false,
  loading: true,
  refreshProfile: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
