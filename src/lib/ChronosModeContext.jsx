import { createContext, useContext, useEffect, useState } from "react";

// Per-admin, per-device UX toggle for Project Chronos admin sections (CJ supplier tooling,
// exception queue, margin alerts, Connect Store/Product Linking, supplier-linker modal).
// This is visibility only — every underlying route still requires RequireAdmin, and every
// Chronos edge function/RLS policy keeps its own admin/service-role gating regardless of this
// flag. The wallet is NOT part of Chronos mode — it's a live member feature, gated by normal
// member auth only (see src/lib/walletFlag.js).
const STORAGE_KEY = "sync_chronos_mode";

const ChronosModeContext = createContext({ chronosMode: false, setChronosMode: () => {} });

export function ChronosModeProvider({ children }) {
  const [chronosMode, setChronosModeState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, chronosMode ? "1" : "0");
    } catch {
      // localStorage unavailable — toggle just won't persist across refresh
    }
  }, [chronosMode]);

  function setChronosMode(next) {
    setChronosModeState(next);
  }

  return (
    <ChronosModeContext.Provider value={{ chronosMode, setChronosMode }}>
      {children}
    </ChronosModeContext.Provider>
  );
}

export function useChronosMode() {
  return useContext(ChronosModeContext);
}
