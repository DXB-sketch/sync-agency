import { Nav } from "sync-agency";

// Nav is position:fixed at the top of the page — rendered solo so it doesn't
// escape a grid cell (cardMode: single in config).
export const SiteHeader = () => (
  <div style={{ position: "relative", minHeight: 120 }}>
    <Nav />
  </div>
);
