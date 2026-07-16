import { useState, useRef, useEffect } from "react";

const SP_NOTIFICATIONS = [
  { initials: "JM", name: "Jordan M.", location: "Sydney", tier: "Elite Scale" },
  { initials: "AR", name: "Aisha R.", location: "Melbourne", tier: "VIP Inner Circle" },
  { initials: "TK", name: "Tyler K.", location: "Brisbane", tier: "Pro Accelerator" },
  { initials: "EL", name: "Emma L.", location: "Perth", tier: "Elite Scale" },
  { initials: "LW", name: "Liam W.", location: "Adelaide", tier: "Pro Accelerator" },
  { initials: "SC", name: "Sophie C.", location: "Gold Coast", tier: "Elite Scale" },
  { initials: "NK", name: "Nathan K.", location: "Hobart", tier: "VIP Inner Circle" },
  { initials: "MR", name: "Mia R.", location: "Canberra", tier: "Pro Accelerator" },
];

export default function SocialProofTicker() {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    const initial = setTimeout(() => {
      started.current = true;
      setVisible(true);
    }, 4000);
    return () => clearTimeout(initial);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const hide = setTimeout(() => setFadeOut(true), 4200);
    const next = setTimeout(() => {
      setFadeOut(false);
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % SP_NOTIFICATIONS.length);
        setVisible(true);
      }, 5800);
    }, 4600);
    return () => { clearTimeout(hide); clearTimeout(next); };
  }, [visible, idx]);

  if (!visible) return null;
  const n = SP_NOTIFICATIONS[idx];
  return (
    <div className="sp-ticker">
      <div className={`sp-toast${fadeOut ? " sp-fade-out" : ""}`}>
        <div className="sp-avatar">{n.initials}</div>
        <div>
          <div className="sp-name">{n.name} · {n.location}</div>
          <div className="sp-detail">just enrolled in</div>
          <div className="sp-tier">{n.tier}</div>
        </div>
      </div>
    </div>
  );
}
