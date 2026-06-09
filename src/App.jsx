import { useState, useEffect, useRef, useCallback } from "react";
import { TIERS } from "./data/pricing.js";
import CheckoutDrawer from "./components/CheckoutDrawer.jsx";
import CheckoutSuccessNotification from "./components/CheckoutSuccessNotification.jsx";

function trackEvent(name, props) {
  if (typeof window.trackEvent === "function") window.trackEvent(name, props);
}

// ─── Fonts injected once ───────────────────────────────────────────────────
const FONT_LINK = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&family=Syne:wght@400;500;600;700;800&display=swap";

// ─── useInView hook ────────────────────────────────────────────────────────
function useInView(threshold = 0.15, once = true) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setVisible(true); if (once) obs.disconnect(); }
    }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, once]);
  return [ref, visible];
}

// ─── useCountUp hook ──────────────────────────────────────────────────────
function useCountUp(target, duration = 1800, active = false) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const prog = Math.min((ts - start) / duration, 1);
      const ease = 1 - Math.pow(1 - prog, 3);
      setVal(Math.floor(ease * target));
      if (prog < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, duration]);
  return val;
}

// ─── STYLES ───────────────────────────────────────────────────────────────
const css = `
  @import url('${FONT_LINK}');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --gold: #C9A84C;
    --gold-lt: #E8C97A;
    --gold-dk: #8A6820;
    --gold-glow: rgba(201,168,76,0.18);
    --gold-subtle: rgba(201,168,76,0.08);
    --black: #080808;
    --ink: #0F0F0F;
    --card: #121212;
    --card2: #1A1A1A;
    --card3: #222222;
    --text: #F0EDE6;
    --text-md: #B8B0A0;
    --text-dim: #6A6258;
    --border: rgba(201,168,76,0.12);
    --border-md: rgba(201,168,76,0.25);
    --font-display: 'Cormorant Garamond', Georgia, serif;
    --font-body: 'Syne', sans-serif;
  }
  html { scroll-behavior: smooth; }
  body { background: var(--black); color: var(--text); font-family: var(--font-body); font-size: 15px; line-height: 1.65; overflow-x: hidden; cursor: none; }
  ::selection { background: var(--gold); color: var(--black); }
  a { text-decoration: none; color: inherit; }

  /* Custom cursor */
  .cursor { position: fixed; pointer-events: none; z-index: 9999; mix-blend-mode: difference; }
  .cursor-dot { width: 8px; height: 8px; background: var(--gold); border-radius: 50%; transform: translate(-50%,-50%); transition: width .2s, height .2s; }
  .cursor-ring { width: 36px; height: 36px; border: 1px solid var(--gold); border-radius: 50%; transform: translate(-50%,-50%); transition: width .25s, height .25s, opacity .25s; opacity: 0.5; }
  .cursor-ring.hovered { width: 56px; height: 56px; opacity: 0.9; }

  /* Noise overlay */
  .noise { position: fixed; inset: 0; pointer-events: none; z-index: 1; opacity: 0.025;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E");
  }

  /* ── NAV ── */
  .nav { position: fixed; top: 0; left: 0; right: 0; z-index: 500; padding: 0 60px; height: 72px; display: flex; align-items: center; justify-content: space-between; transition: background .4s, border-color .4s; }
  .nav.scrolled { background: rgba(8,8,8,0.92); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
  .nav-logo { font-family: var(--font-display); font-size: 26px; font-weight: 700; color: var(--gold); letter-spacing: 0.06em; }
  .nav-links { display: flex; gap: 36px; align-items: center; }
  .nav-links a { font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-md); transition: color .2s; font-weight: 500; }
  .nav-links a:hover { color: var(--gold); }
  .nav-btn { background: var(--gold); color: var(--black); padding: 10px 28px; border-radius: 2px; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; transition: background .2s, transform .15s; border: none; cursor: none; }
  .nav-btn:hover { background: var(--gold-lt); transform: translateY(-1px); }

  /* ── HERO ── */
  .hero { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: 120px 80px 80px; position: relative; overflow: hidden; }
  .hero-grid { display: grid; grid-template-columns: 1fr 420px; gap: 80px; align-items: center; max-width: 1300px; margin: 0 auto; width: 100%; }
  .hero-eyebrow { display: flex; align-items: center; gap: 12px; margin-bottom: 32px; }
  .hero-eyebrow-line { width: 40px; height: 1px; background: var(--gold); }
  .hero-eyebrow-text { font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); font-weight: 600; }
  .hero-h1 { font-family: var(--font-display); font-size: clamp(58px, 5.5vw, 88px); line-height: 1.0; font-weight: 700; margin-bottom: 32px; }
  .hero-h1 em { font-style: italic; color: var(--gold); }
  .hero-sub { font-size: 17px; color: var(--text-md); line-height: 1.75; max-width: 520px; margin-bottom: 52px; font-weight: 400; }
  .hero-actions { display: flex; gap: 16px; align-items: center; margin-bottom: 64px; }
  .btn-gold { background: var(--gold); color: var(--black); padding: 16px 44px; border-radius: 2px; font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; transition: all .2s; display: inline-flex; align-items: center; gap: 10px; border: none; cursor: none; }
  .btn-gold:hover { background: var(--gold-lt); transform: translateY(-2px); box-shadow: 0 12px 40px rgba(201,168,76,0.25); }
  .btn-ghost { border: 1px solid var(--border-md); color: var(--gold); padding: 15px 36px; border-radius: 2px; font-size: 13px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; transition: all .2s; cursor: none; display: inline-block; }
  .btn-ghost:hover { background: var(--gold-subtle); border-color: var(--gold); }
  .hero-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 1px solid var(--border); border-radius: 2px; overflow: hidden; }
  .hero-stat { padding: 28px 24px; border-right: 1px solid var(--border); text-align: center; }
  .hero-stat:last-child { border-right: none; }
  .hero-stat-num { font-family: var(--font-display); font-size: 44px; color: var(--gold); line-height: 1; font-weight: 700; }
  .hero-stat-suf { font-size: 22px; }
  .hero-stat-label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim); margin-top: 6px; }

  /* Hero right panel */
  .hero-panel { background: var(--card); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; }
  .hero-panel-header { padding: 20px 24px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 8px; }
  .panel-dot { width: 10px; height: 10px; border-radius: 50%; }
  .hero-panel-body { padding: 24px; }
  .flow-row { display: flex; flex-direction: column; gap: 0; }
  .flow-node { background: var(--card2); border: 1px solid rgba(255,255,255,0.05); border-radius: 4px; padding: 14px 18px; position: relative; }
  .flow-node.accent { border-color: var(--border-md); background: var(--gold-subtle); }
  .flow-node-tag { font-size: 10px; letter-spacing: 0.15em; color: var(--gold); text-transform: uppercase; margin-bottom: 2px; font-weight: 600; }
  .flow-node-title { font-size: 14px; font-weight: 600; color: var(--text); }
  .flow-node-sub { font-size: 12px; color: var(--text-dim); margin-top: 2px; }
  .flow-connector { display: flex; align-items: center; padding: 6px 18px; gap: 10px; }
  .flow-conn-line { flex: 1; height: 1px; background: linear-gradient(to right, var(--border-md), transparent); }
  .flow-conn-label { font-size: 11px; color: var(--text-dim); white-space: nowrap; }
  .flow-profit { display: flex; justify-content: space-between; align-items: center; background: rgba(201,168,76,0.07); border: 1px solid var(--border-md); border-radius: 4px; padding: 16px 20px; margin-top: 14px; }
  .flow-profit-label { font-size: 12px; color: var(--text-md); }
  .flow-profit-num { font-family: var(--font-display); font-size: 34px; color: var(--gold); font-weight: 700; }

  /* Hero BG elements */
  .hero-bg-orb { position: absolute; border-radius: 50%; pointer-events: none; }
  .orb1 { width: 600px; height: 600px; background: radial-gradient(circle, rgba(201,168,76,0.06) 0%, transparent 70%); top: -100px; right: 200px; }
  .orb2 { width: 400px; height: 400px; background: radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%); bottom: 0; left: 0; }
  .hero-line { position: absolute; top: 0; bottom: 0; width: 1px; background: linear-gradient(to bottom, transparent, var(--border), transparent); }
  .hero-line1 { left: 33.3%; }
  .hero-line2 { left: 66.6%; }

  /* ── MARQUEE ── */
  .marquee-wrap { border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); padding: 18px 0; overflow: hidden; position: relative; background: var(--ink); }
  .marquee-track { display: flex; width: max-content; animation: marquee 22s linear infinite; }
  .marquee-track:hover { animation-play-state: paused; }
  .marquee-item { display: flex; align-items: center; gap: 20px; padding: 0 32px; font-size: 12px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-dim); white-space: nowrap; font-weight: 500; }
  .marquee-dot { width: 4px; height: 4px; background: var(--gold); border-radius: 50%; flex-shrink: 0; }
  @keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }

  /* ── SECTION SHARED ── */
  .section { padding: 120px 80px; }
  .section-inner { max-width: 1300px; margin: 0 auto; width: 100%; }
  .section-header { margin-bottom: 72px; }
  .eyebrow { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
  .eyebrow-line { width: 32px; height: 1px; background: var(--gold); }
  .eyebrow-text { font-size: 11px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); font-weight: 600; }
  .section-title { font-family: var(--font-display); font-size: clamp(40px, 4vw, 64px); line-height: 1.05; font-weight: 700; }
  .section-title em { font-style: italic; color: var(--gold); }
  .section-sub { font-size: 17px; color: var(--text-md); line-height: 1.75; max-width: 560px; margin-top: 16px; }

  /* ── WHAT IS DROPSHIPPING ── */
  .ds-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
  .ds-left .section-sub { max-width: 100%; }
  .ds-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 32px; }
  .ds-card { background: var(--card); border: 1px solid var(--border); border-radius: 4px; padding: 24px 22px; transition: border-color .3s, transform .3s; }
  .ds-card:hover { border-color: var(--border-md); transform: translateY(-3px); }
  .ds-card-icon { font-size: 22px; margin-bottom: 14px; }
  .ds-card h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; }
  .ds-card p { font-size: 13px; color: var(--text-md); line-height: 1.7; }
  .ds-right { position: sticky; top: 100px; }
  .ds-steps { display: flex; flex-direction: column; }
  .ds-step { display: flex; gap: 24px; padding: 28px 0; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: default; transition: all .2s; }
  .ds-step:last-child { border-bottom: none; }
  .ds-step:hover .ds-step-num { color: var(--gold); }
  .ds-step-num { font-family: var(--font-display); font-size: 48px; color: var(--border-md); font-weight: 700; line-height: 1; flex-shrink: 0; width: 56px; transition: color .3s; }
  .ds-step-content h3 { font-size: 16px; font-weight: 600; margin-bottom: 6px; color: var(--text); }
  .ds-step-content p { font-size: 14px; color: var(--text-md); line-height: 1.7; }

  /* ── ABOUT ── */
  .about-section { background: var(--ink); }
  .about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 100px; align-items: center; }
  .about-quote { font-family: var(--font-display); font-size: clamp(28px, 3vw, 42px); line-height: 1.25; font-weight: 400; font-style: italic; color: var(--text); position: relative; padding-left: 32px; margin: 40px 0; }
  .about-quote::before { content: ''; position: absolute; left: 0; top: 8px; bottom: 8px; width: 2px; background: var(--gold); }
  .about-pillars { display: flex; flex-direction: column; gap: 0; }
  .about-pillar { display: flex; gap: 20px; align-items: flex-start; padding: 24px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .about-pillar:last-child { border-bottom: none; }
  .about-pillar-num { font-family: var(--font-display); font-size: 13px; color: var(--gold); font-weight: 600; flex-shrink: 0; padding-top: 3px; }
  .about-pillar h3 { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .about-pillar p { font-size: 13px; color: var(--text-md); line-height: 1.7; }

  /* ── PRICING ── */
  .pricing-section { background: var(--ink); }
  .pricing-grid { display: flex; gap: 20px; margin: 60px 0 0 -40px; width: calc(100% + 40px); }
  @media (max-width: 960px) and (min-width: 769px) {
    .pricing-grid { flex-direction: column; align-items: center; }
    .section { padding: 80px 40px; }
  }
  .price-card { background: var(--card); border: 1px solid var(--border); border-radius: 4px; padding: 40px 36px; position: relative; flex: 1; transition: border-color .3s, transform .3s; display: flex; flex-direction: column; }
  .price-card:hover { border-color: rgba(201,168,76,0.3); transform: translateY(-4px); }
  .price-card.featured { border-color: var(--border-md); background: linear-gradient(160deg, rgba(201,168,76,0.06) 0%, var(--card) 60%); }
  .price-card.featured:hover { border-color: var(--gold); }
  .price-badge { position: absolute; top: -1px; left: 50%; transform: translateX(-50%); background: var(--gold); color: var(--black); font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; padding: 5px 18px; border-radius: 0 0 4px 4px; white-space: nowrap; }
  .price-tier-label { font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase; color: var(--gold); font-weight: 600; margin-bottom: 12px; }
  .price-name { font-family: var(--font-display); font-size: 28px; font-weight: 700; line-height: 1.1; margin-bottom: 6px; }
  .price-tagline { font-size: 13px; color: var(--text-md); line-height: 1.5; margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .price-amount-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 4px; }
  .price-currency { font-size: 20px; color: var(--gold); font-weight: 600; }
  .price-amount { font-family: var(--font-display); font-size: 56px; color: var(--gold); font-weight: 700; line-height: 1; }
  .price-period { font-size: 12px; color: var(--text-dim); margin-bottom: 24px; }
  .price-outcome { background: var(--gold-subtle); border-left: 2px solid var(--gold); padding: 12px 14px; border-radius: 0 3px 3px 0; margin-bottom: 28px; font-size: 13px; color: var(--text); line-height: 1.5; }
  .price-features { list-style: none; display: flex; flex-direction: column; gap: 10px; flex: 1; margin-bottom: 32px; }
  .price-features li { font-size: 13px; color: var(--text-md); display: flex; gap: 10px; line-height: 1.5; }
  .price-features li::before { content: '—'; color: var(--gold); flex-shrink: 0; font-weight: 400; }
  .price-cta-btn { display: block; text-align: center; background: transparent; border: 1px solid var(--border-md); color: var(--gold); padding: 14px; border-radius: 2px; font-size: 12px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; transition: all .2s; cursor: none; }
  .price-cta-btn:hover { background: var(--gold-subtle); border-color: var(--gold); }
  .price-card.featured .price-cta-btn { background: var(--gold); color: var(--black); border-color: var(--gold); }
  .price-card.featured .price-cta-btn:hover { background: var(--gold-lt); }

  /* ── STRIPE BUTTON WRAPPER ── */
  .stripe-btn-wrap { margin-bottom: 10px; overflow: hidden; width: 100%; max-width: 100%; }
  .stripe-btn-wrap stripe-buy-button { display: block; width: 100%; max-width: 100%; }
  .stripe-btn-wrap iframe { max-width: 100% !important; width: 100% !important; }
  .price-discord-btn { display: block; text-align: center; background: transparent; border: 1px solid rgba(255,255,255,0.1); color: var(--text-dim); padding: 9px; border-radius: 2px; font-size: 11px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; transition: all .2s; cursor: none; }
  .price-discord-btn:hover { border-color: rgba(255,255,255,0.2); color: var(--text-md); }
  .price-discord-btn svg { display: inline; margin-right: 6px; vertical-align: -2px; }

  /* ── COMPARISON TABLE ── */
  .compare-wrap { margin-top: 60px; background: var(--card); border: 1px solid var(--border); border-radius: 4px; overflow: hidden; width: 100%; box-sizing: border-box; }
  .compare-toggle { display: flex; align-items: center; gap: 16px; padding: 20px 32px; cursor: none; border-bottom: 1px solid var(--border); background: var(--card2); }
  .compare-toggle-text { font-size: 13px; color: var(--text-md); font-weight: 500; }
  .compare-toggle-icon { width: 20px; height: 20px; border: 1px solid var(--border-md); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--gold); font-size: 12px; transition: transform .3s; }
  .compare-table { width: 100%; border-collapse: collapse; }
  .compare-table th { padding: 16px 24px; text-align: left; font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--gold); font-weight: 600; border-bottom: 1px solid var(--border); background: var(--card2); }
  .compare-table td { padding: 14px 24px; font-size: 13px; color: var(--text-md); border-bottom: 1px solid rgba(255,255,255,0.03); vertical-align: middle; }
  .compare-table tr:last-child td { border-bottom: none; }
  .compare-table tr:hover td { background: rgba(255,255,255,0.01); }
  .check { color: var(--gold); font-size: 14px; }
  .dash { color: var(--text-dim); }
  .compare-table td:first-child { color: var(--text); font-weight: 500; }

  /* ── TESTIMONIALS ── */
  .testi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  .testi-card { background: var(--card); border: 1px solid var(--border); border-radius: 4px; padding: 32px 28px; transition: border-color .3s, transform .3s; }
  .testi-card:hover { border-color: var(--border-md); transform: translateY(-3px); }
  .testi-stars { color: var(--gold); font-size: 14px; margin-bottom: 20px; letter-spacing: 2px; }
  .testi-quote { font-family: var(--font-display); font-size: 17px; font-style: italic; line-height: 1.6; color: var(--text); margin-bottom: 28px; font-weight: 400; }
  .testi-divider { width: 32px; height: 1px; background: var(--border-md); margin-bottom: 20px; }
  .testi-author { display: flex; align-items: center; gap: 14px; }
  .testi-avatar { width: 42px; height: 42px; border-radius: 50%; background: var(--gold-subtle); border: 1px solid var(--border-md); display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; color: var(--gold); flex-shrink: 0; }
  .testi-name { font-size: 14px; font-weight: 600; color: var(--text); }
  .testi-meta { font-size: 12px; color: var(--text-dim); margin-top: 1px; }
  .testi-result { font-size: 12px; color: var(--gold); font-weight: 600; margin-top: 2px; letter-spacing: 0.05em; }

  /* ── FAQ ── */
  .faq-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: start; }
  .faq-list { display: flex; flex-direction: column; }
  .faq-item { border-bottom: 1px solid rgba(255,255,255,0.05); }
  .faq-q { display: flex; justify-content: space-between; align-items: center; gap: 24px; padding: 22px 0; cursor: none; }
  .faq-q-text { font-size: 15px; font-weight: 600; color: var(--text); line-height: 1.4; }
  .faq-icon { width: 26px; height: 26px; border: 1px solid var(--border-md); border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: var(--gold); font-size: 14px; transition: all .25s; background: var(--gold-subtle); }
  .faq-item.open .faq-icon { background: var(--gold); color: var(--black); transform: rotate(45deg); }
  .faq-a { font-size: 14px; color: var(--text-md); line-height: 1.75; padding-bottom: 22px; max-height: 0; overflow: hidden; transition: max-height .4s ease, padding-bottom .4s ease; }
  .faq-item.open .faq-a { max-height: 300px; }
  .faq-aside { position: sticky; top: 120px; }
  .faq-aside-card { background: var(--card); border: 1px solid var(--border-md); border-radius: 4px; padding: 40px 36px; }
  .faq-aside-label { font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: var(--gold); font-weight: 600; margin-bottom: 16px; }
  .faq-aside h3 { font-family: var(--font-display); font-size: 32px; font-weight: 700; margin-bottom: 16px; line-height: 1.1; }
  .faq-aside p { font-size: 14px; color: var(--text-md); line-height: 1.7; margin-bottom: 28px; }

  /* ── CTA SECTION ── */
  .cta-section { text-align: center; padding: 140px 80px; position: relative; overflow: hidden; }
  .cta-bg { position: absolute; inset: 0; background: radial-gradient(ellipse 70% 60% at 50% 50%, rgba(201,168,76,0.06) 0%, transparent 70%); pointer-events: none; }
  .cta-border-top { position: absolute; top: 0; left: 10%; right: 10%; height: 1px; background: linear-gradient(to right, transparent, var(--border-md), transparent); }
  .cta-section h2 { font-family: var(--font-display); font-size: clamp(48px, 5.5vw, 80px); line-height: 1.0; font-weight: 700; max-width: 800px; margin: 24px auto 24px; }
  .cta-section h2 em { font-style: italic; color: var(--gold); }
  .cta-section p { font-size: 17px; color: var(--text-md); max-width: 500px; margin: 0 auto 48px; }
  .cta-btns { display: flex; gap: 16px; justify-content: center; align-items: center; }
  .discord-note { font-size: 12px; color: var(--text-dim); margin-top: 20px; letter-spacing: 0.06em; }

  /* ── FOOTER ── */
  footer { border-top: 1px solid var(--border); padding: 40px 80px; background: var(--ink); }
  .footer-inner { max-width: 1300px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; }
  .footer-logo { font-family: var(--font-display); font-size: 22px; color: var(--gold); font-weight: 700; }
  .footer-links { display: flex; gap: 32px; }
  .footer-links a { font-size: 12px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-dim); transition: color .2s; font-weight: 500; }
  .footer-links a:hover { color: var(--gold); }
  .footer-copy { font-size: 12px; color: var(--text-dim); }

  /* ── ANIMATIONS ── */
  .fade-up { opacity: 0; transform: translateY(36px); transition: opacity .75s cubic-bezier(.16,1,.3,1), transform .75s cubic-bezier(.16,1,.3,1); }
  .fade-up.visible { opacity: 1; transform: translateY(0); }
  .fade-up.delay-1 { transition-delay: .1s; }
  .fade-up.delay-2 { transition-delay: .2s; }
  .fade-up.delay-3 { transition-delay: .3s; }
  .fade-up.delay-4 { transition-delay: .4s; }
  .fade-up.delay-5 { transition-delay: .5s; }
  .fade-up.delay-6 { transition-delay: .6s; }
  .stagger > * { opacity: 0; transform: translateY(24px); transition: opacity .6s cubic-bezier(.16,1,.3,1), transform .6s cubic-bezier(.16,1,.3,1); }
  .stagger.visible > *:nth-child(1) { opacity: 1; transform: none; transition-delay: 0s; }
  .stagger.visible > *:nth-child(2) { opacity: 1; transform: none; transition-delay: .12s; }
  .stagger.visible > *:nth-child(3) { opacity: 1; transform: none; transition-delay: .24s; }
  .stagger.visible > *:nth-child(4) { opacity: 1; transform: none; transition-delay: .36s; }
  .stagger.visible > *:nth-child(5) { opacity: 1; transform: none; transition-delay: .48s; }
  .stagger.visible > *:nth-child(6) { opacity: 1; transform: none; transition-delay: .60s; }

  /* ── MOBILE RESPONSIVE ── */
  @media (max-width: 768px) {
    body { cursor: auto; }
    .cursor-dot, .cursor-ring { display: none; }

    /* Nav */
    .nav { padding: 0 20px; height: 60px; }
    .nav-links { display: none; }
    .nav-hamburger { display: block !important; }

    /* Hero */
    .hero { padding: 80px 20px 60px; min-height: auto; }
    .hero-grid { grid-template-columns: 1fr; gap: 40px; }
    .hero-h1 { font-size: clamp(38px, 9vw, 56px); }
    .hero-sub { font-size: 15px; }
    .hero-actions { flex-direction: column; gap: 12px; }
    .btn-gold, .btn-ghost { width: 100%; text-align: center; justify-content: center; padding: 16px 24px; }
    .hero-stats { grid-template-columns: repeat(3, 1fr); }
    .hero-stat { padding: 16px 8px; }
    .hero-stat-num { font-size: 28px; }
    .hero-stat-label { font-size: 9px; }
    .hero-line { display: none; }
    .hero-bg-orb { display: none; }

    /* Sections */
    .section { padding: 72px 20px; }

    /* What is Dropshipping */
    .ds-grid { grid-template-columns: 1fr; gap: 48px; }
    .ds-right { position: static; }
    .ds-cards { grid-template-columns: 1fr; }

    /* About */
    .about-grid { grid-template-columns: 1fr; gap: 48px; }
    .about-quote { font-size: clamp(20px, 5vw, 28px); }

    /* Pricing */
    .pricing-grid { grid-template-columns: 1fr; gap: 20px; max-width: 320px; margin-left: auto; margin-right: auto; }
    .price-card { padding: 32px 24px; }

    /* Comparison table */
    .compare-table { font-size: 12px; }
    .compare-table th, .compare-table td { padding: 10px 12px; }
    .compare-table th:nth-child(n+2), .compare-table td:nth-child(n+2) { display: none; }
    .compare-table th:nth-child(3), .compare-table td:nth-child(3) { display: table-cell; }

    /* Testimonials */
    .testi-grid { grid-template-columns: 1fr; }

    /* FAQ */
    .faq-grid { grid-template-columns: 1fr; gap: 48px; }
    .faq-aside { position: static; }

    /* CTA */
    .cta-section { padding: 80px 20px; }
    .cta-btns { flex-direction: column; gap: 12px; }
    .cta-btns .btn-gold, .cta-btns .btn-ghost { width: 100%; justify-content: center; }

    /* Footer */
    footer { padding: 32px 20px; }
    .footer-inner { flex-direction: column; gap: 20px; text-align: center; }
    .footer-links { flex-wrap: wrap; justify-content: center; gap: 16px; }
  }

  @media (max-width: 480px) {
    .hero-h1 { font-size: clamp(32px, 8vw, 44px); }
    .hero-stats { grid-template-columns: repeat(3, 1fr); gap: 0; }
    .hero-stat-num { font-size: 24px; }
    .hero-stat-suf { font-size: 16px; }
    .section-title { font-size: clamp(30px, 7vw, 44px); }
    .price-amount { font-size: 44px; }
  }

  /* ── REP SPREADSHEET SECTION ── */
  .rep-section { background: var(--black); position: relative; overflow: hidden; }
  .rep-divider { position: relative; padding: 0 80px; margin-bottom: 0; }
  .rep-divider-inner { max-width: 1300px; margin: 0 auto; }
  .rep-divider-line { height: 1px; background: linear-gradient(to right, transparent, var(--border-md), var(--gold), var(--border-md), transparent); }
  .rep-divider-label { display: flex; justify-content: center; margin-top: -1px; }
  .rep-divider-badge { background: var(--black); border: 1px solid var(--border-md); color: var(--gold); font-size: 10px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; padding: 6px 20px; border-radius: 40px; position: relative; top: -1px; }

  .rep-intro { padding: 80px 80px 0; }
  .rep-intro-inner { max-width: 1300px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 80px; align-items: center; }
  .rep-intro-text { }
  .rep-intro-visual { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .rep-stat-tile { background: var(--card); border: 1px solid var(--border); border-radius: 4px; padding: 24px 22px; text-align: center; transition: border-color .3s, transform .3s; }
  .rep-stat-tile:hover { border-color: var(--border-md); transform: translateY(-3px); }
  .rep-stat-tile-num { font-family: var(--font-display); font-size: 40px; color: var(--gold); font-weight: 700; line-height: 1; }
  .rep-stat-tile-label { font-size: 11px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--text-dim); margin-top: 6px; }
  .rep-stat-tile.wide { grid-column: 1 / -1; }

  .rep-card-section { padding: 60px 80px 120px; }
  .rep-card-section-inner { max-width: 1300px; margin: 0 auto; }
  .rep-card-wrap { display: grid; grid-template-columns: 1fr 420px; gap: 60px; align-items: start; }
  .rep-features-list { display: flex; flex-direction: column; gap: 0; margin-top: 40px; }
  .rep-feature { display: flex; gap: 20px; align-items: flex-start; padding: 22px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
  .rep-feature:last-child { border-bottom: none; }
  .rep-feature-icon { width: 36px; height: 36px; background: var(--gold-subtle); border: 1px solid var(--border-md); border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
  .rep-feature h3 { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
  .rep-feature p { font-size: 13px; color: var(--text-md); line-height: 1.7; }

  .rep-price-card { background: var(--card); border: 1px solid var(--border-md); border-radius: 4px; padding: 40px 36px; position: sticky; top: 100px; background: linear-gradient(160deg, rgba(201,168,76,0.05) 0%, var(--card) 60%); }
  .rep-price-card-label { font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); font-weight: 700; margin-bottom: 12px; }
  .rep-price-card-name { font-family: var(--font-display); font-size: 30px; font-weight: 700; line-height: 1.1; margin-bottom: 8px; }
  .rep-price-card-sub { font-size: 13px; color: var(--text-md); line-height: 1.6; margin-bottom: 28px; padding-bottom: 28px; border-bottom: 1px solid rgba(255,255,255,0.05); }
  .rep-price-row { display: flex; align-items: baseline; gap: 4px; margin-bottom: 4px; }
  .rep-price-currency { font-size: 18px; color: var(--gold); font-weight: 600; }
  .rep-price-amount { font-family: var(--font-display); font-size: 52px; color: var(--gold); font-weight: 700; line-height: 1; }
  .rep-price-period { font-size: 12px; color: var(--text-dim); margin-bottom: 24px; }
  .rep-price-outcome { background: var(--gold-subtle); border-left: 2px solid var(--gold); padding: 12px 14px; border-radius: 0 3px 3px 0; margin-bottom: 28px; font-size: 13px; color: var(--text); line-height: 1.5; }
  .rep-includes { list-style: none; display: flex; flex-direction: column; gap: 10px; margin-bottom: 32px; }
  .rep-includes li { font-size: 13px; color: var(--text-md); display: flex; gap: 10px; line-height: 1.5; }
  .rep-includes li::before { content: '—'; color: var(--gold); flex-shrink: 0; }
  .rep-cancel-note { font-size: 11px; color: var(--text-dim); text-align: center; margin-top: 12px; letter-spacing: 0.06em; }

  @media (max-width: 768px) {
    .rep-divider { padding: 0 20px; }
    .rep-intro { padding: 56px 20px 0; }
    .rep-intro-inner { grid-template-columns: 1fr; gap: 40px; }
    .rep-card-section { padding: 40px 20px 80px; }
    .rep-card-wrap { grid-template-columns: 1fr; gap: 40px; }
    .rep-price-card { position: static; padding: 32px 24px; }
    .rep-intro-visual { grid-template-columns: 1fr 1fr; }
    .rep-stat-tile.wide { grid-column: 1 / -1; }
  }

  @media (prefers-color-scheme: light) {
    :root {
      --black: #F5F2EC;
      --ink: #EDE9E0;
      --card: #FFFFFF;
      --card2: #F0EDE6;
      --card3: #E8E4DC;
      --text: #1A0A2E;
      --text-md: #3D2B5A;
      --text-dim: #7A6890;
      --border: rgba(100,60,160,0.12);
      --border-md: rgba(100,60,160,0.25);
      --gold-subtle: rgba(201,168,76,0.12);
      --gold-glow: rgba(201,168,76,0.22);
    }
    body { background: var(--black); color: var(--text); }
    .nav.scrolled { background: rgba(245,242,236,0.95); }
    .noise { opacity: 0.015; }
    .hero-panel { box-shadow: 0 8px 40px rgba(0,0,0,0.08); }
    .price-card { box-shadow: 0 4px 24px rgba(0,0,0,0.06); }
    .testi-card { box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
    .ds-card { box-shadow: 0 2px 16px rgba(0,0,0,0.05); }
    .faq-aside-card { box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .about-section { background: var(--ink); }
    .pricing-section { background: var(--ink); }
    .marquee-wrap { background: var(--ink); }
  }

  @keyframes slideIn { from { opacity:0; transform: translateX(-12px); } to { opacity:1; transform: translateX(0); } }
  .panel-animate > * { animation: slideIn .5s cubic-bezier(.16,1,.3,1) both; }
  .panel-animate > *:nth-child(1) { animation-delay: .4s; }
  .panel-animate > *:nth-child(2) { animation-delay: .55s; }
  .panel-animate > *:nth-child(3) { animation-delay: .65s; }
  .panel-animate > *:nth-child(4) { animation-delay: .75s; }
  .panel-animate > *:nth-child(5) { animation-delay: .85s; }
  .panel-animate > *:nth-child(6) { animation-delay: .95s; }

  /* Hero h1 word reveal */
  @keyframes wordReveal { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
  .word { display: inline-block; animation: wordReveal .7s cubic-bezier(.16,1,.3,1) both; }

  /* Scrolling indicator */
  @keyframes bounce { 0%,100%{transform:translateY(0)} 50%{transform:translateY(6px)} }
  .scroll-indicator { display: flex; flex-direction: column; align-items: center; gap: 8px; color: var(--text-dim); font-size: 10px; letter-spacing: 0.15em; text-transform: uppercase; }
  .scroll-indicator-arrow { animation: bounce 1.8s ease-in-out infinite; color: var(--gold); }

  /* ── SPOTS BADGE ── */
  .spots-badge { display: flex; align-items: center; gap: 8px; margin-bottom: 18px; padding: 8px 12px; background: rgba(201,168,76,0.06); border: 1px solid rgba(201,168,76,0.18); border-radius: 2px; }
  .spots-dot { width: 6px; height: 6px; background: #E05C5C; border-radius: 50%; flex-shrink: 0; animation: pulseDot 2s ease-in-out infinite; }
  @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.45;transform:scale(0.65)} }
  .spots-text { font-size: 11px; color: var(--text-md); font-weight: 500; line-height: 1.4; }
  .spots-count { font-weight: 700; color: var(--gold); }

  /* ── STICKY CTA BAR ── */
  .sticky-cta { position: fixed; bottom: 0; left: 0; right: 0; z-index: 800; transform: translateY(100%); transition: transform .4s cubic-bezier(.16,1,.3,1); }
  .sticky-cta.visible { transform: translateY(0); }
  .sticky-cta-inner { background: rgba(10,10,10,0.97); backdrop-filter: blur(20px); border-top: 1px solid var(--border-md); padding: 14px 48px; display: flex; align-items: center; justify-content: space-between; gap: 20px; }
  .sticky-cta-text { font-size: 14px; color: var(--text-md); white-space: nowrap; }
  .sticky-cta-text strong { color: var(--text); font-weight: 600; }
  .sticky-cta-actions { display: flex; gap: 10px; align-items: center; flex-shrink: 0; }
  .sticky-close { background: none; border: none; color: var(--text-dim); font-size: 22px; cursor: pointer; padding: 2px 8px; line-height: 1; transition: color .2s; flex-shrink: 0; }
  .sticky-close:hover { color: var(--text); }
  @media (max-width: 768px) {
    .sticky-cta-inner { padding: 12px 16px; flex-wrap: wrap; gap: 8px; }
    .sticky-cta-text { font-size: 12px; width: 100%; white-space: normal; }
    .sticky-cta-actions { width: 100%; }
    .sticky-cta-actions .btn-gold, .sticky-cta-actions .btn-ghost { flex: 1; text-align: center; justify-content: center; padding: 11px 12px; font-size: 11px; width: auto; }
  }

  /* ── SOCIAL PROOF TICKER ── */
  .sp-ticker { position: fixed; bottom: 100px; left: 20px; z-index: 700; max-width: 272px; pointer-events: none; }
  .sp-toast { background: rgba(16,16,16,0.97); backdrop-filter: blur(14px); border: 1px solid var(--border-md); border-radius: 6px; padding: 13px 15px; display: flex; align-items: center; gap: 11px; animation: spIn .45s cubic-bezier(.16,1,.3,1) both; }
  @keyframes spIn { from { opacity:0; transform: translateX(-20px); } to { opacity:1; transform: translateX(0); } }
  .sp-fade-out { animation: spOut .35s ease forwards; }
  @keyframes spOut { to { opacity:0; transform: translateX(-12px); } }
  .sp-avatar { width: 34px; height: 34px; border-radius: 50%; background: var(--gold-subtle); border: 1px solid var(--border-md); display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; color: var(--gold); flex-shrink: 0; }
  .sp-name { font-size: 12px; font-weight: 600; color: var(--text); line-height: 1.3; }
  .sp-detail { font-size: 11px; color: var(--text-dim); margin-top: 1px; }
  .sp-tier { font-size: 11px; color: var(--gold); font-weight: 600; }
  @media (max-width: 768px) { .sp-ticker { bottom: 130px; left: 12px; max-width: 232px; } }

  /* ── EXIT INTENT POPUP ── */
  .exit-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.78); backdrop-filter: blur(8px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 20px; animation: fadeOverlay .3s ease; }
  @keyframes fadeOverlay { from{opacity:0} to{opacity:1} }
  .exit-modal { background: var(--card); border: 1px solid var(--border-md); border-radius: 6px; max-width: 500px; width: 100%; padding: 52px 48px; position: relative; animation: slideModal .4s cubic-bezier(.16,1,.3,1); }
  @keyframes slideModal { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  .exit-close { position: absolute; top: 16px; right: 16px; background: none; border: none; color: var(--text-dim); font-size: 22px; cursor: pointer; line-height: 1; padding: 4px 8px; transition: color .2s; }
  .exit-close:hover { color: var(--text); }
  .exit-eyebrow { font-size: 10px; letter-spacing: 0.22em; text-transform: uppercase; color: var(--gold); font-weight: 700; margin-bottom: 16px; }
  .exit-modal h2 { font-family: var(--font-display); font-size: clamp(28px, 4vw, 42px); font-weight: 700; line-height: 1.08; margin-bottom: 14px; }
  .exit-modal h2 em { color: var(--gold); font-style: italic; }
  .exit-modal p { font-size: 14px; color: var(--text-md); line-height: 1.75; margin-bottom: 28px; }
  .exit-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0; border: 1px solid var(--border); border-radius: 2px; overflow: hidden; margin-bottom: 28px; }
  .exit-stat { padding: 16px 8px; border-right: 1px solid var(--border); text-align: center; }
  .exit-stat:last-child { border-right: none; }
  .exit-stat-num { font-family: var(--font-display); font-size: 26px; color: var(--gold); font-weight: 700; line-height: 1; }
  .exit-stat-label { font-size: 10px; color: var(--text-dim); margin-top: 4px; letter-spacing: 0.1em; text-transform: uppercase; }
  .exit-dismiss { display: block; text-align: center; margin-top: 14px; font-size: 12px; color: var(--text-dim); cursor: pointer; text-decoration: underline; text-underline-offset: 3px; background: none; border: none; }
  .exit-dismiss:hover { color: var(--text-md); }
  @media (max-width: 480px) { .exit-modal { padding: 36px 24px; } }

  /* ── CHECKOUT DRAWER ── */
  .checkout-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.72); backdrop-filter: blur(4px); z-index: 8000; opacity: 0; pointer-events: none; transition: opacity .35s ease; }
  .checkout-overlay.open { opacity: 1; pointer-events: auto; }

  .checkout-drawer { position: fixed; top: 0; right: 0; height: 100%; width: 480px; max-width: 100%; background: var(--card); border-left: 1px solid var(--border-md); z-index: 8001; transform: translateX(100%); transition: transform .45s cubic-bezier(.16,1,.3,1); overflow-y: auto; padding: 48px 40px 60px; display: flex; flex-direction: column; gap: 24px; }
  .checkout-drawer.open { transform: translateX(0); }

  @media (max-width: 768px) {
    .checkout-drawer { top: 60px; width: 100%; height: calc(100% - 60px); border-left: none; border-top: 1px solid var(--border-md); transform: translateY(100%); border-radius: 12px 12px 0 0; padding: 32px 24px 48px; }
    .checkout-drawer.open { transform: translateY(0); }
  }

  .checkout-plan-toggle { display: flex; gap: 8px; background: var(--card2); border-radius: 100px; padding: 4px; }
  .checkout-plan-btn { flex: 1; padding: 10px 16px; border-radius: 100px; border: none; font-family: var(--font-body); font-size: 13px; font-weight: 600; letter-spacing: 0.06em; cursor: pointer; transition: all .2s; background: transparent; color: var(--text-dim); }
  .checkout-plan-btn.active { background: var(--gold); color: var(--black); }

  .checkout-price-display { font-family: var(--font-display); font-size: 56px; font-weight: 700; color: var(--text); line-height: 1; }
  .checkout-price-period { font-size: 13px; color: var(--text-dim); margin-top: 6px; }
  .checkout-savings-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--gold-subtle); border: 1px solid var(--border-md); border-radius: 100px; padding: 6px 14px; font-size: 12px; font-weight: 600; color: var(--gold); letter-spacing: 0.06em; margin-top: 12px; }
  .checkout-trial-badge { display: inline-flex; align-items: center; gap: 6px; background: var(--gold-subtle); border: 1px solid var(--border-md); border-radius: 100px; padding: 6px 14px; font-size: 12px; font-weight: 600; color: var(--gold); letter-spacing: 0.06em; margin-top: 12px; }

  .checkout-cta-btn { width: 100%; padding: 16px; background: var(--gold); color: var(--black); border: none; border-radius: 2px; font-family: var(--font-body); font-size: 14px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; cursor: pointer; transition: background .2s, opacity .2s; margin-top: 8px; }
  .checkout-cta-btn:hover { background: var(--gold-lt); }
  .checkout-cta-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .checkout-smallprint { font-size: 12px; color: var(--text-dim); line-height: 1.6; text-align: center; }
  .checkout-secure { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 12px; color: var(--text-dim); margin-top: auto; padding-top: 24px; border-top: 1px solid var(--border); }
  .checkout-error { font-size: 13px; color: var(--urgent); text-align: center; padding: 10px; background: var(--urgent-bg); border-radius: 2px; }

  /* ── PRICE CTA BUTTON ── */
  .price-cta-btn { width: 100%; margin-bottom: 12px; }
  .btn-gold.price-cta-btn { background: var(--gold); color: var(--black); border: none; padding: 16px; }
  .btn-gold.price-cta-btn:hover { background: var(--gold-lt); }
`;

