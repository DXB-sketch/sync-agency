import { useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./styles/global.css";
import Cursor from "./components/Cursor";
import Nav from "./components/Nav";
import Footer from "./sections/Footer";
import UTMIndicator from "./components/UTMIndicator";
import HomePage from "./pages/HomePage";
import RepListPage from "./pages/RepListPage";
import { captureUTMParams } from "./utils/analytics";

export default function App() {
  useEffect(() => {
    captureUTMParams();
  }, []);

  return (
    <BrowserRouter>
      <div className="noise" aria-hidden="true" />
      <Cursor />
      <Nav />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/rep-list" element={<RepListPage />} />
      </Routes>
      <Footer />
      <UTMIndicator />
    </BrowserRouter>
  );
}
