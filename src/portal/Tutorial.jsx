import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { nav, STEPS, TutorialContext, useTutorial } from "./tutorialSteps";

// Device-local tutorial progress: how many steps have been seen so far.
const SEEN_KEY = "sync_tutorial_seen";
const loadSeen = () => {
  const n = Number(localStorage.getItem(SEEN_KEY));
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), STEPS.length) : 0;
};

// Repeatedly measures the tour target so the popup tracks elements that render
// after data loads, and follows scrolling. Returns null while the element is absent.
// When several elements match (desktop nav + bottom tab bar), uses the visible one.
function useAnchorRect(selector, activeKey) {
  const [rect, setRect] = useState(null);
  const scrolled = useRef(false);

  // Layout effect so a new target is measured before paint (no stale-rect flash)
  useLayoutEffect(() => {
    scrolled.current = false;
    if (!selector) return;
    function measure() {
      // Zero-size = hidden (e.g. the desktop nav strip on mobile)
      const el = [...document.querySelectorAll(selector)].find(
        (e) => e.offsetWidth > 0 || e.offsetHeight > 0
      );
      if (!el) {
        setRect(null);
        return;
      }
      if (!scrolled.current) {
        el.scrollIntoView({ block: "nearest" });
        scrolled.current = true;
      }
      const r = el.getBoundingClientRect();
      setRect((prev) =>
        prev &&
        prev.top === r.top &&
        prev.left === r.left &&
        prev.width === r.width &&
        prev.height === r.height
          ? prev
          : { top: r.top, left: r.left, width: r.width, height: r.height }
      );
    }
    measure();
    const timer = setInterval(measure, 250);
    return () => clearInterval(timer);
  }, [selector, activeKey]);

  return selector ? rect : null;
}

// Positions a popup next to the highlighted rect (below it when there's room,
// otherwise above), clamped to the viewport. Centered when there's no anchor.
function popStyle(rect) {
  if (!rect) {
    return { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(340, vw - 24);
  const left = Math.min(Math.max(rect.left, 12), vw - width - 12);
  const below = rect.top + rect.height + 12;
  if (below + 220 <= vh) return { top: below, left };
  return { top: Math.max(rect.top - 12, 12), left, transform: "translateY(-100%)" };
}

const PAD = 6;
function highlightStyle(rect) {
  return {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  };
}

function TutorialPopover({ idx, onPrev, onNext, onClose }) {
  const step = STEPS[idx];
  const rect = useAnchorRect(step.target, idx);

  return (
    <>
      {rect ? (
        <div className="tut-highlight" style={highlightStyle(rect)} />
      ) : (
        <div className="tut-dim" />
      )}
      <div className="tut-pop" style={popStyle(rect)}>
        <span className="tut-pop-tab">Tutorial · {step.tab}</span>
        <h3 className="tut-pop-title">{step.title}</h3>
        <p className="tut-pop-body">{step.body}</p>
        <div className="tut-pop-foot">
          <span className="tut-pop-count">
            {idx + 1} / {STEPS.length}
          </span>
          <div className="tut-pop-btns">
            <button className="btn-ghost tut-pop-btn" onClick={onClose}>
              Skip
            </button>
            {idx > 0 && (
              <button className="btn-ghost tut-pop-btn" onClick={onPrev}>
                Previous
              </button>
            )}
            <button className="btn-gold tut-pop-btn" onClick={onNext}>
              {idx === STEPS.length - 1 ? "Finish" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function TutorialProvider({ children }) {
  const [idx, setIdx] = useState(null);
  const [seen, setSeen] = useState(loadSeen);
  const navigate = useNavigate();

  const start = useCallback(
    (i) => {
      if (i < 0 || i >= STEPS.length) {
        setIdx(null);
        return;
      }
      setIdx(i);
      // Remember the furthest step viewed so the dashboard card can resume there
      setSeen((prev) => Math.max(prev, i + 1));
      navigate(STEPS[i].route);
    },
    [navigate]
  );

  useEffect(() => {
    localStorage.setItem(SEEN_KEY, String(seen));
  }, [seen]);

  return (
    <TutorialContext.Provider value={{ start, active: idx !== null, seen }}>
      {children}
      {idx !== null && (
        <TutorialPopover
          idx={idx}
          onPrev={() => start(idx - 1)}
          onNext={() => (idx === STEPS.length - 1 ? setIdx(null) : start(idx + 1))}
          onClose={() => setIdx(null)}
        />
      )}
    </TutorialContext.Provider>
  );
}

// ── Sale nudges ──────────────────────────────────────────────────────────────
// Every login: a popup on the Products tab reminding members to order stock
// when they make a sale. If they then add a product to their order, a follow-up
// points them at Checkout to enter the buyer's shipping info.

const NUDGES = {
  sale: {
    target: nav("products"),
    to: "/portal/products",
    cta: "Go to Products",
    title: "Got a sale on Depop?",
    body: "Order the item your buyer purchased from the Products tab — we ship it straight to them.",
  },
  checkout: {
    target: nav("checkout"),
    to: "/portal/checkout",
    cta: "Go to Checkout",
    title: "Added to your order ✓",
    body: "Now go to Checkout, enter your customer's shipping info and order the item.",
  },
};

export function SaleNudges() {
  const { active: tutorialActive } = useTutorial();
  const [nudge, setNudge] = useState(null);
  const saleNudged = useRef(false);
  const navigate = useNavigate();

  useEffect(() => {
    saleNudged.current = true;
    const t = setTimeout(() => setNudge("sale"), 1500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function onAdd() {
      if (saleNudged.current) {
        saleNudged.current = false;
        setNudge("checkout");
      }
    }
    window.addEventListener("sync:cart-add", onAdd);
    return () => window.removeEventListener("sync:cart-add", onAdd);
  }, []);

  const conf = nudge ? NUDGES[nudge] : null;
  const rect = useAnchorRect(conf?.target ?? "", nudge);
  if (tutorialActive || !conf) return null;

  return (
    <>
      {rect && <div className="nudge-ring" style={highlightStyle(rect)} />}
      <div className="tut-pop" style={popStyle(rect)}>
        <button className="tut-pop-close" aria-label="Dismiss" onClick={() => setNudge(null)}>
          ×
        </button>
        <h3 className="tut-pop-title">{conf.title}</h3>
        <p className="tut-pop-body">{conf.body}</p>
        <div className="tut-pop-foot">
          <span />
          <div className="tut-pop-btns">
            <button className="btn-ghost tut-pop-btn" onClick={() => setNudge(null)}>
              Dismiss
            </button>
            <button
              className="btn-gold tut-pop-btn"
              onClick={() => {
                setNudge(null);
                navigate(conf.to);
              }}
            >
              {conf.cta}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