// ─── MARQUEE ITEMS ────────────────────────────────────────────────────────
const MARQUEE_ITEMS = [
  "1200+ clients", "100% success rate", "Australian owned",
  "Depop dropshipping", "Proven system", "Private suppliers",
  "1-on-1 support", "Daily product drops", "Real results",
  "5000+ rep items", "1200+ clients", "100% success rate",
  "Australian owned", "Depop dropshipping", "Proven system",
  "Private suppliers", "1-on-1 support", "Daily product drops",
  "Real results", "5000+ rep items",
];

// ─── PRICING DATA ─────────────────────────────────────────────────────────
// TIERS imported from ./data/pricing.js

const COMPARE_ROWS = [
  { feature: "1-on-1 calls", pro: "Unlimited", elite: "Unlimited", vip: "Unlimited" },
  { feature: "Store setup", pro: "✓", elite: "✓", vip: "✓" },
  { feature: "Store run for you", pro: "—", elite: "✓", vip: "✓" },
  { feature: "Daily product picks", pro: "✓ (drops)", elite: "✓ (drops)", vip: "✓ (personalised)" },
  { feature: "Listings created for you", pro: "—", elite: "✓", vip: "✓" },
  { feature: "Custom supplier sourcing", pro: "—", elite: "—", vip: "✓" },
  { feature: "Priority support", pro: "—", elite: "✓", vip: "Top-priority" },
  { feature: "Store audits", pro: "—", elite: "—", vip: "On-demand" },
  { feature: "Daily operations oversight", pro: "—", elite: "—", vip: "✓" },
];

