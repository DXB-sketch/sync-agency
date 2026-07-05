import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { TIERS } from "../lib/tiers";

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Clients</h1>
        <p className="portal-sub">Every member, their tier, and when they joined.</p>
      </div>

      {loading ? (
        <p className="portal-sub">Loading…</p>
      ) : clients.length === 0 ? (
        <div className="portal-empty">
          <p>No members yet.</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
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
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>{c.email}</td>
                  <td>
                    {c.tier ? (
                      <span className={`tier-badge tier-${c.tier}`}>{TIERS[c.tier].short}</span>
                    ) : (
                      <span className="admin-warn">No tier</span>
                    )}
                  </td>
                  <td>{c.billing_type ?? "—"}</td>
                  <td>
                    {c.subscription_active ? (
                      "Active"
                    ) : (
                      <span className="admin-warn">Inactive</span>
                    )}
                  </td>
                  <td>{new Date(c.created_at).toLocaleDateString()}</td>
                  <td>
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
