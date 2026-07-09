import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

// Anchors the tour to a portal nav tab by its href
const nav = (sub) => `.portal-nav a[href="/portal${sub ? `/${sub}` : ""}"]`;

// Each step: which page it lives on, what element it highlights, and the copy.
// Steps with `blurb` open a new tab section (used by the dashboard tutorial boxes).
export const STEPS = [
  {
    tab: "Dashboard",
    blurb: "Your home base — progress, today's focus and stats at a glance.",
    route: "/portal",
    target: nav(""),
    title: "This is the Dashboard",
    body: "Your home base. Every time you log in you land here to see where your store is at, at a glance.",
  },
  {
    tab: "Dashboard",
    route: "/portal",
    target: ".dash-grid",
    title: "Your snapshot",
    body: "These cards show your pathway progress, today's focus (the next step to work on), your stock orders and your achievements. Click any card to jump straight to that page.",
  },
  {
    tab: "Pathway",
    blurb: "The step-by-step guide to setting up and growing your store.",
    route: "/portal",
    target: nav("pathway"),
    title: "This is the Pathway",
    body: "It provides you with the guide to setting up your store effectively — a step-by-step skill tree that takes you from launching your store all the way to scaling it.",
  },
  {
    tab: "Pathway",
    route: "/portal/pathway",
    target: ".pathway-scroll",
    title: "How the Pathway works",
    body: "Each circle is one step. Click a node to open its instructions, then mark it complete to unlock the next one. Drag to pan around the tree. Work through it in order — “Today's focus” on your dashboard always points at your next step.",
  },
  {
    tab: "Products",
    blurb: "The stock in your store — order items here when you make a sale.",
    route: "/portal/pathway",
    target: nav("products"),
    title: "This is the Products tab",
    body: "These are the products the Sync team runs in your store. Whenever you make a sale on Depop, this is the first place you come.",
  },
  {
    tab: "Products",
    route: "/portal/products",
    target: ".product-grid",
    title: "Your product slots",
    body: "When a buyer purchases something from your Depop store, find that product here and press “Add to order” — we source it and ship it straight to your buyer. Higher tiers unlock more product slots.",
  },
  {
    tab: "Checkout",
    blurb: "Pay for the items you're shipping and track every order.",
    route: "/portal/products",
    target: nav("checkout"),
    title: "This is the Checkout",
    body: "After adding products to your order, come here to enter your buyers' shipping details, pay, and track everything that's already on its way.",
  },
  {
    tab: "Checkout",
    route: "/portal/checkout",
    target: '[data-tut="checkout-cart"]',
    title: "Paying for your items",
    body: "Each item ships to its own buyer — fill in the shipping address your customer gave you on Depop for every item, then pay for everything in one payment.",
  },
  {
    tab: "Checkout",
    route: "/portal/checkout",
    target: '[data-tut="order-tracking"]',
    title: "Order tracking",
    body: "Below the checkout is order tracking: every order you've paid for and exactly where it is — paid, sourcing, shipped or delivered — including tracking numbers once they ship.",
  },
  {
    tab: "Achievements",
    blurb: "Milestones for your store — earn them by submitting proof.",
    route: "/portal/checkout",
    target: nav("achievements"),
    title: "This is the Achievements tab",
    body: "Milestones for your store — first sale, first review and more.",
  },
  {
    tab: "Achievements",
    route: "/portal/achievements",
    target: ".ach-grid",
    title: "Earning achievements",
    body: "When you hit a milestone, submit proof (like a screenshot) and the Sync team verifies it. It's the easiest way to see how far you've come.",
  },
  {
    tab: "Support",
    blurb: "Stuck on anything? Open a ticket and the team will help.",
    route: "/portal/achievements",
    target: nav("support"),
    title: "This is Support",
    body: "Stuck on anything, or something not working the way you expect? This is where you reach the Sync team.",
  },
  {
    tab: "Support",
    route: "/portal/support",
    target: ".support-layout",
    title: "Using Support",
    body: "Open a ticket describing your problem and the team will reply here. All your past tickets and replies stay in one place.",
  },
  {
    tab: "Upgrade",
    blurb: "Compare tiers and unlock more product slots when you're ready.",
    route: "/portal/support",
    target: nav("upgrade"),
    title: "This is the Upgrade tab",
    body: "When you're ready to scale, this is where you level up your membership.",
  },
  {
    tab: "Upgrade",
    route: "/portal/upgrade",
    target: ".upgrade-grid",
    title: "Upgrading your tier",
    body: "Compare tiers and unlock more product slots and pathway phases. That's the tour! You can replay any part of it from the Tutorial section on your Dashboard.",
  },
];

// First step of each tab — powers the dashboard tutorial boxes
export const TAB_STEPS = STEPS.reduce((acc, s, i) => {
  if (s.blurb) acc.push({ tab: s.tab, index: i, blurb: s.blurb });
  return acc;
}, []);

const TutorialContext = createContext({ start: () => {}, active: false });
export const useTutorial = () => useContext(TutorialContext);

// Repeatedly measures the tour target so the popup tracks elements that render
// after data loads, and follows scrolling. Returns null while the element is absent.
function useAnchorRect(selector, activeKey) {
  const [rect, setRect] = useState(null);
  const scrolled = useRef(false);

  useEffect(() => {
    scrolled.current = false;
    setRect(null);
    if (!selector) return;
    function measure() {
      const el = document.querySelector(selector);
      // Zero-size = hidden (e.g. nav links behind the closed mobile menu)
      if (!el || (el.offsetWidth === 0 && el.offsetHeight === 0)) {
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

  return rect;
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

const setPortalNav = (open) =>
  window.dispatchEvent(new CustomEvent("sync:portal-nav", { detail: { open } }));

function TutorialPopover({ idx, onPrev, onNext, onClose }) {
  const step = STEPS[idx];
  const rect = useAnchorRect(step.target, idx);

  // Steps that point at a nav tab need the mobile hamburger menu open to
  // have something to highlight; close it again for in-page steps.
  useEffect(() => {
    setPortalNav(step.target.startsWith(".portal-nav"));
  }, [step]);
  useEffect(() => () => setPortalNav(false), []);

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
  const navigate = useNavigate();

  const start = useCallback(
    (i) => {
      if (i < 0 || i >= STEPS.length) {
        setIdx(null);
        return;
      }
      setIdx(i);
      navigate(STEPS[i].route);
    },
    [navigate]
  );

  return (
    <TutorialContext.Provider value={{ start, active: idx !== null }}>
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