const FAQS = [
  { q: "Do I need any experience to start?", a: "Zero experience needed. Most of our clients had never sold anything online before joining. We walk you through every single step — from creating your account to making your first sale — and we're there whenever questions come up." },
  { q: "How long until I start making money?", a: "Most clients make their first sale within 1–2 weeks. Consistent monthly income typically comes within 30–45 days. Speed depends on how quickly you implement — which is why we handle the heavy lifting in our higher tiers." },
  { q: "What's the difference between the tiers?", a: "Pro Accelerator is coaching + guidance — you execute with our direction. Elite Scale adds done-for-you store management. VIP Inner Circle is maximum access — daily personal picks, real-time oversight, and a fully operated store." },
  { q: "Do I need capital to run the business?", a: "Since you only pay the supplier after a buyer pays you, you can start with very little. A small buffer of $100–$200 AUD is recommended so you can move fast when orders come in, but there's no bulk inventory to buy upfront." },
  { q: "Is Depop dropshipping allowed?", a: "Yes — reselling on Depop is completely allowed and it's what the platform is built for. Our system is fully compliant with Depop's terms of service. We've helped 1200+ clients do this without any platform issues." },
  { q: "How much time does it take per week?", a: "Pro Accelerator: 1–3 hours/day to start. Elite Scale reduces this significantly as we handle most tasks. VIP Inner Circle can be as little as 20–30 minutes per day to approve decisions — we handle the rest." },
];

