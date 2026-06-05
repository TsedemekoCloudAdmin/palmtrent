import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import './App.css';

const PalmTrentAdmin = lazy(() => import('./pages/PalmTrentAdmin'));
const ShipperDashboard = lazy(() => import('./pages/ShipperDashboard'));
const CorporateDashboard = lazy(() => import('./pages/CorporateDashboard'));
const TrailerOwnerDashboard = lazy(() => import('./pages/TrailerOwnerDashboard'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ApiDocsPage = lazy(() => import('./pages/ApiDocsPage'));
const PaymentReturnPage = lazy(() => import('./pages/PaymentReturnPage'));
const PublicTrackingPage = lazy(() => import('./pages/PublicTrackingPage'));
const LegalPage = lazy(() => import('./pages/LegalPage'));

const getRoleHomePath = (user) => {
  switch (user?.userType) {
    case 'admin':
      return '/admin';
    case 'corporate':
      return '/corp';
    case 'trailer_owner':
    case 'rental_owner':
      return '/fleet';
    case 'transporter':
      return '/fleet';
    case 'driver':
      return '/fleet';
    case 'shipper':
    default:
      return '/shipper';
  }
};

const RoleRedirect = () => {
  const user = JSON.parse(localStorage.getItem('palmtrent_user') || 'null');
  const token = localStorage.getItem('palmtrent_token');
  return token && user ? <Navigate to={getRoleHomePath(user)} replace /> : <LandingPage />;
};

const RouteLoader = () => (
  <div className="route-loader" role="status" aria-live="polite">
    <div className="route-loader-mark" />
    <span>Loading Palmtrent...</span>
  </div>
);

function App() {
  return (
    <Router>
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/home" element={<LandingPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route path="/payment/return" element={<PaymentReturnPage />} />
          <Route path="/tracking/:trackingId" element={<PublicTrackingPage />} />
          <Route path="/terms" element={<LegalPage />} />
          <Route path="/privacy" element={<LegalPage />} />
          <Route path="/admin" element={<PalmTrentAdmin />} />
          <Route path="/shipper" element={<ShipperDashboard />} />
          <Route path="/corp" element={<CorporateDashboard />} />
          <Route path="/fleet" element={<TrailerOwnerDashboard />} />
          {/* Redirect any unknown routes to role home or landing page */}
          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
