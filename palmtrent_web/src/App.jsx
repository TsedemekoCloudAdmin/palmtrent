import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import PalmTrentAdmin from './pages/PalmTrentAdmin';
import ShipperDashboard from './pages/ShipperDashboard';
import CorporateDashboard from './pages/CorporateDashboard';
import TrailerOwnerDashboard from './pages/TrailerOwnerDashboard';
import ResetPasswordPage from './pages/ResetPasswordPage';
import ApiDocsPage from './pages/ApiDocsPage';
import PaymentReturnPage from './pages/PaymentReturnPage';
import PublicTrackingPage from './pages/PublicTrackingPage';
import LegalPage from './pages/LegalPage';
import './App.css';

const getRoleHomePath = (user) => {
  switch (user?.userType) {
    case 'admin':
      return '/admin';
    case 'corporate':
      return '/corp';
    case 'trailer_owner':
      return '/fleet';
    case 'transporter':
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

function App() {
  return (
    <Router>
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
    </Router>
  );
}

export default App;