const TESTIMONIALS = [
  { initials: "JM", name: "Jordan M.", meta: "Pro Accelerator · Sydney", result: "↑ $500-$1,000 within 2 weeks", quote: "I was working a job I hated and had zero experience with resale. Within my first month I was making enough to cover rent. The daily product drops alone are worth the price of entry." },
  { initials: "AR", name: "Aisha R.", meta: "Elite Scale · Melbourne", result: "↑ $1,000/week consistently", quote: "I thought dropshipping was a scam until a friend referred me here. The 1-on-1 calls changed everything — they built my store and I just watched the sales roll in. Genuinely life-changing." },
  { initials: "TK", name: "Tyler K.", meta: "VIP Inner Circle · Brisbane", result: "↑ $1,500+ weekly", quote: "I'm a full-time uni student. With VIP they run the whole thing — I just approve products. Made over $1,200 last month doing almost nothing. I wish I'd done this sooner." },
];

// ─── SOCIAL PROOF DATA ────────────────────────────────────────────────────
const SP_NOTIFICATIONS = [
  { initials: "JM", name: "Jordan M.", location: "Sydney", tier: "Elite Scale" },
  { initials: "AR", name: "Aisha R.", location: "Melbourne", tier: "VIP Inner Circle" },
  { initials: "TK", name: "Tyler K.", location: "Brisbane", tier: "Pro Accelerator" },
  { initials: "EL", name: "Emma L.", location: "Perth", tier: "Elite Scale" },
  { initials: "LW", name: "Liam W.", location: "Adelaide", tier: "Pro Accelerator" },
  { initials: "SC", name: "Sophie C.", location: "Gold Coast", tier: "Elite Scale" },
  { initials: "NK", name: "Nathan K.", location: "Hobart", tier: "VIP Inner Circle" },
  { initials: "MR", name: "Mia R.", location: "Canberra", tier: "Pro Accelerator" },
];

