import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { walletEnabled } from "../lib/walletFlag";
import { CRATES, crateForLevel, levelOf } from "../lib/rewards";
import * as fx from "../lib/crateFx";
import { BackIcon, RewardKindIcon, ShieldIcon, SoundIcon } from "../components/portal/RewardIcons";

const MUTE_KEY = "sync-crate-muted";
const SHAKE_MS = 1400;
const BURST_MS = 650;

// Crate faces, from the CrateOpen mockup
const FACES = {
  silver: { top: "oklch(84% 0.01 85)", lidFront: "oklch(68% 0.012 85)", lidRight: "oklch(54% 0.012 85)", front: "oklch(60% 0.012 85)", right: "oklch(44% 0.012 85)", band: "oklch(52% 0.09 70)", gem: "oklch(82% 0.14 86)", aura: "oklch(86% 0.012 85 / .3)", ray: "oklch(86% 0.012 85 / .18)" },
  gold: { top: "oklch(90% 0.08 88)", lidFront: "oklch(76% 0.13 84)", lidRight: "oklch(63% 0.12 76)", front: "oklch(70% 0.13 80)", right: "oklch(54% 0.11 72)", band: "oklch(24% 0.02 85)", gem: "oklch(97% 0.03 90)", aura: "oklch(78% 0.13 86 / .42)", ray: "oklch(78% 0.13 86 / .22)" },
};
const RARITY = { legendary: "Legendary", epic: "Epic", rare: "Rare", common: "Common" };

function rewardCopy(reward, shown) {
  const amount = reward.kind === "credit" ? reward.amount / 100 : reward.amount;
  return {
    credit: { value: `$${shown}`, unit: "", name: "Wallet credit", sub: "Added to your wallet. Spend it on your next stock order.", collect: `Collect $${amount}` },
    xp: { value: `+${shown}`, unit: "XP", name: "Bonus XP", sub: "Added to your level progress straight away.", collect: "Collect XP" },
    discount: { value: `${shown}%`, unit: "OFF", name: "Next stock order", sub: "Applied automatically at your next checkout.", collect: "Save discount" },
    slot: { value: `+${shown}`, unit: "SLOT", name: "Extra product slot", sub: "One more product in your store for 30 days.", collect: "Activate slot" },
  }[reward.kind];
}

function countTarget(reward) {
  return reward.kind === "credit" ? reward.amount / 100 : reward.amount;
}

