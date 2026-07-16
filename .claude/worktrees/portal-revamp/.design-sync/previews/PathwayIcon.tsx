import { PathwayIcon } from "sync-agency";

const cell: React.CSSProperties = { textAlign: "center" };
const cap: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-dim)",
  marginTop: 8,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

export const States = () => (
  <div style={{ display: "flex", gap: 32 }}>
    {(["complete", "in_progress", "available", "locked"] as const).map((state) => (
      <div key={state} style={cell}>
        <PathwayIcon name="storefront" state={state} size={56} />
        <div style={cap}>{state.replace("_", " ")}</div>
      </div>
    ))}
  </div>
);

export const Glyphs = () => (
  <div style={{ display: "flex", gap: 32 }}>
    {(["storefront", "sliders", "handshake"] as const).map((name) => (
      <div key={name} style={cell}>
        <PathwayIcon name={name} state="complete" size={56} />
        <div style={cap}>{name}</div>
      </div>
    ))}
  </div>
);
