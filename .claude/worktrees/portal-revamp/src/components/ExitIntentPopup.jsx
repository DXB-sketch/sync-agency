import { useState, useRef, useEffect } from "react";

export default function ExitIntentPopup() {
  const [show, setShow] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    const onLeave = (e) => {
      if (e.clientY <= 8 && !fired.current) {
        fired.current = true;
        setShow(true);
      }
    };
    const arm = setTimeout(() => document.addEventListener("mouseleave", onLeave), 6000);
    return () => { clearTimeout(arm); document.removeEventListener("mouseleave", onLeave); };
  }, []);

  if (!show) return null;
  return (
    <div className="exit-overlay" onClick={(e) => e.target === e.currentTarget && setShow(false)}>
      <div className="exit-modal">
        <button className="exit-close" onClick={() => setShow(false)} aria-label="Close">×</button>
        <div className="exit-eyebrow">Wait, before you go</div>
        <h2>The dashboard<br />is <em>free.</em></h2>
        <p>
          You don't need to buy anything to start. Create a free account, follow the pathway,
          and see the system for yourself — no card, no commitment.
        </p>
        <div className="exit-stats">
          <div className="exit-stat">
            <div className="exit-stat-num">1200+</div>
            <div className="exit-stat-label">Clients</div>
          </div>
          <div className="exit-stat">
            <div className="exit-stat-num">100%</div>
            <div className="exit-stat-label">Success</div>
          </div>
          <div className="exit-stat">
            <div className="exit-stat-num">&lt;2hr</div>
            <div className="exit-stat-label">Response</div>
          </div>
        </div>
        <a
          href="/signup"
          className="btn-gold"
          style={{ display: "flex", width: "100%", justifyContent: "center", fontSize: 14, padding: "16px 32px" }}
          onClick={() => setShow(false)}
        >
          Create your free account →
        </a>
        <button className="exit-dismiss" onClick={() => setShow(false)}>
          No thanks, I'll figure it out myself
        </button>
      </div>
    </div>
  );
}