function ago(iso) {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

// Burst particles, confetti and reveal stars (positions from the mockup)
const PARTICLES = Array.from({ length: 32 }, (_, i) => {
  const a = ((i * 360) / 32 + (i % 3) * 7) * (Math.PI / 180);
  const d = 150 + ((i * 47) % 110);
  const s = 5 + ((i * 7) % 9);
  return { i, s, dx: Math.round(Math.cos(a) * d), dy: Math.round(Math.sin(a) * d) };
});
const CONFETTI = Array.from({ length: 42 }, (_, j) => {
  const w = 6 + ((j * 5) % 6);
  return { j, w, h: j % 3 === 0 ? w : 10 + ((j * 3) % 8) };
});
const STARS = [["12%", 90, 22], ["84%", 70, 26], ["8%", 380, 16], ["90%", 360, 20], ["20%", 560, 14], ["78%", 580, 22], ["30%", 40, 12], ["68%", 130, 14]];

function CrateArt({ type, phase }) {
  const c = FACES[type];
  const lid = phase === "burst" ? "lid-fly" : "";
  return (
    <svg aria-hidden="true" viewBox="0 0 240 240">
      <defs>
        <linearGradient id="rw-inside" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "oklch(97% 0.04 90)" }} />
          <stop offset="1" style={{ stopColor: "var(--p-gold-bright)" }} />
        </linearGradient>
        <linearGradient id="rw-beam" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: "oklch(96% 0.05 90)" }} stopOpacity=".95" />
          <stop offset="1" style={{ stopColor: "var(--p-gold-bright)" }} stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className={phase === "burst" ? "body-out" : ""}>
        <polygon points="40,114 120,72 200,114 120,156" fill="url(#rw-inside)" />
        <polygon points="40,114 120,156 120,226 40,184" style={{ fill: c.front }} />
        <polygon points="120,156 200,114 200,184 120,226" style={{ fill: c.right }} />
        <polygon points="56,122.4 64,126.6 64,196.6 56,192.4" style={{ fill: c.band }} />
        <polygon points="96,143.4 104,147.6 104,217.6 96,213.4" style={{ fill: c.band }} />
        <polygon points="136,147.6 144,143.4 144,213.4 136,217.6" style={{ fill: c.band }} />
        <polygon points="176,126.6 184,122.4 184,192.4 176,196.6" style={{ fill: c.band }} />
        <polyline points="40,184 120,226 200,184" fill="none" stroke="#000" strokeOpacity=".25" strokeWidth="2" />
        <line x1="120" y1="156" x2="120" y2="226" stroke="#fff" strokeOpacity=".25" strokeWidth="1.5" />
        <polygon points="120,160 132,172 120,184 108,172" style={{ fill: c.band }} />
        <circle className="gem-pulse" cx="120" cy="172" r="6" style={{ fill: c.gem, filter: `drop-shadow(0 0 6px ${c.gem})` }} />
      </g>
      {(phase === "shake" || phase === "hold") && <polygon className="leak" points="50,112 120,146 190,112 236,-60 4,-60" fill="url(#rw-beam)" />}
      <g className={lid}>
        <polygon points="36,96 120,138 120,154 36,112" style={{ fill: c.lidFront }} />
        <polygon points="120,138 204,96 204,112 120,154" style={{ fill: c.lidRight }} />
        <polygon points="36,96 120,54 204,96 120,138" style={{ fill: c.top }} />
        <polygon points="56,106 64,110 64,126 56,122" style={{ fill: c.band }} />
        <polygon points="176,110 184,106 184,122 176,126" style={{ fill: c.band }} />
        <polygon points="56,86 64,82 148,124 140,128" style={{ fill: c.band }} />
        <polygon points="176,86 184,90 100,132 92,128" style={{ fill: c.band }} />
        <polyline points="36,96 120,54 204,96" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.5" />
        <polyline
          points="36,112 120,154 204,112"
          fill="none"
          style={{ stroke: "var(--p-gold-bright)" }}
          className={phase === "shake" ? "seam-glow" : ""}
          strokeOpacity={phase === "idle" ? ".25" : "1"}
          strokeWidth={phase === "hold" ? 9 : 2}
        />
      </g>
    </svg>
  );
}

