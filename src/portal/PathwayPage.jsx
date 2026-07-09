import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { meetsTier, tierRank, TIERS } from "../lib/tiers";
import PathwayIcon from "../components/portal/PathwayIcon";
import NodeBody from "../components/portal/NodeBody";

// Group hubs: one per pathway phase. Each hub branches into its phase's steps.
const GROUPS = {
  1: { name: "Launch Your Store", icon: "storefront" },
  2: { name: "List Your Products", icon: "listing-card" },
  3: { name: "Drive Traffic", icon: "growth-arrow" },
  4: { name: "Sell & Fulfil", icon: "handshake" },
  5: { name: "Scale", icon: "sliders" },
  6: { name: "VIP — Inner Circle", icon: "check-seal" },
};

// Layout constants. Mobile stacks groups in a single trunk; desktop cascades
// each group further down and further right so the tree fills the viewport
// from the top-left.
const M = { width: 380, hubGap: 128, rowH: 138, groupGap: 64, padY: 84 };
const D = { hubStepX: 330, rowH: 140, childSpread: 115, groupGap: 130, padX: 150, padY: 110 };

export default function PathwayPage() {
  const { profile } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [progress, setProgress] = useState({});
  const [openId, setOpenId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollRef = useRef(null);
  const drag = useRef(null); // mouse drag-to-pan state
  const dragMoved = useRef(false);
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia("(min-width: 900px)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 900px)");
    const onChange = (e) => setIsDesktop(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    (async () => {
      const [{ data: n }, { data: p }] = await Promise.all([
        supabase.from("pathway_nodes").select("*").order("phase").order("order_in_phase"),
        supabase.from("member_pathway_progress").select("*"),
      ]);
      setNodes(n ?? []);
      setProgress(Object.fromEntries((p ?? []).map((r) => [r.node_id, r])));
    })();
  }, []);

  // Groups → hub + child positions. Children flow in rows of two beneath their
  // hub; a lone child in the last row sits on the trunk line.
  const { groups, laidOut, width, height } = useMemo(() => {
    if (!nodes.length) return { groups: [], laidOut: [], width: 0, height: 0 };

    const phases = [...new Set(nodes.map((n) => n.phase))].sort((a, b) => a - b);
    const groups = [];
    const laidOut = [];

    if (!isDesktop) {
      const cx = M.width / 2;
      const colL = M.width * 0.26;
      const colR = M.width * 0.74;
      let y = M.padY;
      for (const phase of phases) {
        const children = nodes.filter((n) => n.phase === phase);
        const hub = { phase, ...GROUPS[phase], x: cx, y, children };
        groups.push(hub);
        y += M.hubGap;
        children.forEach((node, i) => {
          const row = Math.floor(i / 2);
          const lastInOddCount = i === children.length - 1 && children.length % 2 === 1;
          laidOut.push({
            ...node,
            x: lastInOddCount ? cx : i % 2 === 0 ? colL : colR,
            y: y + row * M.rowH,
          });
        });
        y += Math.ceil(children.length / 2) * M.rowH + M.groupGap;
      }
      return { groups, laidOut, width: M.width, height: y };
    }

    // Desktop: each group starts below the previous one's children and one
    // column further right — the tree grows down and right simultaneously.
    let hubX = D.padX;
    let hubY = D.padY;
    let maxX = 0;
    for (const phase of phases) {
      const children = nodes.filter((n) => n.phase === phase);
      const hub = { phase, ...GROUPS[phase], x: hubX, y: hubY, children };
      groups.push(hub);
      const childTop = hubY + D.rowH;
      children.forEach((node, i) => {
        const row = Math.floor(i / 2);
        const lastInOddCount = i === children.length - 1 && children.length % 2 === 1;
        const x = lastInOddCount
          ? hubX
          : i % 2 === 0
            ? hubX - D.childSpread
            : hubX + D.childSpread;
        laidOut.push({ ...node, x, y: childTop + row * D.rowH });
        maxX = Math.max(maxX, x);
      });
      const rows = Math.ceil(children.length / 2);
      hubY = childTop + rows * D.rowH + D.groupGap;
      hubX += D.hubStepX;
      maxX = Math.max(maxX, hubX);
    }
    return {
      groups,
      laidOut,
      width: maxX + D.childSpread + D.padX,
      height: hubY + D.padY,
    };
  }, [nodes, isDesktop]);

  const byId = useMemo(() => Object.fromEntries(laidOut.map((n) => [n.id, n])), [laidOut]);

  // Initial view: desktop starts at the top-left where the tree begins;
  // mobile centres the trunk.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !laidOut.length) return;
    el.scrollLeft = isDesktop ? 0 : Math.max(0, width / 2 - el.clientWidth / 2);
  }, [laidOut, isDesktop, width]);

  // ?start=1 → open the first node and scroll to it (getting-started popup lands here)
  useEffect(() => {
    if (searchParams.get("start") && laidOut.length) {
      setOpenId(laidOut[0].id);
      const el = scrollRef.current;
      el?.scrollTo({
        top: 0,
        left: Math.max(0, laidOut[0].x - el.clientWidth / 2),
        behavior: "smooth",
      });
      setSearchParams({}, { replace: true });
    }
  }, [laidOut, searchParams, setSearchParams]);

  // Click-and-drag panning with the mouse (touch uses native scroll).
  function onPointerDown(e) {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = scrollRef.current;
    drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
    dragMoved.current = false;
  }
  function onPointerMove(e) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved.current = true;
    const el = scrollRef.current;
    el.scrollLeft = d.left - dx;
    el.scrollTop = d.top - dy;
  }
  function onPointerUp() {
    drag.current = null;
  }

  function nodeState(node) {
    if (!meetsTier(profile?.tier, node.min_tier)) return "locked";
    const status = progress[node.id]?.status;
    if (status === "complete") return "complete";
    if (status === "in_progress") return "in_progress";
    // available once all dependencies are complete (first node is always available)
    const depsDone = (node.depends_on ?? []).every((d) => {
      const dep = byId[d];
      if (dep && !meetsTier(profile?.tier, dep.min_tier)) return true; // skip deps above the member's tier
      return progress[d]?.status === "complete";
    });
    return depsDone ? "available" : "locked";
  }

  // A group's state summarises its tier-eligible children.
  function groupState(hub) {
    const eligible = hub.children.filter((c) => meetsTier(profile?.tier, c.min_tier));
    if (eligible.length === 0) {
      const minTier = hub.children.reduce(
        (best, c) => (tierRank(c.min_tier) < tierRank(best) ? c.min_tier : best),
        hub.children[0].min_tier
      );
      return { kind: "tier-locked", minTier, done: 0, total: hub.children.length };
    }
    const done = eligible.filter((c) => progress[c.id]?.status === "complete").length;
    const started = eligible.some((c) => progress[c.id]?.status);
    if (done === eligible.length) return { kind: "complete", done, total: eligible.length };
    if (started) return { kind: "in_progress", done, total: eligible.length };
    return { kind: "not_started", done, total: eligible.length };
  }

  function jumpToGroup(hub) {
    const el = scrollRef.current;
    el?.scrollTo({
      left: Math.max(0, hub.x - el.clientWidth / 2),
      top: Math.max(0, hub.y - 90),
      behavior: "smooth",
    });
    setGroupsOpen(false);
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

  const open = openId ? byId[openId] : null;
  const openState = open ? nodeState(open) : null;

  // Connector styling mirrors progression: bright while a group is live,
  // dimmed and dashed for the not-yet-started reaches of the tree.
  function trunkStyle(state) {
    if (state.kind === "complete") return { stroke: "oklch(78% 0.13 86)", opacity: 0.9, dash: "none" };
    if (state.kind === "in_progress") return { stroke: "oklch(78% 0.13 86)", opacity: 0.5, dash: "none" };
    if (state.kind === "not_started") return { stroke: "oklch(58% 0.10 68)", opacity: 0.5, dash: "6 6" };
    return { stroke: "oklch(50% 0.018 85)", opacity: 0.4, dash: "5 7" };
  }

  return (
    <div className="portal-page pathway-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Your Pathway</h1>
        <p className="portal-sub">
          Six groups, each branching into its own steps — all connected, all in one place.
        </p>
      </div>

      <div className="pathway-wrap">
        <div className="pathway-groups">
          <button
            className="pathway-groups-btn"
            aria-expanded={groupsOpen}
            onClick={() => setGroupsOpen((v) => !v)}
          >
            Groups
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: groupsOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
          {groupsOpen && (
            <div className="pathway-groups-list">
              {groups.map((hub) => {
                const st = groupState(hub);
                return (
                  <button
                    key={hub.phase}
                    className={`pathway-groups-item pathway-groups-${st.kind}`}
                    onClick={() => jumpToGroup(hub)}
                  >
                    <span>{hub.name}</span>
                    <span className="pathway-groups-count">
                      {st.kind === "tier-locked"
                        ? `${TIERS[st.minTier].short}+`
                        : `${st.done}/${st.total}`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="pathway-scroll"
          ref={scrollRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <div className="pathway-tree" style={{ width, height }}>
            <svg
              className="pathway-lines"
              viewBox={`0 0 ${width} ${height}`}
              width={width}
              height={height}
              aria-hidden="true"
            >
              {/* Trunk: hub to hub */}
              {groups.map((hub, i) => {
                const next = groups[i + 1];
                if (!next) return null;
                const st = trunkStyle(groupState(next));
                const midY = (hub.y + next.y) / 2;
                return (
                  <path
                    key={`trunk-${hub.phase}`}
                    d={`M ${hub.x} ${hub.y} C ${hub.x} ${midY}, ${next.x} ${midY}, ${next.x} ${next.y}`}
                    fill="none"
                    stroke={st.stroke}
                    strokeOpacity={st.opacity}
                    strokeWidth={3}
                    strokeDasharray={st.dash}
                  />
                );
              })}
              {/* Branches: hub to each of its steps */}
              {groups.map((hub) =>
                hub.children.map((child) => {
                  const node = byId[child.id];
                  if (!node) return null;
                  const done = progress[child.id]?.status === "complete";
                  const eligible = meetsTier(profile?.tier, child.min_tier);
                  const stroke = done
                    ? "oklch(78% 0.13 86)"
                    : eligible
                      ? "oklch(58% 0.10 68)"
                      : "oklch(50% 0.018 85)";
                  const midY = (hub.y + node.y) / 2;
                  return (
                    <path
                      key={`branch-${child.id}`}
                      d={`M ${hub.x} ${hub.y} C ${hub.x} ${midY}, ${node.x} ${midY}, ${node.x} ${node.y}`}
                      fill="none"
                      stroke={stroke}
                      strokeOpacity={done ? 0.9 : eligible ? 0.5 : 0.35}
                      strokeWidth={done ? 2.2 : 2}
                      strokeDasharray={done ? "none" : eligible ? "none" : "4 6"}
                    />
                  );
                })
              )}
            </svg>

            {/* Group hubs */}
            {groups.map((hub) => {
              const st = groupState(hub);
              return (
                <button
                  key={`hub-${hub.phase}`}
                  type="button"
                  className={`pathway-hub pathway-hub-${st.kind}`}
                  style={{ left: hub.x, top: hub.y }}
                  onClick={() => {
                    if (dragMoved.current) return;
                    jumpToGroup(hub);
                  }}
                >
                  <span className="pathway-hub-circle">
                    <PathwayIcon
                      name={hub.icon}
                      state={
                        st.kind === "complete"
                          ? "complete"
                          : st.kind === "in_progress"
                            ? "in_progress"
                            : st.kind === "not_started"
                              ? "available"
                              : "locked"
                      }
                      size={44}
                    />
                  </span>
                  <span className="pathway-hub-name">{hub.name}</span>
                  {st.kind === "tier-locked" ? (
                    <span className={`tier-badge tier-${st.minTier} pathway-node-tier`}>
                      {TIERS[st.minTier].short}+
                    </span>
                  ) : (
                    <span className="pathway-hub-count">
                      {st.kind === "not_started" ? "Not started" : `${st.done} of ${st.total} done`}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Step nodes */}
            {laidOut.map((node) => {
              const state = nodeState(node);
              return (
                <button
                  key={node.id}
                  type="button"
                  className={`pathway-node pathway-node-${state}${openId === node.id ? " open" : ""}`}
                  style={{ left: node.x, top: node.y }}
                  onClick={() => {
                    if (dragMoved.current) return; // was a pan, not a click
                    setOpenId(node.id);
                  }}
                >
                  <PathwayIcon name={node.icon} state={state} size={52} />
                  <span className="pathway-node-title">{node.title}</span>
                  {node.min_tier && (
                    <span className={`tier-badge tier-${node.min_tier} pathway-node-tier`}>
                      {TIERS[node.min_tier].short}+
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {open && (
          <>
            <div className="node-panel-backdrop" onClick={() => setOpenId(null)} />
            <aside className="node-panel">
              <button className="node-panel-close" onClick={() => setOpenId(null)}>
                ×
              </button>
              <div className="node-panel-head">
                <PathwayIcon name={open.icon} state={openState} size={44} />
                <div>
                  <span className="pathway-node-phase">
                    {GROUPS[open.phase]?.name ?? `Phase ${open.phase}`}
                  </span>
                  <h2 className="node-panel-title">{open.title}</h2>
                </div>
              </div>

              {openState === "locked" ? (
                <p className="node-locked-msg">
                  {!meetsTier(profile?.tier, open.min_tier)
                    ? `This step unlocks with ${TIERS[open.min_tier]?.name}. Upgrade to access it.`
                    : "Complete the previous steps to unlock this one."}
                </p>
              ) : (
                <>
                  <NodeBody markdown={open.body} />
                  <div className="node-panel-actions">
                    {openState !== "complete" && openState !== "in_progress" && (
                      <button
                        className="btn-ghost"
                        disabled={saving}
                        onClick={() => setStatus(open, "in_progress")}
                      >
                        Start this step
                      </button>
                    )}
                    {openState !== "complete" && (
                      <button
                        className="btn-gold"
                        disabled={saving}
                        onClick={() => setStatus(open, "complete")}
                      >
                        Mark complete
                      </button>
                    )}
                    {openState === "complete" && (
                      <button
                        className="btn-ghost"
                        disabled={saving}
                        onClick={() => setStatus(open, "in_progress")}
                      >
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
    </div>
  );
}
