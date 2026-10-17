import { createContext, useContext } from "react";

// Kept apart from ChronosModeContext.jsx so that file only exports a component
// (react-refresh/only-export-components).
export const ChronosModeContext = createContext({ chronosMode: false, setChronosMode: () => {} });

export function useChronosMode() {
  return useContext(ChronosModeContext);
}
