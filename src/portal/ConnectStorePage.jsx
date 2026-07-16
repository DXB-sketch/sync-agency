import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

const STATUS_LABELS = {
  pending: "Pending",
  connected: "Connected",
  error: "Needs reconnecting",
  disconnected: "Disconnected",
};

export default function ConnectStorePage() {
  const [store, setStore] = useState(null);
  const [loading, setLoading] = useState(true);
  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [apiSecretKey, setApiSecretKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function loadStore() {
    // No .eq('member_id', ...) needed — RLS already scopes this to the
    // signed-in member's own row. access_token_enc is deliberately left out
    // of the column list: it's revoked from the authenticated role at the DB
    // level, so a select('*') here would fail outright.
    const { data } = await supabase
      .from("shopify_stores")
      .select("id, shop_domain, status, last_health_check_at, created_at")
      .maybeSingle();
    setStore(data ?? null);
    setLoading(false);
  }

  useEffect(() => {
    loadStore();
  }, []);

  async function connect(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: fnErr } = await supabase.functions.invoke("shopify-connect", {
      body: {
        action: "connect",
        shop_domain: shopDomain.trim(),
        access_token: accessToken.trim(),
        api_secret_key: apiSecretKey.trim(),
      },
    });
    if (fnErr || data?.error) {
      setError(data?.error ?? "Could not connect that store.");
      setBusy(false);
      return;
    }
    setAccessToken("");
    setApiSecretKey("");
    setBusy(false);
    await loadStore();
  }

  async function disconnect() {
    if (!window.confirm("Disconnect your Shopify store? Product links stay saved for when you reconnect.")) return;
    setBusy(true);
    setError(null);
    const { data, error: fnErr } = await supabase.functions.invoke("shopify-connect", {
      body: { action: "disconnect" },
    });
    if (fnErr || data?.error) {
      setError(data?.error ?? "Could not disconnect.");
    }
    setBusy(false);
    await loadStore();
  }

  const showConnectForm = !loading && (!store || store.status === "disconnected" || store.status === "error");

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Connect your Shopify store</h1>
        <p className="portal-sub">
          Link your Shopify store so its orders can flow through Sync's fulfilment engine.
          Takes about 2 minutes, all inside your own Shopify admin.
        </p>
      </div>

      {loading ? (
        <p className="portal-sub">Loading…</p>
      ) : (
        <>
          {store && store.status !== "disconnected" && (
            <div className="dash-card store-status-card">
              <div>
                <h2 className="dash-card-title">{store.shop_domain}</h2>
                <p className="dash-card-sub">
                  {store.last_health_check_at
                    ? `Last checked ${new Date(store.last_health_check_at).toLocaleString()}`
                    : "Not checked yet — the daily health check runs overnight."}
                </p>
              </div>
              <div className="store-status-actions">
                <span className={`order-status store-status-${store.status}`}>
                  {STATUS_LABELS[store.status]}
                </span>
                {store.status === "connected" && (
                  <Link to="/portal/store/products" className="btn-ghost">
                    Link products
                  </Link>
                )}
                <button className="btn-ghost danger-btn" disabled={busy} onClick={disconnect}>
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {store?.status === "error" && (
            <p className="auth-error">
              Shopify rejected the stored token on the last health check. Reconnect below with a fresh
              Admin API access token.
            </p>
          )}

          {showConnectForm && (
            <>
              <ol className="connect-store-steps">
                <li>In your Shopify admin, go to <strong>Settings → Apps and sales channels → Develop apps</strong>.</li>
                <li>Click <strong>Create an app</strong>, name it (e.g. "Sync Fulfilment").</li>
                <li>
                  Under <strong>Configuration → Admin API scopes</strong>, enable{" "}
                  <code>read_orders</code>, <code>write_fulfillments</code>, and{" "}
                  <code>read_products</code>.
                </li>
                <li>Click <strong>Install app</strong>, then reveal and copy the <strong>Admin API access token</strong> (shown once).</li>
                <li>
                  On the app's <strong>API credentials</strong> tab, copy the <strong>API secret key</strong> (Shopify's
                  "Client secret") too — Sync uses it to verify order notifications really came from your store.
                </li>
                <li>Paste your store's domain and both values below.</li>
              </ol>

              {error && <p className="auth-error">{error}</p>}

              <form className="connect-store-form" onSubmit={connect}>
                <input
                  className="auth-input"
                  placeholder="your-store.myshopify.com"
                  value={shopDomain}
                  onChange={(e) => setShopDomain(e.target.value)}
                  required
                />
                <input
                  className="auth-input"
                  type="password"
                  placeholder="Admin API access token (shpat_…)"
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  required
                />
                <input
                  className="auth-input"
                  type="password"
                  placeholder="API secret key (Client secret)"
                  value={apiSecretKey}
                  onChange={(e) => setApiSecretKey(e.target.value)}
                  required
                />
                <button className="btn-gold" disabled={busy}>
                  {busy ? "Connecting…" : "Connect store"}
                </button>
              </form>
            </>
          )}
        </>
      )}
    </div>
  );
}
