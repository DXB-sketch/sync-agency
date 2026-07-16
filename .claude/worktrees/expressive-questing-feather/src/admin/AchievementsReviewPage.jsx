import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";

// Review queue for member-submitted proof screenshots. Approved proofs double
// as a browsable promo-content library (the "Verified" tab).
export default function AchievementsReviewPage() {
  const { profile: admin } = useAuth();
  const [tab, setTab] = useState("Pending");
  const [rows, setRows] = useState([]);
  const [urls, setUrls] = useState({});
  const [loading, setLoading] = useState(true);

  async function load(which) {
    setLoading(true);
    const { data } = await supabase
      .from("member_achievements")
      .select("*, achievements(title), profiles!member_achievements_member_id_fkey(email)")
      .eq("status", which === "Pending" ? "proof_submitted" : "verified")
      .order("submitted_at", { ascending: false });
    const list = data ?? [];
    setRows(list);

    // proofs are in a private bucket — sign URLs for display
    const paths = list.map((r) => r.proof_image_url).filter(Boolean);
    if (paths.length) {
      const { data: signed } = await supabase.storage
        .from("achievement-proofs")
        .createSignedUrls(paths, 3600);
      setUrls(Object.fromEntries((signed ?? []).map((s) => [s.path, s.signedUrl])));
    } else {
      setUrls({});
    }
    setLoading(false);
  }

  useEffect(() => {
    load(tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function review(row, approve) {
    await supabase
      .from("member_achievements")
      .update({
        status: approve ? "verified" : "rejected",
        verified_by: approve ? admin.id : null,
        verified_at: approve ? new Date().toISOString() : null,
      })
      .eq("id", row.id);
    await load(tab);
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Achievements review</h1>
        <p className="portal-sub">
          Approve or reject member proof. Verified screenshots become your promo library.
        </p>
      </div>

      <div className="admin-tabs">
        {["Pending", "Verified"].map((t) => (
          <button key={t} className={`admin-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="portal-sub">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="portal-empty">
          <p>{tab === "Pending" ? "No proofs waiting for review." : "No verified proofs yet."}</p>
        </div>
      ) : (
        <div className="review-grid">
          {rows.map((row) => (
            <div key={row.id} className="review-card">
              {row.proof_image_url && urls[row.proof_image_url] ? (
                <a href={urls[row.proof_image_url]} target="_blank" rel="noreferrer">
                  <img src={urls[row.proof_image_url]} alt="Proof screenshot" className="review-img" />
                </a>
              ) : (
                <div className="review-img review-img-empty">No image</div>
              )}
              <div className="review-body">
                <h2 className="ach-title">{row.achievements?.title}</h2>
                <p className="ach-desc">
                  {row.profiles?.email}
                  {row.submitted_at && ` · ${new Date(row.submitted_at).toLocaleDateString()}`}
                </p>
                {tab === "Pending" ? (
                  <div className="review-actions">
                    <button className="btn-gold admin-advance" onClick={() => review(row, true)}>
                      Approve
                    </button>
                    <button className="btn-ghost admin-view-btn" onClick={() => review(row, false)}>
                      Reject
                    </button>
                  </div>
                ) : (
                  <span className="ach-status ach-status-verified">Verified ✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
