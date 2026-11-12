import { createContext, useContext } from "react";

// First-run tutorials (sync-update/3-tutorials/SPEC.md). Each step spotlights one
// real element, found by its data-tut attribute, and moves on only when that
// element is tapped. `t` is the target for phones (and the native app) and `d`
// for desktop when they differ. Card copy says "Tap" on phones, "Click" on desktop.

export const PORTAL_STEPS = [
  null, // 0 is the start card
  { part: 1, t: "focus", icon: "target", big: "Start here every day.", small: "Today's focus is your next step. Tap it." },
  {
    part: 2,
    t: "next-step",
    icon: "pathway",
    big: "This is your Pathway. Tap your next step.",
    small: "Find it any time in More.",
    smallDesk: "Each one tells you what to do.",
  },
  { part: 2, t: "mark-complete", icon: "check", big: "Done it? Tap Mark complete.", small: "The next step unlocks." },
  { part: 3, t: "nav-products", icon: "products", big: "Made a sale? Tap Products.", small: "Your stock lives here." },
  { part: 3, t: "add-first", icon: "products", big: "Find what sold. Tap Add to order.", small: "We source it for you." },
  { part: 4, t: "cart-bar", d: "nav-checkout", icon: "checkout", big: "Now tap Checkout.", small: "Pay for what you sold." },
  { part: 4, t: "tour-pay", icon: "card", big: "Add your buyer's address. Tap Pay.", small: "We ship it straight to them." },
  {
    part: 5,
    t: "nav-more",
    d: "nav-support",
    icon: "help",
    big: "Stuck? Tap More.",
    bigDesk: "Stuck? Click Support.",
    small: "Support and your Pathway live here.",
    smallDesk: "The Sync team replies there.",
  },
];

export const REWARDS_STEPS = [
  null,
  { part: 1, t: "xp-bar", icon: "bolt", big: "This bar is your XP.", small: "Tap it. Fill it up to level up." },
  { part: 2, t: "topup", icon: "wallet", big: "Tap here to top up.", small: "Every $1 of credit = 10 XP." },
  { part: 3, t: "pack-50000", icon: "tag", big: "Tap the $500 pack.", small: "See what it would do. Nothing is charged." },
  { part: 4, t: "tour-crate", icon: "box", big: "You got a crate! Tap it.", small: "Every level gives you one." },
  { part: 5, t: "tour-collect", icon: "coin", big: "Tap Got it.", small: "You earn real crates as you level up." },
];

export const TOURS = { portal: PORTAL_STEPS, rewards: REWARDS_STEPS };

// Desktop wording: "Tap" becomes "Click"
export function deskCopy(text) {
  return text.replace(/\bTap\b/g, "Click").replace(/\btap\b/g, "click");
}

export const TutorialContext = createContext({
  start: () => {},
  active: false,
  kind: null,
  step: null,
  sim: {},
});
export const useTutorial = () => useContext(TutorialContext);
