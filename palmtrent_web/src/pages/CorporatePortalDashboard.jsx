import React, { useState, useRef, useEffect } from 'react';
import { 
  Package, MapPin, TrendingUp, Clock, DollarSign, Plus, 
  Filter, Search, Download, FileText, Star, Truck, Menu, 
  Bell, User, Home, BarChart3, Users, Settings, MessageCircle, 
  HelpCircle, LogOut, CheckCircle, AlertCircle, ChevronDown,
  Calendar, BarChart, Check, FileText as FileTextIcon
} from 'lucide-react';
import './styles/CorporatePortalDashboard.css';

export const CorporatePortalDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState('overview');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  
  const userDropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const stats = {
    today: {
      activeShipments: 12,
      monthlySpend: 45600,
      completedThisMonth: 87,
      onTimeRate: 96
    },
    growth: {
      shipments: 8,
      spend: 12,
      completed: 5,
      onTime: 2
    }
  };

  const navigation = [
    { id: 'overview', label: 'Overview', icon: <Home className="icon" /> },
    { id: 'bookings', label: 'Bookings', icon: <Package className="icon" /> },
    { id: 'team', label: 'Team', icon: <Users className="icon" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="icon" /> },
    { id: 'api', label: 'API', icon: <Settings className="icon" /> },
    { id: 'billing', label: 'Billing', icon: <DollarSign className="icon" /> },
  ];

  const userMenuItems = [
    { id: 'profile', label: 'Company Profile', icon: <User className="corporate-dropdown-icon" /> },
    { id: 'messages', label: 'Messages', icon: <MessageCircle className="corporate-dropdown-icon" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="corporate-dropdown-icon" /> },
    { id: 'help', label: 'Help & Support', icon: <HelpCircle className="corporate-dropdown-icon" /> },
    { id: 'logout', label: 'Logout', icon: <LogOut className="corporate-dropdown-icon" /> },
  ];

  return (
    <div className="corporate-dashboard">
      {/* Sidebar - Non-scrollable */}
      <div className={`corporate-sidebar ${sidebarOpen ? 'corporate-sidebar-open' : 'corporate-sidebar-closed'}`}>
        {/* Header */}
        <div className="corporate-sidebar-header">
          {sidebarOpen && (
            <div className="corporate-sidebar-brand">
              <div className="corporate-brand-logo">
                <Truck className="icon" />
              </div>
              <span className="corporate-brand-text">Palmtrent</span>
            </div>
          )}
          <button 
            className="corporate-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="icon" />
          </button>
        </div>

        {/* Main Navigation - Non-scrollable */}
        <nav className="corporate-sidebar-nav">
          {navigation.map((item) => (
            <CorporateNavItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              active={activeNav === item.id}
              sidebarOpen={sidebarOpen}
              onClick={() => setActiveNav(item.id)}
            />
          ))}
        </nav>
      </div>

      {/* Main Content - Scrollable */}
      <div className="corporate-main-content">
        {/* Top Bar */}
        <div className="corporate-topbar">
          <div className="corporate-topbar-content">
            <div className="corporate-topbar-left">
              <h1 className="corporate-page-title">Corporate Portal</h1>
              <p className="corporate-page-subtitle">ABC Manufacturing - Enterprise Account</p>
            </div>
            <div className="corporate-topbar-right">
              <div className="corporate-search-container">
                <Search className="corporate-search-icon" />
                <input 
                  type="text" 
                  placeholder="Search shipments, team members..." 
                  className="corporate-search-input"
                />
              </div>

              <button className="corporate-notification-btn">
                <Bell className="icon" />
                <span className="corporate-notification-badge"></span>
              </button>

              <button className="corporate-btn-primary" onClick={() => setActiveNav('bookings')}>
                <Plus className="icon" />
                New Booking
              </button>

              {/* User Dropdown */}
              <div 
                className={`corporate-user-dropdown ${userDropdownOpen ? 'open' : ''}`}
                ref={userDropdownRef}
              >
                <button 
                  className="corporate-user-trigger"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                >
                  <div className="corporate-user-avatar">
                    <span className="corporate-user-avatar-text">AM</span>
                  </div>
                  <div className="corporate-user-info">
                    <p className="corporate-user-name">ABC Manufacturing</p>
                    <p className="corporate-user-role">Enterprise Account</p>
                  </div>
                  <ChevronDown className="corporate-dropdown-arrow" size={16} />
                </button>

                <div className="corporate-dropdown-menu">
                  <div className="corporate-dropdown-header">
                    <div className="corporate-dropdown-user">
                      <div className="corporate-dropdown-avatar">
                        <span className="corporate-dropdown-avatar-text">AM</span>
                      </div>
                      <div className="corporate-dropdown-user-info">
                        <p className="corporate-dropdown-user-name">ABC Manufacturing</p>
                        <p className="corporate-dropdown-user-email">admin@abcmfg.co.zw</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="corporate-dropdown-items">
                    {userMenuItems.map((item, index) => (
                      <React.Fragment key={item.id}>
                        <button 
                          className="corporate-dropdown-item"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            console.log(`Clicked: ${item.label}`);
                          }}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                        {index === userMenuItems.length - 2 && (
                          <div className="corporate-dropdown-divider" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="corporate-content">
          {/* Overview Tab Content */}
          {activeNav === 'overview' && (
            <>
              {/* Stats Grid */}
              <div className="corporate-stats-grid">
                <CorporateStatCard
                  title="Active Shipments"
                  value={stats.today.activeShipments}
                  change={stats.growth.shipments}
                  icon={<Truck className="icon" />}
                  color="primary"
                />
                <CorporateStatCard
                  title="Monthly Spend"
                  value={`$${stats.today.monthlySpend.toLocaleString()}`}
                  change={stats.growth.spend}
                  icon={<BarChart className="icon" />}
                  color="accent"
                />
                <CorporateStatCard
                  title="Completed (Nov)"
                  value={stats.today.completedThisMonth}
                  change={stats.growth.completed}
                  icon={<Package className="icon" />}
                  color="secondary"
                />
                <CorporateStatCard
                  title="On-Time Rate"
                  value={`${stats.today.onTimeRate}%`}
                  change={stats.growth.onTime}
                  icon={<Check className="icon" />}
                  color="success"
                />
              </div>

              {/* Quick Actions */}
              <div className="corporate-quick-actions-grid">
                <CorporateQuickActionCard
                  icon={<Plus className="icon" />}
                  title="New Booking"
                  description="Create single shipment"
                  onClick={() => setActiveNav('bookings')}
                />
                <CorporateQuickActionCard
                  icon={<FileTextIcon className="icon" />}
                  title="Bulk Upload"
                  description="Upload CSV file"
                  onClick={() => console.log('Bulk upload')}
                />
                <CorporateQuickActionCard
                  icon={<Calendar className="icon" />}
                  title="Schedule Recurring"
                  description="Set up repeat bookings"
                  onClick={() => console.log('Schedule recurring')}
                />
              </div>

              {/* Recent Shipments */}
              <div className="corporate-section">
                <div className="corporate-section-header">
                  <h3 className="corporate-section-title">Recent Shipments</h3>
                  <button className="corporate-view-all-btn">
                    View All →
                  </button>
                </div>
                <div className="corporate-shipments-list">
                  <CorporateShipmentRow
                    id="PT-2025-001240"
                    route="Harare → Bulawayo"
                    status="in_transit"
                    progress={65}
                    driver="Trust Ncube"
                  />
                  <CorporateShipmentRow
                    id="PT-2025-001239"
                    route="Mutare → Harare"
                    status="loading"
                    progress={10}
                    driver="Mike Chikwanha"
                  />
                  <CorporateShipmentRow
                    id="PT-2025-001238"
                    route="Harare → Gweru"
                    status="delivered"
                    progress={100}
                    driver="James Moyo"
                  />
                </div>
              </div>
            </>
          )}

          {/* Team Management Tab */}
          {activeNav === 'team' && <TeamManagementContent />}

          {/* API Integration Tab */}
          {activeNav === 'api' && <APIIntegrationContent />}

          {/* Billing Tab */}
          {activeNav === 'billing' && <BillingContent />}

          {/* Other Tabs Placeholder */}
          {(activeNav === 'bookings' || activeNav === 'analytics') && (
            <div className="corporate-section">
              <div className="corporate-section-header">
                <h3 className="corporate-section-title">
                  {activeNav === 'bookings' && 'Bookings Management'}
                  {activeNav === 'analytics' && 'Analytics & Reports'}
                </h3>
              </div>
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="icon" style={{ color: 'var(--accent)', width: 32, height: 32 }} />
                </div>
                <h4 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-dark)' }}>
                  {activeNav === 'bookings' && 'Bookings Management'}
                  {activeNav === 'analytics' && 'Analytics & Reports'}
                </h4>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  This feature is currently under development and will be available soon.
                </p>
                <button 
                  className="corporate-btn-primary"
                  onClick={() => setActiveNav('overview')}
                >
                  Return to Overview
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Corporate-specific components
const CorporateNavItem = ({ icon, label, active, badge, sidebarOpen, onClick }) => (
  <button
    onClick={onClick}
    className={`corporate-nav-item ${active ? 'corporate-nav-item-active' : ''}`}
  >
    <span className="corporate-nav-icon">{icon}</span>
    {sidebarOpen && (
      <>
        <span className="corporate-nav-label">{label}</span>
        {badge && (
          <span className="corporate-nav-badge">
            {badge}
          </span>
        )}
      </>
    )}
  </button>
);

const CorporateStatCard = ({ title, value, change, icon, color, alert }) => {
  const colorClass = `corporate-stat-card-${color}`;
  
  return (
    <div className={`corporate-stat-card ${colorClass}`}>
      <div className="corporate-stat-header">
        <div className="corporate-stat-icon-wrapper">
          {icon}
        </div>
        {change !== undefined && (
          <div className={`corporate-stat-change ${change >= 0 ? 'positive' : 'negative'}`}>
            {change >= 0 ? <TrendingUp className="icon" /> : <TrendingDown className="icon" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="corporate-stat-title">{title}</p>
      <p className={`corporate-stat-value ${alert ? 'corporate-stat-alert' : ''}`}>
        {value}
      </p>
    </div>
  );
};

const CorporateQuickActionCard = ({ icon, title, description, onClick }) => (
  <button className="corporate-quick-action-card" onClick={onClick}>
    <div className="corporate-quick-action-icon">
      {icon}
    </div>
    <h3 className="corporate-quick-action-title">{title}</h3>
    <p className="corporate-quick-action-description">{description}</p>
  </button>
);

const CorporateShipmentRow = ({ id, route, status, progress, driver }) => {
  const statusConfig = {
    in_transit: { class: 'corporate-status-in-transit', label: 'In Transit' },
    loading: { class: 'corporate-status-loading', label: 'Loading' },
    delivered: { class: 'corporate-status-delivered', label: 'Delivered' }
  };

  const statusInfo = statusConfig[status];

  return (
    <div className="corporate-shipment-row">
      <div className="corporate-shipment-info">
        <span className="corporate-shipment-id">{id}</span>
        <span className={`corporate-shipment-status ${statusInfo.class}`}>
          {statusInfo.label}
        </span>
      </div>
      <div className="corporate-shipment-details">
        <p className="corporate-shipment-route">{route}</p>
        <p className="corporate-shipment-driver">Driver: {driver}</p>
      </div>
      <div className="corporate-shipment-progress">
        <div className="corporate-progress-bar">
          <div 
            className="corporate-progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="corporate-progress-text">{progress}%</div>
      </div>
      <button className="corporate-shipment-action">
        Track
      </button>
    </div>
  );
};

// Team Management Content
const TeamManagementContent = () => {
  const teamMembers = [
    { name: 'John Moyo', email: 'john@abcmfg.co.zw', role: 'Admin', status: 'active' },
    { name: 'Sarah Dube', email: 'sarah@abcmfg.co.zw', role: 'Manager', status: 'active' },
    { name: 'Mike Ncube', email: 'mike@abcmfg.co.zw', role: 'Staff', status: 'active' }
  ];

  return (
    <div className="space-y-6">
      <div className="corporate-section">
        <div className="corporate-section-header">
          <h3 className="corporate-section-title">Team Management</h3>
          <button className="corporate-btn-primary">
            <Plus className="icon" />
            Add Team Member
          </button>
        </div>

        <table className="corporate-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((member, idx) => (
              <tr key={idx}>
                <td className="font-medium">{member.name}</td>
                <td>{member.email}</td>
                <td>
                  <span className="corporate-role-badge">
                    {member.role}
                  </span>
                </td>
                <td>
                  <span className="corporate-status-badge corporate-status-active">
                    {member.status}
                  </span>
                </td>
                <td>
                  <button className="corporate-action-btn mr-3">Edit</button>
                  <button className="corporate-action-btn corporate-action-btn-danger">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Roles & Permissions */}
      <div className="corporate-section">
        <h3 className="corporate-section-title">Roles & Permissions</h3>
        <div className="space-y-4">
          <RolePermissionCard
            role="Admin"
            permissions={['Full access', 'Manage team', 'View billing', 'API access']}
          />
          <RolePermissionCard
            role="Manager"
            permissions={['Create bookings', 'View reports', 'Manage bookings']}
          />
          <RolePermissionCard
            role="Staff"
            permissions={['Create bookings', 'View assigned bookings']}
          />
        </div>
      </div>
    </div>
  );
};

// API Integration Content
const APIIntegrationContent = () => {
  const [activeTab, setActiveTab] = useState('documentation');
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codeExamples = {
    createBooking: `curl -X POST https://api.palmtrent.co.zw/v1/bookings \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "pickup_address": "123 Main St, Harare",
    "delivery_address": "456 Industry Ave, Bulawayo",
    "cargo_description": "5 tonnes maize",
    "weight_kg": 5000,
    "vehicle_type": "10t_truck",
    "urgent": false
  }'`,
    
    trackShipment: `curl -X GET \\
  "https://api.palmtrent.co.zw/v1/shipments/PT-2025-001240/tracking" \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
    
    getQuotes: `curl -X POST https://api.palmtrent.co.zw/v1/quotes \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "origin": "Harare",
    "destination": "Bulawayo",
    "weight_kg": 5000,
    "cargo_type": "general"
  }'`
  };

  return (
    <div className="space-y-6">
      {/* API Keys Section */}
      <div className="corporate-section">
        <div className="corporate-section-header">
          <div>
            <h3 className="corporate-section-title">API Keys</h3>
            <p className="corporate-section-subtitle">Manage your API keys for integration</p>
          </div>
          <button className="corporate-btn-primary">
            <Plus className="icon" />
            Generate New Key
          </button>
        </div>
        
        <div className="corporate-api-keys-grid">
          <APIKeyCard
            name="Production Key"
            key_preview="pt_live_abc123...xyz789"
            created="Nov 1, 2025"
            lastUsed="2 mins ago"
            permissions={['bookings:write', 'tracking:read', 'quotes:read']}
            onCopy={() => copyToClipboard("pt_live_abc123xyz789")}
          />
          <APIKeyCard
            name="Test Key"
            key_preview="pt_test_def456...uvw012"
            created="Oct 15, 2025"
            lastUsed="3 hours ago"
            permissions={['bookings:write', 'tracking:read']}
            onCopy={() => copyToClipboard("pt_test_def456uvw012")}
          />
        </div>
      </div>

      {/* Usage Statistics */}
      <div className="corporate-section">
        <h3 className="corporate-section-title">API Usage</h3>
        <div className="corporate-usage-grid">
          <div className="corporate-usage-card">
            <div className="corporate-usage-icon">
              <TrendingUp className="icon" />
            </div>
            <div className="corporate-usage-info">
              <p className="corporate-usage-value">1,247</p>
              <p className="corporate-usage-label">Requests Today</p>
            </div>
          </div>
          <div className="corporate-usage-card">
            <div className="corporate-usage-icon">
              <BarChart className="icon" />
            </div>
            <div className="corporate-usage-info">
              <p className="corporate-usage-value">98.2%</p>
              <p className="corporate-usage-label">Success Rate</p>
            </div>
          </div>
          <div className="corporate-usage-card">
            <div className="corporate-usage-icon">
              <Clock className="icon" />
            </div>
            <div className="corporate-usage-info">
              <p className="corporate-usage-value">142ms</p>
              <p className="corporate-usage-label">Avg Response Time</p>
            </div>
          </div>
        </div>
      </div>

      {/* Documentation */}
      <div className="corporate-section">
        <div className="corporate-section-header">
          <h3 className="corporate-section-title">API Documentation</h3>
          <div className="corporate-tab-nav">
            <button 
              className={`corporate-tab ${activeTab === 'documentation' ? 'corporate-tab-active' : ''}`}
              onClick={() => setActiveTab('documentation')}
            >
              Quick Start
            </button>
            <button 
              className={`corporate-tab ${activeTab === 'examples' ? 'corporate-tab-active' : ''}`}
              onClick={() => setActiveTab('examples')}
            >
              Code Examples
            </button>
            <button 
              className={`corporate-tab ${activeTab === 'reference' ? 'corporate-tab-active' : ''}`}
              onClick={() => setActiveTab('reference')}
            >
              Full Reference
            </button>
          </div>
        </div>

        {activeTab === 'documentation' && (
          <div className="space-y-4">
            <div className="corporate-doc-card">
              <h4 className="corporate-doc-title">Getting Started</h4>
              <p className="corporate-doc-text">
                Integrate Palmtrent shipping capabilities directly into your applications using our REST API.
                All API requests must include your API key in the Authorization header.
              </p>
              
              <div className="corporate-code-block">
                <div className="corporate-code-header">
                  <span>Base URL</span>
                  <button 
                    className="corporate-code-copy"
                    onClick={() => copyToClipboard("https://api.palmtrent.co.zw/v1")}
                  >
                    {copied ? <Check className="icon" /> : <FileText className="icon" />}
                  </button>
                </div>
                <code>https://api.palmtrent.co.zw/v1</code>
              </div>

              <div className="corporate-code-block">
                <div className="corporate-code-header">
                  <span>Authentication Header</span>
                  <button 
                    className="corporate-code-copy"
                    onClick={() => copyToClipboard('Authorization: Bearer YOUR_API_KEY')}
                  >
                    {copied ? <Check className="icon" /> : <FileText className="icon" />}
                  </button>
                </div>
                <code>Authorization: Bearer YOUR_API_KEY</code>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'examples' && (
          <div className="space-y-4">
            <div className="corporate-doc-card">
              <h4 className="corporate-doc-title">Create a Booking</h4>
              <div className="corporate-code-block">
                <div className="corporate-code-header">
                  <span>POST /bookings</span>
                  <button 
                    className="corporate-code-copy"
                    onClick={() => copyToClipboard(codeExamples.createBooking)}
                  >
                    {copied ? <Check className="icon" /> : <FileText className="icon" />}
                  </button>
                </div>
                <pre><code>{codeExamples.createBooking}</code></pre>
              </div>
            </div>

            <div className="corporate-doc-card">
              <h4 className="corporate-doc-title">Track Shipment</h4>
              <div className="corporate-code-block">
                <div className="corporate-code-header">
                  <span>GET /shipments/{'{id}'}/tracking</span>
                  <button 
                    className="corporate-code-copy"
                    onClick={() => copyToClipboard(codeExamples.trackShipment)}
                  >
                    {copied ? <Check className="icon" /> : <FileText className="icon" />}
                  </button>
                </div>
                <pre><code>{codeExamples.trackShipment}</code></pre>
              </div>
            </div>

            <div className="corporate-doc-card">
              <h4 className="corporate-doc-title">Get Quotes</h4>
              <div className="corporate-code-block">
                <div className="corporate-code-header">
                  <span>POST /quotes</span>
                  <button 
                    className="corporate-code-copy"
                    onClick={() => copyToClipboard(codeExamples.getQuotes)}
                  >
                    {copied ? <Check className="icon" /> : <FileText className="icon" />}
                  </button>
                </div>
                <pre><code>{codeExamples.getQuotes}</code></pre>
              </div>
            </div>
          </div>
        )}

        <div className="corporate-doc-actions">
          <button className="corporate-btn-primary flex-1">
            <FileText className="icon" />
            View Full Documentation
          </button>
          <button className="corporate-btn-secondary flex-1">
            <Package className="icon" />
            Download SDK
          </button>
        </div>
      </div>
    </div>
  );
};

// Billing Content
const BillingContent = () => (
  <div className="space-y-6">
    {/* Current Bill */}
    <div className="corporate-billing-card">
      <div className="corporate-billing-content">
        <p className="corporate-billing-period">Current Period (Nov 2025)</p>
        <p className="corporate-billing-amount">$15,240</p>
        <div className="corporate-billing-stats">
          <div className="corporate-billing-stat">
            <p className="corporate-billing-stat-label">Deliveries</p>
            <p className="corporate-billing-stat-value">38</p>
          </div>
          <div className="corporate-billing-stat">
            <p className="corporate-billing-stat-label">Due Date</p>
            <p className="corporate-billing-stat-value">Dec 1</p>
          </div>
          <div className="corporate-billing-stat">
            <p className="corporate-billing-stat-label">Days Left</p>
            <p className="corporate-billing-stat-value">8</p>
          </div>
        </div>
        <button className="corporate-billing-btn">
          View Detailed Invoice
        </button>
      </div>
    </div>

    {/* Invoice History */}
    <div className="corporate-section">
      <h3 className="corporate-section-title">Invoice History</h3>
      <div className="space-y-3">
        <InvoiceRow
          period="October 2025"
          amount={14850}
          status="paid"
          dueDate="Nov 1, 2025"
          paidDate="Oct 28, 2025"
        />
        <InvoiceRow
          period="September 2025"
          amount={13200}
          status="paid"
          dueDate="Oct 1, 2025"
          paidDate="Sep 30, 2025"
        />
        <InvoiceRow
          period="August 2025"
          amount={15600}
          status="paid"
          dueDate="Sep 1, 2025"
          paidDate="Aug 29, 2025"
        />
      </div>
    </div>
  </div>
);

// Helper Components
const RolePermissionCard = ({ role, permissions }) => (
  <div className="border border-gray-200 rounded-lg p-4">
    <h4 className="font-semibold text-gray-900 mb-3">{role}</h4>
    <div className="flex flex-wrap gap-2">
      {permissions.map((perm, idx) => (
        <span key={idx} className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded-full">
          {perm}
        </span>
      ))}
    </div>
  </div>
);

const APIKeyCard = ({ name, key_preview, created, lastUsed }) => (
  <div className="corporate-api-key-card">
    <div className="corporate-api-key-info">
      <p className="corporate-api-key-name">{name}</p>
      <p className="corporate-api-key-preview">{key_preview}</p>
      <p className="corporate-api-key-meta">Created: {created} • Last used: {lastUsed}</p>
    </div>
    <div className="corporate-api-key-actions">
      <button className="corporate-action-btn">Copy</button>
      <button className="corporate-action-btn corporate-action-btn-danger">Revoke</button>
    </div>
  </div>
);

const InvoiceRow = ({ period, amount, status, dueDate, paidDate }) => (
  <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
    <div>
      <p className="font-medium text-gray-900">{period}</p>
      <p className="text-sm text-gray-600">Due: {dueDate}</p>
      {paidDate && <p className="text-xs text-gray-500">Paid: {paidDate}</p>}
    </div>
    <div className="text-right">
      <p className="font-bold text-gray-900">${amount.toLocaleString()}</p>
      <span className={`text-xs px-2 py-1 rounded-full font-medium ${
        status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
      }`}>
        {status}
      </span>
    </div>
    <button className="ml-4 corporate-action-btn">
      Download PDF
    </button>
  </div>
);

export default CorporatePortalDashboard;