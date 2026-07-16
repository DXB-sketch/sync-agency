// Hand-built inline SVG skill-tree icons in the brand gold palette. No emojis.
// states: complete (filled gold + glow + check) · in_progress (animated dashed ring)
//         available (muted stroke) · locked (desaturated, dashed, padlock)

const GOLD = "#C9A84C";
const GOLD_LT = "#E8C97A";
const MUTED = "#6A6258";
const LOCKED = "#3E3A33";

const GLYPHS = {
  storefront: (
    <>
      <path d="M10 20 L14 10 H34 L38 20" />
      <path d="M10 20 Q10 24 13.5 24 Q17 24 17 20 Q17 24 20.5 24 Q24 24 24 20 Q24 24 27.5 24 Q31 24 31 20 Q31 24 34.5 24 Q38 24 38 20" />
      <path d="M12 24 V38 H36 V24" />
      <rect x="19" y="28" width="10" height="10" />
    </>
  ),
  "profile-badge": (
    <>
      <rect x="10" y="8" width="28" height="32" rx="3" />
      <circle cx="24" cy="19" r="5" />
      <path d="M15 34 Q15 26 24 26 Q33 26 33 34" />
    </>
  ),
  "listing-card": (
    <>
      <rect x="11" y="7" width="26" height="34" rx="2" />
      <rect x="15" y="11" width="18" height="12" />
      <path d="M15 28 H33 M15 32 H33 M15 36 H26" />
    </>
  ),
  sliders: (
    <>
      <path d="M10 15 H38 M10 24 H38 M10 33 H38" />
      <circle cx="18" cy="15" r="3.5" fill="#080808" />
      <circle cx="31" cy="24" r="3.5" fill="#080808" />
      <circle cx="15" cy="33" r="3.5" fill="#080808" />
    </>
  ),
  "price-tag": (
    <>
      <path d="M25 8 H38 V21 L23 36 Q21 38 19 36 L10 27 Q8 25 10 23 Z" />
      <circle cx="32" cy="14" r="2.5" />
    </>
  ),
  "growth-arrow": (
    <>
      <path d="M9 37 L19 26 L25 31 L38 15" />
      <path d="M30 15 H38 V23" />
      <path d="M9 41 H39" />
    </>
  ),
  handshake: (
    <>
      <path d="M6 18 L14 14 L24 19 L32 14 L42 19" />
      <path d="M14 14 V29 L22 35 Q24 36.5 26 35 L34 29 V14" />
      <path d="M24 19 L18 25 M28 23 L24 27" />
    </>
  ),
  "check-seal": (
    <>
      <path d="M24 6 L28 10 L34 9 L35 15 L40 18 L37 24 L40 30 L35 33 L34 39 L28 38 L24 42 L20 38 L14 39 L13 33 L8 30 L11 24 L8 18 L13 15 L14 9 L20 10 Z" />
      <path d="M17 24 L22 29 L31 19" />
    </>
  ),
};

export default function PathwayIcon({ name, state = "available", size = 48 }) {
  const glyph = GLYPHS[name] ?? GLYPHS["check-seal"];

  const stroke =
    state === "complete" ? GOLD_LT : state === "in_progress" ? GOLD : state === "locked" ? LOCKED : MUTED;
  const fill =
    state === "complete" ? "rgba(201,168,76,0.22)" : state === "in_progress" ? "rgba(201,168,76,0.08)" : "none";

  return (
    <svg
      className={`pathway-icon pathway-icon-${state}`}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      {state === "complete" && (
        <circle cx="24" cy="24" r="23" fill="rgba(201,168,76,0.10)" stroke="none" />
      )}
      {state === "in_progress" && (
        <circle className="icon-progress-ring" cx="24" cy="24" r="22.5" stroke={GOLD} strokeWidth="1.2" strokeDasharray="5 4" fill="none" />
      )}
      <g
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={fill}
        strokeDasharray={state === "locked" ? "3 3" : undefined}
      >
        {glyph}
      </g>
      {state === "complete" && (
        <g stroke="#080808" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="37" cy="37" r="8" fill={GOLD} stroke="none" />
          <path d="M33.5 37 L36 39.5 L40.5 34.5" fill="none" />
        </g>
      )}
      {state === "locked" && (
        <g stroke={LOCKED} strokeWidth="1.6" fill="#080808">
          <rect x="31" y="33" width="12" height="9" rx="1.5" />
          <path d="M33.5 33 V30.5 Q33.5 27 37 27 Q40.5 27 40.5 30.5 V33" fill="none" />
        </g>
      )}
    </svg>
  );
}
