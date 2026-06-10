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
const ForceChangePasswordPage = lazy(() => import('./pages/ForceChangePasswordPage'));
const CourierConsole = lazy(() => import('./pages/CourierConsole'));
const HelpCenter = lazy(() => import('./pages/HelpCenter'));

const getRoleHomePath = (user) => {
  switch (user?.userType) {
    case 'admin':
      return '/admin';
    case 'clerk':
      return '/courier';
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
  if (!token || !user) return <LandingPage />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <Navigate to={getRoleHomePath(user)} replace />;
};

const RouteLoader = () => (
  <div className="route-loader" role="status" aria-live="polite">
    <div className="route-loader-mark" />
    <span>Loading Palmtrent...</span>
  </div>
);

// Floating "Help" link available on every page (hidden on the guide itself).
const HelpFab = () => {
  if (typeof window !== 'undefined' && window.location.pathname === '/help') return null;
  return (
    <a
      href="/help"
      title="User guide & help"
      style={{
        position: 'fixed', right: 18, bottom: 18, zIndex: 1000,
        background: '#0C2D48', color: '#fff', borderRadius: 999,
        padding: '10px 16px', fontWeight: 800, fontSize: 14, textDecoration: 'none',
        boxShadow: '0 6px 18px rgba(12,45,72,0.35)', fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      ? Help
    </a>
  );
};

function App() {
  return (
    <Router>
      <HelpFab />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/" element={<RoleRedirect />} />
          <Route path="/home" element={<LandingPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/change-password" element={<ForceChangePasswordPage />} />
          <Route path="/api-docs" element={<ApiDocsPage />} />
          <Route path="/payment/return" element={<PaymentReturnPage />} />
          <Route path="/tracking/:trackingId" element={<PublicTrackingPage />} />
          <Route path="/terms" element={<LegalPage />} />
          <Route path="/privacy" element={<LegalPage />} />
          <Route path="/admin" element={<PalmTrentAdmin />} />
          <Route path="/shipper" element={<ShipperDashboard />} />
          <Route path="/corp" element={<CorporateDashboard />} />
          <Route path="/fleet" element={<TrailerOwnerDashboard />} />
          <Route path="/courier" element={<CourierConsole />} />
          <Route path="/help" element={<HelpCenter />} />
          {/* Redirect any unknown routes to role home or landing page */}
          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