// ─── SUB-COMPONENTS ───────────────────────────────────────────────────────

function Eyebrow({ text }) {
  return (
    <div className="eyebrow">
      
      <span className="eyebrow-text">{text}</span>
    </div>
  );
}

function FadeUp({ children, delay = 0, className = "" }) {
  const [ref, visible] = useInView(0.1);
  return (
    <div ref={ref} className={`fade-up${visible ? " visible" : ""}${delay ? ` delay-${delay}` : ""} ${className}`}>
      {children}
    </div>
  );
}

function StaggerGrid({ children, className = "" }) {
  const [ref, visible] = useInView(0.1);
  return (
    <div ref={ref} className={`stagger${visible ? " visible" : ""} ${className}`}>
      {children}
    </div>
  );
}

function StatCounter({ target, suffix = "", prefix = "" }) {
  const [ref, visible] = useInView(0.3);
  const val = useCountUp(target, 1600, visible);
  return (
    <span ref={ref}>
      {prefix}{visible || val > 0 ? val : 0}{suffix}
    </span>
  );
}

function SpotsBadge({ spots }) {
  return (
    <div className="spots-badge">
      <div className="spots-dot" />
      <span className="spots-text">
        <span className="spots-count">{spots} spot{spots !== 1 ? "s" : ""}</span> remaining this month
      </span>
    </div>
  );
}

function SocialProofTicker() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    const initial = setTimeout(() => {
      started.current = true;
      setVisible(true);
    }, 4000);
    return () => clearTimeout(initial);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const hide = setTimeout(() => setFadeOut(true), 4200);
    const next = setTimeout(() => {
      setFadeOut(false);
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % SP_NOTIFICATIONS.length);
        setVisible(true);
      }, 5800);
    }, 4600);
    return () => { clearTimeout(hide); clearTimeout(next); };
  }, [visible, idx]);

  if (!visible) return null;
  const n = SP_NOTIFICATIONS[idx];
  return (
    <div className="sp-ticker">
      <div className={`sp-toast${fadeOut ? " sp-fade-out" : ""}`}>
        <div className="sp-avatar">{n.initials}</div>
        <div>
          <div className="sp-name">{n.name} · {n.location}</div>
          <div className="sp-detail">just enrolled in</div>
          <div className="sp-tier">{n.tier}</div>
        </div>
      </div>
    </div>
  );
}

