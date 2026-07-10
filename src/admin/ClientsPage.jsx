import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { TIERS } from "../lib/tiers";

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    supabase
      .from("profiles")
      .select("*")
      .eq("role", "member")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setClients(data ?? []);
        setLoading(false);
      });
  }, []);

  const q = search.trim().toLowerCase();
  const shown = clients.filter(
    (c) =>
      !q ||
      c.email.toLowerCase().includes(q) ||
      (c.full_name ?? "").toLowerCase().includes(q) ||
      (c.tier ?? "").toLowerCase().includes(q)
  );

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Clients</h1>
        <p className="portal-sub">Every member, their tier, and when they joined.</p>
      </div>

      <input
        className="auth-input admin-search"
        placeholder={`Search ${clients.length} clients…`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {loading ? (
        <p className="portal-sub">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="portal-empty">
          <p>{clients.length === 0 ? "No members yet." : "No clients match your search."}</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table admin-table-stack">
            <thead>
              <tr>
                <th>Email</th>
                <th>Tier</th>
                <th>Billing</th>
                <th>Status</th>
                <th>Joined</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map((c) => (
                <tr key={c.id}>
                  <td data-label="Email">{c.email}</td>
                  <td data-label="Tier">
                    {c.tier ? (
                      <span className={`tier-badge tier-${c.tier}`}>{TIERS[c.tier].short}</span>
                    ) : (
                      <span className="admin-warn">No tier</span>
                    )}
                  </td>
                  <td data-label="Billing">{c.billing_type ?? "—"}</td>
                  <td data-label="Status">
                    {c.subscription_active ? (
                      "Active"
                    ) : (
                      <span className="admin-warn">Inactive</span>
                    )}
                  </td>
                  <td data-label="Joined">{new Date(c.created_at).toLocaleDateString()}</td>
                  <td data-label="">
                    <Link to={`/admin/clients/${c.id}`} className="btn-ghost admin-view-btn">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
