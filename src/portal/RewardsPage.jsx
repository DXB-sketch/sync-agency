import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { walletEnabled } from "../lib/walletFlag";
import { TIERS, tierRank } from "../lib/tiers";
import {
  LEVEL_XP,
  PACKS,
  RANKS,
  STREAK_BONUS,
  STREAK_WEEKS,
  XP_PER_DOLLAR,
  crateForLevel,
  dollars,
  levelOf,
  nextRank,
  num,
  rankByKey,
  rewardsAtLevel,
} from "../lib/rewards";
import RankUpModal from "../components/portal/RankUpModal";
import { BoltIcon, CrateIcon, CreditIcon, PlusIcon, RewardKindIcon, ShieldIcon, StarIcon } from "../components/portal/RewardIcons";

const RING_C = 2 * Math.PI * 76;

// What a level on the track is called
function trackName(level, profileTier) {
  const items = rewardsAtLevel(level);
  const rank = items.find((i) => i.kind === "rank");
  if (rank) {
    const r = rankByKey(rank.rank);
    return r.course && tierRank(r.course) > tierRank(profileTier) ? TIERS[r.course].name : `${r.name} rank`;
  }
  return items.map((i) => i.label).join(" + ") || "Level up";
}

export default function RewardsPage() {
  const { profile } = useAuth();
  const [params] = useSearchParams();
  const justToppedUp = params.get("topup") === "1";
  const [data, setData] = useState(null);

  function load() {
    Promise.all([
      supabase.from("member_rewards").select("*").eq("member_id", profile.id).maybeSingle(),
      supabase
        .from("reward_crates")
        .select("id", { count: "exact", head: true })
        .eq("member_id", profile.id)
        .eq("status", "unopened"),
      supabase.from("wallets").select("balance_cents").eq("member_id", profile.id).maybeSingle(),
      supabase.rpc("rewards_my_streak"),
      supabase
        .from("rewards_events")
        .select("result")
        .eq("member_id", profile.id)
        .eq("source", "topup")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([{ data: mr }, { count }, { data: wallet }, { data: streak }, { data: last }]) =>
      setData({
        rewards: mr ?? { xp_total: 0, lifetime_credit_cents: 0, rank: "bronze", rank_seen: "bronze" },
        crates: count ?? 0,
        balance: wallet?.balance_cents ?? 0,
        streak: streak ?? 0,
        lastResult: last?.result ?? null,
      })
    );
  }

  useEffect(() => {
    if (profile?.id && walletEnabled(profile)) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  // Coming back from Stripe: XP lands with the webhook a moment later
  useEffect(() => {
    if (!justToppedUp || !profile?.id) return;
    const t = setTimeout(load, 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justToppedUp, profile?.id]);

  if (!walletEnabled(profile)) {
    return (
      <div className="portal-page">
        <div className="portal-page-head">
          <h1 className="portal-h1">Rewards</h1>
        </div>
        <div className="portal-empty">
          <p>Sync Rewards opens once your membership is active.</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="portal-page">
        <p className="portal-sub">Loading rewards…</p>
      </div>
    );
  }

  const { rewards: r, crates, balance, streak, lastResult } = data;
  const xp = r.xp_total;
  const level = levelOf(xp);
  const into = xp % LEVEL_XP;
  const toNext = LEVEL_XP - into;
  const pct = into / LEVEL_XP;
  const rank = rankByKey(r.rank);
  const rankIdx = RANKS.indexOf(rank);
  const next = nextRank(rank.key);
  const lifetime = r.lifetime_credit_cents;
  const toRank = next ? next.minCents - lifetime : 0;
  const rankPct = next ? (lifetime - rank.minCents) / (next.minCents - rank.minCents) : 1;
  const reachPack = next && PACKS.find((p) => p.cents >= toRank);
  const nextCourse = next?.course && tierRank(next.course) > tierRank(profile.tier) ? next.course : null;
  const nextCrateLevel = Math.max(level + 1, 6);
  const showRankUp = RANKS.findIndex((x) => x.key === r.rank) > RANKS.findIndex((x) => x.key === r.rank_seen);

  const ctaCaption = !next
    ? "You're at the top rank. Every level still drops a crate."
    : reachPack
      ? `A ${dollars(reachPack.cents)} top-up takes you straight to ${next.name}${
          reachPack.cents > toRank ? `, with ${dollars(reachPack.cents - toRank)} to spare` : ""
        }.`
      : `Every ${dollars(PACKS[PACKS.length - 1].cents)} top-up gets you closer to ${next.name}.`;

  // Reward track: the last level, this one, the next five, then a mystery beyond
  const track = [];
  if (level > 1) {
    track.push({ level: level - 1, state: "done", name: crateForLevel(level - 1) ? "Crate claimed" : "Reached" });
  }
  track.push({ level, state: "here", name: `${Math.round(pct * 100)}% to next` });
  for (let l = level + 1; l <= level + 5; l++) {
    const isRank = rewardsAtLevel(l).some((i) => i.kind === "rank");
    const later = next && l > next.level && !isRank;
    track.push({
      level: l,
      state: isRank ? "rank" : l === level + 1 ? "next" : later ? "later" : "upcoming",
      kind: rewardsAtLevel(l).find((i) => i.kind !== "crate")?.kind ?? (crateForLevel(l) ? "crate" : "xp"),
      name: trackName(l, profile.tier),
    });
  }
  if (next) track.push({ level: Math.max(level + 8, next.level + 4), state: "mystery", name: `Revealed at ${next.name}` });
  const hereIdx = track.findIndex((t) => t.state === "here");
  const doneWidth = ((hereIdx + pct) / (track.length - 1)) * 88;

  return (
    <div className="portal-page">
      <div className="rw-page">
        <div className="rw-head">
          <div style={{ minWidth: 0 }}>
            <div className="rw-eyebrow">Sync Rewards</div>
            <h1 className="rw-title">Level up your store</h1>
            <p className="rw-sub">
              Every $1 of wallet credit earns {XP_PER_DOLLAR} XP. Climb levels for crates and credit, and climb ranks
              to unlock the next course.
            </p>
          </div>
          <div className="rw-head-actions">
            <Link to="/portal/rewards/top-up" className="rw-wallet-chip" aria-label={`Wallet ${dollars(balance, { decimals: true })} AUD, top up`}>
              <span className="rw-wallet-chip-label">WALLET</span>
              {dollars(balance, { decimals: true })} AUD
              <span className="rw-wallet-chip-plus">
                <PlusIcon />
              </span>
            </Link>
            <a href="#ranks" className="btn-ghost">
              How ranks work
            </a>
            <Link to="/portal/rewards/top-up" className="btn-gold rw-shine">
              Top up &amp; earn XP
            </Link>
          </div>
        </div>

        {crates > 0 && (
          <section className="dash-card rw-crates-banner">
            <span className="rw-crates-banner-text">
              <span className="rw-shield-tile rw-pulse">
                <CrateIcon size={24} />
              </span>
              {crates} mystery crate{crates === 1 ? "" : "s"} to open
            </span>
            <Link to="/portal/rewards/crates" className="btn-gold rw-shine">
              Open crates
            </Link>
          </section>
        )}

        <div className="rw-hero-grid">
          <section className="dash-card dash-progress rw-level-card">
            <div className="rw-level-glow" aria-hidden="true" />
            <div className="rw-level-row">
              <div className="rw-ring">
                <svg role="img" aria-label={`Level ${level}, ${Math.round(pct * 100)} percent to level ${level + 1}`} viewBox="0 0 176 176">
                  <defs>
                    <linearGradient id="rw-ring-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0" style={{ stopColor: "var(--p-gold)" }} />
                      <stop offset=".55" style={{ stopColor: "var(--p-gold-bright)" }} />
                      <stop offset="1" style={{ stopColor: "var(--p-gold-deep)" }} />
                    </linearGradient>
                  </defs>
                  <circle cx="88" cy="88" r="76" fill="none" style={{ stroke: "var(--p-line)" }} strokeWidth="12" />
                  <circle
                    cx="88"
                    cy="88"
                    r="76"
                    fill="none"
                    stroke="url(#rw-ring-grad)"
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeDasharray={`${pct * RING_C} ${RING_C}`}
                    transform="rotate(-90 88 88)"
                  />
                  <circle cx="88" cy="88" r="60" fill="none" style={{ stroke: "var(--p-line-soft)" }} strokeWidth="1" strokeDasharray="2 5" />
                </svg>
                <div className="rw-ring-inner">
                  <span className="rw-ring-label">Level</span>
                  <span className="rw-ring-num">{level}</span>
                </div>
              </div>
              <div className="rw-level-text">
                <span className={`rw-rank-pill rw-rank-${rank.key}`}>
                  <ShieldIcon size={11} />
                  {rank.name} rank
                </span>
                <span className="rw-xp">
                  {num(xp)} <small>XP</small>
                </span>
                <span className="rw-level-goal">
                  Only <strong>{num(toNext)} XP</strong> ({dollars(Math.ceil(toNext / XP_PER_DOLLAR) * 100)} of credit) to
                  Level {level + 1}
                  {crateForLevel(level + 1) ? " and your next mystery crate" : ""}
                </span>
              </div>
            </div>
            <div className="rw-level-bar">
              <div className="rw-bar">
                <div className="rw-bar-fill rw-shine" style={{ width: `${pct * 100}%` }} />
              </div>
              <div className="rw-bar-labels">
                <span>
                  LVL {level} · {num((level - 1) * LEVEL_XP)}
                </span>
                <span className="rw-gold-text">
                  {num(into)} / {num(LEVEL_XP)} XP
                </span>
                <span>
                  LVL {level + 1} · {num(level * LEVEL_XP)}
                </span>
              </div>
            </div>
          </section>

          <section className="dash-card rw-next-card">
            <div className="rw-next-rays" aria-hidden="true" />
            <div className="rw-next-top">
              <span className="rw-shield-tile rw-pulse">
                <ShieldIcon size={26} />
              </span>
              <div>
                <div className="rw-label">{next ? "Next rank" : "Top rank"}</div>
                <div className="rw-next-title">{next ? `${next.name} in ${dollars(toRank)}` : `You're ${rank.name}`}</div>
              </div>
            </div>
            {next && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="rw-thin-bar">
                  <span style={{ width: `${rankPct * 100}%`, background: "linear-gradient(90deg, var(--silver), var(--p-gold-bright))" }} />
                </div>
                <div className="rw-bar-labels" style={{ marginTop: 0, letterSpacing: 0, fontWeight: 400, fontSize: 11 }}>
                  <span>{dollars(lifetime)} bought</span>
                  <span>{dollars(next.minCents)}</span>
                </div>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {nextCourse && (
                <div className="rw-unlock">
                  <span className={`tier-badge tier-${nextCourse}`}>{TIERS[nextCourse].short}</span>
                  <span>{TIERS[nextCourse].name} course</span>
                </div>
              )}
              <div className="rw-perk">
                <StarIcon size={16} />
                {(next ?? rank).perks}
              </div>
            </div>
            {next && (
              <Link to="/portal/rewards/top-up" className="btn-gold rw-shine rw-next-cta">
                Reach {next.name} now
              </Link>
            )}
            <span className="rw-caption" style={{ marginTop: -6 }}>
              {ctaCaption}
            </span>
          </section>
        </div>

        <div className="dash-card rw-stats">
          <div className="rw-stats-grid">
            <div className="dash-stat-tile">
              <span className="dash-stat-icon">
                <BoltIcon size={16} />
              </span>
              <span>
                <span className="dash-stat-num">
                  {streak} week{streak === 1 ? "" : "s"}
                </span>
                <span className="dash-stat-label">
                  {streak >= STREAK_WEEKS ? `Streak · +${STREAK_BONUS}% bonus XP` : `Streak · +${STREAK_BONUS}% XP at ${STREAK_WEEKS} weeks`}
                </span>
              </span>
            </div>
            <div className="dash-stat-tile">
              <span className="dash-stat-icon">
                <CrateIcon size={16} />
              </span>
              <span>
                <span className="dash-stat-num">Lvl {nextCrateLevel}</span>
                <span className="dash-stat-label">Next mystery crate</span>
              </span>
            </div>
            <div className="dash-stat-tile">
              <span className="dash-stat-icon">
                <CreditIcon size={16} />
              </span>
              <span>
                <span className="dash-stat-num">{dollars(lifetime)}</span>
                <span className="dash-stat-label">Lifetime credit bought</span>
              </span>
            </div>
          </div>
        </div>

        <section className="dash-card rw-track-card">
          <div className="rw-section-head">
            <h2 className="rw-h2">Reward track</h2>
            <span className="rw-note">From Silver, something to claim at every level</span>
          </div>
          <div className="rw-track-scroll">
            <div className="rw-track">
              <div className="rw-track-line" aria-hidden="true" />
              <div className="rw-track-done" aria-hidden="true" style={{ width: `${doneWidth}%` }} />
              {track.map((t) => (
                <div
                  key={t.level}
                  className={`rw-node is-${t.state === "upcoming" ? "upcoming" : t.state === "mystery" ? "later" : t.state}`}
                >
                  <span className={`rw-node-icon${t.state === "next" ? " rw-pulse" : ""}`}>
                    {t.state === "here" ? (
                      level
                    ) : t.state === "mystery" ? (
                      "?"
                    ) : t.state === "done" ? (
                      <RewardKindIcon kind="crate" size={22} />
                    ) : (
                      <RewardKindIcon kind={t.state === "rank" ? "rank" : t.kind} size={22} />
                    )}
                  </span>
                  <span className="rw-node-lvl">
                    {t.state === "here"
                      ? "You are here"
                      : t.state === "rank"
                        ? `Lvl ${t.level} · ${rankByKey(rewardsAtLevel(t.level).find((i) => i.kind === "rank").rank).name}`
                        : `Lvl ${t.level}`}
                  </span>
                  <span className="rw-node-name">{t.name}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="ranks" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="rw-section-head">
            <h2 className="rw-h2">Five ranks. Every one unlocks more.</h2>
            <span className="rw-note">Set by the credit you've bought in total. It never drops.</span>
          </div>
          <div className="rw-ranks">
            {RANKS.map((rk, i) => {
              const state = i < rankIdx ? "done" : i === rankIdx ? "current" : i === rankIdx + 1 ? "next" : "later";
              const course = rk.course && tierRank(rk.course) > tierRank(profile.tier) ? rk.course : null;
              return (
                <div key={rk.key} className={`rw-rank-card is-${state} rank-${rk.key}`}>
                  <div className="rw-rank-card-top">
                    <span className={`rw-rank-icon icon-${rk.key}${state === "next" ? " rw-pulse" : ""}`}>
                      <ShieldIcon size={20} />
                    </span>
                    {state === "next" ? (
                      <span className="rw-rank-next-tag">NEXT · {dollars(rk.minCents - lifetime)}</span>
                    ) : (
                      <span className="rw-rank-state">
                        {state === "done" ? "Complete" : state === "current" ? "You're here" : `${dollars(rk.minCents - lifetime)} to go`}
                      </span>
                    )}
                  </div>
                  <span className={`rw-rank-name name-${rk.key}`}>{rk.name}</span>
                  <span className="rw-rank-meta">
                    {dollars(rk.minCents)} · Level {rk.level}
                  </span>
                  <span className="rw-rank-perks">
                    {course && <span className={`tier-badge tier-${course}`}>{TIERS[course].short}</span>}
                    {rk.perks}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {showRankUp && (
        <RankUpModal
          rewards={r}
          result={lastResult}
          profileTier={profile.tier}
          onClose={() => {
            supabase.rpc("rewards_mark_rank_seen").then(() => setData((d) => ({ ...d, rewards: { ...d.rewards, rank_seen: d.rewards.rank } })));
          }}
        />
      )}
    </div>
  );
}
