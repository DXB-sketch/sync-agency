import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { walletEnabled } from "../lib/walletFlag";
import { isNativeApp } from "../lib/nativeApp";
import * as fx from "../lib/crateFx";
import { RANKS, levelOf, num, rankByKey, rankOf, topupXp } from "../lib/rewards";
import Icon from "../components/portal/Icon";
import { ShieldIcon, RewardKindIcon } from "../components/portal/RewardIcons";
import { CrateArt } from "./CratesPage";
import { TOURS, TutorialContext, deskCopy } from "./tutorialSteps";

// First-run tutorials: live coach marks over the real screens (sync-update/3-tutorials).
// Anything that would cost money, add stock or roll real odds is practice here:
// this file never calls Stripe, wallet-topup, open-crate, or writes any rewards,
// wallet, crate, cart, order or pathway row. The only write is the "seen" flag.

const MUTE_KEY = "sync-crate-muted";
const PACK_CENTS = 50000;
const UNLOCK = {
  silver: "the Elite Scale course",
  gold: "priority stock drops",
  platinum: "the VIP Inner Circle course",
  black: "the Founders' mastermind",
};
const TRACK = ["Paid", "Sourcing", "Shipped", "Delivered"];
const HAND =
  "M24 4c3.3 0 6 2.7 6 6v18.5l1.6-.8c2.6-1.2 5.7-.2 7 2.3l.6 1.2 1.7-.8c2.6-1.1 5.6 0 6.8 2.5l.5 1 1.3-.5c3-1.1 6.3 1.1 6.3 4.3V50c0 8.3-6.7 14-15 14h-5.5c-5.1 0-9.6-2.6-12.3-6.9L8.4 39.8c-1.6-2.7-.8-6.1 1.8-7.7 2.5-1.5 5.7-.9 7.5 1.4l.3.4V10c0-3.3 2.7-6 6-6z";

const isPhone = () => isNativeApp() || window.matchMedia("(max-width: 768px)").matches;
const reducedMotion = () => !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Burst particles for the practice crate (same recipe as the real crate screen)
const PARTICLES = Array.from({ length: 32 }, (_, i) => {
  const a = ((i * 360) / 32 + (i % 3) * 7) * (Math.PI / 180);
  const d = 150 + ((i * 47) % 110);
  return { i, s: 5 + ((i * 7) % 9), dx: Math.round(Math.cos(a) * d), dy: Math.round(Math.sin(a) * d) };
});

// Finds the visible element carrying data-tut={name}, keeps measuring it so the
// spotlight follows late renders and scrolling, and scrolls it into view once.
function useTarget(name) {
  const [found, setFound] = useState(null);
  useLayoutEffect(() => {
    if (!name) return;
    let scrolled = false;
    function measure() {
      const el = [...document.querySelectorAll(`[data-tut="${name}"]`)].find(
        (e) => e.offsetWidth > 0 || e.offsetHeight > 0
      );
      if (!el) {
        setFound(null);
        return;
      }
      if (!scrolled) {
        el.scrollIntoView({ block: "center", behavior: "auto" });
        scrolled = true;
      }
      const r = el.getBoundingClientRect();
      const radius = getComputedStyle(el).borderRadius;
      setFound((prev) =>
        prev && prev.el === el && prev.top === r.top && prev.left === r.left && prev.width === r.width && prev.height === r.height
          ? prev
          : { el, top: r.top, left: r.left, width: r.width, height: r.height, radius }
      );
    }
    measure();
    const t = setInterval(measure, 200);
    return () => {
      clearInterval(t);
      setFound(null);
    };
  }, [name]);
  return name ? found : null;
}

