import React, { useState, useRef, useEffect } from 'react';
import {
  Building, Package, MapPin, TrendingUp, TrendingDown, Clock, DollarSign, Plus,
  Search, Download, FileText, Star, Truck, Menu, Bell, User, Home,
  BarChart3, Users, Settings, LogOut, ChevronDown, Calendar, Filter,
  Eye, RefreshCw, ChevronLeft, ChevronRight, CreditCard, AlertCircle, X,
  Check, PieChart, Activity, Layers, UserPlus, Shield, Phone, Mail, Loader
} from 'lucide-react';
import { authAPI, corporateAPI, bookingsAPI, trackingAPI, notificationsAPI, publicAPI, subscriptionCheckoutAPI } from '../services/api';
import logo from '../assets/logo3.png';
import './styles/CorporateDashboard.css';

const normalizeZimbabwePhone = (phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('263') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+263${digits.slice(1)}`;
  if (!digits.startsWith('0') && digits.length === 9) return `+263${digits}`;
  if (String(phone).trim().startsWith('+263') && digits.length === 12) return `+${digits}`;
  return String(phone || '').trim();
};

const formatAddressValue = (address) => {
  if (!address) return '';
  if (typeof address === 'string') return address;
  return [
    address.street,
    address.city,
    address.state,
    address.country
  ].filter(Boolean).join(', ');
};

const downloadCsv = (filename, rows) => {
  const safeRows = rows.length > 0 ? rows : [{ message: 'No records available' }];
  const headers = Object.keys(safeRows[0]);
  const csv = [
    headers.join(','),
    ...safeRows.map(row => headers.map(header => {
      const value = row[header] === undefined || row[header] === null ? '' : String(row[header]);
      return `"${value.replace(/"/g, '""')}"`;
    }).join(','))
  ].join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const downloadBlob = (filename, blob) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const getCorporateBookingRef = (booking) => booking.bookingReference || booking.bookingId || booking._id || booking.id;
const getCorporateBookingRecordId = (booking) => booking._id || booking.recordId || booking.id;
const getCorporateBookingRoute = (booking) => {
  const pickup = booking.route?.pickup?.address || booking.route?.pickup?.city || booking.pickup?.city || booking.pickup?.address || 'N/A';
  const delivery = booking.route?.delivery?.address || booking.route?.delivery?.city || booking.delivery?.city || booking.delivery?.address || 'N/A';
  return `${pickup} -> ${delivery}`;
};

const CorporateDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState('overview');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationError, setNotificationError] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const userDropdownRef = useRef(null);
  const currentUser = authAPI.getCurrentUser() || {};
  const corporateName = currentUser.corporateAccount?.companyName || currentUser.companyName || currentUser.fullName || '';

  const openNotifications = async () => {
    try {
      setNotificationError('');
      const response = await notificationsAPI.getAll();
      const items = response.data || response.notifications || [];
      setNotifications(items);
      setUnreadCount(items.filter(item => !item.read).length);
      setNotificationsOpen(open => !open);
    } catch (error) {
      setNotificationError(error.message || 'Unable to load notifications.');
      setNotificationsOpen(true);
    }
  };

  const markNotificationsRead = async () => {
    try {
      await notificationsAPI.markAllAsRead();
      setNotifications(items => items.map(item => ({ ...item, read: true })));
      setUnreadCount(0);
    } catch (error) {
      setNotificationError(error.message || 'Unable to mark notifications as read.');
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const response = await notificationsAPI.getUnreadCount();
        setUnreadCount(response.data?.count || response.count || 0);
      } catch {
        setUnreadCount(0);
      }
    };

    loadUnreadCount();
  }, []);

  const navigation = [
    { id: 'overview', label: 'Overview', icon: <Home className="icon" /> },
    { id: 'bookings', label: 'Manage Bookings', icon: <Package className="icon" /> },
    { id: 'team', label: 'Team Members', icon: <Users className="icon" /> },
    { id: 'analytics', label: 'Analytics', icon: <BarChart3 className="icon" /> },
    { id: 'billing', label: 'Billing', icon: <CreditCard className="icon" /> },
    { id: 'reports', label: 'Reports', icon: <FileText className="icon" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="icon" /> },
  ];

  const renderContent = () => {
    switch (activeNav) {
      case 'overview': return <OverviewTab setActiveNav={setActiveNav} />;
      case 'bookings': return <BookingsTab />;
      case 'team': return <TeamTab />;
      case 'analytics': return <AnalyticsTab />;
      case 'billing': return <BillingTab />;
      case 'reports': return <ReportsTab />;
      case 'settings': return <SettingsTab />;
      default: return <OverviewTab setActiveNav={setActiveNav} />;
    }
  };

  return (
    <div className="corporate-dashboard">
      {/* Sidebar */}
      <div className={`corp-sidebar ${sidebarOpen ? 'corp-sidebar-open' : 'corp-sidebar-closed'}`}>
        <div className="corp-sidebar-header">
          {sidebarOpen && (
            <div className="corp-sidebar-brand">
              <div className="corp-brand-logo">
                <img src={logo} alt="Palmtrent" />
              </div>
              <span className="corp-brand-text">Palmtrent</span>
            </div>
          )}
          <button className="corp-sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="icon" />
          </button>
        </div>

        <nav className="corp-sidebar-nav">
          {navigation.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`corp-nav-item ${activeNav === item.id ? 'corp-nav-item-active' : ''}`}
            >
              <span className="corp-nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="corp-nav-label">{item.label}</span>}
            </button>
          ))}
        </nav>

        {sidebarOpen && (
          <div className="corp-sidebar-footer">
            <div className="corp-plan-badge">
              <Shield className="icon" />
              <div>
                <span className="plan-name">Enterprise Plan</span>
                <span className="plan-status">Active</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="corp-main-content">
        <div className="corp-topbar">
          <div className="corp-topbar-content">
            <div className="corp-topbar-left">
              <h1 className="corp-page-title">
                {activeNav === 'overview' && 'Corporate Dashboard'}
                {activeNav === 'bookings' && 'Manage Bookings'}
                {activeNav === 'team' && 'Team Members'}
                {activeNav === 'analytics' && 'Analytics'}
                {activeNav === 'billing' && 'Billing & Invoices'}
                {activeNav === 'reports' && 'Reports'}
                {activeNav === 'settings' && 'Account Settings'}
              </h1>
              <p className="corp-page-subtitle">{corporateName}</p>
            </div>
            <div className="corp-topbar-right">
              <button className="corp-notification-btn" onClick={openNotifications}>
                <Bell className="icon" />
                {unreadCount > 0 && <span className="corp-notification-badge">{unreadCount}</span>}
              </button>
              {notificationsOpen && (
                <div className="corp-notification-panel">
                  <div className="corp-notification-panel-header">
                    <strong>Notifications</strong>
                    <button onClick={markNotificationsRead}>Mark all read</button>
                  </div>
                  {notificationError && <div className="corp-inline-message error">{notificationError}</div>}
                  {!notificationError && notifications.length === 0 && <div className="corp-notification-empty">No notifications yet.</div>}
                  {notifications.slice(0, 8).map(item => (
                    <div key={item._id || item.id} className={`corp-notification-item ${item.read ? '' : 'unread'}`}>
                      <span>{item.title || item.type || 'Notification'}</span>
                      <p>{item.body || item.message || ''}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className={`corp-user-dropdown ${userDropdownOpen ? 'open' : ''}`} ref={userDropdownRef}>
                <button className="corp-user-trigger" onClick={() => setUserDropdownOpen(!userDropdownOpen)}>
                  <div className="corp-user-avatar"><Building className="icon" /></div>
                  <div className="corp-user-info">
                    <p className="corp-user-name">{corporateName || currentUser.email}</p>
                    <p className="corp-user-role">{currentUser.corporateRole || currentUser.userType || 'Corporate user'}</p>
                  </div>
                  <ChevronDown className="corp-dropdown-arrow" size={16} />
                </button>

                <div className="corp-dropdown-menu">
                  <button className="corp-dropdown-item" onClick={() => { setActiveNav('settings'); setUserDropdownOpen(false); }}><User className="icon" /><span>Company Profile</span></button>
                  <button className="corp-dropdown-item" onClick={() => { setActiveNav('settings'); setUserDropdownOpen(false); }}><Settings className="icon" /><span>Settings</span></button>
                  <div className="corp-dropdown-divider" />
                  <button className="corp-dropdown-item logout" onClick={authAPI.logout}><LogOut className="icon" /><span>Logout</span></button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="corp-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

// ============ Overview Tab ============
const OverviewTab = ({ setActiveNav }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBookings: 0,
    activeShipments: 0,
    monthlySpend: 0,
    teamMembers: 0,
    growth: { bookings: 0, spend: 0 }
  });
  const [recentBookings, setRecentBookings] = useState([]);
  const [topRoutes, setTopRoutes] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch corporate dashboard stats
        const statsRes = await corporateAPI.getDashboardStats();
        if (statsRes.success && statsRes.data) {
          setStats({
            totalBookings: statsRes.data.totalBookings || 0,
            activeShipments: statsRes.data.activeShipments || 0,
            monthlySpend: statsRes.data.monthlySpend || 0,
            teamMembers: statsRes.data.teamMembers || 0,
            growth: statsRes.data.growth || { bookings: 0, spend: 0 }
          });
          if (statsRes.data.topRoutes) {
            setTopRoutes(statsRes.data.topRoutes);
          }
        }

        // Fetch recent bookings
        const bookingsRes = await bookingsAPI.getAll({ limit: 5 });
        if (bookingsRes.data) {
          setRecentBookings(bookingsRes.data.map(b => ({
            id: b.bookingId || b._id,
            route: `${b.pickup?.city || 'N/A'} → ${b.delivery?.city || 'N/A'}`,
            status: b.status,
            bookedBy: b.shipper?.fullName || 'N/A',
            amount: b.pricing?.total || 0
          })));
        }

      } catch (error) {
        console.error('Error fetching corporate dashboard:', error);
        setRecentBookings([]);
        setTopRoutes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <Loader className="icon spinning" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <>
      {/* Stats Grid */}
      <div className="corp-stats-grid">
        <StatCard title="Total Bookings" value={stats.totalBookings} change={stats.growth.bookings} icon={<Package className="icon" />} color="primary" />
        <StatCard title="Active Shipments" value={stats.activeShipments} icon={<Truck className="icon" />} color="accent" />
        <StatCard title="Monthly Spend" value={`$${stats.monthlySpend.toLocaleString()}`} change={stats.growth.spend} icon={<DollarSign className="icon" />} color="success" />
        <StatCard title="Team Members" value={stats.teamMembers} icon={<Users className="icon" />} color="secondary" />
      </div>

      {/* Quick Actions */}
      <div className="corp-quick-actions">
        <button className="quick-action-btn primary" onClick={() => setActiveNav('bookings')}>
          <Plus className="icon" /> New Booking
        </button>
        <button className="quick-action-btn secondary" onClick={() => setActiveNav('team')}>
          <UserPlus className="icon" /> Add Team Member
        </button>
        <button className="quick-action-btn secondary" onClick={() => setActiveNav('reports')}>
          <Download className="icon" /> Download Report
        </button>
      </div>

      <div className="corp-content-grid">
        {/* Recent Bookings */}
        <div className="corp-section">
          <div className="corp-section-header">
            <h3>Recent Bookings</h3>
            <button className="view-all-btn" onClick={() => setActiveNav('bookings')}>View All →</button>
          </div>
          <div className="corp-table-container">
            <table className="corp-table">
              <thead>
                <tr><th>Booking ID</th><th>Route</th><th>Booked By</th><th>Status</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {recentBookings.map(booking => (
                  <tr key={booking.id}>
                    <td><span className="booking-id">{booking.id}</span></td>
                    <td>{booking.route}</td>
                    <td>{booking.bookedBy}</td>
                    <td><span className={`status-badge status-${booking.status.replace('_', '-')}`}>{booking.status.replace('_', ' ')}</span></td>
                    <td className="amount">${booking.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Routes */}
        <div className="corp-section">
          <div className="corp-section-header">
            <h3>Top Routes</h3>
          </div>
          <div className="top-routes-list">
            {topRoutes.map((item, index) => (
              <div key={index} className="route-item">
                <div className="route-info">
                  <span className="route-name">{item.route}</span>
                  <span className="route-count">{item.count} shipments</span>
                </div>
                <div className="route-bar">
                  <div className="route-bar-fill" style={{ width: `${item.percentage}%` }} />
                </div>
                <span className="route-percentage">{item.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spending Summary */}
      <div className="corp-section full-width">
        <div className="corp-section-header">
          <h3>Monthly Spending Trend</h3>
          <select className="period-select">
            <option value="6months">Last 6 Months</option>
            <option value="year">Last Year</option>
          </select>
        </div>
        <div className="top-routes-list">
          {topRoutes.length > 0 ? topRoutes.map((item, index) => (
            <div key={index} className="route-item">
              <div className="route-info">
                <span className="route-name">{item.route}</span>
                <span className="route-count">{item.count} shipment{item.count === 1 ? '' : 's'}</span>
              </div>
              <div className="route-bar">
                <div className="route-bar-fill" style={{ width: `${item.percentage || 0}%` }} />
              </div>
              <span className="route-percentage">{item.percentage || 0}%</span>
            </div>
          )) : (
            <div className="empty-state">
              <Activity className="icon" />
              <p>No spending activity has been recorded for this period.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ============ Bookings Tab ============
const BookingsTab = () => {
  const [filter, setFilter] = useState('all');
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [trackingDetails, setTrackingDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsMessage, setDetailsMessage] = useState('');

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        const params = { page: currentPage, limit: 10 };
        if (filter !== 'all') params.status = filter;

        const response = await bookingsAPI.getAll(params);
        const data = response.data || [];

        setBookings(data.map(b => ({
          id: getCorporateBookingRef(b),
          recordId: b._id,
          date: b.createdAt,
          route: getCorporateBookingRoute(b),
          status: b.status,
          bookedBy: b.shipper?.fullName || 'N/A',
          driver: b.transporter?.fullName || 'N/A',
          amount: b.pricing?.total || b.pricing?.totals?.total || b.totalAmount || 0
        })));

        if (response.pagination) {
          setPagination(response.pagination);
        }
      } catch (error) {
        console.error('Error fetching bookings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [filter, currentPage]);

  const filteredBookings = bookings;

  const exportBookings = () => {
    downloadCsv('corporate-bookings.csv', filteredBookings.map(booking => ({
      bookingId: booking.id,
      date: booking.date ? new Date(booking.date).toISOString() : '',
      route: booking.route,
      bookedBy: booking.bookedBy,
      driver: booking.driver,
      status: booking.status,
      amount: booking.amount
    })));
  };

  const viewBooking = async (booking) => {
    setDetailsMessage('');
    setTrackingDetails(null);
    setSelectedBooking(booking);
    setDetailsLoading(true);
    try {
      const response = await bookingsAPI.getById(getCorporateBookingRecordId(booking));
      const data = response.data || response.booking || booking;
      setSelectedBooking({
        ...data,
        id: getCorporateBookingRef(data),
        recordId: data._id,
        routeLabel: getCorporateBookingRoute(data),
        amount: data.pricing?.totals?.total || data.pricing?.total || data.totalAmount || booking.amount || 0
      });
    } catch (error) {
      setDetailsMessage(error.message || 'Unable to load booking details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const trackBooking = async (booking) => {
    setDetailsMessage('');
    setSelectedBooking(booking);
    setDetailsLoading(true);
    try {
      const response = await trackingAPI.track(booking.id);
      setTrackingDetails(response.data || response);
    } catch (error) {
      setDetailsMessage(error.message || 'Tracking is not available for this booking yet.');
    } finally {
      setDetailsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Loader className="icon spinning" />
        <p>Loading bookings...</p>
      </div>
    );
  }

  return (
    <div className="bookings-management">
      <div className="bookings-header">
        <div className="filter-section">
          <div className="filter-tabs">
            {['all', 'in_transit', 'awaiting_pickup', 'delivered', 'cancelled'].map(f => (
              <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
        <div className="action-buttons">
          <button className="btn-secondary" onClick={exportBookings}><Download className="icon" /> Export</button>
          <button className="btn-primary" onClick={() => setShowNewBooking(true)}><Plus className="icon" /> New Booking</button>
        </div>
      </div>

      <div className="corp-table-container">
        {(selectedBooking || trackingDetails || detailsMessage) && (
          <div className="corp-detail-panel">
            <div className="corp-detail-panel-header">
              <div>
                <h3>{selectedBooking?.id || 'Booking details'}</h3>
                <p>{selectedBooking?.routeLabel || selectedBooking?.route || ''}</p>
              </div>
              <button className="btn-secondary" onClick={() => { setSelectedBooking(null); setTrackingDetails(null); setDetailsMessage(''); }}>
                Close
              </button>
            </div>
            {detailsLoading && <div className="corp-inline-message">Loading details...</div>}
            {detailsMessage && <div className="corp-inline-message error">{detailsMessage}</div>}
            {selectedBooking && !detailsLoading && (
              <div className="corp-detail-grid">
                <div><span>Status</span><strong>{(selectedBooking.status || 'pending').replace(/_/g, ' ')}</strong></div>
                <div><span>Booked By</span><strong>{selectedBooking.shipper?.fullName || selectedBooking.bookedBy || 'N/A'}</strong></div>
                <div><span>Transporter</span><strong>{selectedBooking.transporter?.fullName || selectedBooking.driver || 'Pending'}</strong></div>
                <div><span>Amount</span><strong>${Number(selectedBooking.amount || 0).toLocaleString()}</strong></div>
                <div><span>Pickup</span><strong>{selectedBooking.route?.pickup?.address || selectedBooking.pickup || 'N/A'}</strong></div>
                <div><span>Delivery</span><strong>{selectedBooking.route?.delivery?.address || selectedBooking.delivery || 'N/A'}</strong></div>
              </div>
            )}
            {trackingDetails && !detailsLoading && (
              <div className="corp-tracking-summary">
                <h4>Tracking</h4>
                <div className="corp-detail-grid">
                  <div><span>Reference</span><strong>{trackingDetails.reference || selectedBooking?.id}</strong></div>
                  <div><span>Current Status</span><strong>{(trackingDetails.status || selectedBooking?.status || 'pending').replace(/_/g, ' ')}</strong></div>
                  <div><span>Current Location</span><strong>{trackingDetails.currentLocation?.address || 'Location not reported yet'}</strong></div>
                  <div><span>Events</span><strong>{trackingDetails.tracking?.length || 0}</strong></div>
                </div>
              </div>
            )}
          </div>
        )}
        <table className="corp-table">
          <thead>
            <tr><th>Booking ID</th><th>Date</th><th>Route</th><th>Booked By</th><th>Driver</th><th>Status</th><th>Amount</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filteredBookings.map(booking => (
              <tr key={booking.id}>
                <td><span className="booking-id">{booking.id}</span></td>
                <td>{new Date(booking.date).toLocaleDateString()}</td>
                <td>{booking.route}</td>
                <td>{booking.bookedBy}</td>
                <td>{booking.driver}</td>
                <td><span className={`status-badge status-${booking.status.replace('_', '-')}`}>{booking.status.replace('_', ' ')}</span></td>
                <td className="amount">${booking.amount}</td>
                <td>
                  <div className="action-btns">
                    <button className="action-btn" onClick={() => viewBooking(booking)} title="View booking"><Eye className="icon" /></button>
                    <button className="action-btn" onClick={() => trackBooking(booking)} title="Track booking"><MapPin className="icon" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="pagination-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(page => Math.max(1, page - 1))}><ChevronLeft className="icon" /></button>
        <span>Page {currentPage} of {pagination.pages || 1}</span>
        <button className="pagination-btn" disabled={currentPage >= (pagination.pages || 1)} onClick={() => setCurrentPage(page => page + 1)}><ChevronRight className="icon" /></button>
      </div>

      {showNewBooking && (
        <div className="modal-overlay" onClick={() => setShowNewBooking(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Create Corporate Booking</h2>
              <button className="modal-close" type="button" aria-label="Close new booking dialog" onClick={() => setShowNewBooking(false)}>
                <X className="icon" />
              </button>
            </div>
            <div className="modal-body">
              <p>Corporate bookings use the live shipper booking workflow so pricing, documents, insurance, and payment status remain on the same backend records.</p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowNewBooking(false)}>Cancel</button>
              <button className="btn-primary" onClick={() => { window.location.href = '/shipper'; }}>Open Booking Workflow</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Team Tab ============
const TEAM_PERMISSION_OPTIONS = [
  { key: 'create_bookings', label: 'Create Bookings' },
  { key: 'view_all_bookings', label: 'View All Bookings' },
  { key: 'manage_team', label: 'Manage Team' },
  { key: 'view_reports', label: 'View Reports' }
];

const TEAM_ROLE_DEFAULT_PERMISSIONS = {
  admin: TEAM_PERMISSION_OPTIONS.map(permission => permission.key),
  manager: ['create_bookings', 'view_all_bookings', 'view_reports'],
  viewer: ['view_all_bookings']
};

const TeamTab = () => {
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editMemberForm, setEditMemberForm] = useState({ role: 'viewer', permissions: [] });
  const [teamMembers, setTeamMembers] = useState([]);
  const [inviteForm, setInviteForm] = useState({
    fullName: '',
    email: '',
    role: 'manager',
    permissions: TEAM_ROLE_DEFAULT_PERMISSIONS.manager
  });
  const [teamMessage, setTeamMessage] = useState('');

  const loadTeam = async () => {
    try {
      const response = await corporateAPI.getUsers();
      setTeamMembers((response.data || []).map(member => {
        const user = member.user || member;
        return {
          id: user._id,
          name: user.fullName || user.email,
          email: user.email,
          role: member.role || user.corporateRole || 'viewer',
          permissions: member.permissions || TEAM_ROLE_DEFAULT_PERMISSIONS[member.role || 'viewer'] || [],
          bookings: user.bookingCount || 0,
          lastActive: user.lastLogin || user.updatedAt || user.createdAt,
          status: user.status || 'active'
        };
      }).filter(member => member.id));
    } catch (error) {
      console.error('Failed to load team:', error);
      setTeamMembers([]);
    }
  };

  useEffect(() => {
    loadTeam();
  }, []);

  const inviteMember = async () => {
    try {
      if (!inviteForm.email) {
        setTeamMessage('Email address is required.');
        return;
      }
      await corporateAPI.inviteUser({
        email: inviteForm.email,
        role: inviteForm.role,
        permissions: inviteForm.permissions
      });
      setInviteForm({
        fullName: '',
        email: '',
        role: 'manager',
        permissions: TEAM_ROLE_DEFAULT_PERMISSIONS.manager
      });
      setShowAddMember(false);
      await loadTeam();
      setTeamMessage('Team member added to the corporate account.');
    } catch (error) {
      setTeamMessage(error.message || 'Unable to add team member.');
    }
  };

  const editMember = async (member) => {
    setEditingMember(member);
    setEditMemberForm({
      role: member.role || 'viewer',
      permissions: member.permissions || TEAM_ROLE_DEFAULT_PERMISSIONS[member.role || 'viewer'] || []
    });
    setTeamMessage('');
  };

  const saveMemberEdit = async () => {
    if (!editingMember) return;
    try {
      await corporateAPI.updateUser(editingMember.id, editMemberForm);
      await loadTeam();
      setTeamMessage(`${editingMember.name} updated.`);
      setEditingMember(null);
    } catch (error) {
      setTeamMessage(error.message || 'Unable to update team member.');
    }
  };

  const removeMember = async (member) => {
    if (!window.confirm(`Remove ${member.name} from this corporate account?`)) return;
    try {
      await corporateAPI.removeUser(member.id);
      await loadTeam();
      setTeamMessage(`${member.name} removed from this corporate account.`);
    } catch (error) {
      setTeamMessage(error.message || 'Unable to remove team member.');
    }
  };

  const updateInviteRole = (role) => {
    setInviteForm(form => ({
      ...form,
      role,
      permissions: TEAM_ROLE_DEFAULT_PERMISSIONS[role] || []
    }));
  };

  const toggleInvitePermission = (permission) => {
    setInviteForm(form => {
      const permissions = form.permissions.includes(permission)
        ? form.permissions.filter(item => item !== permission)
        : [...form.permissions, permission];
      return { ...form, permissions };
    });
  };

  const updateEditRole = (role) => {
    setEditMemberForm(form => ({
      ...form,
      role,
      permissions: TEAM_ROLE_DEFAULT_PERMISSIONS[role] || []
    }));
  };

  const toggleEditPermission = (permission) => {
    setEditMemberForm(form => {
      const permissions = form.permissions.includes(permission)
        ? form.permissions.filter(item => item !== permission)
        : [...form.permissions, permission];
      return { ...form, permissions };
    });
  };

  return (
    <div className="team-management">
      {teamMessage && <div className="corp-inline-message">{teamMessage}</div>}
      <div className="team-header">
        <div className="team-stats">
          <div className="team-stat"><span className="stat-value">{teamMembers.length}</span><span className="stat-label">Total Members</span></div>
          <div className="team-stat"><span className="stat-value">{teamMembers.filter(m => m.status === 'active').length}</span><span className="stat-label">Active</span></div>
          <div className="team-stat"><span className="stat-value">{teamMembers.filter(m => String(m.role).toLowerCase() === 'admin').length}</span><span className="stat-label">Admins</span></div>
        </div>
        <button className="btn-primary" onClick={() => setShowAddMember(true)}><UserPlus className="icon" /> Add Member</button>
      </div>

      <div className="team-grid">
        {teamMembers.map(member => (
          <div key={member.id} className="team-card">
            <div className="team-card-header">
              <div className="member-avatar">{member.name.split(' ').map(n => n[0]).join('')}</div>
              <span className={`member-status ${member.status}`}>{member.status}</span>
            </div>
            <h3 className="member-name">{member.name}</h3>
            <p className="member-email">{member.email}</p>
            <div className="member-role"><Shield className="icon" /> {member.role}</div>
            <div className="member-permissions">
              {(member.permissions || []).map(permission => (
                <span key={permission} className="permission-chip">
                  {permission.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
            <div className="member-stats">
              <div><span className="value">{member.bookings}</span><span className="label">Bookings</span></div>
              <div><span className="value">{new Date(member.lastActive).toLocaleDateString()}</span><span className="label">Last Active</span></div>
            </div>
            <div className="member-actions">
              <button className="btn-secondary" onClick={() => editMember(member)}>Edit</button>
              <button className="btn-secondary danger" onClick={() => removeMember(member)}>Remove</button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Member Modal */}
      {showAddMember && (
        <div className="modal-overlay" onClick={() => setShowAddMember(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Add Team Member</h2>
              <button className="modal-close" type="button" aria-label="Close add member dialog" onClick={() => setShowAddMember(false)}>
                <X className="icon" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" placeholder="Enter full name" value={inviteForm.fullName} onChange={e => setInviteForm(form => ({ ...form, fullName: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" placeholder="Enter email address" value={inviteForm.email} onChange={e => setInviteForm(form => ({ ...form, email: e.target.value }))} />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={inviteForm.role} onChange={e => updateInviteRole(e.target.value)}>
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Permissions</label>
                <div className="permissions-list">
                  {TEAM_PERMISSION_OPTIONS.map(permission => (
                    <label key={permission.key} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={inviteForm.permissions.includes(permission.key)}
                        onChange={() => toggleInvitePermission(permission.key)}
                      />
                      {permission.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddMember(false)}>Cancel</button>
              <button className="btn-primary" onClick={inviteMember}>Send Invitation</button>
            </div>
          </div>
        </div>
      )}

      {editingMember && (
        <div className="modal-overlay" onClick={() => setEditingMember(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit Team Member</h2>
              <button className="modal-close" type="button" aria-label="Close edit member dialog" onClick={() => setEditingMember(null)}>
                <X className="icon" />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Member</label>
                <input type="text" value={`${editingMember.name} (${editingMember.email})`} disabled />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select value={editMemberForm.role} onChange={e => updateEditRole(e.target.value)}>
                  <option value="viewer">Viewer</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Permissions</label>
                <div className="permissions-list">
                  {TEAM_PERMISSION_OPTIONS.map(permission => (
                    <label key={permission.key} className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={editMemberForm.permissions.includes(permission.key)}
                        onChange={() => toggleEditPermission(permission.key)}
                      />
                      {permission.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setEditingMember(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveMemberEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Analytics Tab ============
const AnalyticsTab = () => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await corporateAPI.getAnalytics();

        if (response.success && response.data) {
          if (response.data.metrics) {
            setMetrics(response.data.metrics);
          } else if (response.data.summary) {
            setMetrics([
              { label: 'Total Bookings', value: response.data.summary.totalBookings || 0, change: `${response.data.summary.completionRate || 0}% complete`, trend: 'positive' },
              { label: 'Completed', value: response.data.summary.completedBookings || 0, change: 'Delivered', trend: 'positive' },
              { label: 'Total Spend', value: `$${Number(response.data.summary.totalSpend || 0).toLocaleString()}`, change: 'Live', trend: 'positive' },
              { label: 'Avg. Order', value: `$${Number(response.data.summary.avgOrderValue || 0).toLocaleString()}`, change: 'Per booking', trend: 'positive' }
            ]);
          }

          if (response.data.monthlyData) {
            setMonthlyData(response.data.monthlyData);
          } else {
            setMonthlyData(Object.entries(response.data.statusBreakdown || {}).map(([status, count]) => ({
              month: status.replace('_', ' '),
              bookings: count,
              spend: 0
            })));
          }
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
        setMetrics([]);
        setMonthlyData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <Loader className="icon spinning" />
        <p>Loading analytics...</p>
      </div>
    );
  }

  const maxBookings = Math.max(1, ...monthlyData.map(item => Number(item.bookings || 0)));

  return (
    <div className="analytics-container">
      {/* Key Metrics */}
      <div className="metrics-grid">
        {metrics.map((metric, index) => (
          <div key={index} className="metric-card">
            <div className="metric-header">
              <span className="metric-label">{metric.label}</span>
              <span className={`metric-change ${metric.trend}`}>{metric.change}</span>
            </div>
            <span className="metric-value">{metric.value}</span>
          </div>
        ))}
      </div>

      {/* Analytics Summaries */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>Booking Status</h3>
          <div className="top-routes-list">
            {monthlyData.length > 0 ? monthlyData.map((data, index) => (
              <div key={index} className="route-item">
                <div className="route-info">
                  <span className="route-name">{data.month}</span>
                  <span className="route-count">{data.bookings} booking{Number(data.bookings) === 1 ? '' : 's'}</span>
                </div>
                <div className="route-bar">
                  <div className="route-bar-fill" style={{ width: `${Math.round((Number(data.bookings || 0) / maxBookings) * 100)}%` }} />
                </div>
              </div>
            )) : <p>No booking analytics available yet.</p>}
          </div>
        </div>
        <div className="chart-card">
          <h3>Spending Distribution</h3>
          <div className="top-routes-list">
            {metrics.filter(metric => String(metric.label).toLowerCase().includes('spend') || String(metric.label).toLowerCase().includes('order')).map((metric, index) => (
              <div key={index} className="route-item">
                <div className="route-info">
                  <span className="route-name">{metric.label}</span>
                  <span className="route-count">{metric.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="corp-section">
        <div className="corp-section-header">
          <h3>Monthly Summary</h3>
        </div>
        <div className="corp-table-container">
          <table className="corp-table">
            <thead>
              <tr><th>Month</th><th>Bookings</th><th>Total Spend</th><th>Avg. per Booking</th></tr>
            </thead>
            <tbody>
              {monthlyData.map((data, index) => (
                <tr key={index}>
                  <td>{data.month}</td>
                  <td>{data.bookings}</td>
                  <td className="amount">${Number(data.spend || 0).toLocaleString()}</td>
                  <td>${Number(data.bookings || 0) > 0 ? Math.round(Number(data.spend || 0) / Number(data.bookings || 1)).toLocaleString() : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============ Billing Tab ============
const BillingTab = () => {
  const currentUser = authAPI.getCurrentUser() || {};
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [currentBilling, setCurrentBilling] = useState({
    currentCharges: 0,
    pendingPayments: 0,
    creditBalance: 0,
    nextBillingDate: ''
  });
  const [billingMessage, setBillingMessage] = useState('');
  const [payingSubscription, setPayingSubscription] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [paymentMethodForm, setPaymentMethodForm] = useState('monthly_invoice');

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        setLoading(true);

        const [response, subscriptionResponse] = await Promise.all([
          corporateAPI.getInvoices(),
          publicAPI.getMySubscription()
        ]);
        if (response.success && response.data) {
          setInvoices(response.data.invoices || []);
          if (response.data.billing) {
            setCurrentBilling(response.data.billing);
          }
        }
        setSubscription(subscriptionResponse.data || null);
      } catch (error) {
        console.error('Error fetching billing data:', error);
        setInvoices([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();
  }, []);

  const refreshBilling = async () => {
    const [response, subscriptionResponse] = await Promise.all([
      corporateAPI.getInvoices(),
      publicAPI.getMySubscription()
    ]);
    if (response.success && response.data) {
      setInvoices(response.data.invoices || []);
      if (response.data.billing) setCurrentBilling(response.data.billing);
    }
    setSubscription(subscriptionResponse.data || null);
  };

  const paySubscription = async () => {
    if (!subscription) return;
    try {
      setPayingSubscription(true);
      setBillingMessage('');
      const redirected = await subscriptionCheckoutAPI.start(subscription, {
        email: currentUser.email,
        phone: currentUser.phone
      });
      if (!redirected) setBillingMessage('Subscription does not require payment or is already paid.');
    } catch (error) {
      setBillingMessage(error.message || 'Could not start subscription payment.');
    } finally {
      setPayingSubscription(false);
    }
  };

  const subscriptionPaymentStatus = subscription?.payment?.status || '';
  const canPaySubscription = subscription &&
    Number(subscription.amount || subscription.plan?.price || 0) > 0 &&
    !['paid', 'not_required'].includes(subscriptionPaymentStatus);

  const updatePaymentMethod = async () => {
    try {
      await corporateAPI.addPaymentMethod({ method: paymentMethodForm });
      setBillingMessage('Payment method updated.');
    } catch (error) {
      setBillingMessage(error.message || 'Unable to update payment method.');
    }
  };

  const exportInvoices = () => {
    downloadCsv('corporate-invoices.csv', invoices.map(invoice => ({
      invoice: invoice.invoiceNumber || invoice.id || invoice._id,
      date: invoice.createdAt || invoice.date,
      period: invoice.period || `${invoice.billingPeriod?.start || ''} - ${invoice.billingPeriod?.end || ''}`,
      amount: invoice.total || invoice.amount || 0,
      status: invoice.status
    })));
  };

  const downloadInvoice = async (invoice) => {
    try {
      const id = invoice._id || invoice.id;
      const blob = await corporateAPI.downloadInvoice(id);
      downloadBlob(`${invoice.invoiceNumber || id}.html`, blob);
    } catch (error) {
      setBillingMessage(error.message || 'Unable to download invoice.');
    }
  };

  const viewInvoice = async (invoice) => {
    try {
      const response = await corporateAPI.getInvoiceById(invoice._id || invoice.id);
      const data = response.data || invoice;
      setSelectedInvoice(data);
    } catch (error) {
      setBillingMessage(error.message || 'Unable to load invoice.');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Loader className="icon spinning" />
        <p>Loading billing information...</p>
      </div>
    );
  }

  return (
    <div className="billing-container">
      {billingMessage && <div className="corp-inline-message">{billingMessage}</div>}
      {selectedInvoice && (
        <div className="corp-detail-panel">
          <div className="corp-detail-panel-header">
            <div>
              <h3>{selectedInvoice.invoiceNumber || selectedInvoice._id}</h3>
              <p>Invoice details</p>
            </div>
            <button className="btn-secondary" onClick={() => setSelectedInvoice(null)}>Close</button>
          </div>
          <div className="corp-detail-grid">
            <div><span>Status</span><strong>{selectedInvoice.status}</strong></div>
            <div><span>Total</span><strong>{selectedInvoice.currency || '$'}{Number(selectedInvoice.total || selectedInvoice.amount || 0).toLocaleString()}</strong></div>
            <div><span>Due Date</span><strong>{selectedInvoice.dueDate ? new Date(selectedInvoice.dueDate).toLocaleDateString() : 'N/A'}</strong></div>
            <div><span>Billing Period</span><strong>{selectedInvoice.billingPeriod?.start ? new Date(selectedInvoice.billingPeriod.start).toLocaleDateString() : 'N/A'} - {selectedInvoice.billingPeriod?.end ? new Date(selectedInvoice.billingPeriod.end).toLocaleDateString() : 'N/A'}</strong></div>
          </div>
        </div>
      )}
      {/* Billing Summary */}
      <div className="billing-summary">
        {subscription && (
          <div className="billing-card">
            <span className="billing-label">{subscription.plan?.name || 'Subscription'}</span>
            <span className="billing-value">{subscriptionPaymentStatus || 'pending'}</span>
            {canPaySubscription && (
              <button className="btn-primary billing-card-action" onClick={paySubscription} disabled={payingSubscription}>
                {payingSubscription ? 'Opening ClicknPay...' : 'Pay with ClicknPay'}
              </button>
            )}
          </div>
        )}
        <div className="billing-card">
          <span className="billing-label">Current Month Charges</span>
          <span className="billing-value">${currentBilling.currentCharges.toLocaleString()}</span>
        </div>
        <div className="billing-card">
          <span className="billing-label">Pending Payments</span>
          <span className="billing-value">${currentBilling.pendingPayments}</span>
        </div>
        <div className="billing-card">
          <span className="billing-label">Credit Balance</span>
          <span className="billing-value success">${currentBilling.creditBalance}</span>
        </div>
        <div className="billing-card">
          <span className="billing-label">Next Billing Date</span>
          <span className="billing-value">{new Date(currentBilling.nextBillingDate).toLocaleDateString()}</span>
        </div>
      </div>

      {/* Payment Method */}
      <div className="corp-section">
        <div className="corp-section-header">
          <h3>Payment Method</h3>
          <div className="corp-section-actions">
            <select value={paymentMethodForm} onChange={event => setPaymentMethodForm(event.target.value)} className="filter-select">
              <option value="monthly_invoice">Monthly Invoice</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="corporate_credit">Corporate Credit</option>
            </select>
            <button className="btn-secondary" onClick={updatePaymentMethod}>Update</button>
          </div>
        </div>
        <div className="payment-method-card">
          <div className="payment-icon"><CreditCard className="icon" /></div>
          <div className="payment-details">
            <span className="payment-type">Bank Transfer</span>
            <span className="payment-info">CBZ Bank - ****4521</span>
          </div>
          <span className="payment-default">Default</span>
        </div>
      </div>

      {/* Invoices */}
      <div className="corp-section">
        <div className="corp-section-header">
          <h3>Invoice History</h3>
          <div className="corp-section-actions">
            <button className="btn-secondary" onClick={refreshBilling}><RefreshCw className="icon" /> Refresh</button>
            <button className="btn-secondary" onClick={exportInvoices}><Download className="icon" /> Export All</button>
          </div>
        </div>
        <div className="corp-table-container">
          <table className="corp-table">
            <thead>
              <tr><th>Invoice #</th><th>Date</th><th>Billing Period</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {invoices.map(invoice => (
                <tr key={invoice._id || invoice.id}>
                  <td><span className="invoice-id">{invoice.invoiceNumber || invoice.id || invoice._id}</span></td>
                  <td>{new Date(invoice.createdAt || invoice.date).toLocaleDateString()}</td>
                  <td>{invoice.period || `${invoice.billingPeriod?.start ? new Date(invoice.billingPeriod.start).toLocaleDateString() : ''} - ${invoice.billingPeriod?.end ? new Date(invoice.billingPeriod.end).toLocaleDateString() : ''}`}</td>
                  <td className="amount">${Number(invoice.total || invoice.amount || 0).toLocaleString()}</td>
                  <td><span className={`status-badge status-${invoice.status}`}>{invoice.status}</span></td>
                  <td>
                    <button className="action-btn" onClick={() => downloadInvoice(invoice)} title="Download invoice"><Download className="icon" /></button>
                    <button className="action-btn" onClick={() => viewInvoice(invoice)} title="View invoice"><Eye className="icon" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ============ Reports Tab ============
const ReportsTab = () => {
  const [downloads, setDownloads] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [schedulingType, setSchedulingType] = useState('');
  const [reportMessage, setReportMessage] = useState('');
  const reports = [
    { name: 'Monthly Booking Summary', description: 'Overview of all bookings for the month', type: 'bookings' },
    { name: 'Spending Analysis', description: 'Detailed breakdown of transportation costs', type: 'spending' },
    { name: 'Team Activity Report', description: 'Booking activity by team members', type: 'team' },
    { name: 'Route Efficiency Report', description: 'Analysis of most used routes and costs', type: 'routes' }
  ];

  useEffect(() => {
    const loadSchedules = async () => {
      try {
        const response = await corporateAPI.getReportSchedules();
        setSchedules(response.data || []);
      } catch (error) {
        console.error('Unable to load report schedules:', error);
      }
    };

    loadSchedules();
  }, []);

  const generateReport = async (report) => {
    try {
      setReportMessage('');
      let rows = [];
      if (report.type === 'bookings') {
        const response = await bookingsAPI.getAll({ limit: 100 });
        rows = (response.data || []).map(booking => ({
          bookingId: booking.bookingId || booking._id,
          status: booking.status,
          pickup: booking.pickup?.city || booking.route?.pickup?.city || booking.route?.pickup?.address || '',
          delivery: booking.delivery?.city || booking.route?.delivery?.city || booking.route?.delivery?.address || '',
          amount: booking.pricing?.totals?.total || booking.pricing?.total || 0
        }));
      } else if (report.type === 'team') {
        const response = await corporateAPI.getUsers();
        rows = (response.data || []).map(item => ({
          name: item.user?.fullName || item.fullName || item.user?.email || item.email,
          email: item.user?.email || item.email,
          role: item.role || item.corporateRole,
          status: item.user?.status || item.status || 'active'
        }));
      } else if (report.type === 'spending') {
        const response = await corporateAPI.getInvoices();
        rows = (response.data?.invoices || []).map(invoice => ({
          invoice: invoice.invoiceNumber || invoice._id,
          status: invoice.status,
          total: invoice.total || invoice.amount || 0,
          dueDate: invoice.dueDate || ''
        }));
      } else {
        const response = await corporateAPI.getAnalytics();
        rows = Object.entries(response.data?.routeStats || {}).map(([route, data]) => ({
          route,
          bookings: data.count,
          spend: data.totalSpend
        }));
      }

      const filename = `${report.name.toLowerCase().replace(/\s+/g, '-')}.csv`;
      downloadCsv(filename, rows);
      setDownloads(items => [{ name: filename, date: new Date().toISOString(), rows: rows.length }, ...items]);
      setReportMessage(`${report.name} generated with ${rows.length} rows.`);
    } catch (error) {
      setReportMessage(error.message || 'Unable to generate report.');
    }
  };

  const scheduleReport = async (report) => {
    try {
      setReportMessage('');
      setSchedulingType(report.type);
      const response = await corporateAPI.saveReportSchedule({
        reportType: report.type,
        reportName: report.name,
        frequency: 'monthly'
      });
      const saved = response.data;
      setSchedules(items => [saved, ...items.filter(item => item._id !== saved._id)]);
      setReportMessage(`${report.name} scheduled monthly.`);
    } catch (error) {
      setReportMessage(error.message || 'Unable to schedule report.');
    } finally {
      setSchedulingType('');
    }
  };

  const scheduledByType = schedules.reduce((lookup, schedule) => ({
    ...lookup,
    [schedule.reportType]: schedule
  }), {});

  return (
    <div className="reports-container">
      {reportMessage && <div className="corp-inline-message">{reportMessage}</div>}
      <div className="reports-header">
        <h3>Available Reports</h3>
        <button className="btn-primary" onClick={() => generateReport({ name: 'Custom Corporate Export', type: 'bookings' })}><Plus className="icon" /> Custom Report</button>
      </div>

      <div className="reports-grid">
        {reports.map((report, index) => (
          <div key={index} className="report-card">
            <div className="report-icon"><FileText className="icon" /></div>
            <div className="report-info">
              <h4>{report.name}</h4>
              <p>{report.description}</p>
              <div className="report-meta">
                <span className="report-type">{report.type}</span>
                <span className="report-date">{scheduledByType[report.type] ? `Scheduled ${scheduledByType[report.type].frequency}` : 'Generated on demand'}</span>
              </div>
            </div>
            <div className="report-actions">
              <button className="btn-primary" onClick={() => generateReport(report)}><Download className="icon" /> Generate</button>
              <button className="btn-secondary" onClick={() => scheduleReport(report)} disabled={schedulingType === report.type}>
                {schedulingType === report.type ? 'Scheduling...' : scheduledByType[report.type] ? 'Reschedule' : 'Schedule'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="corp-section">
        <div className="corp-section-header">
          <h3>Scheduled Reports</h3>
        </div>
        <div className="downloads-list">
          {schedules.length > 0 ? schedules.map(schedule => (
            <div className="download-item" key={schedule._id}>
              <Calendar className="icon" />
              <div className="download-info">
                <span className="download-name">{schedule.reportName}</span>
                <span className="download-date">
                  {schedule.frequency} CSV to {(schedule.recipients || []).join(', ') || 'account email'} - next run {schedule.nextRunAt ? new Date(schedule.nextRunAt).toLocaleString() : 'pending'}
                </span>
              </div>
            </div>
          )) : (
            <div className="download-item">
              <Calendar className="icon" />
              <div className="download-info">
                <span className="download-name">No scheduled reports yet.</span>
                <span className="download-date">Schedule a report above to persist monthly delivery for the corporate account.</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Downloads */}
      <div className="corp-section">
        <div className="corp-section-header">
          <h3>Recent Downloads</h3>
        </div>
        <div className="downloads-list">
          {downloads.length > 0 ? downloads.map(item => (
            <div className="download-item" key={item.name + item.date}>
              <FileText className="icon" />
              <div className="download-info">
                <span className="download-name">{item.name}</span>
                <span className="download-date">Generated: {new Date(item.date).toLocaleString()} - {item.rows} rows</span>
              </div>
            </div>
          )) : (
            <div className="download-item">
              <FileText className="icon" />
              <div className="download-info">
                <span className="download-name">No reports downloaded in this session.</span>
                <span className="download-date">Generate a report above to download live corporate data.</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ Settings Tab ============
const SettingsTab = () => {
  const currentUser = authAPI.getCurrentUser() || {};
  const [form, setForm] = useState({
    companyName: currentUser.corporateAccount?.companyName || currentUser.companyName || '',
    registrationNumber: currentUser.corporateAccount?.registrationNumber || '',
    contactName: currentUser.fullName || currentUser.corporateAccount?.contactPerson?.name || '',
    email: currentUser.email || '',
    phone: currentUser.phone || '',
    address: formatAddressValue(currentUser.corporateAccount?.billingAddress || currentUser.corporateAccount?.address || currentUser.address),
    bookingConfirmations: true,
    deliveryUpdates: true,
    invoiceNotifications: true,
    teamActivityAlerts: false
  });
  const [apiAccess, setApiAccess] = useState({ hasKey: false });
  const [latestApiKey, setLatestApiKey] = useState('');
  const [settingsMessage, setSettingsMessage] = useState('');

  useEffect(() => {
    const loadApiAccess = async () => {
      try {
        const response = await corporateAPI.getApiAccess();
        setApiAccess(response.data || { hasKey: false });
      } catch {
        setApiAccess({ hasKey: false });
      }
    };
    loadApiAccess();
  }, []);

  const updateField = (field, value) => setForm(current => ({ ...current, [field]: value }));

  const saveSettings = async () => {
    try {
      setSettingsMessage('');
      const email = String(form.email || '').trim().toLowerCase();
      const phone = normalizeZimbabwePhone(form.phone);
      if (!String(form.contactName || '').trim()) throw new Error('Contact name is required.');
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
      if (!/^\+263[0-9]{9}$/.test(phone)) throw new Error('Enter a valid Zimbabwean mobile number in +263 format.');

      await corporateAPI.updateProfile({
        companyName: form.companyName,
        registrationNumber: form.registrationNumber,
        contactPerson: { name: form.contactName, email, phone },
        billingAddress: { street: form.address }
      });
      await authAPI.updateProfile({
        fullName: form.contactName,
        email,
        phone,
        companyName: form.companyName,
        address: {
          street: String(form.address || '').trim(),
          country: 'Zimbabwe'
        }
      });
      setSettingsMessage('Corporate settings saved.');
    } catch (error) {
      setSettingsMessage(error.message || 'Unable to save settings.');
    }
  };

  const copyApiKey = async () => {
    const keyToCopy = latestApiKey || `${apiAccess.keyPrefix || ''}...${apiAccess.keyLastFour || ''}`;
    if (!keyToCopy || keyToCopy === '...') {
      setSettingsMessage('Generate an API key first.');
      return;
    }
    try {
      await navigator.clipboard.writeText(keyToCopy);
      setSettingsMessage('API key copied.');
    } catch {
      setSettingsMessage('Unable to copy API key from this browser context.');
    }
  };

  const regenerateApiKey = async () => {
    if (!window.confirm('Regenerate the corporate API key? Existing integrations using the old key will stop working.')) return;
    try {
      setSettingsMessage('');
      const response = await corporateAPI.regenerateApiKey();
      setLatestApiKey(response.data.apiKey);
      setApiAccess(response.data);
      setSettingsMessage('New API key generated. Copy it now; it will not be shown again after refresh.');
    } catch (error) {
      setSettingsMessage(error.message || 'Unable to regenerate API key.');
    }
  };

  return (
    <div className="settings-container">
      {settingsMessage && <div className="corp-inline-message">{settingsMessage}</div>}
      {/* Company Profile */}
      <div className="settings-section">
        <h3>Company Profile</h3>
        <div className="settings-form">
          <div className="form-row">
            <div className="form-group">
              <label>Company Name</label>
              <input type="text" value={form.companyName} onChange={e => updateField('companyName', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Registration Number</label>
              <input type="text" value={form.registrationNumber} onChange={e => updateField('registrationNumber', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Contact Name</label>
            <input type="text" value={form.contactName} onChange={e => updateField('contactName', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" value={form.phone} onChange={e => updateField('phone', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea value={form.address} onChange={e => updateField('address', e.target.value)} rows={2} />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="settings-section">
        <h3>Notification Preferences</h3>
        <div className="notification-settings">
          <div className="notification-item">
            <div className="notification-info">
              <span className="notification-title">Booking Confirmations</span>
              <span className="notification-desc">Receive confirmations for all bookings</span>
            </div>
            <input type="checkbox" checked={form.bookingConfirmations} onChange={e => updateField('bookingConfirmations', e.target.checked)} />
          </div>
          <div className="notification-item">
            <div className="notification-info">
              <span className="notification-title">Delivery Updates</span>
              <span className="notification-desc">Get notified on shipment status changes</span>
            </div>
            <input type="checkbox" checked={form.deliveryUpdates} onChange={e => updateField('deliveryUpdates', e.target.checked)} />
          </div>
          <div className="notification-item">
            <div className="notification-info">
              <span className="notification-title">Invoice Notifications</span>
              <span className="notification-desc">Receive monthly invoice notifications</span>
            </div>
            <input type="checkbox" checked={form.invoiceNotifications} onChange={e => updateField('invoiceNotifications', e.target.checked)} />
          </div>
          <div className="notification-item">
            <div className="notification-info">
              <span className="notification-title">Team Activity Alerts</span>
              <span className="notification-desc">Get alerts when team members make bookings</span>
            </div>
            <input type="checkbox" checked={form.teamActivityAlerts} onChange={e => updateField('teamActivityAlerts', e.target.checked)} />
          </div>
        </div>
      </div>

      {/* API Access */}
      <div className="settings-section">
        <h3>API Access</h3>
        <div className="api-section">
          <p className="api-description">Integrate Palmtrent with your internal systems using our API.</p>
          <div className="api-key-display">
            <label>API Key</label>
            <div className="api-key-input">
              <input type="password" value={latestApiKey || (apiAccess.hasKey ? `${apiAccess.keyPrefix}...${apiAccess.keyLastFour}` : 'No API key generated')} readOnly />
              <button className="btn-secondary" onClick={copyApiKey}>Copy</button>
              <button className="btn-secondary" onClick={regenerateApiKey}>Regenerate</button>
            </div>
          </div>
          <button className="api-docs-link" onClick={() => window.open('/api-docs', '_blank')}>View API Documentation -&gt;</button>
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn-primary" onClick={saveSettings}>Save Changes</button>
      </div>
    </div>
  );
};

// ============ Shared Components ============
const StatCard = ({ title, value, change, icon, color }) => (
  <div className={`corp-stat-card corp-stat-card-${color}`}>
    <div className="corp-stat-header">
      <div className="corp-stat-icon-wrapper">{icon}</div>
      {change !== undefined && (
        <div className={`corp-stat-change ${change >= 0 ? 'positive' : 'negative'}`}>
          {change >= 0 ? <TrendingUp className="icon" /> : <TrendingDown className="icon" />}
          {Math.abs(change)}%
        </div>
      )}
    </div>
    <p className="corp-stat-title">{title}</p>
    <p className="corp-stat-value">{value}</p>
  </div>
);

export default CorporateDashboard;
