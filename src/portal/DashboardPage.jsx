import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { TIERS, meetsTier } from "../lib/tiers";
import PathwayIcon from "../components/portal/PathwayIcon";
import { useTutorial, TAB_STEPS } from "./Tutorial";

export default function DashboardPage() {
  const { profile } = useAuth();
  const { start: startTutorial } = useTutorial();
  const [nodes, setNodes] = useState([]);
  const [progress, setProgress] = useState({});
  const [orderCount, setOrderCount] = useState(0);
  const [earned, setEarned] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [startDismissed, setStartDismissed] = useState(
    () => localStorage.getItem("sync_start_popup_dismissed") === "1"
  );

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const [{ data: n }, { data: p }, { count: oc }, { count: ac }] = await Promise.all([
        supabase.from("pathway_nodes").select("*").order("phase").order("order_in_phase"),
        supabase.from("member_pathway_progress").select("*"),
        supabase.from("orders").select("id", { count: "exact", head: true }).neq("status", "pending_payment"),
        supabase
          .from("member_achievements")
          .select("id", { count: "exact", head: true })
          .eq("status", "verified"),
      ]);
      setNodes((n ?? []).filter((node) => meetsTier(profile.tier, node.min_tier)));
      setProgress(Object.fromEntries((p ?? []).map((r) => [r.node_id, r.status])));
      setOrderCount(oc ?? 0);
      setEarned(ac ?? 0);
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

  const R = 52;
  const CIRC = 2 * Math.PI * R;

  const showStartPopup =
    loaded && !startDismissed && nodes.length > 0 && Object.keys(progress).length === 0;

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

      <div className="dash-tut">
        <div className="dash-tut-head">
          <div>
            <h2 className="dash-card-title">Tutorial</h2>
            <p className="dash-card-sub">
              New here? Learn what each tab is for and how to use it — step by step.
            </p>
          </div>
          <button className="btn-gold dash-tut-start" onClick={() => startTutorial(0)}>
            Start full tour
          </button>
        </div>
        <div className="dash-tut-grid">
          {TAB_STEPS.map((t) => (
            <button key={t.tab} className="dash-tut-box" onClick={() => startTutorial(t.index)}>
              <span className="dash-tut-label">Teaches · {t.tab}</span>
              <span className="dash-tut-blurb">{t.blurb}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="dash-grid">
        <div className="dash-card dash-progress">
          <svg width="128" height="128" viewBox="0 0 128 128">
            <circle cx="64" cy="64" r={R} stroke="rgba(201,168,76,0.12)" strokeWidth="8" fill="none" />
            <circle
              cx="64"
              cy="64"
              r={R}
              stroke="#C9A84C"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRC}
              strokeDashoffset={CIRC * (1 - pct / 100)}
              transform="rotate(-90 64 64)"
            />
            <text x="64" y="70" textAnchor="middle" className="dash-ring-text">
              {pct}%
            </text>
          </svg>
          <div>
            <h2 className="dash-card-title">Pathway progress</h2>
            <p className="dash-card-sub">
              {completed} of {nodes.length} steps complete
            </p>
            <Link to="/portal/pathway" className="btn-ghost dash-btn">
              Open pathway
            </Link>
          </div>
        </div>

        <div className="dash-card">
          <h2 className="dash-card-title">Today's focus</h2>
          {focus ? (
            <Link to="/portal/pathway" className="dash-focus">
              <PathwayIcon
                name={focus.icon}
                state={progress[focus.id] === "in_progress" ? "in_progress" : "available"}
                size={44}
              />
              <div>
                <span className="dash-focus-phase">Phase {focus.phase}</span>
                <span className="dash-focus-title">{focus.title}</span>
              </div>
            </Link>
          ) : (
            <p className="dash-card-sub">Pathway complete — you're operating at full speed.</p>
          )}
        </div>

        <div className="dash-card dash-stat">
          <span className="dash-stat-num">{orderCount}</span>
          <span className="dash-stat-label">Stock orders placed</span>
          <Link to="/portal/checkout" className="dash-stat-link">
            View orders →
          </Link>
        </div>

        <div className="dash-card dash-stat">
          <span className="dash-stat-num">{earned}</span>
          <span className="dash-stat-label">Achievements earned</span>
          <Link to="/portal/achievements" className="dash-stat-link">
            View achievements →
          </Link>
        </div>
      </div>
    </div>
  );
}
