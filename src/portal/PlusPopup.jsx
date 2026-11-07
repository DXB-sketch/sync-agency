import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { isNativeApp } from "../lib/nativeApp";
import { PLUS, isPlus, canGetPlus, usePlusPrice } from "../lib/plus";
import { useTutorial } from "./tutorialSteps";

const SHOWN_KEY = "sync:plus-popup-last";
const EVERY_MS = 3 * 24 * 60 * 60 * 1000;

function due() {
  try {
    return Date.now() - Number(localStorage.getItem(SHOWN_KEY) ?? 0) >= EVERY_MS;
  } catch {
    return true;
  }
}

function markShown() {
  try {
    localStorage.setItem(SHOWN_KEY, String(Date.now()));
  } catch {
    // Storage unavailable — the popup just shows again next visit.
  }
}

// Sync Plus invitation for course members who haven't joined, at most once every 3 days.
// Separate from the admin-managed wallet promo popup; waits its turn if that one is open.
export default function PlusPopup() {
  const { profile } = useAuth();
  const { active: tutorialActive } = useTutorial();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const price = usePlusPrice();
  const eligible = canGetPlus(profile) && !isPlus(profile) && !isNativeApp();

  useEffect(() => {
    if (!eligible || !due()) return;
    const t = setTimeout(() => {
      if (window.location.pathname === "/portal/plus") return;
      if (document.querySelector(".admin-modal-overlay")) return;
      markShown();
      setOpen(true);
    }, 10000);
    return () => clearTimeout(t);
  }, [eligible]);

  if (!open || tutorialActive) return null;

  return (
    <div className="admin-modal-overlay" onClick={() => setOpen(false)}>
      <div
        className="admin-modal wallet-promo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="plus-popup-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="tut-pop-close" aria-label="Dismiss" onClick={() => setOpen(false)}>
          ×
        </button>
        <h2 id="plus-popup-title" className="dash-card-title">
          Get 10% off everything with {PLUS.name}
        </h2>
        <p className="tut-pop-body">
          10% off every stock order and course upgrade with no spending limit, an extra product slot, and a
          monthly draw for ${PLUS.drawAmount} of wallet credit. {price ? `$${price}/month, c` : "C"}ancel any time.
        </p>
        <div className="tut-pop-btns">
          <button className="btn-ghost" onClick={() => setOpen(false)}>
            Not now
          </button>
          <button
            className="btn-gold"
            onClick={() => {
              setOpen(false);
              navigate("/portal/plus");
            }}
          >
            See {PLUS.name}
          </button>
        </div>
      </div>
    </div>
  );
}
