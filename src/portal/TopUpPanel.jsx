import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { walletEnabled } from "../lib/walletFlag";
import { TIERS, tierRank } from "../lib/tiers";
import {
  LEVEL_XP,
  PACKS,
  STREAK_BONUS,
  STREAK_WEEKS,
  XP_PER_DOLLAR,
  dollars,
  levelOf,
  nextRank,
  num,
  packBonusPct,
  rankByKey,
  rankOf,
  rewardsAtLevel,
  topupXp,
} from "../lib/rewards";
import { CheckIcon } from "../components/portal/RewardIcons";
import { useTutorial } from "./tutorialSteps";

// Bonus credit per top-up amount (cents). Credited by stripe-webhook, which holds the same table.
const TOPUP_BONUSES = { 50000: 8000 };
const SHOW_REWARDS = 8;

// The top-up packs, "Your climb" and the pay summary, shared by /portal/rewards/top-up and the
// Wallet page. `back` renders above the heading; `returnTo` is where Stripe sends the member back
// (wallet-topup: "rewards", otherwise the wallet); `children` render under the packs.
export default function TopUpPanel({ back, titleAs: Title = "h1", returnTo, children }) {
  const { profile } = useAuth();
  // Rewards tutorial: practice mode. Taps on the packs go to the tutorial, never to checkout.
  const { kind: tourKind, sim, practiceLine } = useTutorial();
  const practice = tourKind === "rewards" && !!sim?.practice;
  const [data, setData] = useState(null);
  const [picked, setPicked] = useState(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!profile?.id || !walletEnabled(profile)) return;
    Promise.all([
      supabase.from("member_rewards").select("*").eq("member_id", profile.id).maybeSingle(),
      supabase.from("wallets").select("balance_cents").eq("member_id", profile.id).maybeSingle(),
      supabase.rpc("rewards_my_streak"),
    ]).then(([{ data: mr }, { data: wallet }, { data: streak }]) =>
      setData({
        rewards: mr ?? { xp_total: 0, lifetime_credit_cents: 0, rank: "bronze", level_rewarded: 1 },
        balance: wallet?.balance_cents ?? 0,
        streak: streak ?? 0,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (!walletEnabled(profile)) {
    return (
      <div>
        <div className="portal-empty">
          <p>Sync Rewards opens once your membership is active.</p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div>
        <p className="portal-sub">Loading top-up packs…</p>
      </div>
    );
  }

  const { rewards: r, balance, streak } = data;
  const streakLive = streak >= STREAK_WEEKS;
  const xp = r.xp_total;
  const level = levelOf(xp);
  const rank = rankByKey(r.rank);

  const packs = PACKS.map((p) => {
    const gain = topupXp(p.cents, streakLive);
    const toLevel = levelOf(xp + gain);
    const toRank = rankOf(r.lifetime_credit_cents + p.cents);
    return { ...p, gain, toLevel, toRank, rankUp: toRank.key !== rank.key };
  });
  // Default: the smallest pack that reaches the next rank, otherwise "Most popular"
  const sel =
    packs.find((p) => p.cents === picked) ?? packs.find((p) => p.rankUp) ?? packs.find((p) => p.tag === "Most popular");

  const base = (sel.cents / 100) * XP_PER_DOLLAR;
  const packBonusXp = Math.round(base * (packBonusPct(sel.cents) / 100));
  const streakXp = sel.gain - base - packBonusXp;
  const bonusCredit = TOPUP_BONUSES[sel.cents] ?? 0;
  const course = sel.rankUp && sel.toRank.course && tierRank(sel.toRank.course) > tierRank(profile.tier) ? sel.toRank.course : null;
  const nextAfter = nextRank(sel.toRank.key);
  const gapText = nextAfter
    ? `${nextAfter.name}${nextAfter.course && tierRank(nextAfter.course) > tierRank(profile.tier) ? ` and the ${TIERS[nextAfter.course].name} course are` : " is"} another ${dollars(
        nextAfter.minCents - r.lifetime_credit_cents - sel.cents
      )} after this.`
    : null;

  // Every reward crossed on the way (levels already paid out are skipped)
  const crossed = [];
  for (let l = Math.max(level, r.level_rewarded ?? 1) + 1; l <= sel.toLevel; l++) {
    for (const item of rewardsAtLevel(l)) {
      const isRank = item.kind === "rank";
      const rk = isRank ? rankByKey(item.rank) : null;
      crossed.push({
        key: `${l}-${item.kind}`,
        level: l,
        big: isRank,
        name: isRank ? `${rk.name} rank${rk.course && tierRank(rk.course) > tierRank(profile.tier) ? ` · ${TIERS[rk.course].name} course` : ""}` : item.label,
      });
    }
  }

  async function pay() {
    setError(null);
    setPaying(true);
    const { data: res, error: fnErr } = await supabase.functions.invoke("wallet-topup", {
      body: { amount_cents: sel.cents, return_to: returnTo },
    });
    if (fnErr || !res?.url) {
      setError(res?.error ?? "Could not start the top-up checkout.");
      setPaying(false);
      return;
    }
    window.location.assign(res.url);
  }

  return (
    <div className="rw-page" style={{ gap: 26 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {back}
        <div className="rw-head" style={{ alignItems: "flex-end" }}>
          <div>
            {practice && (
              <span className="tut-practice" style={{ marginBottom: 10 }}>
                Practice mode · no payment
              </span>
            )}
            <Title className="rw-title" style={{ marginTop: 0 }}>
              Top up and earn XP
            </Title>
            <p className="rw-sub" style={{ display: "block" }}>
              {XP_PER_DOLLAR} XP for every $1 of credit. Bigger packs add bonus XP on top.
              {streakLive && ` Your ${streak}-week streak adds +${STREAK_BONUS}%.`}
            </p>
          </div>
          <div className="rw-level-mini">
            <span className="rw-level-mini-num">Lvl {level}</span>
            <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span className="rw-note" style={{ fontSize: 11 }}>
                {rank.name} · {num(xp)} XP · Balance {dollars(balance, { decimals: true })}
              </span>
              <span className="rw-level-mini-bar">
                <span style={{ width: `${((xp % LEVEL_XP) / LEVEL_XP) * 100}%` }} />
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="rw-packs" role="radiogroup" aria-label="Top-up amount">
        {packs.map((p) => {
          const on = p.cents === sel.cents;
          return (
            <button
              key={p.cents}
              type="button"
              role="radio"
              aria-checked={on}
              data-tut={`pack-${p.cents}`}
              className={`rw-pack${on ? " is-on" : ""}`}
              onClick={() => setPicked(p.cents)}
            >
              {p.tag && <span className="rw-pack-tag">{p.tag}</span>}
              <span className="rw-pack-top">
                <span className="rw-pack-amt">{dollars(p.cents)}</span>
                <span className="rw-pack-check">
                  <CheckIcon size={12} />
                </span>
              </span>
              <span className="rw-pack-xp">
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  +{num(p.gain)} XP
                  <span className="rw-pack-mobile-outcome">
                    {p.rankUp ? `Gets you to ${p.toRank.name} · Level ${p.toLevel}` : `Gets you to Level ${p.toLevel}`}
                  </span>
                </span>
                {p.bonus > 0 && <span className="rw-pack-bonus">+{p.bonus}% bonus</span>}
              </span>
              <span className="rw-pack-rule" />
              <span className="rw-pack-row">
                <span>Gets you to</span>
                <span className={`rw-rank-pill rw-rank-${p.toRank.key}`}>{p.toRank.name}</span>
              </span>
              <span className="rw-pack-level">
                {practice && p.cents === 50000 && practiceLine ? practiceLine : `Level ${p.toLevel}`}
              </span>
            </button>
          );
        })}
      </div>

      {children}

      <div className="rw-topup-cols">
        <section className="dash-card rw-climb">
          <div className="rw-section-head">
            <h2 className="rw-h2">Your climb with {dollars(sel.cents)}</h2>
            <span className="rw-note">
              {crossed.length} reward{crossed.length === 1 ? "" : "s"} unlocked on the way
            </span>
          </div>
          <div className="rw-climb-bar">
            <span className="rw-climb-from">{level}</span>
            <div className="rw-bar">
              <div className="rw-bar-fill rw-shine" style={{ width: "100%" }} />
            </div>
            <span className="rw-climb-to">{sel.toLevel}</span>
          </div>
          {crossed.length > 0 ? (
            <div className="rw-climb-grid">
              {crossed.slice(0, SHOW_REWARDS).map((c) => (
                <div key={c.key} className={`rw-climb-item${c.big ? " is-big" : ""}`}>
                  <span className="rw-climb-lvl">{c.level}</span>
                  <span>{c.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="rw-note">Crates start at Silver (Level 6). This top-up moves you closer.</span>
          )}
          {crossed.length > SHOW_REWARDS && (
            <span className="rw-note">+ {crossed.length - SHOW_REWARDS} more crates and credit drops</span>
          )}
        </section>

        <aside className="dash-card dash-progress rw-summary">
          <span className="rw-label">After this top-up</span>
          <div className="rw-summary-rows">
            <div className="rw-summary-row">
              <span>Wallet credit</span>
              <span>{dollars(sel.cents, { decimals: true })} AUD</span>
            </div>
            {bonusCredit > 0 && (
              <div className="rw-summary-row">
                <span>Bonus credit</span>
                <span className="rw-gold-text">+{dollars(bonusCredit, { decimals: true })}</span>
              </div>
            )}
            <div className="rw-summary-row">
              <span>Base XP</span>
              <span>{num(base)} XP</span>
            </div>
            {packBonusXp > 0 && (
              <div className="rw-summary-row">
                <span>Pack bonus</span>
                <span className="rw-gold-text">
                  +{num(packBonusXp)} XP ({sel.bonus}%)
                </span>
              </div>
            )}
            {streakXp > 0 && (
              <div className="rw-summary-row">
                <span>Streak bonus</span>
                <span className="rw-gold-text">
                  +{num(streakXp)} XP ({STREAK_BONUS}%)
                </span>
              </div>
            )}
            <div className="rw-summary-rule" />
            <div className="rw-summary-row rw-summary-total">
              <span>Total XP</span>
              <span>+{num(sel.gain)} XP</span>
            </div>
            <div className="rw-summary-row">
              <span>Level</span>
              <span>
                {level} → {sel.toLevel}
              </span>
            </div>
            <div className="rw-summary-row">
              <span>New balance</span>
              <span>{dollars(balance + sel.cents + bonusCredit, { decimals: true })} AUD</span>
            </div>
          </div>
          {course ? (
            <div className="rw-unlock" style={{ fontSize: 13 }}>
              <span className={`tier-badge tier-${course}`}>{TIERS[course].short}</span>
              <span>
                {sel.toRank.name} rank unlocks {TIERS[course].name}
              </span>
            </div>
          ) : (
            gapText && <span className="rw-gap">{gapText}</span>
          )}
          {error && <p className="rw-error">{error}</p>}
          <button className="btn-gold rw-shine rw-pay" disabled={paying} onClick={pay}>
            {paying ? "Opening checkout…" : `Pay ${dollars(sel.cents, { decimals: true })} AUD`}
          </button>
          <span className="rw-caption">Secure checkout with Stripe. XP is added as soon as your payment clears.</span>
        </aside>
      </div>
    </div>
  );
}