function StickyCTABar() {
  const [show, setShow] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onScroll = () => { if (!dismissed) setShow(window.scrollY > 520); };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [dismissed]);

  const dismiss = () => { setDismissed(true); setShow(false); };

  return (
    <div className={`sticky-cta${show ? " visible" : ""}`}>
      <div className="sticky-cta-inner">
        <p className="sticky-cta-text">
          <strong>1200+ clients · 100% success rate.</strong> Your Depop store won't build itself.
        </p>
        <div className="sticky-cta-actions">
          <a href="https://discord.gg/pVzjXumpbP" target="_blank" rel="noreferrer" className="btn-gold" style={{ padding: "11px 28px", fontSize: 12 }}>
            Enrol Now →
          </a>
          <a href="#pricing" className="btn-ghost" style={{ padding: "10px 20px", fontSize: 12 }}>
            See Pricing
          </a>
          <button className="sticky-close" onClick={dismiss} aria-label="Dismiss">×</button>
        </div>
      </div>
    </div>
  );
}

function ExitIntentPopup() {
  const [show, setShow] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    const onLeave = (e) => {
      if (e.clientY <= 8 && !fired.current) {
        fired.current = true;
        setShow(true);
      }
    };
    const arm = setTimeout(() => document.addEventListener("mouseleave", onLeave), 6000);
    return () => { clearTimeout(arm); document.removeEventListener("mouseleave", onLeave); };
  }, []);

  if (!show) return null;
  return (
    <div className="exit-overlay" onClick={(e) => e.target === e.currentTarget && setShow(false)}>
      <div className="exit-modal">
        <button className="exit-close" onClick={() => setShow(false)} aria-label="Close">×</button>
        <div className="exit-eyebrow">Wait — before you go</div>
        <h2>Still on the fence?<br />Let us <em>answer it.</em></h2>
        <p>
          Jump into our Discord and ask anything, completely free. No pressure, no scripts —
          just straight answers from the team before you commit.
        </p>
        <div className="exit-stats">
          <div className="exit-stat">
            <div className="exit-stat-num">1200+</div>
            <div className="exit-stat-label">Clients</div>
          </div>
          <div className="exit-stat">
            <div className="exit-stat-num">100%</div>
            <div className="exit-stat-label">Success</div>
          </div>
          <div className="exit-stat">
            <div className="exit-stat-num">&lt;2hr</div>
            <div className="exit-stat-label">Response</div>
          </div>
        </div>
        <a
          href="https://discord.gg/pVzjXumpbP"
          target="_blank"
          rel="noreferrer"
          className="btn-gold"
          style={{ display: "flex", width: "100%", justifyContent: "center", fontSize: 14, padding: "16px 32px" }}
          onClick={() => setShow(false)}
        >
          Ask a question on Discord →
        </a>
        <button className="exit-dismiss" onClick={() => setShow(false)}>
          No thanks, I'll figure it out myself
        </button>
      </div>
    </div>
  );
}

