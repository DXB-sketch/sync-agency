import { Link } from "react-router-dom";
import { BackIcon } from "../components/portal/RewardIcons";
import TopUpPanel from "./TopUpPanel";

export default function RewardsTopUpPage() {
  return (
    <div className="portal-page">
      <TopUpPanel
        returnTo="rewards"
        back={
          <Link to="/portal/rewards" className="rw-back">
            <BackIcon />
            Rewards
          </Link>
        }
      />
    </div>
  );
}
