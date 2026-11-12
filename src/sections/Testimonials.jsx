import { Link } from "react-router-dom";
import FadeUp from "../components/FadeUp";
import StaggerGrid from "../components/StaggerGrid";
import Eyebrow from "../components/Eyebrow";
import Icon from "../components/SiteIcon";

// "Honest expectations" section (the file keeps its historical name).
const EXPECTATIONS = [
  {
    title: "What we do",
    icon: "check",
    tone: "ok",
    points: [
      "Teach you how to set up and run a Depop dropshipping store",
      "Give you the Sync dashboard, pathway and product slots for your tier",
      "Fulfil the orders you place through your dashboard",
      "Answer your questions and support you for the length of your access",
    ],
  },
  {
    title: "What we don't promise",
    icon: "x",
    tone: "bad",
    points: [
      "Any level of sales, income or profit",
      "That you'll make your money back, or make money at all",
      "That any product will sell, or keep selling",
      "How Depop, suppliers or the market will behave",
    ],
  },
  {
    title: "What it depends on",
    icon: "info",
    tone: "info",
    points: [
      "The time and effort you put in",
      "Your product, pricing and listing decisions",
      "Fees, shipping costs, returns and competition",
      "Depop's rules and your account standing",
    ],
  },
];

export default function Expectations() {
  return (
    <section className="s-section" id="expectations">
      <div className="wrap s-stack">
        <FadeUp>
          <div className="s-split s-split-end">
            <div>
              <Eyebrow text="Honest expectations" />
              <h2 className="t-h1 s-title">Education and tools. <em className="em">Not a guarantee.</em></h2>
            </div>
            <p className="t-body s-lede-lg">
              Sync Agency is a coaching and education service. Most new online businesses make
              little or no profit, and you could lose money. Please only join if you're comfortable
              with that. Full details are in our <Link to="/terms" className="s-link">Terms of Service</Link>.
            </p>
          </div>
        </FadeUp>
        <StaggerGrid className="s-cards3">
          {EXPECTATIONS.map((e) => (
            <div key={e.title} className="card expect-card">
              <div className="expect-head">
                <span className={`icon-well tone-${e.tone}`}><Icon name={e.icon} /></span>
                <h3 className="t-h3">{e.title}</h3>
              </div>
              <ul className="expect-list">
                {e.points.map((p) => <li key={p} className="dash">{p}</li>)}
              </ul>
            </div>
          ))}
        </StaggerGrid>
      </div>
    </section>
  );
}
