import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

// Latest nightly CJ price/stock sync results (docs/PHASE1_PLAN.md §3.2).
export default function MarginAlertsPage() {
  const [log, setLog] = useState(null);
  const [outOfStock, setOutOfStock] = useState([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    const [{ data: logs }, { data: stock }] = await Promise.all([
      supabase.from("price_sync_log").select("*").order("run_at", { ascending: false }).limit(1),
      supabase
        .from("supplier_products")
        .select("*")
        .eq("stock_state", "out_of_stock")
        .order("last_synced_at", { ascending: false }),
    ]);
    setLog(logs?.[0] ?? null);
    setOutOfStock(stock ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function runSync() {
    setError(null);
    setRunning(true);
    const { data, error: fnErr } = await supabase.functions.invoke("nightly-price-sync", { body: {} });
    if (fnErr || data?.error) {
      setError(
        data?.error ?? fnErr?.message ?? "Sync failed to run — nightly-price-sync may not be deployed yet."
      );
    }
    await load();
    setRunning(false);
  }

  const details = log?.details ?? [];
  const breaches = details.filter(
    (d) => d.margin_pct != null && d.floor != null && Number(d.margin_pct) < Number(d.floor)
  );

  return (
    <div className="portal-page">
      <div className="portal-page-head portal-page-head-row">
        <div>
          <h1 className="portal-h1">Margins</h1>
          <p className="portal-sub">
            Nightly CJ price/stock sync results — products below their margin floor and supplier
            stock-outs.
          </p>
        </div>
        <button className="btn-gold" disabled={running} onClick={runSync}>
          {running ? "Running…" : "Run sync now"}
        </button>
      </div>

      {error && <p className="auth-error">{error}</p>}

      {loading ? (
        <p className="portal-sub">Loading…</p>
      ) : !log ? (
        <div className="portal-empty">
          <p>No sync has run yet — press "Run sync now" to pull live CJ prices and margins.</p>
        </div>
      ) : (
        <>
          <div className="admin-product-form">
            <h2 className="dash-card-title">Latest run</h2>
            <p className="dash-card-sub">
              {new Date(log.run_at).toLocaleString()} · FX{" "}
              {log.fx_rate ? `${Number(log.fx_rate).toFixed(4)} AUD/USD` : "unknown"} ·{" "}
              {log.products_checked} checked · {log.price_changes} price changes · {log.margin_flags}{" "}
              margin flags · {log.stock_flags} stock flags
            </p>
            {log.errors && Array.isArray(log.errors) && log.errors.length > 0 && (
              <p className="admin-warn">{log.errors.length} SKU(s) failed to sync this run.</p>
            )}
          </div>

          <h2 className="dash-card-title">Margin breaches ({breaches.length})</h2>
          {breaches.length === 0 ? (
            <div className="portal-empty">
              <p>Nothing below its margin floor.</p>
            </div>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Listing (AUD)</th>
                    <th>Landed (AUD)</th>
                    <th>Margin</th>
                    <th>Floor</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {breaches.map((d, i) => (
                    <tr key={d.product_id ?? d.pool_product_id ?? i} className="margin-row-breach">
                      <td>{d.name}</td>
                      <td>${Number(d.listing_price).toFixed(2)}</td>
                      <td>${Number(d.landed_aud).toFixed(2)}</td>
                      <td>{Number(d.margin_pct).toFixed(1)}%</td>
                      <td>{Number(d.floor).toFixed(0)}%</td>
                      <td>
                        <Link className="btn-ghost admin-view-btn" to="/admin/products">
                          Fix
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <h2 className="dash-card-title">Out of stock ({outOfStock.length})</h2>
      {outOfStock.length === 0 ? (
        <div className="portal-empty">
          <p>Nothing flagged out of stock.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Last synced</th>
              </tr>
            </thead>
            <tbody>
              {outOfStock.map((sp) => (
                <tr key={sp.id}>
                  <td>
                    <div className="admin-product-cell">
                      {sp.image_url && <img src={sp.image_url} alt="" />}
                      {sp.display_name ?? sp.external_sku}
                    </div>
                  </td>
                  <td>{sp.external_sku}</td>
                  <td>{sp.last_synced_at ? new Date(sp.last_synced_at).toLocaleString() : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
