import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { TIERS, tierRank } from "../../lib/tiers";
import { MILESTONES, dollars, levelOf, nextRank, rankByKey } from "../../lib/rewards";
import { ArrowIcon, CloseIcon, CrateIcon, CreditIcon, ShieldIcon, SlotIcon } from "./RewardIcons";

const WORDS = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

// Shown once after a top-up that crossed a rank (member_rewards.rank ahead of rank_seen).
export default function RankUpModal({ rewards, result, profileTier, onClose }) {
  const closeRef = useRef(null);
  const rank = rankByKey(rewards.rank);
  const next = nextRank(rank.key);
  const after = result?.level_after ?? levelOf(rewards.xp_total);
  const before = result?.level_before ?? after;
  const crossed = after - before;
  const course = rank.course && tierRank(rank.course) > tierRank(profileTier) ? rank.course : null;

  let creditCents = 0;
  let slots = 0;
  for (let l = before + 1; l <= after; l++) {
    if (MILESTONES[l]?.kind === "credit") creditCents += MILESTONES[l].cents;
    if (MILESTONES[l]?.kind === "slot") slots += 1;
  }
  const crates = result?.crates ?? 0;
  const toNext = next ? next.minCents - rewards.lifetime_credit_cents : 0;
  const nextPct = next ? (rewards.lifetime_credit_cents - rank.minCents) / (next.minCents - rank.minCents) : 0;

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="rw-modal-back" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <section className="rw-rankup" role="dialog" aria-modal="true" aria-labelledby="rw-rankup-title">
        <button ref={closeRef} className="rw-close" aria-label="Close" onClick={onClose}>
          <CloseIcon />
        </button>

        <div className="rw-rankup-hero">
          <div className="rw-rankup-rays" aria-hidden="true" />
          <span className="rw-spark" aria-hidden="true" style={{ top: 70, left: 70, width: 7, height: 7, borderRadius: "50%", background: "var(--p-gold-bright)", boxShadow: "0 0 14px var(--p-gold-bright)" }} />
          <span className="rw-spark" aria-hidden="true" style={{ top: 120, right: 64, width: 9, height: 9, transform: "rotate(45deg)", background: "var(--p-gold)" }} />
          <span className="rw-spark" aria-hidden="true" style={{ bottom: 96, left: 56, width: 6, height: 6, transform: "rotate(45deg)", background: "var(--p-gold-deep)" }} />
          <span className="rw-spark" aria-hidden="true" style={{ bottom: 70, right: 90, width: 6, height: 6, borderRadius: "50%", background: "var(--p-gold-bright)", boxShadow: "0 0 12px var(--p-gold-bright)" }} />

          <div className="rw-rankup-kicker">Rank up</div>
          <div className="rw-shield">
            <svg role="img" aria-label={`${rank.name} rank shield, level ${after}`} width="100%" height="100%" viewBox="0 0 150 170">
              <defs>
                <linearGradient id="rw-shield-grad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" style={{ stopColor: "var(--p-gold)" }} />
                  <stop offset=".55" style={{ stopColor: "var(--p-gold-bright)" }} />
                  <stop offset="1" style={{ stopColor: "var(--p-gold-deep)" }} />
                </linearGradient>
              </defs>
              <path d="M75 6l62 22v46c0 40-27 74-62 90C40 148 13 114 13 74V28z" fill="url(#rw-shield-grad)" />
              <path d="M75 22l47 17v35c0 31-20 57-47 70-27-13-47-39-47-70V39z" fill="none" style={{ stroke: "var(--p-ink)" }} strokeOpacity=".35" strokeWidth="2" />
            </svg>
            <span className="rw-shield-num">{after}</span>
          </div>
          {crossed > 0 && (
            <div className="rw-rankup-levels">
              <span>Lvl {before}</span>
              <ArrowIcon />
              <span>Lvl {after}</span>
            </div>
          )}
        </div>

        <div className="rw-rankup-body">
          <div>
            <h1 id="rw-rankup-title" className="rw-rankup-title">
              You're {rank.name}
            </h1>
            <p className="rw-sub" style={{ display: "block" }}>
              {crossed > 1 ? `${WORDS[crossed] ?? crossed} levels in one top-up. ` : ""}
              {course ? "Your new course is ready now" : "Your new perks are live"}
              {crates > 0 ? ", and your rewards are waiting to be opened." : "."}
            </p>
          </div>

          <div className="rw-course rw-shine">
            {course ? (
              <span className={`tier-badge tier-${course}`}>{TIERS[course].short}</span>
            ) : (
              <span className="rw-shield-tile" style={{ width: 40, height: 40, borderRadius: 12 }}>
                <ShieldIcon size={20} />
              </span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="rw-label">{course ? "Course unlocked" : "Unlocked"}</div>
              <div className="rw-course-name">{course ? TIERS[course].name : rank.perks}</div>
            </div>
          </div>

          {(crates > 0 || creditCents > 0 || slots > 0) && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="rw-label" style={{ color: "var(--p-muted)" }}>
                Also collected on the way
              </span>
              <div className="rw-collected">
                {crates > 0 && (
                  <div className="dash-card">
                    <span className="dash-stat-icon">
                      <CrateIcon size={16} />
                    </span>
                    {crates} crate{crates === 1 ? "" : "s"}
                  </div>
                )}
                {creditCents > 0 && (
                  <div className="dash-card">
                    <span className="dash-stat-icon">
                      <CreditIcon size={16} />
                    </span>
                    {dollars(creditCents)} credit
                  </div>
                )}
                {slots > 0 && (
                  <div className="dash-card">
                    <span className="dash-stat-icon">
                      <SlotIcon size={16} />
                    </span>
                    +{slots} slot
                  </div>
                )}
              </div>
            </div>
          )}

          {next && (
            <div className="rw-rankup-next">
              <ShieldIcon size={16} />
              <span style={{ flex: 1 }}>
                Next: <strong>{next.name}</strong> in {dollars(toNext)}
              </span>
              <span className="rw-thin-bar" style={{ width: 110, height: 6, flexShrink: 0 }}>
                <span style={{ width: `${nextPct * 100}%`, background: "var(--plat)" }} />
              </span>
            </div>
          )}

          <div className="rw-rankup-actions">
            {course && (
              <Link to="/portal/pathway" className="btn-gold" onClick={onClose}>
                Start the {TIERS[course].short} course
              </Link>
            )}
            {crates > 0 ? (
              <Link to="/portal/rewards/crates" className={course ? "btn-ghost" : "btn-gold"} onClick={onClose}>
                Open my crates
              </Link>
            ) : (
              <button className="btn-ghost" onClick={onClose}>
                Back to rewards
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
