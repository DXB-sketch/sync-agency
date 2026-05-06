import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Hero from "../sections/Hero";
import Marquee from "../components/Marquee";
import WhatIsDropshipping from "../sections/WhatIsDropshipping";
import About from "../sections/About";
import Pricing from "../sections/Pricing";
import Testimonials from "../sections/Testimonials";
import FAQ from "../sections/FAQ";
import CTASection from "../sections/CTASection";
import ExitIntentPopup from "../components/ExitIntentPopup";
import StickyCTABar from "../components/StickyCTABar";
import SocialProofTicker from "../components/SocialProofTicker";

export default function HomePage() {
  const location = useLocation();

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 50);
      }
    }
  }, [location]);

  return (
    <>
      <Hero />
      <Marquee />
      <WhatIsDropshipping />
      <About />
      <Pricing />
      <Testimonials />
      <FAQ />
      <CTASection />
      <ExitIntentPopup />
      <StickyCTABar />
      <SocialProofTicker />
    </>
  );
}
