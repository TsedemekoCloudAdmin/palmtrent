import React from 'react';
import './styles/CorporateDashboard.css';

const ApiDocsPage = () => {
  const endpoints = [
    { method: 'GET', path: '/api/v1/corporate/profile', description: 'Read the authenticated corporate account profile.' },
    { method: 'PUT', path: '/api/v1/corporate/profile', description: 'Update company, contact, and billing profile fields.' },
    { method: 'GET', path: '/api/v1/corporate/invoices', description: 'List invoices for the corporate account.' },
    { method: 'GET', path: '/api/v1/corporate/invoices/:id/download', description: 'Download a corporate invoice document.' },
    { method: 'GET', path: '/api/v1/corporate/users', description: 'List corporate account users and roles.' },
    { method: 'POST', path: '/api/v1/corporate/users/invite', description: 'Add a registered user to the corporate account.' },
    { method: 'GET', path: '/api/v1/bookings', description: 'List bookings visible to the authenticated account.' },
    { method: 'POST', path: '/api/v1/bookings', description: 'Create a shipment booking.' }
  ];

  return (
    <div className="corporate-dashboard">
      <div className="corp-main-content" style={{ marginLeft: 0 }}>
        <div className="corp-topbar">
          <div className="corp-topbar-content">
            <div className="corp-topbar-left">
              <h1 className="corp-page-title">Corporate API Documentation</h1>
              <p className="corp-page-subtitle">Use the corporate API key from Account Settings as a bearer token.</p>
            </div>
            <button className="btn-secondary" onClick={() => window.location.href = '/corp'}>Back to Dashboard</button>
          </div>
        </div>
        <div className="corp-content">
          <div className="corp-section full-width">
            <div className="corp-table-container">
              <table className="corp-table">
                <thead>
                  <tr><th>Method</th><th>Endpoint</th><th>Description</th></tr>
                </thead>
                <tbody>
                  {endpoints.map(endpoint => (
                    <tr key={`${endpoint.method}-${endpoint.path}`}>
                      <td><span className="status-badge status-active">{endpoint.method}</span></td>
                      <td><span className="booking-id">{endpoint.path}</span></td>
                      <td>{endpoint.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiDocsPage;
