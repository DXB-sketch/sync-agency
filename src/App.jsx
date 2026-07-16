import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import "./styles/global.css";
import "./styles/portal.css";
import { captureAffiliate } from "./utils/affiliate.js";
import { AuthProvider } from "./lib/AuthContext";
import Cursor from "./components/Cursor";
import Nav from "./components/Nav";
import CompetitionBanner from "./components/CompetitionBanner";
import Footer from "./sections/Footer";
import UTMIndicator from "./components/UTMIndicator";
import HomePage from "./pages/HomePage";
import RepListPage from "./pages/RepListPage";
import AboutPage from "./pages/AboutPage";
import CompetitionPage from "./pages/CompetitionPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import AuthConfirmedPage from "./pages/AuthConfirmedPage";
import { RequireMember, RequireAdmin } from "./components/portal/Guards";
import PortalLayout from "./portal/PortalLayout";
import DashboardPage from "./portal/DashboardPage";
import PathwayPage from "./portal/PathwayPage";
import ProductsPage from "./portal/ProductsPage";
import CheckoutPage from "./portal/CheckoutPage";
import AchievementsPage from "./portal/AchievementsPage";
import SupportPage from "./portal/SupportPage";
import UpgradePage from "./portal/UpgradePage";
import MorePage from "./portal/MorePage";
import ReactivatePage from "./portal/ReactivatePage";
import ConnectStorePage from "./portal/ConnectStorePage";
import ProductLinkingPage from "./portal/ProductLinkingPage";
import AdminLayout from "./admin/AdminLayout";
import ClientsPage from "./admin/ClientsPage";
import ClientDetailPage from "./admin/ClientDetailPage";
import ProductsAdminPage from "./admin/ProductsAdminPage";
import OrdersQueuePage from "./admin/OrdersQueuePage";
import AchievementsReviewPage from "./admin/AchievementsReviewPage";
import SupportQueuePage from "./admin/SupportQueuePage";
import ExceptionQueuePage from "./admin/ExceptionQueuePage";
import MarginAlertsPage from "./admin/MarginAlertsPage";

// Orders merged into Checkout — forward old links (incl. Stripe's ?paid=1 return)
function OrdersRedirect() {
  const location = useLocation();
  return <Navigate to={{ pathname: "/portal/checkout", search: location.search }} replace />;
}

function Shell() {
  const location = useLocation();
  // Marketing chrome (nav, banner, footer) stays off the portal/auth screens
  const isAppRoute = /^\/(portal|admin|login|signup|auth)/.test(location.pathname);

  return (
    <>
      {!isAppRoute && <CompetitionBanner />}
      <div className="noise" aria-hidden="true" />
      <Cursor />
      {!isAppRoute && <Nav />}
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
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/auth/confirmed" element={<AuthConfirmedPage />} />

        <Route
          path="/portal/reactivate"
          element={
            <RequireMember>
              <ReactivatePage />
            </RequireMember>
          }
        />
        <Route
          path="/portal"
          element={
            <RequireMember>
              <PortalLayout />
            </RequireMember>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="pathway" element={<PathwayPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="checkout" element={<CheckoutPage />} />
          <Route path="orders" element={<OrdersRedirect />} />
          <Route path="achievements" element={<AchievementsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="upgrade" element={<UpgradePage />} />
          <Route path="store" element={<ConnectStorePage />} />
          <Route path="store/products" element={<ProductLinkingPage />} />
          <Route path="more" element={<MorePage />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientDetailPage />} />
          <Route path="products" element={<ProductsAdminPage />} />
          <Route path="pool" element={<Navigate to="/admin/products" replace />} />
          <Route path="catalogue" element={<Navigate to="/admin/products" replace />} />
          <Route path="orders" element={<OrdersQueuePage />} />
          <Route path="exceptions" element={<ExceptionQueuePage />} />
          <Route path="margins" element={<MarginAlertsPage />} />
          <Route path="achievements" element={<AchievementsReviewPage />} />
          <Route path="support" element={<SupportQueuePage />} />
        </Route>
      </Routes>
      {!isAppRoute && <Footer />}
      {!isAppRoute && <UTMIndicator />}
    </>
  );
}

export default function App() {
  useEffect(() => {
    captureAffiliate();
  }, []);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Shell />
      </BrowserRouter>
    </AuthProvider>
  );
}
