import { useEffect, useState } from "react";
import { getStoredUTMParams, isLocalhost } from "../utils/analytics";

export default function UTMIndicator() {
  const [params, setParams] = useState(null);

  useEffect(() => {
    if (!isLocalhost()) return;
    setParams(getStoredUTMParams());
    const id = setInterval(() => setParams(getStoredUTMParams()), 2000);
    return () => clearInterval(id);
  }, []);

  if (!isLocalhost()) return null;

  return (
    <div className="utm-indicator">
      <strong>UTM (dev only)</strong>
      {params && Object.keys(params).length > 0 ? (
        Object.entries(params).map(([k, v]) => (
          <div key={k}>{k}: {v}</div>
        ))
      ) : (
        <div style={{ color: "var(--text-dim)" }}>none captured</div>
      )}
    </div>
  );
}
