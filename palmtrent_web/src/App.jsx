import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import LandingPage from './pages/LandingPage';
import PalmTrentAdmin from './pages/PalmTrentAdmin';
import ShipperDashboard from './pages/ShipperDashboard';
import CorporatePortalDashboard from './pages/CorporatePortalDashboard';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/admin" element={<PalmTrentAdmin />} />
         <Route path="/shipper" element={<ShipperDashboard />} />
         <Route path="/corp" element={<CorporatePortalDashboard />} />
        {/* Redirect any unknown routes to landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
