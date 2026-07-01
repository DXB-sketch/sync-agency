import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles/global.css";
import { captureAffiliate } from "./utils/affiliate.js";
import Cursor from "./components/Cursor";
import Nav from "./components/Nav";
import CompetitionBanner from "./components/CompetitionBanner";
import Footer from "./sections/Footer";
import UTMIndicator from "./components/UTMIndicator";
import HomePage from "./pages/HomePage";
import RepListPage from "./pages/RepListPage";
import AboutPage from "./pages/AboutPage";
import CompetitionPage from "./pages/CompetitionPage";

export default function App() {
  useEffect(() => {
    captureAffiliate();
  }, []);

  return (
    <BrowserRouter>
      <CompetitionBanner />
      <div className="noise" aria-hidden="true" />
      <Cursor />
      <Nav />
      <Routes>
        <Route
          path="/"
          element={
            <>
              <HomePage />
              <RepListPage />
              <AboutPage />
            </>
          }
        />
        <Route path="/competition" element={<CompetitionPage />} />
      </Routes>
      <Footer />
      <UTMIndicator />
    </BrowserRouter>
  );
}
