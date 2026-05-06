import { useEffect, useState, useRef } from "react";
import { SOCIAL_PROOF } from "../data/social-proof";
import { trackEvent } from "../utils/analytics";

const INITIAL_DELAY_MS = 10000;
const VISIBLE_MS = 5000;
const HIDDEN_MS = 8000;
const SHOWN_FLAG = "socialProofShown";

function isMobile() {
  return typeof window !== "undefined" && (window.matchMedia("(max-width: 768px)").matches || "ontouchstart" in window);
}

function pickNext(prevIdx) {
  if (SOCIAL_PROOF.length <= 1) return 0;
  let i;
  do { i = Math.floor(Math.random() * SOCIAL_PROOF.length); } while (i === prevIdx);
  return i;
}

export default function SocialProofTicker() {
  const [current, setCurrent] = useState(null);
  const [visible, setVisible] = useState(false);
  const lastIdx = useRef(-1);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isMobile()) return;

    let visibleTimer = null;
    let hiddenTimer = null;
    let cancelled = false;

    const showNext = () => {
      if (cancelled) return;
      const idx = pickNext(lastIdx.current);
      lastIdx.current = idx;
      setCurrent(SOCIAL_PROOF[idx]);
      setVisible(true);
      if (!trackedRef.current) {
        trackedRef.current = true;
        try {
          if (!sessionStorage.getItem(SHOWN_FLAG)) {
            sessionStorage.setItem(SHOWN_FLAG, "1");
            trackEvent("social_proof_shown");
          }
        } catch { /* noop */ }
      }
      visibleTimer = setTimeout(() => {
        setVisible(false);
        hiddenTimer = setTimeout(showNext, HIDDEN_MS);
      }, VISIBLE_MS);
    };

    const startTimer = setTimeout(showNext, INITIAL_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(startTimer);
      if (visibleTimer) clearTimeout(visibleTimer);
      if (hiddenTimer) clearTimeout(hiddenTimer);
    };
  }, []);

  if (!current) return null;
  return (
    <div className={`social-proof${visible ? " visible" : ""}`} aria-live="polite">
      <div className="social-proof-icon">✦</div>
      <div className="social-proof-text">
        <div className="social-proof-name">{current.name} from {current.city}</div>
        <div className="social-proof-meta">just enrolled — <em>{current.tier}</em></div>
      </div>
    </div>
  );
}
