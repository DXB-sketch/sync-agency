import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import CountUp from "../components/portal/CountUp";
import Icon from "../components/portal/Icon";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const WEEKDAYS_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const NOT_PLACED = new Set(["pending_payment", "cancelled"]);

const RANGES = [
  { key: "day", label: "Today", prev: "yesterday" },
  { key: "week", label: "This week", prev: "last week" },
  { key: "month", label: "This month", prev: "last month" },
  { key: "all", label: "All time" },
];

const METRICS = [
  { key: "sales", label: "Sales", money: true },
  { key: "orders", label: "Orders" },
  { key: "topups", label: "Wallet top-ups", money: true },
];

const PIPELINE = [
  {
    label: "Awaiting payment",
    statuses: ["pending_payment", "awaiting_funds"],
    tone: "plain",
  },
  { label: "Paid", statuses: ["paid"], tone: "gold" },
  { label: "Sourcing", statuses: ["dispatching"], tone: "info" },
  { label: "Shipped", statuses: ["dispatched", "shipped"], tone: "info" },
  { label: "Delivered", statuses: ["delivered"], tone: "ok" },
  { label: "Needs attention", statuses: ["exception"], tone: "bad" },
  { label: "Cancelled", statuses: ["cancelled"], tone: "plain" },
];

const money = (n) => `$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const moneyShort = (n) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${Math.round(n)}`);
const count = (n) => Math.round(n).toLocaleString("en-AU");
const hourLabel = (h) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`);
const weekday = (ts) => (new Date(ts).getDay() + 6) % 7; // Monday = 0
const shortDate = (ts) => new Date(ts).toLocaleDateString("en-AU", { day: "numeric", month: "short" });

function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return shortDate(ts);
}

function startOfDay(ts) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(ts) {
  const d = new Date(startOfDay(ts));
  d.setDate(d.getDate() - weekday(ts));
  return d.getTime();
}

// The selected window, plus the same stretch of the previous day/week/month to compare against
function windowFor(key, now) {
  if (key === "all") return { start: -Infinity, end: now, prev: null };
  const s = new Date(startOfDay(now));
  if (key === "week") s.setDate(s.getDate() - weekday(now));
  if (key === "month") s.setDate(1);
  const back = (ts) => {
    const d = new Date(ts);
    if (key === "day") d.setDate(d.getDate() - 1);
    else if (key === "week") d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    return d.getTime();
  };
  const start = s.getTime();
  return {
    start,
    end: now,
    prev: { start: back(start), end: Math.min(back(now), start) },
  };
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}

// PostgREST caps a request at 1000 rows — page through so totals never silently truncate
async function fetchAll(build) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 1000) return rows;
  }
}

function Delta({ cur, prev, label }) {
  if (prev == null) return null;
  if (!prev) return <span className={`an-delta is-${cur ? "up" : "flat"}`}>{cur ? `▲ New vs ${label}` : `No change vs ${label}`}</span>;
  const pct = Math.round(((cur - prev) / prev) * 100);
  const tone = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
  return (
    <span className={`an-delta is-${tone}`}>
      {pct > 0 ? "▲" : pct < 0 ? "▼" : "■"} {Math.abs(pct)}% vs {label}
    </span>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [range, setRange] = useState("week");
  const [metric, setMetric] = useState("sales");
  const [trendMode, setTrendMode] = useState("daily");
  const [productSort, setProductSort] = useState("units");
  const [cell, setCell] = useState(null);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [orders, items, topups, profiles, products, wallets] = await Promise.all([
          fetchAll(() => supabase.from("orders").select("id, member_id, status, total_amount, created_at").order("created_at")),
          fetchAll(() => supabase.from("order_items").select("order_id, product_id, product_name, quantity, unit_price").order("id")),
          fetchAll(() => supabase.from("wallet_transactions").select("member_id, amount_cents, created_at").eq("type", "topup").order("created_at")),
          fetchAll(() => supabase.from("profiles").select("id, full_name, email, role, created_at").order("created_at")),
          fetchAll(() => supabase.from("products").select("id, image_url, image_urls").order("id")),
          fetchAll(() => supabase.from("wallets").select("balance_cents").order("member_id")),
        ]);
        setData({
          orders,
          items,
          topups,
          profiles,
          products,
          wallets,
          at: Date.now(),
        });
        setError(null);
      } catch (e) {
        setError(e.message ?? "Could not load analytics.");
      }
    })();
  }, [reload]);

  // Everything below is derived once per load; range changes only re-filter
  const base = useMemo(() => {
    if (!data) return null;
    const people = Object.fromEntries(data.profiles.map((p) => [p.id, p]));
    const images = Object.fromEntries(data.products.map((p) => [p.id, p.image_url || p.image_urls?.[0]]));
    const orders = data.orders.map((o) => ({
      ...o,
      ts: Date.parse(o.created_at),
      amount: Number(o.total_amount ?? 0),
    }));
    const placed = orders.filter((o) => !NOT_PLACED.has(o.status));
    const itemsByOrder = {};
    for (const it of data.items) (itemsByOrder[it.order_id] ??= []).push(it);
    const topups = data.topups.map((t) => ({
      ...t,
      ts: Date.parse(t.created_at),
      amount: t.amount_cents / 100,
    }));
    const members = data.profiles.filter((p) => p.role === "member").map((p) => ({ ...p, ts: Date.parse(p.created_at) }));
    const storeName = (id) => people[id]?.full_name || people[id]?.email || "Unknown member";
    const held = data.wallets.reduce((s, w) => s + (w.balance_cents ?? 0), 0) / 100;
    return {
      people,
      images,
      orders,
      placed,
      itemsByOrder,
      topups,
      members,
      storeName,
      held,
    };
  }, [data]);

  const summarise = useCallback(
    (win) => {
      const inWin = (x) => x.ts >= win.start && x.ts <= win.end;
      const os = base.placed.filter(inWin);
      const sales = os.reduce((s, o) => s + o.amount, 0);
      const items = os.reduce((s, o) => s + (base.itemsByOrder[o.id] ?? []).reduce((q, it) => q + (it.quantity ?? 1), 0), 0);
      const tops = base.topups.filter(inWin);
      const deposits = tops.reduce((s, t) => s + t.amount, 0);
      return {
        orders: os,
        sales,
        count: os.length,
        aov: os.length ? sales / os.length : 0,
        items,
        stores: new Set(os.map((o) => o.member_id)).size,
        newMembers: base.members.filter(inWin).length,
        deposits,
        depositCount: tops.length,
        avgDeposit: tops.length ? deposits / tops.length : 0,
      };
    },
    [base],
  );

  const view = useMemo(() => {
    if (!base) return null;
    const now = data.at;
    const r = RANGES.find((x) => x.key === range);
    const win = windowFor(range, now);
    const cur = summarise(win);
    const prev = win.prev ? summarise(win.prev) : null;
    const hero = ["day", "week", "all"].map((k) => {
      const w = windowFor(k, now);
      return {
        key: k,
        cur: summarise(w),
        prev: w.prev ? summarise(w.prev) : null,
      };
    });

    // Trend buckets: last 30 days, or last 12 weeks
    const buckets = [];
    const n = trendMode === "daily" ? 30 : 12;
    const anchor = trendMode === "daily" ? startOfDay(now) : startOfWeek(now);
    for (let i = n - 1; i >= 0; i--) {
      const s = new Date(anchor);
      s.setDate(s.getDate() - i * (trendMode === "daily" ? 1 : 7));
      const e = new Date(s);
      e.setDate(e.getDate() + (trendMode === "daily" ? 1 : 7));
      const os = base.placed.filter((o) => o.ts >= s.getTime() && o.ts < e.getTime());
      const tops = base.topups.filter((t) => t.ts >= s.getTime() && t.ts < e.getTime());
      buckets.push({
        start: s.getTime(),
        sales: os.reduce((sum, o) => sum + o.amount, 0),
        orders: os.length,
        topups: tops.reduce((sum, t) => sum + t.amount, 0),
      });
    }

    // When orders land: weekday × hour
    const grid = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ orders: 0, sales: 0 })));
    const byDate = {};
    for (const o of cur.orders) {
      const d = new Date(o.ts);
      const c = grid[weekday(o.ts)][d.getHours()];
      c.orders += 1;
      c.sales += o.amount;
      const k = startOfDay(o.ts);
      byDate[k] = (byDate[k] ?? 0) + o.amount;
    }
    const dayTotals = grid.map((row) => row.reduce((s, c) => s + c.orders, 0));
    const hourTotals = Array.from({ length: 24 }, (_, h) => grid.reduce((s, row) => s + row[h].orders, 0));
    const gridMax = Math.max(1, ...grid.flat().map((c) => c.orders));
    const bestDate = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0];

    // Leaderboards
    const storeMap = {};
    const productMap = {};
    for (const o of cur.orders) {
      const st = (storeMap[o.member_id] ??= {
        id: o.member_id,
        sales: 0,
        orders: 0,
        items: 0,
        last: 0,
      });
      st.sales += o.amount;
      st.orders += 1;
      st.last = Math.max(st.last, o.ts);
      for (const it of base.itemsByOrder[o.id] ?? []) {
        const qty = it.quantity ?? 1;
        st.items += qty;
        const key = it.product_name || it.product_id;
        const p = (productMap[key] ??= {
          key,
          name: it.product_name || "Unnamed product",
          image: base.images[it.product_id],
          units: 0,
          revenue: 0,
          orders: new Set(),
        });
        p.units += qty;
        p.revenue += qty * Number(it.unit_price ?? 0);
        p.orders.add(o.id);
        p.image ??= base.images[it.product_id];
      }
    }
    const stores = Object.values(storeMap)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);
    const products = Object.values(productMap)
      .sort((a, b) => (productSort === "units" ? b.units - a.units || b.revenue - a.revenue : b.revenue - a.revenue))
      .slice(0, 10);

    const allInRange = base.orders.filter((o) => o.ts >= win.start && o.ts <= win.end);
    const pipeline = PIPELINE.map((p) => ({
      ...p,
      n: allInRange.filter((o) => p.statuses.includes(o.status)).length,
    }));

    const activity = [
      ...base.placed.slice(-12).map((o) => ({
        kind: "order",
        ts: o.ts,
        amount: o.amount,
        who: base.storeName(o.member_id),
        id: o.member_id,
      })),
      ...base.topups.slice(-12).map((t) => ({
        kind: "topup",
        ts: t.ts,
        amount: t.amount,
        who: base.storeName(t.member_id),
        id: t.member_id,
      })),
    ]
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 10);

    return {
      r,
      cur,
      prev,
      hero,
      buckets,
      grid,
      gridMax,
      dayTotals,
      hourTotals,
      bestDate,
      stores,
      products,
      pipeline,
      allInRange,
      activity,
    };
  }, [base, data, range, trendMode, productSort, summarise]);

  const loading = !view;
  const m = METRICS.find((x) => x.key === metric);
  const fmt = m.money ? money : count;
  const trendMax = view ? niceMax(Math.max(...view.buckets.map((b) => b[metric]))) : 1;
  const trendTotal = view ? view.buckets.reduce((s, b) => s + b[metric], 0) : 0;
  const peakIdx = view ? view.buckets.reduce((best, b, i, arr) => (b[metric] > arr[best][metric] ? i : best), 0) : -1;
  const busiestDay = view && Math.max(...view.dayTotals) > 0 ? view.dayTotals.indexOf(Math.max(...view.dayTotals)) : null;
  const peakHour = view && Math.max(...view.hourTotals) > 0 ? view.hourTotals.indexOf(Math.max(...view.hourTotals)) : null;
  const pipelineMax = view ? Math.max(1, ...view.pipeline.map((p) => p.n)) : 1;
  const prevLabel = view?.r.prev;

  const HERO = [{ label: "Sales today", prev: "yesterday" }, { label: "Sales this week", prev: "last week" }, { label: "Sales all time" }];

  const KPIS = [
    { label: "Sales", key: "sales", f: money, icon: "profit" },
    { label: "Orders placed", key: "count", f: count, icon: "checkout" },
    { label: "Avg order value", key: "aov", f: money, icon: "tag" },
    { label: "Items sold", key: "items", f: count, icon: "box" },
    { label: "Selling stores", key: "stores", f: count, icon: "store" },
    { label: "New members", key: "newMembers", f: count, icon: "user" },
  ].map((k) => ({ ...k, v: view?.cur[k.key], p: view?.prev?.[k.key] }));

  return (
    <div className="portal-page an-page">
      <div className="an-head">
        <div>
          <div className="t-eyebrow">Sync analytics</div>
          <h1 className="portal-h1">Command centre</h1>
          <p className="portal-sub">Sales, orders, wallet deposits and who's selling what, live from the portal.</p>
        </div>
        <div className="an-live">
          <span className="an-live-dot" aria-hidden="true" />
          <span className="t-small">
            {data ? `Updated ${new Date(data.at).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}` : "Loading…"}
          </span>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setReload((n) => n + 1)}>
            <Icon name="refresh" size={16} />
            Refresh
          </button>
        </div>
      </div>

      {error && <div className="an-error">{error}</div>}

      <section className="an-hero" aria-label="Sales headline">
        {HERO.map((h, i) => {
          const row = view?.hero[i];
          return (
            <div key={h.label} className={`an-hero-card${i === 2 ? " is-total" : ""}`}>
              <div className="an-hero-glow" aria-hidden="true" />
              <span className="t-label">{h.label}</span>
              <span className="t-num an-hero-num">
                <CountUp value={row ? row.cur.sales : null} format={money} duration={2000} delay={i * 200} />
              </span>
              <span className="an-hero-meta">
                {row ? (
                  <>
                    <span className="t-small">
                      {count(row.cur.count)} order
                      {row.cur.count === 1 ? "" : "s"} · {count(row.cur.items)} items
                    </span>
                    {h.prev ? (
                      <Delta cur={row.cur.sales} prev={row.prev.sales} label={h.prev} />
                    ) : (
                      base.placed[0] && <span className="t-small t-muted">Since {shortDate(base.placed[0].ts)}</span>
                    )}
                  </>
                ) : (
                  <span className="an-skel an-skel-line" />
                )}
              </span>
            </div>
          );
        })}
      </section>

      <div className="an-filter" role="group" aria-label="Date range">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            className={`an-seg${range === r.key ? " is-on" : ""}`}
            aria-pressed={range === r.key}
            onClick={() => setRange(r.key)}
          >
            {r.label}
          </button>
        ))}
        <span className="t-small t-muted an-filter-note">Every panel below follows this range.</span>
      </div>

      <section className="an-kpis" aria-label="Key numbers">
        {KPIS.map((k, i) => (
          <div key={k.label} className="an-kpi">
            <span className="an-kpi-top">
              <span className="t-label">{k.label}</span>
              <Icon name={k.icon} size={18} className="t-gold" />
            </span>
            <span className="t-num an-kpi-num">
              <CountUp value={loading ? null : k.v} format={k.f} delay={i * 80} duration={1200} />
            </span>
            {!loading && <Delta cur={k.v} prev={k.p} label={prevLabel} />}
          </div>
        ))}
      </section>

      <section className="dash-card an-card an-trend">
        <div className="an-card-head">
          <div>
            <h2 className="t-h3">{m.label} trend</h2>
            <p className="t-small">
              {trendMode === "daily" ? "Last 30 days" : "Last 12 weeks"}
              {view && ` · ${fmt(trendTotal)} total`}
            </p>
          </div>
          <div className="an-toggles">
            <div className="an-mini-seg" role="group" aria-label="Metric">
              {METRICS.map((x) => (
                <button
                  key={x.key}
                  type="button"
                  className={metric === x.key ? "is-on" : ""}
                  aria-pressed={metric === x.key}
                  onClick={() => setMetric(x.key)}
                >
                  {x.label}
                </button>
              ))}
            </div>
            <div className="an-mini-seg" role="group" aria-label="Grouping">
              {["daily", "weekly"].map((x) => (
                <button
                  key={x}
                  type="button"
                  className={trendMode === x ? "is-on" : ""}
                  aria-pressed={trendMode === x}
                  onClick={() => setTrendMode(x)}
                >
                  {x === "daily" ? "Daily" : "Weekly"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {loading ? (
          <div className="an-skel an-skel-chart" />
        ) : (
          <>
            <div className="an-chart">
              <div className="an-chart-y" aria-hidden="true">
                <span>{m.money ? moneyShort(trendMax) : count(trendMax)}</span>
                <span>{m.money ? moneyShort(trendMax / 2) : count(trendMax / 2)}</span>
                <span>0</span>
              </div>
              <div className="an-chart-plot">
                <div className="an-grid-line" style={{ bottom: "100%" }} />
                <div className="an-grid-line" style={{ bottom: "50%" }} />
                <div className="an-grid-line is-base" style={{ bottom: 0 }} />
                <div className="an-bars" key={`${metric}-${trendMode}`}>
                  {view.buckets.map((b, i) => {
                    const label = trendMode === "daily" ? shortDate(b.start) : `Week of ${shortDate(b.start)}`;
                    return (
                      <div key={b.start} className="an-col" tabIndex={0} aria-label={`${label}: ${fmt(b[metric])}`}>
                        {i === peakIdx && b[metric] > 0 && (
                          <span
                            className="an-peak"
                            style={{
                              bottom: `calc(${(b[metric] / trendMax) * 100}% + 4px)`,
                            }}
                          >
                            {m.money ? moneyShort(b[metric]) : count(b[metric])}
                          </span>
                        )}
                        <span
                          className={`an-bar${i === peakIdx ? " is-peak" : ""}`}
                          style={{
                            height: `${(b[metric] / trendMax) * 100}%`,
                            "--i": i,
                          }}
                        />
                        <span className="an-tip" role="tooltip">
                          <strong>{label}</strong>
                          <span>Sales {money(b.sales)}</span>
                          <span>
                            {b.orders} order{b.orders === 1 ? "" : "s"}
                          </span>
                          <span>Top-ups {money(b.topups)}</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="an-chart-x" aria-hidden="true">
              {view.buckets.map((b, i) => (
                <span key={b.start}>{i % (trendMode === "daily" ? 5 : 2) === 0 || i === view.buckets.length - 1 ? shortDate(b.start) : ""}</span>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="an-row an-row-2-1">
        <section className="dash-card an-card">
          <div className="an-card-head">
            <div>
              <h2 className="t-h3">When orders land</h2>
              <p className="t-small">Orders placed by day and hour · {view?.r.label.toLowerCase()}</p>
            </div>
            <p className="an-readout t-small" aria-live="polite">
              {cell ? (
                <>
                  <strong>
                    {WEEKDAYS[cell.d]} {hourLabel(cell.h)}
                  </strong>{" "}
                  · {view.grid[cell.d][cell.h].orders} orders · {money(view.grid[cell.d][cell.h].sales)}
                </>
              ) : (
                "Hover a square for detail"
              )}
            </p>
          </div>
          {loading ? (
            <div className="an-skel an-skel-chart" />
          ) : (
            <>
              <div className="an-heat" onMouseLeave={() => setCell(null)}>
                {view.grid.map((row, d) => (
                  <div key={d} className="an-heat-row">
                    <span className="an-heat-day">{WEEKDAYS[d]}</span>
                    <div className="an-heat-cells">
                      {row.map((c, h) => (
                        <span
                          key={h}
                          className={`an-heat-cell${c.orders ? "" : " is-zero"}`}
                          style={{
                            "--v": c.orders / view.gridMax,
                            "--i": d * 3 + h,
                          }}
                          tabIndex={0}
                          aria-label={`${WEEKDAYS_LONG[d]} ${hourLabel(h)}: ${c.orders} orders`}
                          onMouseEnter={() => setCell({ d, h })}
                          onFocus={() => setCell({ d, h })}
                        />
                      ))}
                    </div>
                    <span className="an-heat-total t-small">{view.dayTotals[d]}</span>
                  </div>
                ))}
                <div className="an-heat-row an-heat-axis" aria-hidden="true">
                  <span className="an-heat-day" />
                  <div className="an-heat-cells">
                    {Array.from({ length: 24 }, (_, h) => (
                      <span key={h}>{h % 6 === 0 ? hourLabel(h) : ""}</span>
                    ))}
                  </div>
                  <span className="an-heat-total" />
                </div>
              </div>
              <div className="an-heat-foot">
                <div className="an-callouts">
                  <div>
                    <span className="t-label">Busiest day</span>
                    <span className="an-callout-v">{busiestDay != null ? WEEKDAYS_LONG[busiestDay] : "—"}</span>
                  </div>
                  <div>
                    <span className="t-label">Peak hour</span>
                    <span className="an-callout-v">{peakHour != null ? `${hourLabel(peakHour)}–${hourLabel((peakHour + 1) % 24)}` : "—"}</span>
                  </div>
                  <div>
                    <span className="t-label">Best single day</span>
                    <span className="an-callout-v">
                      {view.bestDate ? `${shortDate(Number(view.bestDate[0]))} · ${money(view.bestDate[1])}` : "—"}
                    </span>
                  </div>
                </div>
                <div className="an-legend t-small" aria-hidden="true">
                  Fewer <span className="an-legend-ramp" /> More
                </div>
              </div>
            </>
          )}
        </section>

        <section className="dash-card an-card an-wallet">
          <div className="an-card-head">
            <div>
              <h2 className="t-h3">Wallet deposits</h2>
              <p className="t-small">Member top-ups · {view?.r.label.toLowerCase()}</p>
            </div>
            <Icon name="wallet" className="t-gold" />
          </div>
          <span className="t-num an-wallet-num">
            <CountUp value={loading ? null : view.cur.deposits} format={money} duration={1600} />
          </span>
          {!loading && <Delta cur={view.cur.deposits} prev={view.prev?.deposits} label={prevLabel} />}
          <dl className="an-wallet-list">
            <div>
              <dt>Top-ups</dt>
              <dd>{loading ? "…" : count(view.cur.depositCount)}</dd>
            </div>
            <div>
              <dt>Average deposit</dt>
              <dd>{loading ? "…" : money(view.cur.avgDeposit)}</dd>
            </div>
            <div>
              <dt>Held in wallets now</dt>
              <dd>{loading ? "…" : money(base.held)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="an-row an-row-1-1">
        <section className="dash-card an-card">
          <div className="an-card-head">
            <div>
              <h2 className="t-h3">Top stores</h2>
              <p className="t-small">By sales · {view?.r.label.toLowerCase()}</p>
            </div>
          </div>
          {loading ? (
            <div className="an-skel an-skel-list" />
          ) : view.stores.length === 0 ? (
            <p className="t-small t-muted an-empty">No sales in this range yet.</p>
          ) : (
            <ol className="an-board">
              {view.stores.map((s, i) => (
                <li key={s.id} style={{ "--i": i }}>
                  <span className={`an-rank${i < 3 ? " is-top" : ""}`}>{i + 1}</span>
                  <span className="an-board-main">
                    <Link to={`/admin/clients/${s.id}`} className="an-board-name">
                      {base.storeName(s.id)}
                    </Link>
                    <span className="t-small t-muted">
                      {s.orders} order{s.orders === 1 ? "" : "s"} · {s.items} items · last {ago(s.last)}
                    </span>
                    <span className="an-share">
                      <span
                        style={{
                          width: `${(s.sales / view.stores[0].sales) * 100}%`,
                        }}
                      />
                    </span>
                  </span>
                  <span className="an-board-v">
                    {money(s.sales)}
                    <span className="t-small t-muted">{view.cur.sales ? Math.round((s.sales / view.cur.sales) * 100) : 0}% of sales</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="dash-card an-card">
          <div className="an-card-head">
            <div>
              <h2 className="t-h3">Top products</h2>
              <p className="t-small">Best sellers · {view?.r.label.toLowerCase()}</p>
            </div>
            <div className="an-mini-seg" role="group" aria-label="Rank products by">
              {[
                ["units", "Units"],
                ["revenue", "Revenue"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  type="button"
                  className={productSort === k ? "is-on" : ""}
                  aria-pressed={productSort === k}
                  onClick={() => setProductSort(k)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="an-skel an-skel-list" />
          ) : view.products.length === 0 ? (
            <p className="t-small t-muted an-empty">No items sold in this range yet.</p>
          ) : (
            <ol className="an-board">
              {view.products.map((p, i) => {
                const lead = productSort === "units" ? view.products[0].units : view.products[0].revenue;
                const v = productSort === "units" ? p.units : p.revenue;
                return (
                  <li key={p.key} style={{ "--i": i }}>
                    <span className={`an-rank${i < 3 ? " is-top" : ""}`}>{i + 1}</span>
                    {p.image ? <img className="an-thumb" src={p.image} alt="" loading="lazy" /> : <span className="an-thumb" />}
                    <span className="an-board-main">
                      <span className="an-board-name">{p.name}</span>
                      <span className="t-small t-muted">
                        {p.orders.size} order{p.orders.size === 1 ? "" : "s"} · {money(p.revenue)}
                      </span>
                      <span className="an-share">
                        <span style={{ width: `${lead ? (v / lead) * 100 : 0}%` }} />
                      </span>
                    </span>
                    <span className="an-board-v">
                      {productSort === "units" ? count(p.units) : money(p.revenue)}
                      <span className="t-small t-muted">{productSort === "units" ? "units" : `${count(p.units)} units`}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <div className="an-row an-row-1-2">
        <section className="dash-card an-card">
          <div className="an-card-head">
            <div>
              <h2 className="t-h3">Order pipeline</h2>
              <p className="t-small">
                {view ? `${count(view.allInRange.length)} orders created` : "Orders created"} · {view?.r.label.toLowerCase()}
              </p>
            </div>
          </div>
          {loading ? (
            <div className="an-skel an-skel-list" />
          ) : (
            <ul className="an-pipe">
              {view.pipeline.map((p, i) => (
                <li key={p.label} style={{ "--i": i }}>
                  <span className={`chip chip-${p.tone}`}>{p.label}</span>
                  <span className="an-share">
                    <span style={{ width: `${(p.n / pipelineMax) * 100}%` }} />
                  </span>
                  <span className="an-pipe-n">{count(p.n)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="dash-card an-card">
          <div className="an-card-head">
            <div>
              <h2 className="t-h3">Latest activity</h2>
              <p className="t-small">Newest sales and wallet top-ups</p>
            </div>
          </div>
          {loading ? (
            <div className="an-skel an-skel-list" />
          ) : view.activity.length === 0 ? (
            <p className="t-small t-muted an-empty">Nothing yet.</p>
          ) : (
            <ul className="an-feed">
              {view.activity.map((a, i) => (
                <li key={`${a.kind}-${a.ts}-${i}`} style={{ "--i": i }}>
                  <span className={`an-feed-icon is-${a.kind}`}>
                    <Icon name={a.kind === "order" ? "truck" : "wallet"} size={16} />
                  </span>
                  <span className="an-feed-main">
                    <strong>{a.kind === "order" ? "Sale" : "Wallet top-up"}</strong>{" "}
                    <Link to={`/admin/clients/${a.id}`} className="t-small">
                      {a.who}
                    </Link>
                  </span>
                  <span className="an-feed-v">{money(a.amount)}</span>
                  <span className="t-small t-muted an-feed-t">{ago(a.ts)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
