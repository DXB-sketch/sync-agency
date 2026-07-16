import { Link } from "react-router-dom";

// Admin-only hub for Project Chronos while it's staged behind an admin gate
// (no client-facing entry point exists yet — see docs/FOUNDER_DECISIONS_REQUIRED.md).
// Every link below either already lives in the admin nav (Margins, Exceptions) or
// is a portal-styled member page wrapped in RequireAdmin (App.jsx) so no client can
// reach it by URL either.
const LINKS = [
  {
    to: "/portal/wallet",
    title: "Wallet",
    body: "Member wallet balance, top-ups, ledger. Admins always have wallet access regardless of the WALLET_MEMBER_IDS allowlist.",
  },
  {
    to: "/portal/store",
    title: "Connect Shopify store",
    body: "The member-facing Connect Store flow — paste a custom app token to link a Shopify store to a Sync account.",
  },
  {
    to: "/portal/store/products",
    title: "Link products",
    body: "Match a connected store's Shopify products to Sync catalogue products.",
  },
  {
    to: "/portal/pathway",
    title: "Shopify education pathway",
    body: "The 7-module Shopify course tree. Admins see both pathways regardless of grants.",
  },
  {
    to: "/admin/margins",
    title: "Margin alerts",
    body: "CJ Dropshipping nightly price/stock sync results and margin-floor flags.",
  },
  {
    to: "/admin/exceptions",
    title: "Fulfilment exceptions",
    body: "Orders that failed to auto-dispatch to CJ — unlinked products, CJ errors, etc.",
  },
];

export default function ChronosPreviewPage() {
  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Chronos Preview</h1>
      </div>

      <p className="dash-card-sub" style={{ marginBottom: 24 }}>
        Project Chronos is live on production but admin-gated: nothing below is visible or
        reachable by a client. The CJ Dropshipping auto-dispatch trigger and its cron sweeps are
        also intentionally not wired up yet — creating a CJ order requires at least one real
        product linked to a supplier first, and staging that here would just generate exception
        noise on real Depop orders. See docs/FOUNDER_DECISIONS_REQUIRED.md for the full status.
      </p>

      <div className="more-list">
        {LINKS.map((l) => (
          <Link key={l.to} to={l.to} className="more-row" style={{ alignItems: "flex-start" }}>
            <span className="more-row-main" style={{ flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
              <strong>{l.title}</strong>
              <span className="dash-card-sub" style={{ margin: 0 }}>{l.body}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
