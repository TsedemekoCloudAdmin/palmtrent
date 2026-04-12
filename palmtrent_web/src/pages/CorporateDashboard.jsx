import React, { useState, useRef, useEffect } from 'react';
import {
  Building, Package, MapPin, TrendingUp, TrendingDown, Clock, DollarSign, Plus,
  Search, Download, FileText, Star, Truck, Menu, Bell, User, Home,
  BarChart3, Users, Settings, LogOut, ChevronDown, Calendar, Filter,
  Eye, RefreshCw, ChevronLeft, ChevronRight, CreditCard, AlertCircle,
  Check, PieChart, Activity, Layers, UserPlus, Shield, Phone, Mail, Loader
} from 'lucide-react';
import { authAPI, corporateAPI, bookingsAPI } from '../services/api';
import './styles/CorporateDashboard.css';

const CorporateDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState('overview');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userDropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target)) {
        setUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
              <div className="corp-brand-logo"><Building className="icon" /></div>
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
              <p className="corp-page-subtitle">ABC Manufacturing Ltd</p>
            </div>
            <div className="corp-topbar-right">
              <button className="corp-notification-btn">
                <Bell className="icon" />
                <span className="corp-notification-badge">3</span>
              </button>

              <div className={`corp-user-dropdown ${userDropdownOpen ? 'open' : ''}`} ref={userDropdownRef}>
                <button className="corp-user-trigger" onClick={() => setUserDropdownOpen(!userDropdownOpen)}>
                  <div className="corp-user-avatar"><Building className="icon" /></div>
                  <div className="corp-user-info">
                    <p className="corp-user-name">ABC Manufacturing</p>
                    <p className="corp-user-role">Admin</p>
                  </div>
                  <ChevronDown className="corp-dropdown-arrow" size={16} />
                </button>

                <div className="corp-dropdown-menu">
                  <button className="corp-dropdown-item"><User className="icon" /><span>Company Profile</span></button>
                  <button className="corp-dropdown-item"><Settings className="icon" /><span>Settings</span></button>
                  <div className="corp-dropdown-divider" />
                  <button className="corp-dropdown-item logout"><LogOut className="icon" /><span>Logout</span></button>
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
        // Set default mock data on error
        setStats({
          totalBookings: 156, activeShipments: 12, monthlySpend: 45680, teamMembers: 8,
          growth: { bookings: 23, spend: 15 }
        });
        setRecentBookings([
          { id: 'PT-2025-001250', route: 'Harare → Bulawayo', status: 'in_transit', bookedBy: 'John Moyo', amount: 450 },
          { id: 'PT-2025-001249', route: 'Mutare → Harare', status: 'delivered', bookedBy: 'Sarah Dube', amount: 380 }
        ]);
        setTopRoutes([
          { route: 'Harare → Bulawayo', count: 45, percentage: 35 },
          { route: 'Mutare → Harare', count: 32, percentage: 25 },
          { route: 'Harare → Gweru', count: 28, percentage: 22 },
          { route: 'Other Routes', count: 23, percentage: 18 }
        ]);
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

      {/* Spending Chart Placeholder */}
      <div className="corp-section full-width">
        <div className="corp-section-header">
          <h3>Monthly Spending Trend</h3>
          <select className="period-select">
            <option value="6months">Last 6 Months</option>
            <option value="year">Last Year</option>
          </select>
        </div>
        <div className="chart-placeholder">
          <Activity className="icon" />
          <p>Spending trend visualization</p>
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

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        const params = { page: currentPage, limit: 10 };
        if (filter !== 'all') params.status = filter;

        const response = await bookingsAPI.getAll(params);
        const data = response.data || [];

        setBookings(data.map(b => ({
          id: b.bookingId || b._id,
          date: b.createdAt,
          route: `${b.pickup?.city || 'N/A'} → ${b.delivery?.city || 'N/A'}`,
          status: b.status,
          bookedBy: b.shipper?.fullName || 'N/A',
          driver: b.transporter?.fullName || 'N/A',
          amount: b.pricing?.total || 0
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
          <button className="btn-secondary"><Download className="icon" /> Export</button>
          <button className="btn-primary" onClick={() => setShowNewBooking(true)}><Plus className="icon" /> New Booking</button>
        </div>
      </div>

      <div className="corp-table-container">
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
                    <button className="action-btn"><Eye className="icon" /></button>
                    <button className="action-btn"><MapPin className="icon" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="pagination-btn" disabled><ChevronLeft className="icon" /></button>
        <span>Page 1 of 1</span>
        <button className="pagination-btn" disabled><ChevronRight className="icon" /></button>
      </div>
    </div>
  );
};

// ============ Team Tab ============
const TeamTab = () => {
  const [showAddMember, setShowAddMember] = useState(false);

  const teamMembers = [
    { id: 1, name: 'John Moyo', email: 'john@abcmfg.co.zw', role: 'Admin', bookings: 45, lastActive: '2025-01-10', status: 'active' },
    { id: 2, name: 'Sarah Dube', email: 'sarah@abcmfg.co.zw', role: 'Manager', bookings: 32, lastActive: '2025-01-10', status: 'active' },
    { id: 3, name: 'Peter Ndlovu', email: 'peter@abcmfg.co.zw', role: 'Member', bookings: 18, lastActive: '2025-01-09', status: 'active' },
    { id: 4, name: 'Grace Mutasa', email: 'grace@abcmfg.co.zw', role: 'Member', bookings: 12, lastActive: '2025-01-08', status: 'inactive' }
  ];

  return (
    <div className="team-management">
      <div className="team-header">
        <div className="team-stats">
          <div className="team-stat"><span className="stat-value">{teamMembers.length}</span><span className="stat-label">Total Members</span></div>
          <div className="team-stat"><span className="stat-value">{teamMembers.filter(m => m.status === 'active').length}</span><span className="stat-label">Active</span></div>
          <div className="team-stat"><span className="stat-value">1</span><span className="stat-label">Admins</span></div>
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
            <div className="member-stats">
              <div><span className="value">{member.bookings}</span><span className="label">Bookings</span></div>
              <div><span className="value">{new Date(member.lastActive).toLocaleDateString()}</span><span className="label">Last Active</span></div>
            </div>
            <div className="member-actions">
              <button className="btn-secondary">Edit</button>
              <button className="btn-secondary danger">Remove</button>
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
              <button className="modal-close" onClick={() => setShowAddMember(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Full Name</label>
                <input type="text" placeholder="Enter full name" />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input type="email" placeholder="Enter email address" />
              </div>
              <div className="form-group">
                <label>Role</label>
                <select>
                  <option value="member">Member</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className="form-group">
                <label>Permissions</label>
                <div className="permissions-list">
                  <label className="checkbox-label"><input type="checkbox" defaultChecked /> Create Bookings</label>
                  <label className="checkbox-label"><input type="checkbox" defaultChecked /> View All Bookings</label>
                  <label className="checkbox-label"><input type="checkbox" /> Manage Team</label>
                  <label className="checkbox-label"><input type="checkbox" /> View Reports</label>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowAddMember(false)}>Cancel</button>
              <button className="btn-primary">Send Invitation</button>
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
          if (response.data.metrics) setMetrics(response.data.metrics);
          if (response.data.monthlyData) setMonthlyData(response.data.monthlyData);
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
        // Set mock data on error
        setMetrics([
          { label: 'Total Shipments', value: '156', change: '+23%', trend: 'up' },
          { label: 'On-Time Delivery', value: '94%', change: '+2%', trend: 'up' },
          { label: 'Avg. Cost per Shipment', value: '$385', change: '-5%', trend: 'down' },
          { label: 'Customer Satisfaction', value: '4.8/5', change: '+0.2', trend: 'up' }
        ]);
        setMonthlyData([
          { month: 'Aug', bookings: 18, spend: 6840 },
          { month: 'Sep', bookings: 22, spend: 8360 },
          { month: 'Oct', bookings: 28, spend: 10640 },
          { month: 'Nov', bookings: 35, spend: 13300 },
          { month: 'Dec', bookings: 42, spend: 15960 },
          { month: 'Jan', bookings: 48, spend: 18240 }
        ]);
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

      {/* Charts */}
      <div className="charts-grid">
        <div className="chart-card">
          <h3>Booking Trends</h3>
          <div className="chart-placeholder">
            <BarChart3 className="icon" />
            <p>Monthly booking trends chart</p>
          </div>
        </div>
        <div className="chart-card">
          <h3>Spending Distribution</h3>
          <div className="chart-placeholder">
            <PieChart className="icon" />
            <p>Spending by route/category</p>
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
                  <td>{data.month} 2024</td>
                  <td>{data.bookings}</td>
                  <td className="amount">${data.spend.toLocaleString()}</td>
                  <td>${Math.round(data.spend / data.bookings)}</td>
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
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState([]);
  const [currentBilling, setCurrentBilling] = useState({
    currentCharges: 0,
    pendingPayments: 0,
    creditBalance: 0,
    nextBillingDate: ''
  });

  useEffect(() => {
    const fetchBillingData = async () => {
      try {
        setLoading(true);

        const response = await corporateAPI.getInvoices();
        if (response.success && response.data) {
          setInvoices(response.data.invoices || []);
          if (response.data.billing) {
            setCurrentBilling(response.data.billing);
          }
        }
      } catch (error) {
        console.error('Error fetching billing data:', error);
        // Set mock data on error
        setInvoices([
          { id: 'INV-2025-001', date: '2025-01-01', period: 'December 2024', amount: 15960, status: 'paid' },
          { id: 'INV-2024-012', date: '2024-12-01', period: 'November 2024', amount: 13300, status: 'paid' }
        ]);
        setCurrentBilling({
          currentCharges: 12450,
          pendingPayments: 0,
          creditBalance: 500,
          nextBillingDate: '2025-02-01'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBillingData();
  }, []);

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
      {/* Billing Summary */}
      <div className="billing-summary">
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
          <button className="btn-secondary">Update</button>
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
          <button className="btn-secondary"><Download className="icon" /> Export All</button>
        </div>
        <div className="corp-table-container">
          <table className="corp-table">
            <thead>
              <tr><th>Invoice #</th><th>Date</th><th>Billing Period</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {invoices.map(invoice => (
                <tr key={invoice.id}>
                  <td><span className="invoice-id">{invoice.id}</span></td>
                  <td>{new Date(invoice.date).toLocaleDateString()}</td>
                  <td>{invoice.period}</td>
                  <td className="amount">${invoice.amount.toLocaleString()}</td>
                  <td><span className={`status-badge status-${invoice.status}`}>{invoice.status}</span></td>
                  <td>
                    <button className="action-btn"><Download className="icon" /></button>
                    <button className="action-btn"><Eye className="icon" /></button>
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
  const reports = [
    { name: 'Monthly Booking Summary', description: 'Overview of all bookings for the month', type: 'monthly', lastGenerated: '2025-01-01' },
    { name: 'Spending Analysis', description: 'Detailed breakdown of transportation costs', type: 'monthly', lastGenerated: '2025-01-01' },
    { name: 'Team Activity Report', description: 'Booking activity by team members', type: 'weekly', lastGenerated: '2025-01-07' },
    { name: 'Route Efficiency Report', description: 'Analysis of most used routes and costs', type: 'quarterly', lastGenerated: '2024-10-01' }
  ];

  return (
    <div className="reports-container">
      <div className="reports-header">
        <h3>Available Reports</h3>
        <button className="btn-primary"><Plus className="icon" /> Custom Report</button>
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
                <span className="report-date">Last: {new Date(report.lastGenerated).toLocaleDateString()}</span>
              </div>
            </div>
            <div className="report-actions">
              <button className="btn-primary"><Download className="icon" /> Generate</button>
              <button className="btn-secondary">Schedule</button>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Downloads */}
      <div className="corp-section">
        <div className="corp-section-header">
          <h3>Recent Downloads</h3>
        </div>
        <div className="downloads-list">
          <div className="download-item">
            <FileText className="icon" />
            <div className="download-info">
              <span className="download-name">Monthly_Booking_Summary_Jan2025.pdf</span>
              <span className="download-date">Generated: Jan 10, 2025</span>
            </div>
            <button className="btn-secondary"><Download className="icon" /></button>
          </div>
          <div className="download-item">
            <FileText className="icon" />
            <div className="download-info">
              <span className="download-name">Spending_Analysis_Dec2024.xlsx</span>
              <span className="download-date">Generated: Jan 1, 2025</span>
            </div>
            <button className="btn-secondary"><Download className="icon" /></button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============ Settings Tab ============
const SettingsTab = () => {
  return (
    <div className="settings-container">
      {/* Company Profile */}
      <div className="settings-section">
        <h3>Company Profile</h3>
        <div className="settings-form">
          <div className="form-row">
            <div className="form-group">
              <label>Company Name</label>
              <input type="text" defaultValue="ABC Manufacturing Ltd" />
            </div>
            <div className="form-group">
              <label>Registration Number</label>
              <input type="text" defaultValue="12345/2020" />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" defaultValue="logistics@abcmfg.co.zw" />
            </div>
            <div className="form-group">
              <label>Phone Number</label>
              <input type="tel" defaultValue="+263 242 123 456" />
            </div>
          </div>
          <div className="form-group">
            <label>Address</label>
            <textarea defaultValue="123 Industrial Park, Msasa, Harare" rows={2} />
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
            <input type="checkbox" defaultChecked />
          </div>
          <div className="notification-item">
            <div className="notification-info">
              <span className="notification-title">Delivery Updates</span>
              <span className="notification-desc">Get notified on shipment status changes</span>
            </div>
            <input type="checkbox" defaultChecked />
          </div>
          <div className="notification-item">
            <div className="notification-info">
              <span className="notification-title">Invoice Notifications</span>
              <span className="notification-desc">Receive monthly invoice notifications</span>
            </div>
            <input type="checkbox" defaultChecked />
          </div>
          <div className="notification-item">
            <div className="notification-info">
              <span className="notification-title">Team Activity Alerts</span>
              <span className="notification-desc">Get alerts when team members make bookings</span>
            </div>
            <input type="checkbox" />
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
              <input type="password" value="pk_live_abc123xyz789..." readOnly />
              <button className="btn-secondary">Copy</button>
              <button className="btn-secondary">Regenerate</button>
            </div>
          </div>
          <a href="#" className="api-docs-link">View API Documentation →</a>
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn-primary">Save Changes</button>
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
