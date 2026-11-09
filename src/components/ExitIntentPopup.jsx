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
        <h2>Questions before<br />you <em>decide?</em></h2>
        <p>
          Every client gets the step-by-step pathway, product slots stocked by our team,
          and coaching that answers within hours. Pick the level of support that suits you.
        </p>
        <div className="exit-stats">
          <div className="exit-stat">
            <div className="exit-stat-num">&lt;2hr</div>
            <div className="exit-stat-label">Response</div>
          </div>
        </div>
        <a
          href="#pricing"
          className="btn-gold"
          style={{ display: "flex", width: "100%", justifyContent: "center", fontSize: 14, padding: "16px 32px" }}
          onClick={() => setShow(false)}
        >
          Choose your plan →
        </a>
        <button className="exit-dismiss" onClick={() => setShow(false)}>
          No thanks, I'll figure it out myself
        </button>
      </div>
    </div>
  );
}