function Recap({ items }) {
  return (
    <div className="tut-recap">
      {items.map(([icon, label], i) => (
        <div key={label} style={{ display: "contents" }}>
          {i > 0 && <Icon name="arrow" size={18} className="tut-recap-arrow" />}
          <span className="tut-recap-item">
            <span className="tut-recap-icon">
              <Icon name={icon} size={22} />
            </span>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}

function Spotlight({ target, label, onTap }) {
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
  }, [target.el]);
  const PAD = 6;
  const nearBottom = target.top + target.height + 70 > window.innerHeight;
  return (
    <button
      ref={ref}
      type="button"
      className="tut-spot"
      aria-label={label}
      style={{
        top: target.top - PAD,
        left: target.left - PAD,
        width: target.width + PAD * 2,
        height: target.height + PAD * 2,
        borderRadius: target.radius && target.radius !== "0px" ? `calc(${target.radius} + ${PAD}px)` : 16,
      }}
      onClick={() => onTap(target.el)}
    >
      <span className="tut-ping" />
      <span className={`tut-hand ${nearBottom ? "hand-tr" : "hand-br"}`} aria-hidden="true">
        <svg viewBox="0 0 64 64">
          <path d={HAND} fill="#fffaf0" stroke="#1d1a14" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      </span>
    </button>
  );
}

export function TutorialProvider({ children }) {
  const { profile, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [tour, setTour] = useState(null); // { kind, step: 0 | n | "finish" }
  const [cheer, setCheer] = useState(null);
  const [sim, setSim] = useState({});
  const [member, setMember] = useState(null); // rewards tour inputs, read only
  const [seenLocal, setSeenLocal] = useState({});
  const [missingFor, setMissingFor] = useState(null);
  const timers = useRef([]);
  const phone = isPhone();

  const clearTimers = () => {
    timers.current.forEach((t) => {
      clearTimeout(t);
      clearInterval(t);
    });
    timers.current = [];
  };
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));
  const go = (step) => setTour((t) => (t ? { ...t, step } : t));

  const start = useCallback(
    (kind) => {
      clearTimers();
      try {
        fx.setMuted(localStorage.getItem(MUTE_KEY) === "1");
      } catch {
        // sound stays on
      }
      setSim({});
      setCheer(null);
      setTour({ kind, step: 0 });
      navigate(kind === "rewards" ? "/portal/rewards" : "/portal");
      if (kind === "rewards" && profile?.id) {
        supabase
          .from("member_rewards")
          .select("xp_total, lifetime_credit_cents, rank")
          .eq("member_id", profile.id)
          .maybeSingle()
          .then(({ data }) =>
            setMember({
              xp: data?.xp_total ?? 0,
              credit: data?.lifetime_credit_cents ?? 0,
              rank: data?.rank ?? "bronze",
            })
          );
      }
    },
    [navigate, profile?.id]
  );

  const end = useCallback(() => {
    clearTimers();
    fx.cancel();
    setCheer(null);
    setSim({});
    if (tour) {
      setSeenLocal((s) => ({ ...s, [tour.kind]: true }));
      supabase.rpc("mark_tour_seen", { p_tour: tour.kind }).then(() => refreshProfile?.());
    }
    setTour(null);
  }, [tour, refreshProfile]);

  useEffect(() => () => clearTimers(), []);

  // First visit: the Portal tour on the dashboard, then the Rewards tour the
  // first time Rewards opens. "Seen" lives on the member's profile, not the device.
  useEffect(() => {
    if (!profile || tour || profile.role === "admin") return;
    const portalSeen = !!profile.portal_tour_seen_at || seenLocal.portal;
    const rewardsSeen = !!profile.rewards_tour_seen_at || seenLocal.rewards;
    let kind = null;
    if (!portalSeen && location.pathname === "/portal") kind = "portal";
    else if (portalSeen && !rewardsSeen && location.pathname === "/portal/rewards" && walletEnabled(profile)) kind = "rewards";
    if (!kind) return;
    const t = setTimeout(() => start(kind), 700);
    return () => clearTimeout(t);
  }, [profile, tour, seenLocal, location.pathname, start]);

  useEffect(() => {
    if (!tour) return;
    const onKey = (e) => e.key === "Escape" && end();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [tour, end]);

  function cheerThen(word, sub, after) {
    fx.reveal("common");
    setCheer({ word, sub });
    later(() => {
      setCheer(null);
      after();
    }, 900);
  }

  function tapPortal(step, el) {
    if (step === 1) {
      fx.tap();
      navigate("/portal/pathway");
      go(2);
    } else if (step === 2) {
      fx.tap();
      if (el) {
        el.click();
        go(3);
      } else go(4);
    } else if (step === 3) {
      // Practice: the member's real step is not completed
      fx.tap();
      cheerThen("Nice!", "Next step unlocked", () => {
        document.querySelector('[data-tut="panel-close"]')?.click();
        go(4);
      });
    } else if (step === 4) {
      fx.tap();
      navigate("/portal/products");
      go(5);
    } else if (step === 5) {
      // Practice: nothing goes into the real order
      fx.coin();
      setSim((s) => ({
        ...s,
        added: true,
        itemName: el?.dataset.name || "Your sold item",
        itemPrice: el?.dataset.price ? Number(el.dataset.price) : null,
      }));
      go(6);
    } else if (step === 6) {
      fx.tap();
      navigate("/portal/checkout");
      setSim((s) => ({ ...s, checkout: true }));
      go(7);
    } else if (step === 7) {
      // Practice: nothing is charged; the tracker only plays the stages
      fx.coin();
      setSim((s) => ({ ...s, paid: true, trackAt: 0 }));
      [1, 2, 3].forEach((k) =>
        later(() => {
          fx.tick(k / 3);
          setSim((s) => ({ ...s, trackAt: k }));
        }, k * 450)
      );
      later(
        () =>
          cheerThen("Shipped!", "We send it to your buyer", () => {
            setSim((s) => ({ ...s, checkout: false, added: false }));
            go(8);
          }),
        1700
      );
    } else if (step === 8) {
      fx.tap();
      navigate(phone ? "/portal/more" : "/portal/support");
      cheerThen("Found it!", phone ? "Support lives in More" : "The Sync team replies here", () => go("finish"));
    }
  }

  function openPracticeCrate() {
    if (reducedMotion()) {
      fx.reveal("legendary");
      setSim((s) => ({ ...s, crate: "reveal", shown: 50 }));
      go(5);
      return;
    }
    fx.tap();
    fx.shake(1.4);
    setSim((s) => ({ ...s, crate: "shake" }));
    later(() => {
      setSim((s) => ({ ...s, crate: "burst" }));
      fx.burst();
    }, 1400);
    later(() => {
      setSim((s) => ({ ...s, crate: "reveal", shown: 0 }));
      fx.reveal("legendary");
      let n = 0;
      const t = setInterval(() => {
        n += 2;
        if (n % 4 === 0) fx.tick(n / 50);
        setSim((s) => ({ ...s, shown: Math.min(n, 50) }));
        if (n >= 50) {
          clearInterval(t);
          go(5);
        }
      }, 30);
      timers.current.push(t);
    }, 2050);
  }

  function tapRewards(step) {
    if (step === 1) {
      fx.tap();
      cheerThen("Nice!", "That bar is your XP", () => go(2));
    } else if (step === 2) {
      fx.tap();
      setSim((s) => ({ ...s, practice: true }));
      navigate("/portal/rewards/top-up");
      go(3);
    } else if (step === 3) {
      fx.tap();
      fx.coin();
      setSim((s) => ({ ...s, preview: true }));
      later(() => fx.reveal("epic"), 350);
      later(() => {
        setSim((s) => ({ ...s, preview: false, crate: "idle" }));
        go(4);
      }, reducedMotion() ? 1800 : 2600);
    } else if (step === 4) {
      openPracticeCrate();
    } else if (step === 5) {
      fx.coin();
      cheerThen("Nice!", "That's how crates work", () => {
        setSim((s) => ({ ...s, crate: null }));
        go("finish");
      });
    }
  }

  const steps = tour ? TOURS[tour.kind] : null;
  const def = tour && typeof tour.step === "number" && tour.step > 0 ? steps[tour.step] : null;
  // Nothing to spotlight while a cheer, a preview or an animation is playing
  const busy =
    !!cheer ||
    sim.preview ||
    (tour?.kind === "portal" && tour.step === 7 && sim.paid) ||
    (tour?.kind === "rewards" && tour.step === 4 && sim.crate !== "idle");
  const targetName = def && !busy ? (phone ? def.t : def.d ?? def.t) : null;
  const target = useTarget(targetName);

  // If the target never shows (no products yet, pathway finished…) offer a way on
  useEffect(() => {
    if (!targetName) return;
    const t = setTimeout(() => setMissingFor(targetName), 2500);
    return () => clearTimeout(t);
  }, [targetName]);
  const missing = !!targetName && missingFor === targetName;

  function onTap(el) {
    if (!tour || busy) return;
    if (tour.kind === "portal") tapPortal(tour.step, el);
    else tapRewards(tour.step);
  }

  const big = def ? (phone ? def.big : def.bigDesk ?? deskCopy(def.big)) : "";
  const small = def ? (phone ? def.small : def.smallDesk ?? deskCopy(def.small)) : "";
  const cardPos = target && target.top + target.height / 2 > window.innerHeight / 2 ? "top" : "bottom";

  // Rewards preview numbers: the member's real XP and lifetime credit, plus the $500 pack
  const pv = member && {
    gain: topupXp(PACK_CENTS),
    level: levelOf(member.xp),
    toLevel: levelOf(member.xp + topupXp(PACK_CENTS)),
    rank: rankByKey(member.rank),
    toRank: rankOf(member.credit + PACK_CENTS),
  };
  const rankUp = pv && RANKS.indexOf(pv.toRank) > RANKS.findIndex((r) => r.key === pv.rank.key);

  const ctx = {
    start,
    active: !!tour,
    kind: tour?.kind ?? null,
    step: tour?.step ?? null,
    sim,
    practiceLine: pv ? (rankUp ? `Would take you to ${pv.toRank.name}` : `Would take you to Level ${pv.toLevel}`) : null,
  };

  return (
    <TutorialContext.Provider value={ctx}>
      {children}
      {tour && (
        <div className="tut-root" role="dialog" aria-modal="true" aria-label={tour.kind === "rewards" ? "Sync Rewards tutorial" : "Portal tutorial"}>
          {/* Practice checkout (portal step 7) */}
          {tour.kind === "portal" && sim.checkout && (
            <div className="tut-sheet">
              <div className="tut-sheet-card">
                <span className="tut-practice" style={{ alignSelf: "flex-start" }}>
                  Practice mode · no payment
                </span>
                <h2 className="tut-sheet-title">Checkout</h2>
                <div className="tut-item">
                  <strong>{sim.itemName}</strong>
                  {sim.itemPrice != null && <span>${sim.itemPrice.toFixed(2)} AUD</span>}
                </div>
                <div className="tut-field">
                  <span>Buyer's name</span>
                  <span>Alex Buyer</span>
                </div>
                <div className="tut-field">
                  <span>Buyer's address</span>
                  <span>12 Example St, Sydney NSW 2000</span>
                </div>
                {!sim.paid ? (
                  <button type="button" className="btn-gold" data-tut="tour-pay" style={{ width: "100%" }}>
                    Pay
                  </button>
                ) : (
                  <div className="tut-track" aria-live="polite">
                    {TRACK.map((label, i) => (
                      <span key={label} className={`tut-track-step${i <= sim.trackAt ? " hit" : ""}`}>
                        <i />
                        {label}
                      </span>
                    ))}
                  </div>
                )}
                <span className="t-small" style={{ color: "var(--text-2)", fontSize: 13 }}>
                  This is practice. Nothing is charged or ordered.
                </span>
              </div>
            </div>
          )}

          {/* Practice crate (rewards steps 4–5) */}
          {tour.kind === "rewards" && sim.crate && (
            <div className="tut-crate-screen">
              <section className={`rw-stage rarity-legendary${sim.crate === "burst" ? " jolt" : ""}`} aria-live="polite">
                <div className="rw-stage-fade" aria-hidden="true" />
                <div className="rw-stage-pill">
                  <span className="tut-practice">Practice crate</span>
                </div>
                {sim.crate !== "reveal" && (
                  <>
                    <div aria-hidden="true" className="rw-crate-shadow shadow-idle" />
                    <div className="rw-crate-wrap">
                      <button type="button" className="crate-btn" data-tut="tour-crate" aria-label="Open the practice crate">
                        <div className={sim.crate === "idle" ? "crate-idle" : sim.crate === "shake" ? "crate-shake" : ""}>
                          <CrateArt type="gold" phase={sim.crate} />
                        </div>
                      </button>
                    </div>
                  </>
                )}
                {sim.crate === "burst" && (
                  <>
                    <div aria-hidden="true" className="rw-fx ring-wave" style={{ width: 220, height: 220, margin: "-110px 0 0 -110px", border: "5px solid var(--rc)", boxShadow: "0 0 60px var(--rc)" }} />
                    <div aria-hidden="true" className="rw-fx" style={{ width: 0, height: 0 }}>
                      {PARTICLES.map((p) => (
                        <span
                          key={p.i}
                          className="particle"
                          style={{
                            left: 0,
                            top: 0,
                            width: p.s,
                            height: p.s,
                            margin: `-${p.s / 2}px 0 0 -${p.s / 2}px`,
                            background: "var(--rc)",
                            borderRadius: "50%",
                            "--dx": `${p.dx}px`,
                            "--dy": `${p.dy}px`,
                          }}
                        />
                      ))}
                    </div>
                    <div aria-hidden="true" className="flash" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 50% 42%, oklch(99% 0.02 90) 0%, var(--rc) 35%, transparent 75%)" }} />
                  </>
                )}
                {sim.crate === "reveal" && (
                  <div className="rw-reward-card card-pop">
                    <span className="rw-reward-rarity">Legendary · Practice crate</span>
                    <span className="rw-reward-icon rise">
                      <RewardKindIcon kind="credit" size={38} />
                    </span>
                    <div className="rw-reward-value value-pop">
                      <span className="shimmer-text">${sim.shown ?? 0}</span>
                    </div>
                    <span className="rw-reward-name rise">Wallet credit</span>
                    <span className="rw-reward-sub rise">Practice only. Nothing is added. Real crates use the odds in the app.</span>
                  </div>
                )}
                <div className="rw-stage-foot">
                  {sim.crate === "idle" && <span className="rw-tap">Tap the crate to open</span>}
                  {sim.crate === "reveal" && (
                    <button type="button" className="btn-gold" data-tut="tour-collect" style={{ minWidth: 240 }}>
                      Got it
                    </button>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* Everything else is blocked: the only way on is the spotlight */}
          {tour.step !== 0 && tour.step !== "finish" && <div className={`tut-block${target && !busy ? "" : " dim"}`} />}
          {target && !busy && <Spotlight target={target} label={big} onTap={onTap} />}

          {def && !busy && (target || missing) && (
            <div className={`tut-card ${cardPos}${phone ? "" : " desk"}`} role="status">
              <span className="tut-icon">
                <Icon name={def.icon} size={28} strokeWidth={2.2} />
              </span>
              <span className="tut-copy">
                <span className="tut-steps" aria-label={`Part ${def.part} of 5`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className={`tut-dot${i < def.part ? " done" : i === def.part ? " now" : ""}`} />
                  ))}
                </span>
                <span className="tut-big">{big}</span>
                <span className="tut-small">{small}</span>
                {!target && missing && (
                  <button type="button" className="btn-ghost btn-sm tut-continue" onClick={() => onTap(null)}>
                    Continue
                  </button>
                )}
              </span>
            </div>
          )}

          {tour.step !== 0 && tour.step !== "finish" && (
            <button type="button" className="tut-skip" onClick={end}>
              Skip
            </button>
          )}

          {cheer && (
            <div className="tut-cheer" role="status">
              <span className="tut-cheer-badge">
                <Icon name="check" size={52} strokeWidth={3} />
              </span>
              <span className="tut-cheer-word">{cheer.word}</span>
              <span className="tut-cheer-sub">{cheer.sub}</span>
            </div>
          )}

          {/* $500 pack preview: what it would do, with the member's real numbers */}
          {sim.preview && pv && (
            <div className="tut-preview" role="status">
              <div className="tut-rays" aria-hidden="true" />
              <span className="tut-practice" style={{ position: "relative" }}>
                Preview · nothing is charged
              </span>
              <span className="tut-preview-xp" style={{ position: "relative" }}>
                +{num(pv.gain)} XP
              </span>
              <span className="tut-preview-level" style={{ position: "relative" }}>
                This pack would take you to Level {pv.toLevel}
              </span>
              <span className="tut-preview-rank" style={{ position: "relative" }}>
                <span className={`rw-rank-pill rw-rank-${pv.toRank.key}`}>
                  <ShieldIcon size={11} />
                  {pv.toRank.name} rank
                </span>
                {rankUp && UNLOCK[pv.toRank.key] && <span className="tut-preview-note">Would unlock {UNLOCK[pv.toRank.key]}</span>}
                <span className="tut-preview-note">You're still Level {pv.level}. This was a preview.</span>
              </span>
            </div>
          )}

          {tour.step === 0 && (
            <div className="tut-modal">
              <div className="tut-modal-card">
                <span className="tut-icon" style={{ width: 64, height: 64 }}>
                  <Icon name={tour.kind === "rewards" ? "rewards" : "home"} size={32} strokeWidth={2} />
                </span>
                <h2 className="tut-modal-title">{tour.kind === "rewards" ? "Welcome to Sync Rewards" : "Welcome to Sync"}</h2>
                <p className="tut-modal-sub">
                  {tour.kind === "rewards"
                    ? "Top up, level up, open crates. Let's try it. It takes 30 seconds."
                    : "Here's how your store works, in five taps."}
                </p>
                <button
                  type="button"
                  className="btn-gold tut-go"
                  autoFocus
                  onClick={() => {
                    fx.tap();
                    go(1);
                  }}
                >
                  {tour.kind === "rewards" ? "Let's go" : "Show me"}
                </button>
                <button type="button" className="tut-later" onClick={end}>
                  Skip for now
                </button>
              </div>
            </div>
          )}

          {tour.step === "finish" && (
            <div className="tut-modal">
              <div className="tut-modal-card">
                <h2 className="tut-modal-title">{tour.kind === "rewards" ? "You're ready!" : "You've got it!"}</h2>
                {tour.kind === "rewards" ? (
                  <>
                    <Recap items={[["wallet", "Top up"], ["bolt", "Level up"], ["box", "Open crates"]]} />
                    <p className="tut-modal-note">This was practice. Nothing was charged or added.</p>
                  </>
                ) : (
                  <>
                    <Recap items={[["pathway", "Do a step"], ["products", "Made a sale?"], ["truck", "Pay & ship"]]} />
                    {phone && <p className="tut-modal-sub">Pathway and Support are both in More.</p>}
                  </>
                )}
                <button
                  type="button"
                  className="btn-gold tut-go"
                  autoFocus
                  onClick={() => {
                    fx.tap();
                    navigate(tour.kind === "rewards" ? "/portal/rewards" : "/portal");
                    end();
                  }}
                >
                  {tour.kind === "rewards" ? "Start earning" : "Start my next step"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </TutorialContext.Provider>
  );
}
