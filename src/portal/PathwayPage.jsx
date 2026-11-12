import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/useAuth";
import { meetsTier, tierRank, TIERS } from "../lib/tiers";
import { courseTier } from "../lib/rewards";
import PathwayIcon from "../components/portal/PathwayIcon";
import NodeBody from "../components/portal/NodeBody";
import Icon from "../components/portal/Icon";

// Stages: one per pathway phase, keyed by pathway slug. `short` labels the mobile chips.
const GROUPS = {
  depop: {
    1: { name: "Launch your store", short: "Launch", icon: "store" },
    2: { name: "List your products", short: "List", icon: "list" },
    3: { name: "Drive traffic", short: "Traffic", icon: "megaphone" },
    4: { name: "Sell & fulfil", short: "Sell", icon: "truck" },
    5: { name: "Scale", short: "Scale", icon: "profit" },
    6: { name: "VIP Inner Circle", short: "VIP", icon: "star" },
  },
  shopify: {
    1: { name: "Set up your store", short: "Set up", icon: "store" },
    2: { name: "Pick your products", short: "Pick", icon: "box" },
    3: { name: "Build & list", short: "Build", icon: "list" },
    4: { name: "Connect to Sync", short: "Connect", icon: "link" },
    5: { name: "Drive traffic", short: "Traffic", icon: "megaphone" },
    6: { name: "Run the machine", short: "Run", icon: "wallet" },
    7: { name: "Scale", short: "Scale", icon: "profit" },
  },
};

