import React, { useState, useRef, useEffect } from 'react';
import { 
  Package, MapPin, TrendingUp, Clock, DollarSign, Plus, 
  Filter, Search, Download, FileText, Star, Truck, Menu, 
  Bell, User, Home, BarChart3, Heart, MessageCircle, 
  HelpCircle, LogOut, CheckCircle, AlertCircle, Users,
  ChevronDown, Settings
} from 'lucide-react';
import './styles/ShipperDashboard.css';

export const ShipperDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState('overview');
  const [timeRange, setTimeRange] = useState('today');
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
      activeShipments: 3,
      completed: 45,
      totalSpent: 15240,
      avgRating: 4.8
    },
    growth: {
      shipments: 12,
      completed: 8,
      spending: 15
    }
  };

  const activeShipments = [
    {
      id: 'PT-2025-001234',
      route: 'Harare → Bulawayo',
      status: 'in_transit',
      progress: 48,
      driver: 'Trust Ncube',
      eta: '5:30 PM'
    },
    {
      id: 'PT-2025-001235',
      route: 'Mutare → Harare',
      status: 'loading',
      progress: 5,
      driver: 'Mike Chikwanha',
      eta: '8:00 PM'
    },
    {
      id: 'PT-2025-001236',
      route: 'Harare → Gweru',
      status: 'awaiting_pickup',
      progress: 0,
      driver: 'James Moyo',
      eta: '4:00 PM'
    }
  ];

  const recentBookings = [
    { id: 'PT-2025-001230', date: '02 Nov', route: 'Harare → Bulawayo', status: 'delivered', amount: 400 },
    { id: 'PT-2025-001229', date: '01 Nov', route: 'Mutare → Harare', status: 'delivered', amount: 350 },
    { id: 'PT-2025-001228', date: '31 Oct', route: 'Harare → Gweru', status: 'delivered', amount: 280 },
    { id: 'PT-2025-001227', date: '30 Oct', route: 'Harare → Masvingo', status: 'delivered', amount: 320 }
  ];

  const recentActivity = [
    { time: '2 mins ago', event: 'Shipment picked up', user: 'PT-2025-001234', type: 'pickup' },
    { time: '1 hour ago', event: 'Payment received', user: 'PT-2025-001229', type: 'payment' },
    { time: '3 hours ago', event: 'New booking confirmed', user: 'PT-2025-001238', type: 'booking' },
    { time: '5 hours ago', event: 'Driver assigned', user: 'Trust Ncube', type: 'assignment' }
  ];

  const navigation = [
    { id: 'overview', label: 'Overview', icon: <Home className="icon" /> },
    { id: 'new-booking', label: 'New Booking', icon: <Plus className="icon" /> },
    { id: 'track', label: 'Track Shipments', icon: <MapPin className="icon" /> },
    { id: 'bookings', label: 'My Bookings', icon: <FileText className="icon" /> },
    { id: 'payments', label: 'Payments', icon: <DollarSign className="icon" /> },
    { id: 'favorites', label: 'Favorites', icon: <Heart className="icon" /> },
    { id: 'reviews', label: 'Reviews', icon: <Star className="icon" /> },
  ];

  const userMenuItems = [
    { id: 'profile', label: 'My Profile', icon: <User className="shipper-dropdown-icon" /> },
    { id: 'messages', label: 'Messages', icon: <MessageCircle className="shipper-dropdown-icon" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="shipper-dropdown-icon" /> },
    { id: 'help', label: 'Help & Support', icon: <HelpCircle className="shipper-dropdown-icon" /> },
    { id: 'logout', label: 'Logout', icon: <LogOut className="shipper-dropdown-icon" /> },
  ];

  return (
    <div className="shipper-dashboard">
      {/* Sidebar - Non-scrollable */}
      <div className={`shipper-sidebar ${sidebarOpen ? 'shipper-sidebar-open' : 'shipper-sidebar-closed'}`}>
        {/* Header */}
        <div className="shipper-sidebar-header">
          {sidebarOpen && (
            <div className="shipper-sidebar-brand">
              <div className="shipper-brand-logo">
                <Truck className="icon" />
              </div>
              <span className="shipper-brand-text">Palmtrent</span>
            </div>
          )}
          <button 
            className="shipper-sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="icon" />
          </button>
        </div>

        {/* Main Navigation - Non-scrollable */}
        <nav className="shipper-sidebar-nav">
          {navigation.map((item) => (
            <ShipperNavItem
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
      <div className="shipper-main-content">
        {/* Top Bar */}
        <div className="shipper-topbar">
          <div className="shipper-topbar-content">
            <div className="shipper-topbar-left">
              <h1 className="shipper-page-title">Shipper Dashboard</h1>
              <p className="shipper-page-subtitle">Welcome back, John - Manage your shipments efficiently</p>
            </div>
            <div className="shipper-topbar-right">
              <div className="shipper-search-container">
                <Search className="shipper-search-icon" />
                <input 
                  type="text" 
                  placeholder="Search shipments, bookings..." 
                  className="shipper-search-input"
                />
              </div>

              <button className="shipper-notification-btn">
                <Bell className="icon" />
                <span className="shipper-notification-badge"></span>
              </button>

              <select 
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="shipper-time-selector"
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="year">This Year</option>
              </select>

              {/* User Dropdown */}
              <div 
                className={`shipper-user-dropdown ${userDropdownOpen ? 'open' : ''}`}
                ref={userDropdownRef}
              >
                <button 
                  className="shipper-user-trigger"
                  onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                >
                  <div className="shipper-user-avatar">
                    <span className="shipper-user-avatar-text">JM</span>
                  </div>
                  <div className="shipper-user-info">
                    <p className="shipper-user-name">John Moyo</p>
                    <p className="shipper-user-role">Premium Shipper</p>
                  </div>
                  <ChevronDown className="shipper-dropdown-arrow" size={16} />
                </button>

                <div className="shipper-dropdown-menu">
                  <div className="shipper-dropdown-header">
                    <div className="shipper-dropdown-user">
                      <div className="shipper-dropdown-avatar">
                        <span className="shipper-dropdown-avatar-text">JM</span>
                      </div>
                      <div className="shipper-dropdown-user-info">
                        <p className="shipper-dropdown-user-name">John Moyo</p>
                        <p className="shipper-dropdown-user-email">john.moyo@example.com</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="shipper-dropdown-items">
                    {userMenuItems.map((item, index) => (
                      <React.Fragment key={item.id}>
                        <button 
                          className="shipper-dropdown-item"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            // Handle menu item clicks here
                            console.log(`Clicked: ${item.label}`);
                          }}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                        {/* Add divider before logout */}
                        {index === userMenuItems.length - 2 && (
                          <div className="shipper-dropdown-divider" />
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
        <div className="shipper-content">
          {/* Overview Tab Content */}
          {activeNav === 'overview' && (
            <>
              {/* Stats Grid */}
              <div className="shipper-stats-grid">
                <ShipperStatCard
                  title="Active Shipments"
                  value={stats.today.activeShipments}
                  change={stats.growth.shipments}
                  icon={<Truck className="icon" />}
                  color="primary"
                />
                <ShipperStatCard
                  title="Completed"
                  value={stats.today.completed}
                  change={stats.growth.completed}
                  icon={<Package className="icon" />}
                  color="success"
                />
                <ShipperStatCard
                  title="Total Spent"
                  value={`$${stats.today.totalSpent.toLocaleString()}`}
                  change={stats.growth.spending}
                  icon={<DollarSign className="icon" />}
                  color="accent"
                />
                <ShipperStatCard
                  title="Your Rating"
                  value={stats.today.avgRating}
                  icon={<Star className="icon" />}
                  color="secondary"
                />
              </div>

              {/* Quick Actions */}
              <div className="shipper-quick-actions">
                <div className="shipper-quick-actions-content">
                  <h2 className="shipper-quick-actions-title">Ready to ship?</h2>
                  <p className="shipper-quick-actions-subtitle">Book transport in just a few clicks and get instant quotes</p>
                  <button 
                    onClick={() => setActiveNav('new-booking')}
                    className="shipper-quick-actions-btn"
                  >
                    <Plus className="icon" />
                    Create New Booking
                  </button>
                </div>
              </div>

              {/* Content Grid */}
              <div className="shipper-content-grid">
                {/* Active Shipments */}
                <div className="shipper-shipments-section">
                  <div className="shipper-section-header">
                    <h3 className="shipper-section-title">Active Shipments</h3>
                    <button 
                      className="shipper-view-all-btn"
                      onClick={() => setActiveNav('track')}
                    >
                      View All →
                    </button>
                  </div>

                  <div className="shipper-shipments-list">
                    {activeShipments.map((shipment) => (
                      <ShipperShipmentCard key={shipment.id} shipment={shipment} />
                    ))}
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="shipper-activity-section">
                  <div className="shipper-section-header">
                    <h3 className="shipper-section-title">Recent Activity</h3>
                    <button className="shipper-view-all-btn">
                      View All →
                    </button>
                  </div>
                  
                  <div className="shipper-activity-list">
                    {recentActivity.map((activity, index) => (
                      <ShipperActivityItem key={index} activity={activity} />
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Bookings */}
              <div className="shipper-bookings-section">
                <div className="shipper-section-header">
                  <h3 className="shipper-section-title">Recent Bookings</h3>
                  <button 
                    className="shipper-view-all-btn"
                    onClick={() => setActiveNav('bookings')}
                  >
                    View All →
                  </button>
                </div>

                <table className="shipper-bookings-table">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Date</th>
                      <th>Route</th>
                      <th>Status</th>
                      <th>Amount</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>
                          <span className="shipper-shipment-id">{booking.id}</span>
                        </td>
                        <td>{booking.date}</td>
                        <td>{booking.route}</td>
                        <td>
                          <span className="shipper-booking-status shipper-status-delivered">
                            {booking.status}
                          </span>
                        </td>
                        <td>${booking.amount}</td>
                        <td>
                          <button className="shipper-booking-action">
                            View POD
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Other tabs would be implemented similarly */}
          {activeNav !== 'overview' && (
            <div className="shipper-shipments-section">
              <div className="shipper-section-header">
                <h3 className="shipper-section-title">
                  {activeNav === 'new-booking' && 'Create New Booking'}
                  {activeNav === 'track' && 'Track Shipments'}
                  {activeNav === 'bookings' && 'My Bookings'}
                  {activeNav === 'payments' && 'Payment History'}
                  {activeNav === 'favorites' && 'Favorite Drivers'}
                  {activeNav === 'reviews' && 'My Reviews'}
                </h3>
              </div>
              <div className="text-center py-12">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-100 to-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="icon" style={{ color: 'var(--accent)', width: 32, height: 32 }} />
                </div>
                <h4 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-dark)' }}>
                  {activeNav === 'new-booking' && 'Create New Booking'}
                  {activeNav === 'track' && 'Track Your Shipments'}
                  {activeNav === 'bookings' && 'Manage Your Bookings'}
                  {activeNav === 'payments' && 'Payment History'}
                  {activeNav === 'favorites' && 'Favorite Drivers'}
                  {activeNav === 'reviews' && 'My Reviews'}
                </h4>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  This feature is currently under development and will be available soon.
                </p>
                <button 
                  className="shipper-btn-primary"
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

// Keep the same component definitions as before
const ShipperNavItem = ({ icon, label, active, badge, sidebarOpen, onClick }) => (
  <button
    onClick={onClick}
    className={`shipper-nav-item ${active ? 'shipper-nav-item-active' : ''}`}
  >
    <span className="shipper-nav-icon">{icon}</span>
    {sidebarOpen && (
      <>
        <span className="shipper-nav-label">{label}</span>
        {badge && (
          <span className="shipper-nav-badge">
            {badge}
          </span>
        )}
      </>
    )}
  </button>
);

const ShipperStatCard = ({ title, value, change, icon, color, alert }) => {
  const colorClass = `shipper-stat-card-${color}`;
  
  return (
    <div className={`shipper-stat-card ${colorClass}`}>
      <div className="shipper-stat-header">
        <div className="shipper-stat-icon-wrapper">
          {icon}
        </div>
        {change !== undefined && (
          <div className={`shipper-stat-change ${change >= 0 ? 'positive' : 'negative'}`}>
            {change >= 0 ? <TrendingUp className="icon" /> : <TrendingDown className="icon" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="shipper-stat-title">{title}</p>
      <p className={`shipper-stat-value ${alert ? 'shipper-stat-alert' : ''}`}>
        {value}
      </p>
    </div>
  );
};

const ShipperShipmentCard = ({ shipment }) => {
  const statusConfig = {
    in_transit: { class: 'shipper-status-in-transit', label: 'In Transit' },
    loading: { class: 'shipper-status-loading', label: 'Loading' },
    awaiting_pickup: { class: 'shipper-status-awaiting', label: 'Awaiting Pickup' },
    delivered: { class: 'shipper-status-delivered', label: 'Delivered' }
  };

  const status = statusConfig[shipment.status];

  return (
    <div className="shipper-shipment-card">
      <div className="shipper-shipment-header">
        <span className="shipper-shipment-id">{shipment.id}</span>
        <span className={`shipper-shipment-status ${status.class}`}>
          {status.label}
        </span>
      </div>
      
      <div className="shipper-shipment-route">
        <MapPin className="icon" />
        <span>{shipment.route}</span>
      </div>

      <div className="shipper-shipment-details">
        <span>Driver: {shipment.driver}</span>
        <span className="flex items-center gap-1">
          <Clock className="icon" style={{ width: 16, height: 16 }} />
          ETA: {shipment.eta}
        </span>
      </div>

      <div className="shipper-shipment-progress">
        <div className="shipper-progress-bar">
          <div 
            className="shipper-progress-fill"
            style={{ width: `${shipment.progress}%` }}
          />
        </div>
        <div className="shipper-progress-text">{shipment.progress}% Complete</div>
      </div>

      <div className="shipper-shipment-actions">
        <button className="shipper-btn-track">
          Track Live
        </button>
        <button className="shipper-btn-contact">
          Contact
        </button>
      </div>
    </div>
  );
};

const ShipperActivityItem = ({ activity }) => {
  const typeIcons = {
    pickup: <Package className="icon" />,
    payment: <DollarSign className="icon" />,
    booking: <Plus className="icon" />,
    assignment: <Users className="icon" />,
    delivery: <CheckCircle className="icon" />,
    dispute: <AlertCircle className="icon" />
  };

  return (
    <div className="shipper-activity-item">
      <div className="shipper-activity-icon">
        {typeIcons[activity.type]}
      </div>
      <div className="shipper-activity-content">
        <p className="shipper-activity-event">{activity.event}</p>
        <p className="shipper-activity-user">{activity.user}</p>
        <p className="shipper-activity-time">{activity.time}</p>
      </div>
    </div>
  );
};

export default ShipperDashboard;