function Cursor() {
  const dotRef = useRef(null);
  const ringRef = useRef(null);
  const pos = useRef({ x: 0, y: 0 });
  const ring = useRef({ x: 0, y: 0 });
  const hovered = useRef(false);

  useEffect(() => {
    const onMove = (e) => {
      pos.current = { x: e.clientX, y: e.clientY };
      if (dotRef.current) {
        dotRef.current.style.left = e.clientX + "px";
        dotRef.current.style.top = e.clientY + "px";
      }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const isHover = el && (el.tagName === "A" || el.tagName === "BUTTON" || el.closest("a") || el.closest("button") || el.style.cursor === "pointer" || getComputedStyle(el).cursor === "pointer");
      hovered.current = isHover;
      if (ringRef.current) ringRef.current.classList.toggle("hovered", !!isHover);
    };
    let raf;
    const animate = () => {
      ring.current.x += (pos.current.x - ring.current.x) * 0.12;
      ring.current.y += (pos.current.y - ring.current.y) * 0.12;
      if (ringRef.current) {
        ringRef.current.style.left = ring.current.x + "px";
        ringRef.current.style.top = ring.current.y + "px";
      }
      raf = requestAnimationFrame(animate);
    };
    animate();
    document.addEventListener("mousemove", onMove);
    return () => { document.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      <div ref={dotRef} className="cursor cursor-dot" style={{ position: "fixed", pointerEvents: "none", zIndex: 9999 }} />
      <div ref={ringRef} className="cursor cursor-ring" style={{ position: "fixed", pointerEvents: "none", zIndex: 9998 }} />
    </>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);
  return (
    <nav className={`nav${scrolled ? " scrolled" : ""}`}>
      <div className="nav-logo">Sync Agency</div>
      <div className="nav-links">
        <a href="#how-it-works">How it works</a>
        <a href="#pricing">Pricing</a>
        <a href="#results">Results</a>
        <a href="#faq">FAQ</a>
        <a href="https://discord.gg/pVzjXumpbP" target="_blank" rel="noreferrer" className="nav-btn">Enrol Now →</a>
      </div>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMenuOpen(v => !v)}
        style={{ display: "none", background: "none", border: "1px solid var(--border-md)", color: "var(--gold)", padding: "8px 12px", borderRadius: 2, cursor: "pointer", fontSize: 18, lineHeight: 1 }}
        className="nav-hamburger"
        aria-label="Menu"
      >
        {menuOpen ? "✕" : "☰"}
      </button>
      {menuOpen && (
        <div style={{ position: "fixed", top: 60, left: 0, right: 0, background: "rgba(8,8,8,0.97)", backdropFilter: "blur(16px)", borderBottom: "1px solid var(--border)", padding: "24px 20px", zIndex: 499, display: "flex", flexDirection: "column", gap: 0 }}>
          {["#how-it-works", "#pricing", "#results", "#faq"].map((href, i) => (
            <a key={href} href={href} onClick={() => setMenuOpen(false)} style={{ padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--text-md)", fontWeight: 500 }}>
              {["How it works", "Pricing", "Results", "FAQ"][i]}
            </a>
          ))}
          <a href="https://discord.gg/pVzjXumpbP" target="_blank" rel="noreferrer" className="btn-gold" style={{ marginTop: 20, justifyContent: "center" }} onClick={() => setMenuOpen(false)}>
            Enrol Now →
          </a>
        </div>
      )}
    </nav>
  );
}

function HeroPanel() {
  return (
    <div className="hero-panel">
      <div className="hero-panel-header">
        <div className="panel-dot" style={{ background: "#FF5F57" }} />
        <div className="panel-dot" style={{ background: "#FFBD2E" }} />
        <div className="panel-dot" style={{ background: "#28CA41" }} />
        <span style={{ fontSize: 12, color: "var(--text-dim)", marginLeft: 8, fontWeight: 500 }}>live_profit_model.sync</span>
      </div>
      <div className="hero-panel-body">
        <div className="flow-row panel-animate">
          <div className="flow-node accent">
            <div className="flow-node-tag">Your Depop store</div>
            <div className="flow-node-title">Product listed at $85</div>
            <div className="flow-node-sub">Optimised listing · private niche</div>
          </div>
          <div className="flow-connector">
            <div className="flow-conn-line" />
            <div className="flow-conn-label">buyer purchases ↓</div>
          </div>
          <div className="flow-node">
            <div className="flow-node-tag">Step 2 — Sale received</div>
            <div className="flow-node-title">$85 lands in your account</div>
            <div className="flow-node-sub">Depop handles payment processing</div>
          </div>
          <div className="flow-connector">
            <div className="flow-conn-line" />
            <div className="flow-conn-label">you order from supplier ↓</div>
          </div>
          <div className="flow-node">
            <div className="flow-node-tag">Private supplier</div>
            <div className="flow-node-title">You pay $38 — they ship direct</div>
            <div className="flow-node-sub">No stock held · no warehouse needed</div>
          </div>
          <div className="flow-profit">
            <div>
              <div className="flow-profit-label">Your profit per sale</div>
              <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 2 }}>$85 − $38 cost</div>
            </div>
            <div className="flow-profit-num">$47 ✦</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const words = ["Turn", "Depop", "Into", "a"];
  return (
    <section className="hero">
      <div className="hero-bg-orb orb1" />
      <div className="hero-bg-orb orb2" />
      <div className="hero-line hero-line1" />
      <div className="hero-line hero-line2" />
      <div className="hero-grid">
        <div>
          <div className="hero-eyebrow">
            <div className="hero-eyebrow-line" />
            <span className="hero-eyebrow-text">Depop Dropshipping · Australia</span>
          </div>
          <h1 className="hero-h1">
            {words.map((w, i) => (
              <span key={w} className="word" style={{ animationDelay: `${0.1 + i * 0.08}s`, marginRight: "0.28em" }}>{w}</span>
            ))}
            <br />
            <em className="word" style={{ animationDelay: "0.44s" }}>Profitable Business.</em>
          </h1>
          <p className="hero-sub" style={{ animation: "wordReveal .8s .6s cubic-bezier(.16,1,.3,1) both" }}>
            We've helped 1200+ clients build real income on Depop. No guesswork. No theory.
            A practitioner-built system with a 100% success rate.
          </p>
          <div className="hero-actions" style={{ animation: "wordReveal .8s .75s cubic-bezier(.16,1,.3,1) both" }}>
            <a href="https://discord.gg/pVzjXumpbP" target="_blank" rel="noreferrer" className="btn-gold">
              Enrol Now <span>→</span>
            </a>
            <a href="#pricing" className="btn-ghost">View Pricing</a>
          </div>
          <div className="hero-stats" style={{ animation: "wordReveal .8s .9s cubic-bezier(.16,1,.3,1) both" }}>
            <div className="hero-stat">
              <div className="hero-stat-num">
                <StatCounter target={1200} suffix="+" />
              </div>
              <div className="hero-stat-label">Clients helped</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">
                <StatCounter target={100} suffix="%" />
              </div>
              <div className="hero-stat-label">Success rate</div>
            </div>
            <div className="hero-stat">
              <div className="hero-stat-num">
                $<StatCounter target={800} />
              </div>
              <div className="hero-stat-label">Avg monthly profit</div>
            </div>
          </div>
        </div>
        <div style={{ animation: "wordReveal .9s .5s cubic-bezier(.16,1,.3,1) both" }}>
          <HeroPanel />
        </div>
      </div>
      <div style={{ position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)" }}>
        <div className="scroll-indicator">
          <span>Scroll</span>
          <div className="scroll-indicator-arrow">↓</div>
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  return (
    <div className="marquee-wrap">
      <div className="marquee-track">
        {MARQUEE_ITEMS.map((item, i) => (
          <div key={i} className="marquee-item">
            <div className="marquee-dot" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function WhatIsDropshipping() {
  return (
    <section className="section" id="how-it-works">
      <div className="section-inner">
        <div className="ds-grid">
          <div className="ds-left">
            <FadeUp>
              <Eyebrow text="What is dropshipping?" />
              <h2 className="section-title">Sell products.<br />Never hold <em>stock.</em></h2>
              <p className="section-sub">
                Dropshipping is one of the simplest business models online — you list products,
                take orders, buy from a supplier, keep the margin. No warehouse. No upfront inventory.
                Depop makes it even more powerful: millions of active buyers, less competition than
                Amazon, and higher margins on the right products.
              </p>
            </FadeUp>
            <StaggerGrid className="ds-cards">
              {[
                { icon: "📦", title: "No inventory needed", desc: "Products ship direct from supplier to buyer. You're the middleman — and you keep the margin." },
                { icon: "📱", title: "Phone-based business", desc: "List products, manage orders, and grow your store entirely from your phone." },
                { icon: "💸", title: "Keep the difference", desc: "Buy low from private suppliers, sell higher on Depop. Clients average $300–$800/mo." },
                { icon: "🎯", title: "Why Depop?", desc: "Built-in audience of millions actively searching resale items. Less competition, better margins." },
              ].map((c) => (
                <div key={c.title} className="ds-card">
                  <div className="ds-card-icon">{c.icon}</div>
                  <h3>{c.title}</h3>
                  <p>{c.desc}</p>
                </div>
              ))}
            </StaggerGrid>
          </div>
          <div className="ds-right">
            <FadeUp delay={2}>
              <div style={{ marginBottom: 32 }}>
                <Eyebrow text="The process" />
                <h3 className="section-title" style={{ fontSize: 36 }}>How it works<br />step by <em>step.</em></h3>
              </div>
              <div className="ds-steps">
                {[
                  { n: "01", title: "Find a winning product", desc: "Our research system identifies high-demand products with strong Depop search volume and low supplier cost. We also send daily winning product drops." },
                  { n: "02", title: "List on your store", desc: "Create an optimised listing using our proven frameworks — titles, photos, pricing, and descriptions engineered to convert." },
                  { n: "03", title: "Customer buys from you", desc: "Depop handles payment. A buyer purchases your listing and the money hits your account." },
                  { n: "04", title: "Order from supplier", desc: "You buy the item from your private supplier at cost and they ship directly to your buyer. You pocket the difference." },
                  { n: "05", title: "Scale & compound", desc: "More listings, better niches, smarter pricing. Your income grows as you do — and our team scales with you." },
                ].map((s) => (
                  <div key={s.n} className="ds-step">
                    <div className="ds-step-num">{s.n}</div>
                    <div className="ds-step-content">
                      <h3>{s.title}</h3>
                      <p>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}

function About() {
  return (
    <section className="section about-section">
      <div className="section-inner">
        <div className="about-grid">
          <FadeUp>
            <Eyebrow text="About Sync Agency" />
            <h2 className="section-title">Built by a practitioner,<br />not a <em>guru.</em></h2>
            <blockquote className="about-quote">
              "We didn't learn this from a YouTube video. We built it, tested it,
              and refined it until it worked — then taught it to 1200+ clients."
            </blockquote>
            <p style={{ fontSize: 15, color: "var(--text-md)", lineHeight: 1.8 }}>
              Sync Agency was built from hands-on experience on Depop — not formal education,
              not theory. Every tactic in our system has been validated by real stores and real
              clients. That's why we have a 100% success rate. And that's why we're selective
              about who we work with.
            </p>
          </FadeUp>
          <FadeUp delay={2}>
            <div className="about-pillars">
              {[
                { n: "I", title: "Outcome-first", desc: "We don't sell courses — we sell results. Every part of our system is engineered to get your store profitable as fast as possible." },
                { n: "II", title: "Real numbers only", desc: "No fake screenshots. No inflated promises. Our clients average $300–$800/month. Some do more. None have done worse." },
                { n: "III", title: "We're in it with you", desc: "On every tier, you get direct access to us. We don't disappear after enrolment — we stay until your store is working." },
                { n: "IV", title: "Proven supplier network", desc: "Access to private suppliers our clients use every day. Lower costs, faster shipping, higher margins than anything public." },
              ].map((p) => (
                <div key={p.n} className="about-pillar">
                  <div className="about-pillar-num">{p.n}</div>
                  <div>
                    <h3>{p.title}</h3>
                    <p>{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </FadeUp>
        </div>
      </div>
    </section>
  );
}

// Stripe buy button as a React-compatible web component wrapper
function StripeBuyButton({ buyButtonId, publishableKey }) {
  const ref = useRef(null);

  useEffect(() => {
    // Inject Stripe script once globally
    if (!document.getElementById("stripe-buy-btn-script")) {
      const script = document.createElement("script");
      script.id = "stripe-buy-btn-script";
      script.src = "https://js.stripe.com/v3/buy-button.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // Use dangerouslySetInnerHTML to render the custom web component
  // because React doesn't natively support custom element attributes with hyphens
  return (
    <div
      ref={ref}
      className="stripe-btn-wrap"
      dangerouslySetInnerHTML={{
        __html: `<stripe-buy-button buy-button-id="${buyButtonId}" publishable-key="${publishableKey}"></stripe-buy-button>`,
      }}
    />
  );
}

function Pricing() {
  const [showCompare, setShowCompare] = useState(false);
  const [ref, visible] = useInView(0.05);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTier, setDrawerTier] = useState(null);

  return (
    <section className="section pricing-section" id="pricing">
      <div className="section-inner">
        <FadeUp>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 0" }}>
            <Eyebrow text="Pricing" />
            <h2 className="section-title">One system.<br />Three levels of <em>access.</em></h2>
            <p className="section-sub" style={{ margin: "16px auto 0" }}>
              All prices in AUD. Pay securely via Stripe, or join our Discord to ask questions first.
            </p>
          </div>
        </FadeUp>

        <div ref={ref} className={`pricing-grid stagger${visible ? " visible" : ""}`}>
          {TIERS.map((tier) => (
            <div key={tier.id} className={`price-card${tier.featured ? " featured" : ""}`}>
              {tier.featured && <div className="price-badge">Most Popular</div>}
              <div className="price-tier-label">{tier.tier}</div>
              <div className="price-name">{tier.name}</div>
              <div className="price-tagline">{tier.tagline}</div>
              <div className="price-amount-row">
                <span className="price-currency">$</span>
                <span className="price-amount">{tier.price}</span>
              </div>
              <div className="price-period">AUD — per month · 3-day free trial</div>
              <SpotsBadge spots={tier.spotsBase} />
              <div className="price-outcome">
                <strong style={{ color: "var(--gold)", fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Outcome: </strong>
                {tier.outcome}
              </div>
              <ul className="price-features">
                {tier.features.map((f) => <li key={f}>{f}</li>)}
              </ul>
              <button
                className="btn-gold price-cta-btn"
                onClick={() => { setDrawerTier(tier); setDrawerOpen(true); trackEvent("pricing_cta_click", { tier: tier.name }); }}
              >
                Choose Plan →
              </button>
              <a
                href="https://discord.gg/pVzjXumpbP"
                target="_blank"
                rel="noreferrer"
                className="price-discord-btn"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.033.057a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/></svg>
                Join Discord to discuss first
              </a>
            </div>
          ))}
        </div>

        <FadeUp>
          <div className="compare-wrap" style={{ marginTop: 40, maxWidth: "100%", overflowX: "auto" }}>
            <div className="compare-toggle" onClick={() => setShowCompare(v => !v)} style={{ cursor: "pointer" }}>
              <div className="compare-toggle-icon" style={{ transform: showCompare ? "rotate(45deg)" : "none", transition: "transform .3s" }}>+</div>
              <span className="compare-toggle-text">Compare all tiers side-by-side</span>
            </div>
            {showCompare && (
              <table className="compare-table">
                <thead>
                  <tr>
                    <th>Feature</th>
                    <th>Pro Accelerator — $79/mo</th>
                    <th>Elite Scale — $127/mo</th>
                    <th>VIP Inner Circle — $349/mo</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_ROWS.map((row) => (
                    <tr key={row.feature}>
                      <td>{row.feature}</td>
                      <td>{row.pro === "✓" ? <span className="check">✦</span> : row.pro === "—" ? <span className="dash">—</span> : row.pro}</td>
                      <td>{row.elite === "✓" ? <span className="check">✦</span> : row.elite === "—" ? <span className="dash">—</span> : row.elite}</td>
                      <td>{row.vip === "✓" ? <span className="check">✦</span> : row.vip === "—" ? <span className="dash">—</span> : row.vip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </FadeUp>
      </div>
      <CheckoutDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} tier={drawerTier} />
      <CheckoutSuccessNotification />
    </section>
  );
}

function Testimonials() {
  return (
    <section className="section" id="results">
      <div className="section-inner">
        <FadeUp>
          <Eyebrow text="Client results" />
          <h2 className="section-title">Real people.<br /><em>Real income.</em></h2>
          <p className="section-sub">These aren't handpicked outliers — this is the standard.</p>
        </FadeUp>
        <StaggerGrid className="testi-grid" style={{ marginTop: 56 }}>
          {TESTIMONIALS.map((t) => (
            <div key={t.initials} className="testi-card">
              <div className="testi-stars">★★★★★</div>
              <p className="testi-quote">"{t.quote}"</p>
              <div className="testi-divider" />
              <div className="testi-author">
                <div className="testi-avatar">{t.initials}</div>
                <div>
                  <div className="testi-name">{t.name}</div>
                  <div className="testi-meta">{t.meta}</div>
                  <div className="testi-result">{t.result}</div>
                </div>
              </div>
            </div>
          ))}
        </StaggerGrid>
      </div>
    </section>
  );
}

function FAQ() {
  const [open, setOpen] = useState(null);
  return (
    <section className="section" style={{ background: "var(--ink)" }} id="faq">
      <div className="section-inner">
        <div className="faq-grid">
          <div>
            <FadeUp>
              <Eyebrow text="FAQ" />
              <h2 className="section-title">Got questions?<br /><em>Good.</em></h2>
            </FadeUp>
            <div className="faq-list" style={{ marginTop: 48 }}>
              {FAQS.map((faq, i) => (
                <div key={i} className={`faq-item${open === i ? " open" : ""}`}>
                  <div className="faq-q" onClick={() => setOpen(open === i ? null : i)} style={{ cursor: "pointer" }}>
                    <span className="faq-q-text">{faq.q}</span>
                    <div className="faq-icon">+</div>
                  </div>
                  <div className="faq-a">{faq.a}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="faq-aside">
            <FadeUp delay={2}>
              <div className="faq-aside-card">
                <div className="faq-aside-label">Still unsure?</div>
                <h3>Ask us directly.</h3>
                <p>
                  Jump into our Discord and ask anything before you commit. We answer
                  every question — no sales pressure, no scripts. Just straight answers
                  from the people running the programme.
                </p>
                <a href="https://discord.gg/pVzjXumpbP" target="_blank" rel="noreferrer" className="btn-gold" style={{ display: "flex", width: "100%", justifyContent: "center" }}>
                  Join our Discord →
                </a>
                <div style={{ marginTop: 28, paddingTop: 24, borderTop: "1px solid var(--border)" }}>
                  {[
                    { label: "Response time", value: "< 2 hours" },
                    { label: "Clients enrolled", value: "1200+" },
                    { label: "Success rate", value: "100%" },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13 }}>
                      <span style={{ color: "var(--text-dim)" }}>{label}</span>
                      <span style={{ color: "var(--gold)", fontWeight: 600 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className="cta-section">
      <div className="cta-bg" />
      <div className="cta-border-top" />
      <div style={{ position: "relative", zIndex: 2 }}>
        <FadeUp>
          <Eyebrow text="Ready to start?" />
          <h2>Your store won't<br /><em>build itself.</em></h2>
          <p>
            1200+ clients in. Zero failures. The system works — the only question
            is whether you'll use it.
          </p>
          <div className="cta-btns">
            <a href="https://discord.gg/pVzjXumpbP" target="_blank" rel="noreferrer" className="btn-gold" style={{ fontSize: 15, padding: "18px 52px" }}>
              Enrol via Discord →
            </a>
            <a href="#pricing" className="btn-ghost">See Pricing</a>
          </div>
          <p className="discord-note">You'll be directed to our Discord to confirm your tier and get started.</p>
        </FadeUp>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer>
      <div className="footer-inner">
        <div className="footer-logo">Sync Agency</div>
        <div className="footer-links">
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#results">Results</a>
          <a href="#faq">FAQ</a>
          <a href="https://discord.gg/pVzjXumpbP" target="_blank" rel="noreferrer">Discord</a>
        </div>
        <div className="footer-copy">© 2025 Sync Agency · All prices AUD</div>
      </div>
    </footer>
  );
}

function RepSpreadsheet() {
  return (
    <>
      {/* Divider with label */}
      <div className="rep-divider" style={{ paddingTop: 0 }}>
        <div className="rep-divider-inner">
          <div className="rep-divider-line" />
          <div className="rep-divider-label">
            <span className="rep-divider-badge">Also Available from Sync Agency</span>
          </div>
        </div>
      </div>

      {/* Intro strip */}
      <div className="rep-intro section" style={{ paddingBottom: 0 }}>
        <div className="rep-intro-inner">
          <FadeUp>
            <Eyebrow text="The Rep Spreadsheet" />
            <h2 className="section-title">5,000+ sourcing links.<br />One <em>subscription.</em></h2>
            <p className="section-sub">
              Whether you're a dedicated reseller or sourcing products for your Depop dropshipping store —
              this spreadsheet is the unfair advantage. Access 5,000+ verified links for high-rep items,
              updated regularly, with direct supplier access built in.
            </p>
            <p style={{ fontSize: 14, color: "var(--text-dim)", marginTop: 16, lineHeight: 1.7 }}>
              Used by Sync Agency clients to accelerate product research and find items that convert.
              Skip hours of hunting — the work's already done.
            </p>
          </FadeUp>
          <StaggerGrid className="rep-intro-visual">
            {[
              { num: "5,000+", label: "Rep item links" },
              { num: "Monthly", label: "New additions" },
              { num: "Direct", label: "Supplier access" },
              { num: "Instant", label: "Access on subscribe" },
            ].map(({ num, label }, i) => (
              <div key={label} className={`rep-stat-tile${i === 3 ? "" : ""}`}>
                <div className="rep-stat-tile-num">{num}</div>
                <div className="rep-stat-tile-label">{label}</div>
              </div>
            ))}
          </StaggerGrid>
        </div>
      </div>

      {/* Card section */}
      <div className="rep-card-section">
        <div className="rep-card-section-inner">
          <div className="rep-card-wrap">
            <FadeUp>
              <Eyebrow text="What's included" />
              <h3 className="section-title" style={{ fontSize: "clamp(28px, 3vw, 44px)" }}>
                Everything a serious<br />reseller <em>needs.</em>
              </h3>
              <div className="rep-features-list">
                {[
                  { icon: "🔗", title: "5,000+ verified item links", desc: "Direct links to high-rep products across multiple supplier platforms. Curated, tested, and ready to list." },
                  { icon: "📋", title: "Categorised & searchable", desc: "Items are sorted by category so you can find exactly what you need fast — no wading through noise." },
                  { icon: "🔄", title: "Monthly updates", desc: "New items are added every month. The spreadsheet stays current with what's selling and what's trending." },
                  { icon: "💰", title: "Built for profit", desc: "Every link is selected with margins in mind. Ideal for Depop dropshippers sourcing products at scale." },
                  { icon: "⚡", title: "Instant access", desc: "Subscribe and you're in immediately. No waiting, no approval. Access is delivered automatically." },
                ].map((f) => (
                  <div key={f.title} className="rep-feature">
                    <div className="rep-feature-icon">{f.icon}</div>
                    <div>
                      <h3>{f.title}</h3>
                      <p>{f.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </FadeUp>

            <FadeUp delay={2}>
              <div className="rep-price-card">
                <div className="rep-price-card-label">Monthly Subscription</div>
                <div className="rep-price-card-name">The Rep Spreadsheet</div>
                <div className="rep-price-card-sub">5,000+ sourcing links for resellers & dropshippers. Updated monthly.</div>
                <div className="rep-price-row">
                  <span className="rep-price-currency">$</span>
                  <span className="rep-price-amount">47.95</span>
                </div>
                <div className="rep-price-period">AUD — billed monthly · cancel anytime</div>
                <div className="rep-price-outcome">
                  <strong style={{ color: "var(--gold)", fontWeight: 600, fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>You get: </strong>
                  Instant access to 5,000+ rep item links, updated every month.
                </div>
                <ul className="rep-includes">
                  <li>5,000+ high-rep item links</li>
                  <li>Direct supplier URLs</li>
                  <li>Monthly new additions</li>
                  <li>Categorised by product type</li>
                  <li>Usable for dropshipping & resale</li>
                  <li>Instant access on subscribe</li>
                </ul>
                <StripeBuyButton
                  buyButtonId="buy_btn_1TSuH2PDABwVk3W5i9KMVmIi"
                  publishableKey="pk_live_51TKIROPDABwVk3W5w51MmfawDKkAMsyEjGoK6ZA5PZeBalPsJc36lz8gcPkpXKqqROKuve95rUmS1JclAIwTpzZ900qOf5I2Ne"
                />
                <p className="rep-cancel-note">Cancel any time. No lock-in contracts.</p>
              </div>
            </FadeUp>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────
export default function App() {
  useEffect(() => {
    // Inject styles
    const styleEl = document.createElement("style");
    styleEl.textContent = css;
    document.head.appendChild(styleEl);
    return () => document.head.removeChild(styleEl);
  }, []);

  return (
    <>
      <div className="noise" aria-hidden="true" />
      <Cursor />
      <ExitIntentPopup />
      <StickyCTABar />
      <SocialProofTicker />
      <Nav />
      <Hero />
      <Marquee />
      <WhatIsDropshipping />
      <About />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTASection />
      <RepSpreadsheet />
      <Footer />
    </>
  );
}