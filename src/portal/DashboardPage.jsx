import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { TIERS, meetsTier } from "../lib/tiers";
import { walletEnabled } from "../lib/walletFlag";
import { productLimit } from "../lib/plus";
import { LEVEL_XP, activeSlots, courseTier, dollars, levelOf, nextRank, num, rankByKey } from "../lib/rewards";
import Icon from "../components/portal/Icon";
import CountUp from "../components/portal/CountUp";

const BANNER_KEY = "sync_sale_banner_dismissed";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

// First plain sentence(s) of a step's markdown, for the focus card
function summary(markdown) {
  const para = (markdown ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(#|>|-|\*|\d+\.|```)/.test(p));
  if (!para) return null;
  const text = para.replace(/[*_`[\]]/g, "").replace(/\(https?:[^)]+\)/g, "");
  return text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text;
}

const ORDER_LABEL = {
  pending_payment: "Awaiting payment",
  awaiting_funds: "Awaiting funds",
  paid: "Paid",
  dispatching: "Sourcing",
  dispatched: "Shipped",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
  exception: "Needs attention",
};
const orderTone = (s) => (s === "delivered" ? "ok" : s === "exception" ? "bad" : s === "cancelled" ? "plain" : "info");

export default function DashboardPage() {
  const { profile } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [progress, setProgress] = useState({});
  const [orders, setOrders] = useState([]);
  const [earned, setEarned] = useState(0);
  const [nextAch, setNextAch] = useState(null);
  const [productCount, setProductCount] = useState(0);
  const [rewardSlots, setRewardSlots] = useState(0);
  const [rewards, setRewards] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [bannerHidden, setBannerHidden] = useState(() => {
    try {
      return sessionStorage.getItem(BANNER_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: n }, { data: p }, { data: o }, { data: ma }, { data: ach }, { data: mp }, { data: mr }, { count: pc }, { data: grants }] =
        await Promise.all([
          supabase.from("pathway_nodes").select("*").order("phase").order("order_in_phase"),
          supabase.from("member_pathway_progress").select("*"),
          supabase.from("orders").select("id, status, total_amount, created_at").order("created_at", { ascending: false }),
          supabase.from("member_achievements").select("achievement_id, status"),
          supabase.from("achievements").select("id, title").order("sort_order"),
          supabase.from("member_pathways").select("pathway_id, granted_at").order("granted_at"),
          supabase.from("member_rewards").select("xp_total, lifetime_credit_cents, rank").eq("member_id", profile.id).maybeSingle(),
          supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true).eq("member_id", profile.id),
          supabase.from("reward_grants").select("kind, expires_at, clawed_back_at").eq("member_id", profile.id).eq("kind", "slot"),
        ]);
      // Course access: the paid plan, or a higher course unlocked by Sync Rewards rank
      const memberTier = courseTier(profile.tier, mr?.rank);
      // Two owned pathways both have a phase 1, 2, ... — sort by grant order first
      const grantOrder = Object.fromEntries((mp ?? []).map((row, i) => [row.pathway_id, i]));
      const sorted = (n ?? [])
        .filter((node) => meetsTier(memberTier, node.min_tier))
        .sort((a, b) => {
          const oa = grantOrder[a.pathway_id] ?? 0;
          const ob = grantOrder[b.pathway_id] ?? 0;
          if (oa !== ob) return oa - ob;
          if (a.phase !== b.phase) return a.phase - b.phase;
          return a.order_in_phase - b.order_in_phase;
        });
      const verified = new Set((ma ?? []).filter((m) => m.status === "verified").map((m) => m.achievement_id));
      setNodes(sorted);
      setProgress(Object.fromEntries((p ?? []).map((r) => [r.node_id, r.status])));
      setOrders(o ?? []);
      setEarned(verified.size);
      setNextAch((ach ?? []).find((a) => !verified.has(a.id))?.title ?? null);
      setProductCount(pc ?? 0);
      setRewardSlots(activeSlots(grants));
      setRewards(mr ?? { xp_total: 0, lifetime_credit_cents: 0, rank: "bronze" });
      setLoaded(true);
    })();
  }, [profile]);

  function hideBanner() {
    setBannerHidden(true);
    try {
      sessionStorage.setItem(BANNER_KEY, "1");
    } catch {
      // hidden for this page view only
    }
  }

  const tier = profile?.tier ? TIERS[profile.tier] : null;
  const completed = nodes.filter((n) => progress[n.id] === "complete").length;
  const pct = nodes.length ? Math.round((completed / nodes.length) * 100) : 0;
  const focusIdx = nodes.findIndex((n) => progress[n.id] !== "complete");
  const focus = focusIdx >= 0 ? nodes[focusIdx] : null;
  const around = focus ? nodes.slice(Math.max(0, focusIdx - 1), focusIdx + 3) : nodes.slice(-4);

  const placed = orders.filter((o) => o.status !== "pending_payment" && o.status !== "cancelled");
  const shippedCount = placed.filter((o) => ["dispatched", "shipped", "delivered"].includes(o.status)).length;
  const totalSales = placed.reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);

  const slotLimit = productLimit({ ...profile, reward_slots: rewardSlots });
  const R = 36;
  const C = 2 * Math.PI * R;

  const xp = rewards?.xp_total ?? 0;
  const level = levelOf(xp);
  const rank = rankByKey(rewards?.rank);
  const next = nextRank(rank.key);

  return (
    <div className="portal-page dash-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">
          {greeting()}
          {profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        <p className="portal-sub">
          {[tier?.name, nodes.length ? `${completed} of ${nodes.length} steps done` : null].filter(Boolean).join(" · ")}
        </p>
      </div>

      {!bannerHidden && (
        <div className="dash-banner">
          <span className="icon-well">
            <Icon name="products" />
          </span>
          <span className="dash-banner-text">
            <strong>Made a sale on Depop?</strong>{" "}
            <span className="dash-banner-long">Add the item to your order and we ship it straight to your buyer.</span>
            <span className="dash-banner-short">Add it in Products.</span>
          </span>
          <Link to="/portal/products" className="btn-ghost btn-sm dash-banner-go">
            Go to Products
          </Link>
          <button type="button" className="pt-icon-btn" aria-label="Dismiss" onClick={hideBanner}>
            <Icon name="x" />
          </button>
        </div>
      )}

      <div className="dash-top">
        {focus ? (
          <section className="dash-focus-card" data-tut="focus" aria-labelledby="dash-focus-title">
            <div className="dash-focus-glow" aria-hidden="true" />
            <div className="t-eyebrow">Today's focus</div>
            <h2 className="dash-focus-title" id="dash-focus-title">
              {focus.title}
            </h2>
            <div className="dash-chips">
              <span className="chip chip-plain">
                Step {focusIdx + 1} of {nodes.length}
              </span>
              {progress[focus.id] === "in_progress" && <span className="chip chip-plain">In progress</span>}
            </div>
            {summary(focus.body) && <p className="dash-focus-body">{summary(focus.body)}</p>}
            <div className="dash-focus-actions">
              <Link to={`/portal/pathway?open=${focus.id}`} className="btn-gold btn-lg">
                Start this step
                <Icon name="arrow" size={18} />
              </Link>
              <Link to="/portal/pathway" className="btn-ghost btn-lg dash-focus-secondary">
                See the whole pathway
              </Link>
            </div>
          </section>
        ) : (
          <section className="dash-focus-card" data-tut="focus">
            <div className="t-eyebrow">Today's focus</div>
            <h2 className="dash-focus-title">{loaded ? "Pathway complete" : "Loading your next step…"}</h2>
            {loaded && <p className="dash-focus-body">Every step is done. Keep listing, selling and reviewing what works.</p>}
            {loaded && (
              <div className="dash-focus-actions">
                <Link to="/portal/pathway" className="btn-ghost btn-lg">
                  See the whole pathway
                </Link>
              </div>
            )}
          </section>
        )}

        <Link to="/portal/pathway" className="dash-card dash-path">
          <div className="dash-path-head">
            <div className="dash-ring">
              <svg aria-hidden="true" width="84" height="84" viewBox="0 0 84 84">
                <circle cx="42" cy="42" r={R} fill="none" strokeWidth="8" style={{ stroke: "var(--bg-3)" }} />
                <circle
                  cx="42"
                  cy="42"
                  r={R}
                  fill="none"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * C} ${C}`}
                  transform="rotate(-90 42 42)"
                  style={{ stroke: "var(--gold-strong)" }}
                />
              </svg>
              <span className="t-num">{pct}%</span>
            </div>
            <div>
              <div className="t-h3">Your pathway</div>
              <div className="t-small">
                {completed} of {nodes.length} steps done
              </div>
            </div>
            <Icon name="chevron" className="dash-path-chev" />
          </div>
          {around.length > 0 && (
            <ul className="dash-path-list">
              {around.map((n) => {
                const st = progress[n.id] === "complete" ? "done" : n.id === focus?.id ? "now" : "later";
                return (
                  <li key={n.id} className={`dash-path-item is-${st}`}>
                    <span className="dash-path-dot">{st === "done" && <Icon name="check" size={16} strokeWidth={2.5} />}</span>
                    <span>{n.title}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Link>
      </div>

      <div className="dash-stats">
        <div className="dash-stat">
          <span className="icon-well">
            <Icon name="profit" />
          </span>
          <span className="t-num dash-stat-num dash-stat-hero">
            <CountUp value={loaded ? totalSales : null} format={(n) => `$${n.toFixed(totalSales % 1 ? 2 : 0)}`} duration={1800} />
          </span>
          <span className="t-label">Total sales</span>
          <span className="t-small t-muted">{placed.length ? `${placed.length} order${placed.length === 1 ? "" : "s"} placed` : "Your first sale shows here."}</span>
        </div>
        <div className="dash-stat">
          <span className="icon-well">
            <Icon name="truck" />
          </span>
          <span className="t-num dash-stat-num">
            <CountUp value={loaded ? shippedCount : null} delay={150} />
          </span>
          <span className="t-label">Orders shipped</span>
          <span className="t-small t-muted">We ship straight to your buyer.</span>
        </div>
        <Link to="/portal/products" className="dash-stat">
          <span className="icon-well">
            <Icon name="box" />
          </span>
          <span className="t-num dash-stat-num">
            <CountUp value={loaded ? (tier?.unlimited ? productCount : Math.min(productCount, slotLimit)) : null} delay={300} />
            {loaded && !tier?.unlimited && ` of ${slotLimit}`}
          </span>
          <span className="t-label">{tier?.unlimited ? "Products" : "Product slots used"}</span>
          <span className="t-small t-muted">{tier?.unlimited ? "Full catalogue access." : "New products drop weekly."}</span>
        </Link>
        <Link to="/portal/achievements" className="dash-stat">
          <span className="icon-well">
            <Icon name="achieve" />
          </span>
          <span className="t-num dash-stat-num">
            <CountUp value={loaded ? earned : null} delay={450} />
          </span>
          <span className="t-label">Achievements</span>
          <span className="t-small t-muted">{nextAch ? `Next: ${nextAch}.` : "Every achievement earned."}</span>
        </Link>
      </div>

      <div className="dash-bottom">
        {walletEnabled(profile) && rewards && (
          <section className="dash-card dash-rewards">
            <div className="dash-row">
              <span className="t-h3">Sync Rewards</span>
              <span className="chip chip-plain">
                {rank.name} · Level {level}
              </span>
            </div>
            <div className="bar" style={{ height: 10 }}>
              <span style={{ width: `${((xp % LEVEL_XP) / LEVEL_XP) * 100}%` }} />
            </div>
            <div className="dash-row">
              <span className="t-small">
                {num(LEVEL_XP - (xp % LEVEL_XP))} XP to Level {level + 1}
              </span>
              {next && (
                <span className="t-small t-gold">
                  {next.name} in {dollars(next.minCents - (rewards.lifetime_credit_cents ?? 0))}
                </span>
              )}
            </div>
            <Link to="/portal/rewards" className="btn-quiet">
              Open Rewards
              <Icon name="chevron" size={18} />
            </Link>
          </section>
        )}
        <section className="dash-card dash-orders">
          <div className="dash-row">
            <span className="t-h3">Recent orders</span>
            {orders.length > 0 && (
              <Link to="/portal/checkout" className="btn-quiet">
                All orders
              </Link>
            )}
          </div>
          {orders.length === 0 ? (
            <div className="dash-empty">
              <span className="icon-well">
                <Icon name="truck" />
              </span>
              <span className="t-small">No orders yet. When you make a Depop sale, add it from Products and you can track it here.</span>
            </div>
          ) : (
            <ul className="dash-order-list">
              {orders.slice(0, 3).map((o) => (
                <li key={o.id}>
                  <span className="t-small">
                    {new Date(o.created_at).toLocaleDateString("en-AU", { day: "numeric", month: "short" })}
                  </span>
                  <span className="dash-order-amt">${Number(o.total_amount ?? 0).toFixed(2)} AUD</span>
                  <span className={`chip chip-${orderTone(o.status)}`}>{ORDER_LABEL[o.status] ?? o.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
