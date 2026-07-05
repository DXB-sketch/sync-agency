import { FadeUp } from "sync-agency";

// Scroll-reveal wrapper — in view at capture time, so it renders revealed.
export const RevealedContent = () => (
  <FadeUp>
    <div className="ds-card" style={{ maxWidth: 420, padding: 28 }}>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
        Fade-up reveal
      </h3>
      <p style={{ color: "var(--text-md)", fontSize: 14 }}>
        Any content wrapped in FadeUp slides up and fades in when it scrolls into view.
      </p>
    </div>
  </FadeUp>
);
