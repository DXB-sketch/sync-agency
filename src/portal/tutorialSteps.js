import { createContext, useContext } from "react";

// Anchors a tour step to a navigation control. Both the desktop top strip and
// the mobile bottom tab bar (plus a few in-page buttons) carry data-nav
// attributes — the anchor hook picks whichever one is actually visible.
export const nav = (name) => `[data-nav="${name}"]`;

// Each step: which page it lives on, what element it highlights, and the copy.
// Steps with `blurb` open a new tab section (used by the dashboard tutorial card).
export const STEPS = [
  {
    tab: "Dashboard",
    blurb: "Your home base — progress, today's focus and stats at a glance.",
    route: "/portal",
    target: nav("dashboard"),
    title: "This is the Dashboard",
    body: "Your home base. Every time you log in you land here to see where your store is at, at a glance.",
  },
  {
    tab: "Dashboard",
    route: "/portal",
    target: ".dash-grid",
    title: "Your snapshot",
    body: "These cards show your pathway progress, today's focus (the next step to work on), your sales, stock orders and achievements. Click any card to jump straight to that page.",
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
    body: "Steps are grouped by stage — each large circle is a group, branching into its individual steps. Click a step to open its instructions, then mark it complete to unlock the next one. Use the Groups button to jump between stages.",
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
    body: "Every product shows the price to list it at and the price to discount it to on Depop — plus your profit per sale. When a buyer purchases something, find it here and press “Add to order” — we source it and ship it straight to your buyer.",
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
    route: "/portal/more",
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
    route: "/portal/more",
    target: nav("upgrade"),
    title: "This is the Upgrade tab",
    body: "When you're ready to scale, this is where you level up your membership.",
  },
  {
    tab: "Upgrade",
    route: "/portal/upgrade",
    target: ".upgrade-grid",
    title: "Upgrading your tier",
    body: "Compare tiers and unlock more product slots and pathway steps. That's the tour! You can replay any part of it from the Tutorial card on your Dashboard.",
  },
];

// First step of each tab — powers the dashboard tutorial card's step list
export const TAB_STEPS = STEPS.reduce((acc, s, i) => {
  if (s.blurb) acc.push({ tab: s.tab, index: i, blurb: s.blurb });
  return acc;
}, []);

export const TutorialContext = createContext({ start: () => {}, active: false, seen: 0 });
export const useTutorial = () => useContext(TutorialContext);
