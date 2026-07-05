import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import { meetsTier, TIERS } from "../lib/tiers";
import PathwayIcon from "../components/portal/PathwayIcon";
import NodeBody from "../components/portal/NodeBody";

const PHASE_NAMES = {
  1: "Launch Your Store",
  2: "List Your Products",
  3: "Drive Traffic",
  4: "Sell & Fulfil",
  5: "Elite — Scale",
  6: "VIP — Inner Circle",
};

// 2D grid layout: each node carries gx (column, can be negative) and gy (row).
// The canvas grows in both directions as nodes are added.
const COL_W = 190;
const ROW_H = 150;
const PAD_X = 40;
const PAD_Y = 70;

export default function PathwayPage() {
  const { profile } = useAuth();
  const [nodes, setNodes] = useState([]);
  const [progress, setProgress] = useState({});
  const [openId, setOpenId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollRef = useRef(null);
  const drag = useRef(null); // mouse drag-to-pan state
  const dragMoved = useRef(false);

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

  const { laidOut, width, height } = useMemo(() => {
    if (!nodes.length) return { laidOut: [], width: 0, height: 0 };
    const minGx = Math.min(...nodes.map((n) => n.gx ?? 0));
    const maxGx = Math.max(...nodes.map((n) => n.gx ?? 0));
    const maxGy = Math.max(...nodes.map((n) => n.gy ?? 0));
    const laidOut = nodes.map((node) => ({
      ...node,
      x: ((node.gx ?? 0) - minGx) * COL_W + COL_W / 2 + PAD_X,
      y: (node.gy ?? 0) * ROW_H + PAD_Y,
    }));
    return {
      laidOut,
      width: (maxGx - minGx + 1) * COL_W + PAD_X * 2,
      height: (maxGy + 1) * ROW_H + PAD_Y,
    };
  }, [nodes]);

  const byId = useMemo(() => Object.fromEntries(laidOut.map((n) => [n.id, n])), [laidOut]);

  // Start with the first node horizontally centred instead of the tree's left edge.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !laidOut.length) return;
    el.scrollLeft = Math.max(0, laidOut[0].x - el.clientWidth / 2);
  }, [laidOut]);

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

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Your Pathway</h1>
        <p className="portal-sub">
          The Y2K/streetwear playbook, step by step. The tree grows in every direction — scroll to
          explore, complete a step, move on.
        </p>
      </div>

      <div className="pathway-wrap">
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
              {laidOut.map((node) =>
                (node.depends_on ?? []).map((depId) => {
                  const dep = byId[depId];
                  if (!dep) return null;
                  const done = progress[depId]?.status === "complete";
                  const midY = (dep.y + node.y) / 2;
                  return (
                    <path
                      key={`${depId}-${node.id}`}
                      d={`M ${dep.x} ${dep.y} C ${dep.x} ${midY}, ${node.x} ${midY}, ${node.x} ${node.y}`}
                      fill="none"
                      stroke={done ? "#C9A84C" : "rgba(201,168,76,0.22)"}
                      strokeWidth={done ? 1.6 : 1.2}
                      strokeDasharray={done ? "none" : "4 5"}
                    />
                  );
                })
              )}
            </svg>

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
                  <span className="pathway-node-phase">
                    {PHASE_NAMES[node.phase] ?? `Phase ${node.phase}`}
                  </span>
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
                    {PHASE_NAMES[open.phase] ?? `Phase ${open.phase}`}
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
