const MARQUEE_ITEMS = [
  "Free dashboard", "1200+ clients", "100% success rate", "Australian owned",
  "Depop coaching system", "Proven system", "Private suppliers",
  "1-on-1 support", "Daily product drops", "Real results",
  "5000+ rep items", "Free dashboard", "1200+ clients", "100% success rate",
  "Australian owned", "Depop coaching system", "Proven system",
  "Private suppliers", "1-on-1 support", "Daily product drops",
  "Real results", "5000+ rep items",
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