function summary(markdown) {
  const para = (markdown ?? "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .find((p) => p && !/^(#|>|-|\*|\d+\.|```)/.test(p));
  if (!para) return null;
  const text = para.replace(/[*_`[\]]/g, "").replace(/\(https?:[^)]+\)/g, "");
  return text.length > 200 ? `${text.slice(0, 197).trimEnd()}…` : text;
}

export default function PathwayPage() {
  const { profile } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [progress, setProgress] = useState({});
  const [pathways, setPathways] = useState([]); // owned pathways: [{id, slug, name}]
  const [activeId, setActiveId] = useState(null);
  const [stagePick, setStagePick] = useState(null); // phase the member picked; null = follow progress
  const [openId, setOpenIdState] = useState(null);
  const [saving, setSaving] = useState(false);
  const [rewardsRank, setRewardsRank] = useState(null); // Sync Rewards rank, which can unlock a course
  const [searchParams, setSearchParams] = useSearchParams();
  const panelRef = useRef(null);

  // Course access: the paid plan, or a higher course unlocked by Sync Rewards rank
  const memberTier = courseTier(profile?.tier, rewardsRank);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const isAdmin = profile.role === "admin";
      const [{ data: n }, { data: p }, { data: mp }, { data: mr }] = await Promise.all([
        supabase.from("pathway_nodes").select("*").order("phase").order("order_in_phase"),
        supabase.from("member_pathway_progress").select("*"),
        isAdmin
          ? supabase.from("pathways").select("*").order("created_at")
          : supabase
              .from("member_pathways")
              .select("pathway_id, granted_at, pathways(id, slug, name)")
              .order("granted_at"),
        supabase.from("member_rewards").select("rank").eq("member_id", profile.id).maybeSingle(),
      ]);
      setRewardsRank(mr?.rank ?? null);
      setNodes(n ?? []);
      setProgress(Object.fromEntries((p ?? []).map((r) => [r.node_id, r])));
      const owned = isAdmin ? (mp ?? []) : (mp ?? []).map((row) => row.pathways).filter(Boolean);
      setPathways(owned);
      setActiveId((prev) => prev ?? owned[0]?.id ?? null);
    })();
  }, [profile]);

  const active = pathways.find((pw) => pw.id === activeId);
  const activeSlug = active?.slug;
  const branchNodes = activeId ? nodes.filter((n) => n.pathway_id === activeId) : [];
  const byId = Object.fromEntries(branchNodes.map((n) => [n.id, n]));

  function nodeState(node) {
    if (!meetsTier(memberTier, node.min_tier)) return "tier";
    const status = progress[node.id]?.status;
    if (status === "complete") return "complete";
    if (status === "in_progress") return "in_progress";
    // available once all dependencies are complete (first node is always available)
    const depsDone = (node.depends_on ?? []).every((d) => {
      const dep = byId[d];
      if (dep && !meetsTier(memberTier, dep.min_tier)) return true; // skip deps above the member's tier
      return progress[d]?.status === "complete";
    });
    return depsDone ? "available" : "locked";
  }

  // Stages with a summary of their tier-eligible steps
  const stages = (() => {
    const phases = [...new Set(branchNodes.map((n) => n.phase))].sort((a, b) => a - b);
    return phases.map((phase) => {
      const steps = branchNodes.filter((n) => n.phase === phase);
      const eligible = steps.filter((s) => meetsTier(memberTier, s.min_tier));
      const done = eligible.filter((s) => progress[s.id]?.status === "complete").length;
      const minTier = eligible.length
        ? null
        : steps.reduce((best, c) => (tierRank(c.min_tier) < tierRank(best) ? c.min_tier : best), steps[0].min_tier);
      const g = GROUPS[activeSlug]?.[phase] ?? { name: `Stage ${phase}`, short: `${phase}`, icon: "pathway" };
      return { phase, ...g, steps, eligible: eligible.length, done, minTier };
    });
  })();

  const totalEligible = stages.reduce((s, g) => s + g.eligible, 0);
  const totalDone = stages.reduce((s, g) => s + g.done, 0);
  // The step that's up next: first eligible step that isn't complete
  const upNext = branchNodes.find((n) => {
    const st = nodeState(n);
    return st === "available" || st === "in_progress";
  });
  const currentPhase = upNext?.phase ?? stages.find((g) => !g.minTier && g.done < g.eligible)?.phase ?? stages[0]?.phase;

  // ?open=<id> (dashboard "Start this step") and ?start=1 open a step directly
  const openParam = searchParams.get("open") ?? (searchParams.get("start") ? branchNodes[0]?.id : null);
  const effectiveOpenId = openParam && byId[openParam] ? openParam : openId;
  const open = effectiveOpenId ? byId[effectiveOpenId] : null;
  const openState = open ? nodeState(open) : null;
  const phase = stagePick ?? (openParam && byId[openParam] ? byId[openParam].phase : currentPhase);
  const stageIdx = stages.findIndex((g) => g.phase === phase);
  const stage = stages[stageIdx];
  const nextStage = stages[stageIdx + 1];

  function setOpenId(id) {
    setOpenIdState(id);
    if (searchParams.has("start") || searchParams.has("open")) {
      const next = new URLSearchParams(searchParams);
      next.delete("start");
      next.delete("open");
      setSearchParams(next, { replace: true });
    }
  }

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && setOpenId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.id]);

  function switchPathway(id) {
    if (id === activeId) return;
    setActiveId(id);
    setStagePick(null);
    setOpenId(null);
  }

  async function setStatus(node, status) {
    setSaving(true);
    const row = {
      member_id: profile.id,
      node_id: node.id,
      status,
      completed_at: status === "complete" ? new Date().toISOString() : null,
    };
    const { error } = await supabase
      .from("member_pathway_progress")
      .upsert(row, { onConflict: "member_id,node_id" });
    if (!error) setProgress((prev) => ({ ...prev, [node.id]: row }));
    setSaving(false);
  }

  const stageDonePct = stage && stage.eligible ? (stage.done / stage.eligible) * 100 : 0;
  // The trail line fills up to the last completed step in this stage
  const lastDoneIdx = stage ? stage.steps.reduce((acc, s, i) => (progress[s.id]?.status === "complete" ? i : acc), -1) : -1;
  const linePct = stage && stage.steps.length > 1 ? Math.max(0, Math.min(100, ((lastDoneIdx + 0.5) / (stage.steps.length - 1)) * 100)) : 0;

  return (
    <div className="portal-page pw-page">
      <aside className="pw-rail">
        <div>
          <h1 className="portal-h1">Pathway</h1>
          <p className="portal-sub">
            {[active?.name, `${totalDone} of ${totalEligible} steps done`].filter(Boolean).join(" · ")}
          </p>
          <div className="bar" style={{ marginTop: 12 }}>
            <span style={{ width: `${totalEligible ? (totalDone / totalEligible) * 100 : 0}%` }} />
          </div>
        </div>

        {pathways.length >= 2 && (
          <div className="pw-switch" role="group" aria-label="Pathways">
            {pathways.map((pw) => (
              <button
                key={pw.id}
                type="button"
                className={`chip ${pw.id === activeId ? "chip-gold" : "chip-plain"}`}
                aria-pressed={pw.id === activeId}
                onClick={() => switchPathway(pw.id)}
              >
                {pw.name}
              </button>
            ))}
          </div>
        )}

        <nav className="pw-stages card" aria-label="Stages">
          {stages.map((g) => {
            const kind = g.minTier ? "tier" : g.phase === currentPhase ? "now" : g.done === g.eligible ? "done" : "open";
            return (
              <button
                key={g.phase}
                type="button"
                className={`pw-stage is-${kind}${g.phase === phase ? " is-on" : ""}`}
                aria-current={g.phase === phase ? "step" : undefined}
                onClick={() => setStagePick(g.phase)}
              >
                <span className="pw-stage-ring">
                  <Icon name={kind === "tier" ? "lock" : kind === "done" ? "check" : g.icon} size={18} />
                </span>
                <span className="pw-stage-text">
                  <span className="pw-stage-name">{g.name}</span>
                  <span className="pw-stage-meta">
                    {g.minTier
                      ? `${g.steps.length} step${g.steps.length === 1 ? "" : "s"}`
                      : g.done
                        ? `${g.done} of ${g.eligible} done`
                        : `${g.eligible} step${g.eligible === 1 ? "" : "s"}`}
                  </span>
                </span>
                {g.minTier && <span className="chip chip-plain pw-stage-tier">{TIERS[g.minTier].short}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="pw-chips" role="group" aria-label="Stages">
        {stages.map((g, i) => (
          <button
            key={g.phase}
            type="button"
            className={`chip ${g.phase === phase ? "chip-on" : "chip-plain"}${g.minTier ? " is-locked" : ""}`}
            aria-pressed={g.phase === phase}
            onClick={() => setStagePick(g.phase)}
          >
            {g.minTier && <Icon name="lock" size={14} />}
            {i + 1} · {g.short}
          </button>
        ))}
      </div>

      {stage && (
        <section className="pw-main">
          <div className="pw-stage-head card-feature">
            <span className="pw-stage-icon">
              <Icon name={stage.icon} size={30} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="t-eyebrow">
                Stage {stageIdx + 1} of {stages.length}
              </div>
              <h2 className="pw-stage-title">{stage.name}</h2>
            </div>
            {!stage.minTier && (
              <div className="pw-stage-progress">
                <span className="t-label" style={{ color: "var(--text)" }}>
                  {stage.done} of {stage.eligible} done
                </span>
                <div className="bar">
                  <span style={{ width: `${stageDonePct}%` }} />
                </div>
              </div>
            )}
          </div>

          <ol className="pw-trail" style={{ "--pw-fill": `${linePct}%` }}>
            {stage.steps.map((node, i) => {
              const st = nodeState(node);
              const isNext = upNext?.id === node.id;
              return (
                <li key={node.id} className={`pw-step is-${st}${isNext ? " is-next" : ""}`}>
                  <span className="pw-step-dot" aria-hidden="true">
                    {st === "complete" ? <Icon name="check" strokeWidth={2.5} /> : st === "locked" || st === "tier" ? <Icon name="lock" size={18} /> : i + 1}
                  </span>
                  {isNext ? (
                    <div className="pw-step-card is-next">
                      <div className="pw-step-row">
                        <span className="pw-step-title">{node.title}</span>
                        <span className="chip chip-gold">Up next</span>
                      </div>
                      {summary(node.body) && <p className="t-body">{summary(node.body)}</p>}
                      <div>
                        <button type="button" className="btn-gold" data-tut="next-step" onClick={() => setOpenId(node.id)}>
                          Open step
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className="pw-step-card" onClick={() => setOpenId(node.id)}>
                      <span className="pw-step-title">{node.title}</span>
                      {st === "complete" && <span className="chip chip-ok">Done</span>}
                      {st === "in_progress" && <span className="chip chip-plain">In progress</span>}
                      {st === "available" && <span className="chip chip-plain">Open</span>}
                      {st === "locked" && <span className="chip chip-plain">Locked</span>}
                      {st === "tier" && <span className="chip chip-plain">{TIERS[node.min_tier].short}+</span>}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>

          {nextStage && (
            <div className="pw-next card">
              <span className="icon-well">
                <Icon name="lock" />
              </span>
              <span className="pw-next-text">
                <span className="pw-next-title">Next: {nextStage.name}</span>
                <span className="t-small">
                  {nextStage.minTier
                    ? `Unlocks with ${TIERS[nextStage.minTier].name}.`
                    : `${nextStage.eligible} step${nextStage.eligible === 1 ? "" : "s"}. Unlocks when you finish this stage.`}
                </span>
              </span>
            </div>
          )}
        </section>
      )}

      {open && (
        <>
          <div className="node-panel-backdrop" onClick={() => setOpenId(null)} />
          <aside className="node-panel" role="dialog" aria-modal="true" aria-labelledby="node-panel-title" tabIndex={-1} ref={panelRef}>
            <button className="pt-icon-btn node-panel-close" aria-label="Close" data-tut="panel-close" onClick={() => setOpenId(null)}>
              <Icon name="x" />
            </button>
            <div className="node-panel-head">
              <PathwayIcon name={open.icon} state={openState === "tier" ? "locked" : openState} size={44} />
              <div>
                <span className="t-eyebrow">{GROUPS[activeSlug]?.[open.phase]?.name ?? `Stage ${open.phase}`}</span>
                <h2 className="node-panel-title" id="node-panel-title">
                  {open.title}
                </h2>
              </div>
            </div>

            {openState === "locked" || openState === "tier" ? (
              <p className="node-locked-msg">
                {openState === "tier"
                  ? `This step unlocks with ${TIERS[open.min_tier]?.name}. Upgrade to access it.`
                  : "Complete the previous steps to unlock this one."}
              </p>
            ) : (
              <>
                <NodeBody markdown={open.body} />
                <div className="node-panel-actions">
                  {openState !== "complete" && (
                    <button className="btn-gold" data-tut="mark-complete" disabled={saving} onClick={() => setStatus(open, "complete")}>
                      Mark complete
                    </button>
                  )}
                  {openState === "available" && (
                    <button className="btn-ghost" disabled={saving} onClick={() => setStatus(open, "in_progress")}>
                      Start this step
                    </button>
                  )}
                  {openState === "complete" && (
                    <button className="btn-ghost" disabled={saving} onClick={() => setStatus(open, "in_progress")}>
                      Re-open step
                    </button>
                  )}
                </div>
              </>
            )}
          </aside>
        </>
      )}
    </div>
  );
}
