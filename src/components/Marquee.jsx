import Icon from "./SiteIcon";

const ITEMS = [
  { icon: "home", label: "Members dashboard" },
  { icon: "store", label: "Australian owned" },
  { icon: "target", label: "Depop coaching system" },
  { icon: "profit", label: "Step-by-step pathway" },
  { icon: "link", label: "Supplier network" },
  { icon: "support", label: "1-on-1 support" },
  { icon: "box", label: "Daily product drops" },
];

// The list renders twice so the loop is seamless; the copy is hidden from
// assistive tech. Animation stops under prefers-reduced-motion (see site.css).
export default function Marquee() {
  return (
    <div className="marquee-wrap">
      <div className="marquee-track">
        {[0, 1].map((copy) => (
          <ul key={copy} className="marquee-list" aria-hidden={copy === 1 ? "true" : undefined}>
            {ITEMS.map((item) => (
              <li key={item.label} className="marquee-item">
                <Icon name={item.icon} />
                {item.label}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}