export default function CratesPage() {
  const { profile } = useAuth();
  const [crates, setCrates] = useState(null);
  const [history, setHistory] = useState([]);
  const [odds, setOdds] = useState([]);
  const [level, setLevel] = useState(1);
  const [sel, setSel] = useState(0);
  const [phase, setPhase] = useState("idle"); // idle | shake | hold | burst | reveal
  const [reward, setReward] = useState(null);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState(null);
  const [muted, setMutedState] = useState(() => {
    try {
      return localStorage.getItem(MUTE_KEY) === "1";
    } catch {
      return false;
    }
  });
  const timers = useRef([]);

  function clearTimers() {
    timers.current.forEach((t) => {
      clearTimeout(t);
      clearInterval(t);
    });
    timers.current = [];
  }

  function load() {
    Promise.all([
      supabase.from("reward_crates").select("*").eq("member_id", profile.id).eq("status", "unopened").order("created_at"),
      supabase
        .from("reward_crates")
        .select("id, reward, opened_at")
        .eq("member_id", profile.id)
        .eq("status", "opened")
        .order("opened_at", { ascending: false })
        .limit(5),
      supabase.from("crate_odds").select("*").order("sort"),
      supabase.from("member_rewards").select("xp_total").eq("member_id", profile.id).maybeSingle(),
    ]).then(([{ data: open }, { data: pulls }, { data: o }, { data: mr }]) => {
      setCrates(open ?? []);
      setHistory(pulls ?? []);
      setOdds(o ?? []);
      setLevel(levelOf(mr?.xp_total ?? 0));
    });
  }

  useEffect(() => {
    fx.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    if (profile?.id && walletEnabled(profile)) load();
    return () => {
      clearTimers();
      fx.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (!walletEnabled(profile)) {
    return (
      <div className="portal-page">
        <div className="portal-empty">
          <p>Sync Rewards opens once your membership is active.</p>
        </div>
      </div>
    );
  }
  if (!crates) {
    return (
      <div className="portal-page">
        <p className="portal-sub">Loading crates…</p>
      </div>
    );
  }

  const crate = crates[sel] ?? null;
  const nextCrateLevel = Math.max(level + 1, 6);
  const type = crate?.crate_type ?? crateForLevel(nextCrateLevel);
  const info = CRATES[type];
  const typeOdds = odds.filter((o) => o.crate_type === type);
  const empty = crates.length === 0;
  const rarity = reward?.rarity ?? "legendary";

  function countUp(target) {
    if (target <= 1) {
      setShown(target);
      return;
    }
    let step = 0;
    const steps = 26;
    setShown(0);
    const t = setInterval(() => {
      step++;
      if (step % 2 === 0) fx.tick(step / steps);
      const eased = 1 - Math.pow(1 - step / steps, 3);
      setShown(step >= steps ? target : Math.max(1, Math.round(target * eased)));
      if (step >= steps) clearInterval(t);
    }, 38);
    timers.current.push(t);
  }

  async function open() {
    if (phase !== "idle" || !crate) return;
    setError(null);
    clearTimers();
    fx.tap();
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const started = Date.now();
    if (!reduced) {
      setPhase("shake");
      fx.shake(SHAKE_MS / 1000);
      // if the server is slower than the build-up, keep rattling at full size
      timers.current.push(setTimeout(() => setPhase((p) => (p === "shake" ? "hold" : p)), SHAKE_MS));
    }

    // The roll happens on the server; the screen only animates the result
    const { data: res, error: rpcErr } = await supabase.rpc("rewards_open_crate", { p_crate_id: crate.id });
    if (rpcErr || res?.status !== "opened") {
      clearTimers();
      fx.cancel();
      setPhase("idle");
      setError("Couldn't open the crate. Try again.");
      if (res?.status === "not_available") load();
      return;
    }
    const won = res.reward;
    setReward(won);

    if (reduced) {
      setShown(countTarget(won));
      setPhase("reveal");
      fx.reveal(won.rarity);
      return;
    }
    const wait = Math.max(0, SHAKE_MS - (Date.now() - started));
    timers.current.push(
      setTimeout(() => {
        setPhase("burst");
        fx.burst();
        timers.current.push(
          setTimeout(() => {
            setPhase("reveal");
            fx.reveal(won.rarity);
            countUp(countTarget(won));
          }, BURST_MS)
        );
      }, wait)
    );
  }

  function collect() {
    clearTimers();
    fx.coin();
    setHistory((h) => [{ id: crate.id, reward, opened_at: new Date().toISOString() }, ...h].slice(0, 5));
    setCrates((list) => list.filter((c) => c.id !== crate.id));
    setSel(0);
    setReward(null);
    setShown(0);
    setPhase("idle");
  }

  function toggleSound() {
    const m = !muted;
    setMutedState(m);
    try {
      localStorage.setItem(MUTE_KEY, m ? "1" : "0");
    } catch {
      // the toggle still works for this visit
    }
  }

  const copy = reward ? rewardCopy(reward, shown) : null;
  const opening = phase === "shake" || phase === "hold" || phase === "burst";
  const crateClass = phase === "idle" ? "crate-idle" : phase === "shake" ? "crate-shake" : phase === "hold" ? "crate-hold" : "";
  const face = FACES[type];

  return (
    <div className="portal-page">
      <div className="rw-page" style={{ gap: 20 }}>
        <div className="rw-head">
          <div>
            <Link to="/portal/rewards" className="rw-back">
              <BackIcon />
              Rewards
            </Link>
            <h1 className="rw-title" style={{ marginTop: 8 }}>
              Mystery crates
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="btn-ghost rw-sound-btn" onClick={toggleSound} aria-pressed={!muted}>
              <SoundIcon on={!muted} size={16} />
              {muted ? "Sound off" : "Sound on"}
            </button>
            <Link to="/portal/rewards/odds" className="btn-ghost">
              Odds
            </Link>
          </div>
        </div>

        <div className="rw-crate-cols">
          <section className={`rw-stage rarity-${rarity}${phase === "burst" ? " jolt" : ""}`} aria-live="polite">
            <div className="rw-stage-fade" aria-hidden="true" />
            <div className="rw-stage-pill">
              <span className={`rw-crate-pill is-${type}`}>
                <ShieldIcon size={12} />
                {info.name} crate · {info.top}
              </span>
            </div>

            {empty && phase === "idle" && (
              <div className="rw-empty">
                <span className="rw-empty-title">All crates opened</span>
                <p>
                  Your next {info.name} crate drops at Level {nextCrateLevel}. Every $100 of credit is a level.
                </p>
                <Link to="/portal/rewards/top-up" className="btn-gold rw-shine" style={{ marginTop: 8 }}>
                  Top up &amp; earn XP
                </Link>
              </div>
            )}

            {!empty && phase !== "reveal" && (
              <>
                <div
                  aria-hidden="true"
                  className={`rw-fx ${opening ? "aura-shake" : "gem-pulse"}`}
                  style={{ width: 520, height: 520, margin: "-260px 0 0 -260px", background: `radial-gradient(circle, ${face.aura} 0%, transparent 65%)` }}
                />
                <div
                  aria-hidden="true"
                  className="rw-fx rays-spin"
                  style={{
                    width: 1000,
                    height: 1000,
                    margin: "-500px 0 0 -500px",
                    opacity: 0.55,
                    background: `repeating-conic-gradient(from 0deg, ${face.ray} 0deg 4deg, transparent 4deg 15deg)`,
                    WebkitMaskImage: "radial-gradient(circle, #000 10%, transparent 52%)",
                    maskImage: "radial-gradient(circle, #000 10%, transparent 52%)",
                  }}
                />
                <div aria-hidden="true" className="rw-crate-shadow shadow-idle" />
                <div className="rw-crate-wrap">
                  <button className="crate-btn" aria-label={`Open the ${info.name} crate`} onClick={open} disabled={opening}>
                    <div className={crateClass}>
                      <CrateArt type={type} phase={phase} />
                    </div>
                  </button>
                </div>
              </>
            )}

            {phase === "burst" && (
              <>
                <div aria-hidden="true" className="rw-fx ring-wave" style={{ width: 220, height: 220, margin: "-110px 0 0 -110px", border: "5px solid var(--rc)", boxShadow: "0 0 60px var(--rc)" }} />
                <div aria-hidden="true" className="rw-fx" style={{ width: 0, height: 0 }}>
                  {PARTICLES.map((p) => {
                    const col = ["var(--p-gold-bright)", "var(--p-gold)", "var(--rc)", "oklch(97% 0.03 90)"][p.i % 4];
                    return (
                      <span
                        key={p.i}
                        className="particle"
                        style={{
                          left: 0,
                          top: 0,
                          width: p.s,
                          height: p.s,
                          margin: `-${p.s / 2}px 0 0 -${p.s / 2}px`,
                          background: col,
                          boxShadow: `0 0 10px ${col}`,
                          borderRadius: p.i % 2 ? "50%" : 0,
                          clipPath: p.i % 2 ? undefined : "polygon(50% 0, 100% 50%, 50% 100%, 0 50%)",
                          "--dx": `${p.dx}px`,
                          "--dy": `${p.dy}px`,
                          animationDelay: `${(p.i % 4) * 0.03}s`,
                        }}
                      />
                    );
                  })}
                </div>
                <div aria-hidden="true" className="flash" style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(circle at 50% 42%, oklch(99% 0.02 90) 0%, var(--rc) 35%, transparent 75%)" }} />
              </>
            )}

            {phase === "reveal" && reward && (
              <>
                <div
                  aria-hidden="true"
                  className={`rw-fx ${rarity === "legendary" ? "rays-fast" : "rays-spin"}`}
                  style={{
                    width: 1200,
                    height: 1200,
                    margin: "-600px 0 0 -600px",
                    opacity: { legendary: 0.95, epic: 0.8, rare: 0.6, common: 0.45 }[rarity],
                    background: "repeating-conic-gradient(from 0deg, var(--rc) 0deg 6deg, transparent 6deg 18deg)",
                    WebkitMaskImage: "radial-gradient(circle, #000 8%, transparent 50%)",
                    maskImage: "radial-gradient(circle, #000 8%, transparent 50%)",
                  }}
                />
                <div aria-hidden="true" className="rw-fx" style={{ width: 640, height: 640, margin: "-320px 0 0 -320px", background: "radial-gradient(circle, var(--rc-glow) 0%, transparent 62%)" }} />
                <div className="rw-confetti-layer" aria-hidden="true">
                  {CONFETTI.map((c) => (
                    <span
                      key={c.j}
                      className="confetti"
                      style={{
                        left: `${(c.j * 29) % 100}%`,
                        width: c.w,
                        height: c.h,
                        background: ["var(--p-gold-bright)", "var(--p-gold)", "var(--rc)", "var(--silver)", "var(--p-gold-deep)"][c.j % 5],
                        borderRadius: c.j % 3 === 0 ? "50%" : 2,
                        "--dur": `${2.8 + (c.j % 5) * 0.4}s`,
                        "--delay": `-${((c.j * 0.37) % 3.2).toFixed(2)}s`,
                        "--sway": `${(c.j % 2 ? 1 : -1) * (20 + (c.j % 40))}px`,
                        "--spin": `${360 + (c.j % 4) * 180}deg`,
                      }}
                    />
                  ))}
                </div>
                {STARS.map(([left, top, size], k) => (
                  <svg
                    key={k}
                    aria-hidden="true"
                    className="twinkle"
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    style={{ position: "absolute", left, top, fill: "var(--rc)", animationDelay: `${k * 0.25}s` }}
                  >
                    <path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z" />
                  </svg>
                ))}

                <div className="rw-reward-card card-pop">
                  <span className="rw-reward-rarity">
                    {RARITY[rarity]} · {Number(reward.chance)}% chance
                  </span>
                  <span className="rw-reward-icon rise">
                    <RewardKindIcon kind={reward.kind} size={38} />
                  </span>
                  <div className="rw-reward-value value-pop">
                    <span className="shimmer-text">{copy.value}</span>
                    {copy.unit && <span className="rw-reward-unit">{copy.unit}</span>}
                  </div>
                  <span className="rw-reward-name rise">{copy.name}</span>
                  <span className="rw-reward-sub rise">{copy.sub}</span>
                </div>
              </>
            )}

            <div className="rw-stage-foot">
              {phase === "idle" && !empty && (
                <>
                  <span className="rw-tap tap-hint">Tap the crate to open</span>
                  <button className="btn-gold rw-shine rw-stage-btn" onClick={open}>
                    Open {info.name} crate
                  </button>
                  {error && <p className="rw-error">{error}</p>}
                </>
              )}
              {opening && <span className="rw-opening">Opening…</span>}
              {phase === "reveal" && (
                <div className="rw-stage-actions rise">
                  <button className="btn-gold rw-shine rw-stage-btn" onClick={collect}>
                    {copy.collect}
                  </button>
                  {crates.length <= 1 && (
                    <Link to="/portal/rewards" className="btn-ghost" onClick={() => fx.coin()} style={{ textAlign: "center" }}>
                      Back to rewards
                    </Link>
                  )}
                </div>
              )}
            </div>
          </section>

          <aside className="rw-crate-aside">
            <section className="dash-card rw-aside-card">
              <div className="rw-section-head">
                <h2>Your crates</h2>
                <span className="rw-note">{crates.length} to open</span>
              </div>
              {crates.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  className={`rw-q-item${i === sel ? " is-on" : ""}`}
                  aria-pressed={i === sel}
                  disabled={phase !== "idle"}
                  onClick={() => setSel(i)}
                >
                  <span className={`rw-q-icon${c.crate_type === "gold" ? " is-gold" : ""}`}>
                    <RewardKindIcon kind="crate" />
                  </span>
                  <span className="rw-q-text">
                    {CRATES[c.crate_type].name} crate
                    <small>{c.source === "welcome" ? "Welcome to Sync Rewards" : `Earned at Level ${c.earned_level}`}</small>
                  </span>
                  <span className="rw-q-top">{c.crate_type === "gold" ? "Up to $50" : "Up to $30"}</span>
                </button>
              ))}
              {empty && <span className="rw-note">No crates waiting. Level up to earn more.</span>}
            </section>

            <section className="dash-card rw-aside-card">
              <div className="rw-section-head">
                <h2>{info.name} crate odds</h2>
                <Link to="/portal/rewards/odds" className="rw-note" style={{ textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 600, fontSize: 11 }}>
                  All
                </Link>
              </div>
              {typeOdds.map((o) => (
                <div key={o.key} className={`rw-odds-row rarity-${o.rarity} is-${o.rarity}`}>
                  <span className="rw-odds-label">
                    <span className="rw-dot" />
                    <span>{o.label}</span>
                  </span>
                  <span className="rw-odds-bar">
                    <span style={{ width: `${Math.min(100, (Number(o.chance) / 20) * 100)}%` }} />
                  </span>
                  <span className="rw-odds-pct">{Number(o.chance)}%</span>
                </div>
              ))}
            </section>

            {history.length > 0 && (
              <section className="dash-card rw-aside-card">
                <h2>Recent pulls</h2>
                {history.map((h) => (
                  <div key={h.id} className={`rw-pull rarity-${h.reward?.rarity}`}>
                    <span className="rw-dot" />
                    <span>{h.reward?.label}</span>
                    <small>{ago(h.opened_at)}</small>
                  </div>
                ))}
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
