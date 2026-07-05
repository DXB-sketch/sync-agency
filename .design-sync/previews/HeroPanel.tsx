import { HeroPanel } from "sync-agency";

// The animated "live profit model" terminal panel from the homepage hero.
// The rows stagger in with animation delays; show the settled final state.
export const ProfitModel = () => (
  <div style={{ maxWidth: 560 }}>
    <style>{`.panel-animate > * { animation: none !important; opacity: 1 !important; transform: none !important; }`}</style>
    <HeroPanel />
  </div>
);
