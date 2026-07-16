import { StaggerGrid } from "sync-agency";

const tile: React.CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  padding: 22,
};

// Children stagger-animate in as the grid enters the viewport.
export const ThreeUp = () => (
  <StaggerGrid className="">
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 720 }}>
      {["List", "Sell", "Ship"].map((step, i) => (
        <div key={step} style={tile}>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 30, color: "var(--gold)", fontWeight: 700 }}>
            {i + 1}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-md)", marginTop: 6 }}>{step}</div>
        </div>
      ))}
    </div>
  </StaggerGrid>
);
