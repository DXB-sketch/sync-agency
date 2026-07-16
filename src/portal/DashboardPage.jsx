import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TIERS, meetsTier } from "../lib/tiers";
import PathwayIcon from "../components/portal/PathwayIcon";
import { useTutorial, STEPS, TAB_STEPS } from "./Tutorial";

const StatIcon = ({ d }) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const STAT_ICONS = {
  sales: "M3 6h18v12H3zM12 9.4a2.6 2.6 0 100 5.2 2.6 2.6 0 000-5.2",
  shipped: "M21 8l-9-5-9 5v8l9 5 9-5V8zM3 8l9 5 9-5M12 13v8",
  placed: "M4 8l1-4h14l1 4M4 8h16M4 8v10a2 2 0 002 2h12a2 2 0 002-2V8",
  earned: "M8 21h8M12 17v4M6 4h12v3a6 6 0 01-12 0V4zM6 5H3v2a3 3 0 003 3M18 5h3v2a3 3 0 01-3 3",
};

export default function DashboardPage() {
  const { profile } = useAuth();
  const { start: startTutorial, seen } = useTutorial();
  const [nodes, setNodes] = useState([]);
  const [progress, setProgress] = useState({});
  const [pathwayCount, setPathwayCount] = useState(0);
  const [orders, setOrders] = useState([]);
  const [earned, setEarned] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [tutExpanded, setTutExpanded] = useState(false);
  const [startDismissed, setStartDismissed] = useState(
    () => localStorage.getItem("sync_start_popup_dismissed") === "1"
  );

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: n }, { data: p }, { data: o }, { count: ac }, { data: mp }] = await Promise.all([
        supabase.from("pathway_nodes").select("*").order("phase").order("order_in_phase"),
        supabase.from("member_pathway_progress").select("*"),
        supabase.from("orders").select("status, total_amount"),
        supabase
          .from("member_achievements")
          .select("id", { count: "exact", head: true })
          .eq("status", "verified"),
        supabase.from("member_pathways").select("pathway_id, granted_at").order("granted_at"),
      ]);
      // Two owned pathways both have a phase 1, 2, ... — sort by grant order first
      // so branches don't interleave, then the existing phase/order_in_phase.
      const grantOrder = Object.fromEntries((mp ?? []).map((row, i) => [row.pathway_id, i]));
      const sorted = (n ?? [])
        .filter((node) => meetsTier(profile.tier, node.min_tier))
        .sort((a, b) => {
          const oa = grantOrder[a.pathway_id] ?? 0;
          const ob = grantOrder[b.pathway_id] ?? 0;
          if (oa !== ob) return oa - ob;
          if (a.phase !== b.phase) return a.phase - b.phase;
          return a.order_in_phase - b.order_in_phase;
        });
      setNodes(sorted);
      setProgress(Object.fromEntries((p ?? []).map((r) => [r.node_id, r.status])));
      setOrders(o ?? []);
      setEarned(ac ?? 0);
      setPathwayCount(mp?.length ?? 0);
      setLoaded(true);
    })();
  }, [profile]);

  function dismissStart() {
    localStorage.setItem("sync_start_popup_dismissed", "1");
    setStartDismissed(true);
  }

  const completed = nodes.filter((n) => progress[n.id] === "complete").length;
  const pct = nodes.length ? Math.round((completed / nodes.length) * 100) : 0;
  const focus = nodes.find((n) => progress[n.id] !== "complete");
  const tier = profile?.tier ? TIERS[profile.tier] : null;

  // Tracking stats sourced from the orders + achievements the member already has
  const placed = orders.filter((o) => o.status !== "pending_payment" && o.status !== "cancelled");
  const shippedCount = placed.filter((o) => o.status === "shipped" || o.status === "delivered").length;
  const totalSales = placed.reduce((sum, o) => sum + Number(o.total_amount ?? 0), 0);

  const R = 52;
  const CIRC = 2 * Math.PI * R;

  const showStartPopup =
    loaded && !startDismissed && nodes.length > 0 && Object.keys(progress).length === 0;

  // Compact tutorial: the next unseen step, remembered on this device
  const nextStep = seen < STEPS.length ? STEPS[seen] : null;

  return (
    <div className="portal-page">
      {showStartPopup && (
        <>
          <div className="node-panel-backdrop" onClick={dismissStart} />
          <div className="start-popup">
            <button className="node-panel-close" onClick={dismissStart}>
              ×
            </button>
            <PathwayIcon name={nodes[0].icon} state="available" size={56} />
            <h2 className="start-popup-title">Ready to launch your store?</h2>
            <p className="start-popup-sub">
              Everything starts with step one of your pathway: <strong>{nodes[0].title}</strong>.
              It takes a few minutes and unlocks the rest of the tree.
            </p>
            <div className="start-popup-actions">
              <Link to="/portal/pathway?start=1" className="btn-gold" onClick={dismissStart}>
                Take me to step 1
              </Link>
              <button className="btn-ghost" onClick={dismissStart}>
                Maybe later
              </button>
            </div>
          </div>
        </>
      )}
      <div className="portal-page-head">
        <h1 className="portal-h1">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}
        </h1>
        {tier && (
          <p className="portal-sub">
            {tier.rank === 0
              ? "Free Dashboard · upgrade anytime for more slots and steps"
              : `${tier.name} · ${profile.billing_type === "monthly" ? "Monthly" : "Lifetime"} access`}
          </p>
        )}
      </div>

      <div className="dash-grid">
        <div className="dash-card dash-tut">
          <div className="dash-tut-head">
            <h2 className="dash-card-title">Tutorial</h2>
            <span className="dash-tut-progress">
              {Math.min(seen, STEPS.length)}/{STEPS.length}
            </span>
          </div>
          <p className="dash-card-sub">New here? Learn what each tab is for — step by step.</p>
          <button className="btn-gold dash-tut-start" onClick={() => startTutorial(0)}>
            Start full tour
          </button>
          {nextStep ? (
            <button className="dash-tut-next" onClick={() => startTutorial(seen)}>
              <span className="dash-tut-next-label">{nextStep.tab} · Up next</span>
              <span className="dash-tut-next-title">{nextStep.title}</span>
            </button>
          ) : (
            <div className="dash-tut-next dash-tut-done">
              <span className="dash-tut-next-label">Tour complete</span>
              <span className="dash-tut-next-title">Replay any part from the list below.</span>
            </div>
          )}
          <button className="dash-tut-toggle" onClick={() => setTutExpanded((v) => !v)}>
            {tutExpanded ? "Hide steps" : "Show all steps"}
          </button>
          {tutExpanded && (
            <div className="dash-tut-list">
              {TAB_STEPS.map((t) => (
                <button key={t.tab} className="dash-tut-item" onClick={() => startTutorial(t.index)}>
                  <span className={`dash-tut-dot${t.index < seen ? " seen" : ""}`} />
                  <span className="dash-tut-item-text">
                    <span className="dash-tut-item-tab">{t.tab}</span>
                    <span className="dash-tut-item-blurb">{t.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="dash-card dash-progress">
          <div className="dash-progress-row">
            <svg width="112" height="112" viewBox="0 0 128 128">
              <circle cx="64" cy="64" r={R} stroke="oklch(30% 0.02 85 / .5)" strokeWidth="8" fill="none" />
              <circle
                cx="64"
                cy="64"
                r={R}
                stroke="url(#dashGoldGrad)"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={CIRC * (1 - pct / 100)}
                transform="rotate(-90 64 64)"
              />
              <defs>
                <linearGradient id="dashGoldGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="oklch(86% 0.05 88)" />
                  <stop offset="100%" stopColor="oklch(58% 0.10 68)" />
                </linearGradient>
              </defs>
              <text x="64" y="70" textAnchor="middle" className="dash-ring-text">
                {pct}%
              </text>
            </svg>
            <div>
              <h2 className="dash-card-title">Pathway progress</h2>
              <p className="dash-card-sub">
                {pathwayCount >= 2
                  ? `${completed} of ${nodes.length} steps across your pathways`
                  : `${completed} of ${nodes.length} steps complete`}
              </p>
              <Link to="/portal/pathway" className="btn-ghost dash-btn">
                Open pathway
              </Link>
            </div>
          </div>
          {focus && (
            <Link to="/portal/pathway" className="dash-focus">
              <PathwayIcon
                name={focus.icon}
                state={progress[focus.id] === "in_progress" ? "in_progress" : "available"}
                size={44}
              />
              <div>
                <span className="dash-focus-phase">Today's focus</span>
                <span className="dash-focus-title">{focus.title}</span>
              </div>
            </Link>
          )}
          {!focus && loaded && (
            <p className="dash-card-sub">Pathway complete — you're operating at full speed.</p>
          )}
        </div>

        <div className="dash-card dash-stats">
          <div className="dash-stat-tile">
            <span className="dash-stat-icon">
              <StatIcon d={STAT_ICONS.sales} />
            </span>
            <div>
              <span className="dash-stat-num">${totalSales.toFixed(totalSales % 1 ? 2 : 0)}</span>
              <span className="dash-stat-label">Total sales</span>
            </div>
          </div>
          <div className="dash-stat-tile">
            <span className="dash-stat-icon">
              <StatIcon d={STAT_ICONS.shipped} />
            </span>
            <div>
              <span className="dash-stat-num">{shippedCount}</span>
              <span className="dash-stat-label">Orders shipped</span>
            </div>
          </div>
          <Link to="/portal/checkout" className="dash-stat-tile">
            <span className="dash-stat-icon">
              <StatIcon d={STAT_ICONS.placed} />
            </span>
            <div>
              <span className="dash-stat-num">{placed.length}</span>
              <span className="dash-stat-label">Orders placed</span>
            </div>
          </Link>
          <Link to="/portal/achievements" className="dash-stat-tile">
            <span className="dash-stat-icon">
              <StatIcon d={STAT_ICONS.earned} />
            </span>
            <div>
              <span className="dash-stat-num">{earned}</span>
              <span className="dash-stat-label">Earned</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
