import { useEffect } from "react";
import Hero from "../sections/Hero";
import WhatIsDropshipping from "../sections/WhatIsDropshipping";
import About from "../sections/About";
import Pricing from "../sections/Pricing";
import Expectations from "../sections/Testimonials";
import FAQ from "../sections/FAQ";
import CTASection from "../sections/CTASection";
import Marquee from "../components/Marquee";
import ExitIntentPopup from "../components/ExitIntentPopup";

export default function HomePage() {
  useEffect(() => {
    if (window.location.hash) {
      const el = document.getElementById(window.location.hash.slice(1));
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  return (
    <main id="main">
      <ExitIntentPopup />
      <Hero />
      <Pricing />
      <Marquee />
      <WhatIsDropshipping />
      <About />
      <Expectations />
      <FAQ />
      <CTASection />
    </main>
  );
}
