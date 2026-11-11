import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { CRATES } from "../lib/rewards";
import { BackIcon, ShieldIcon } from "../components/portal/RewardIcons";

// Published odds. Read from crate_odds, the same table the server rolls against.
export default function CrateOddsPage() {
  const [odds, setOdds] = useState(null);

  useEffect(() => {
    supabase
      .from("crate_odds")
      .select("*")
      .order("sort")
      .then(({ data }) => setOdds(data ?? []));
  }, []);

  return (
    <div className="portal-page">
      <div className="rw-page" style={{ gap: 18, maxWidth: 900 }}>
        <div>
          <Link to="/portal/rewards/crates" className="rw-back">
            <BackIcon />
            Mystery crates
          </Link>
          <h1 className="rw-title" style={{ marginTop: 8 }}>
            Crate odds
          </h1>
          <p className="rw-sub" style={{ display: "block" }}>
            Every crate pays out one reward. These are the exact chances. Crates come from levelling up and can't be
            bought.
          </p>
        </div>

        {!odds ? (
          <p className="portal-sub">Loading odds…</p>
        ) : (
          <div className="rw-odds-cards">
            {["silver", "gold"].map((type) => (
              <section key={type} className={`dash-card rw-odds-card is-${type}`}>
                <div className="rw-section-head" style={{ alignItems: "center", marginBottom: 2 }}>
                  <span className={`rw-crate-pill is-${type}`} style={{ fontSize: 10.5, padding: "5px 12px" }}>
                    <ShieldIcon size={12} />
                    {CRATES[type].name} crate
                  </span>
                  <span className="rw-note" style={{ fontSize: 11 }}>
                    {CRATES[type].when}
                  </span>
                </div>
                {odds
                  .filter((o) => o.crate_type === type)
                  .map((o) => (
                    <div key={o.key} className={`rw-odds-row rarity-${o.rarity} is-${o.rarity}`} style={{ gridTemplateColumns: "minmax(0, 1fr) 96px 36px" }}>
                      <span className="rw-odds-label" style={{ fontSize: 13 }}>
                        <span className="rw-dot" />
                        <span>{o.label}</span>
                      </span>
                      <span className="rw-odds-bar">
                        <span style={{ width: `${Math.min(100, (Number(o.chance) / 20) * 100)}%` }} />
                      </span>
                      <span className="rw-odds-pct">{Number(o.chance)}%</span>
                    </div>
                  ))}
              </section>
            ))}
          </div>
        )}

        <div className="rw-legend">
          {["legendary", "epic", "rare", "common"].map((r) => (
            <span key={r} className={`rarity-${r}`}>
              <span className="rw-dot" style={{ boxShadow: "none" }} />
              {r[0].toUpperCase() + r.slice(1)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
