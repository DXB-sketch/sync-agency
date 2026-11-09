import { Link } from "react-router-dom";
import FadeUp from "../components/FadeUp";
import StaggerGrid from "../components/StaggerGrid";
import Eyebrow from "../components/Eyebrow";

const EXPECTATIONS = [
  {
    title: "What we do",
    points: [
      "Teach you how to set up and run a Depop dropshipping store",
      "Give you the Sync dashboard, pathway and product slots for your tier",
      "Fulfil the orders you place through your dashboard",
      "Answer your questions and support you for the length of your access",
    ],
  },
  {
    title: "What we don't promise",
    points: [
      "Any level of sales, income or profit",
      "That you'll make your money back, or make money at all",
      "That any product will sell, or keep selling",
      "How Depop, suppliers or the market will behave",
    ],
  },
  {
    title: "What it depends on",
    points: [
      "The time and effort you put in",
      "Your product, pricing and listing decisions",
      "Fees, shipping costs, returns and competition",
      "Depop's rules and your account standing",
    ],
  },
];

export default function Testimonials() {
  return (
    <section className="section" id="expectations">
      <div className="section-inner">
        <FadeUp>
          <Eyebrow text="Honest expectations" />
          <h2 className="section-title">Education and tools.<br /><em>Not a guarantee.</em></h2>
          <p className="section-sub">
            Sync Agency is a coaching and education service. Most new online businesses make
            little or no profit, and you could lose money. Please only join if you're comfortable
            with that. Full details are in our <Link to="/terms" style={{ color: "var(--gold)", textDecoration: "underline" }}>Terms of Service</Link>.
          </p>
        </FadeUp>
        <StaggerGrid className="testi-grid" style={{ marginTop: 56 }}>
          {EXPECTATIONS.map((e) => (
            <div key={e.title} className="testi-card">
              <div className="testi-name">{e.title}</div>
              <div className="testi-divider" />
              <ul className="price-features" style={{ textAlign: "left" }}>
                {e.points.map((p) => <li key={p}>{p}</li>)}
              </ul>
            </div>
          ))}
        </StaggerGrid>
      </div>
    </section>
  );
}
