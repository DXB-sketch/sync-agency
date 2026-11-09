const MARQUEE_ITEMS = [
  "Members dashboard", "Australian owned", "Depop coaching system",
  "Step-by-step pathway", "Supplier network", "1-on-1 support",
  "Daily product drops", "Members dashboard", "Australian owned",
  "Depop coaching system", "Step-by-step pathway", "Supplier network",
  "1-on-1 support", "Daily product drops",
];

export default function Marquee() {
  return (
    <div className="marquee-wrap">
      <div className="marquee-track">
        {MARQUEE_ITEMS.map((item, i) => (
          <div key={i} className="marquee-item">
            <div className="marquee-dot" />
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}
