import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/useAuth";
import { walletEnabled } from "../lib/walletFlag";
import { fetchLivePromo, rewardText, requirementText } from "../lib/walletPromo";
import { useTutorial } from "./tutorialSteps";

const MAX_PER_DAY = 2;
const MIN_GAP_MS = 6 * 60 * 60 * 1000;

function shownKey(promoId) {
  return `sync:promo-shown:${promoId}`;
}

function readShown(promoId) {
  try {
    return JSON.parse(localStorage.getItem(shownKey(promoId)) ?? "[]");
  } catch {
    return [];
  }
}

// Up to MAX_PER_DAY times a calendar day, at least MIN_GAP_MS apart, per promo.
function dueToShow(promoId) {
  const shown = readShown(promoId);
  const today = new Date().toDateString();
  const todayCount = shown.filter((t) => new Date(t).toDateString() === today).length;
  const last = shown.length ? Math.max(...shown) : 0;
  return todayCount < MAX_PER_DAY && Date.now() - last >= MIN_GAP_MS;
}

function markShown(promoId) {
  const recent = readShown(promoId).filter((t) => Date.now() - t < 2 * 24 * 60 * 60 * 1000);
  try {
    localStorage.setItem(shownKey(promoId), JSON.stringify([...recent, Date.now()]));
  } catch {
    // Storage unavailable — the popup just shows again next visit.
  }
}

// Admin-managed wallet top-up promo (wallet_promos), shown as a modal in the member portal.
export default function WalletPromoPopup() {
  const { profile } = useAuth();
  const { active: tutorialActive } = useTutorial();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [promo, setPromo] = useState(null);
  const enabled = walletEnabled(profile);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const live = await fetchLivePromo();
      if (cancelled || !live || !dueToShow(live.id)) return;
      if (window.location.pathname === "/portal/wallet") return;
      markShown(live.id);
      setPromo(live);
    }, 4000);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [enabled]);

  if (!promo || tutorialActive || pathname === "/portal/wallet") return null;

  return (
    <div className="admin-modal-overlay" onClick={() => setPromo(null)}>
      <div
        className="admin-modal wallet-promo-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-promo-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="tut-pop-close" aria-label="Dismiss" onClick={() => setPromo(null)}>
          ×
        </button>
        <h2 id="wallet-promo-title" className="dash-card-title">
          {promo.title}
        </h2>
        <p className="tut-pop-body">{promo.body}</p>
        <p className="wallet-promo-terms">
          {requirementText(promo)} to get {rewardText(promo)}.
        </p>
        <div className="tut-pop-btns">
          <button className="btn-ghost" onClick={() => setPromo(null)}>
            Not now
          </button>
          <button
            className="btn-gold"
            onClick={() => {
              setPromo(null);
              navigate(`/portal/wallet?amount=${promo.min_topup_cents / 100}`);
            }}
          >
            {promo.cta_label}
          </button>
        </div>
      </div>
    </div>
  );
}
