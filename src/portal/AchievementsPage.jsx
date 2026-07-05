import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/AuthContext";
import PathwayIcon from "../components/portal/PathwayIcon";

export default function AchievementsPage() {
  const { profile } = useAuth();
  const [achievements, setAchievements] = useState([]);
  const [mine, setMine] = useState({});
  const [uploadingId, setUploadingId] = useState(null);
  const [error, setError] = useState(null);
  const fileInput = useRef(null);
  const pendingId = useRef(null);

  async function load() {
    const [{ data: a }, { data: m }] = await Promise.all([
      supabase.from("achievements").select("*").order("sort_order"),
      supabase.from("member_achievements").select("*"),
    ]);
    setAchievements(a ?? []);
    setMine(Object.fromEntries((m ?? []).map((r) => [r.achievement_id, r])));
  }

  useEffect(() => {
    load();
  }, []);

  function startUpload(achievementId) {
    pendingId.current = achievementId;
    fileInput.current?.click();
  }

  async function handleFile(e) {
    const file = e.target.files?.[0];
    const achievementId = pendingId.current;
    e.target.value = "";
    if (!file || !achievementId) return;
    setError(null);
    setUploadingId(achievementId);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${profile.id}/${achievementId}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("achievement-proofs")
        .upload(path, file, { contentType: file.type });
      if (upErr) throw upErr;

      const { error: dbErr } = await supabase.from("member_achievements").upsert(
        {
          member_id: profile.id,
          achievement_id: achievementId,
          status: "proof_submitted",
          proof_image_url: path,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "member_id,achievement_id" }
      );
      if (dbErr) throw dbErr;
      await load();
    } catch (err) {
      setError(err.message ?? "Upload failed");
    }
    setUploadingId(null);
  }

  function statusFor(a) {
    return mine[a.id]?.status ?? "not_started";
  }

  return (
    <div className="portal-page">
      <div className="portal-page-head">
        <h1 className="portal-h1">Achievements</h1>
        <p className="portal-sub">
          Hit a milestone? Upload a screenshot as proof — the Sync team verifies it and the badge
          is yours.
        </p>
      </div>

      {error && <p className="auth-error">{error}</p>}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFile}
      />

      <div className="ach-grid">
        {achievements.map((a) => {
          const status = statusFor(a);
          return (
            <div key={a.id} className={`ach-card ach-${status}`}>
              <PathwayIcon
                name={a.icon}
                state={status === "verified" ? "complete" : status === "not_started" ? "available" : "in_progress"}
                size={44}
              />
              <h2 className="ach-title">{a.title}</h2>
              <p className="ach-desc">{a.description}</p>
              {status === "verified" && <span className="ach-status ach-status-verified">Earned ✓</span>}
              {status === "proof_submitted" && (
                <span className="ach-status ach-status-pending">Proof under review</span>
              )}
              {status === "rejected" && (
                <span className="ach-status ach-status-rejected">Proof rejected — try again</span>
              )}
              {(status === "not_started" || status === "rejected") && (
                <button
                  className="btn-ghost ach-upload"
                  disabled={uploadingId === a.id}
                  onClick={() => startUpload(a.id)}
                >
                  {uploadingId === a.id ? "Uploading…" : "Upload proof"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
