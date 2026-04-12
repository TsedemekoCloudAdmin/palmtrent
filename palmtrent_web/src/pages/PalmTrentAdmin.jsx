import React, { useState, useEffect } from 'react';
import {
  Users, Truck, Package, DollarSign, TrendingUp, TrendingDown,
  AlertCircle, CheckCircle, Clock, MapPin, Star, Settings, Menu,
  Search, Filter, Download, Eye, Edit, Ban, RefreshCw, XCircle,
  ChevronLeft, ChevronRight, MoreVertical, Phone, Mail, Calendar,
  CreditCard, Building, MessageSquare, FileText, Shield, Check
} from 'lucide-react';
import { adminAPI, authAPI } from '../services/api';
import './styles/AdminDashboard.css';

const AdminDashboard = () => {
  const [timeRange, setTimeRange] = useState('today');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);

  const handleNavClick = (tab) => {
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView timeRange={timeRange} setTimeRange={setTimeRange} />;
      case 'users':
        return <UsersView />;
      case 'jobs':
        return <JobsView />;
      case 'payments':
        return <PaymentsView />;
      case 'disputes':
        return <DisputesView />;
      case 'reviews':
        return <ReviewsView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView timeRange={timeRange} setTimeRange={setTimeRange} />;
    }
  };

  return (
    <div className="admin-dashboard">
      {/* Sidebar */}
      <div className={`admin-sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sidebar-header">
          {sidebarOpen && (
            <div className="sidebar-brand">
              <div className="brand-logo">
                <Truck className="icon" />
              </div>
              <span className="brand-text">Palmtrent</span>
            </div>
          )}
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="icon" />
          </button>
        </div>

        <nav className="sidebar-nav">
          <NavItem
            icon={<Package />}
            label="Dashboard"
            active={activeTab === 'dashboard'}
            sidebarOpen={sidebarOpen}
            onClick={() => handleNavClick('dashboard')}
          />
          <NavItem
            icon={<Users />}
            label="Users"
            active={activeTab === 'users'}
            sidebarOpen={sidebarOpen}
            onClick={() => handleNavClick('users')}
          />
          <NavItem
            icon={<Truck />}
            label="Jobs"
            active={activeTab === 'jobs'}
            sidebarOpen={sidebarOpen}
            onClick={() => handleNavClick('jobs')}
          />
          <NavItem
            icon={<DollarSign />}
            label="Payments"
            active={activeTab === 'payments'}
            sidebarOpen={sidebarOpen}
            onClick={() => handleNavClick('payments')}
          />
          <NavItem
            icon={<AlertCircle />}
            label="Disputes"
            badge="2"
            active={activeTab === 'disputes'}
            sidebarOpen={sidebarOpen}
            onClick={() => handleNavClick('disputes')}
          />
          <NavItem
            icon={<Star />}
            label="Reviews"
            active={activeTab === 'reviews'}
            sidebarOpen={sidebarOpen}
            onClick={() => handleNavClick('reviews')}
          />
          <NavItem
            icon={<Settings />}
            label="Settings"
            active={activeTab === 'settings'}
            sidebarOpen={sidebarOpen}
            onClick={() => handleNavClick('settings')}
          />
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={() => authAPI.logout()}>
            {sidebarOpen ? 'Logout' : ''}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="admin-main-content">
        {renderContent()}
      </div>
    </div>
  );
};

// ============ Dashboard View ============
const DashboardView = ({ timeRange, setTimeRange }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    today: { revenue: 0, bookings: 0, activeJobs: 0, newUsers: 0, disputes: 0 },
    growth: { revenue: 0, bookings: 0, users: 0, onTime: 0 }
  });
  const [activeJobs, setActiveJobs] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const response = await adminAPI.getDashboardStats();

        if (response.success && response.data) {
          const data = response.data;
          setStats({
            today: {
              revenue: data.revenue?.thisMonth || 0,
              bookings: data.bookings?.thisMonth || 0,
              activeJobs: data.bookings?.active || 0,
              newUsers: data.users?.newThisMonth || 0,
              disputes: data.claims?.pending || 0
            },
            growth: {
              revenue: data.revenue?.growth || 0,
              bookings: data.bookings?.growth || 0,
              users: 8,
              onTime: 2
            }
          });
        }

        // Fetch active bookings
        const bookingsRes = await adminAPI.getBookings({ status: 'in_transit,picked_up,accepted', limit: 5 });
        if (bookingsRes.data) {
          setActiveJobs(bookingsRes.data.map(b => ({
            id: b.bookingId || b._id,
            shipper: b.shipper?.fullName || 'N/A',
            driver: b.transporter?.fullName || 'Pending',
            route: `${b.pickup?.city || 'N/A'} → ${b.delivery?.city || 'N/A'}`,
            status: b.status,
            progress: b.status === 'in_transit' ? 50 : b.status === 'picked_up' ? 75 : 15,
            eta: b.estimatedDelivery ? new Date(b.estimatedDelivery).toLocaleTimeString() : 'TBD'
          })));
        }

      } catch (error) {
        console.error('Error fetching admin dashboard:', error);
        // Set mock data on error
        setStats({
          today: { revenue: 15240, bookings: 38, activeJobs: 12, newUsers: 23, disputes: 2 },
          growth: { revenue: 12, bookings: 15, users: 8, onTime: 2 }
        });
        setActiveJobs([
          { id: 'PT-2025-001234', shipper: 'John Moyo', driver: 'Trust Ncube', route: 'Harare → Bulawayo', status: 'in_transit', progress: 48, eta: '5:30 PM' },
          { id: 'PT-2025-001235', shipper: 'ABC Manufacturing', driver: 'Mike Chikwanha', route: 'Mutare → Harare', status: 'loading', progress: 5, eta: '8:00 PM' }
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeRange]);

  const recentActivityData = recentActivity.length > 0 ? recentActivity : [
    { time: '2 mins ago', event: 'New booking created', user: 'John Moyo', type: 'booking' },
    { time: '5 mins ago', event: 'Payment confirmed', user: 'PT-2025-001237', type: 'payment' },
    { time: '8 mins ago', event: 'Delivery completed', user: 'PT-2025-001230', type: 'delivery' },
    { time: '12 mins ago', event: 'New driver registered', user: 'Peter Ndlovu', type: 'user' },
    { time: '15 mins ago', event: 'Dispute raised', user: 'PT-2025-001228', type: 'dispute' }
  ];

  return (
    <>
      <div className="admin-topbar">
        <div className="topbar-content">
          <div className="topbar-left">
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle">Welcome back, Admin</p>
          </div>
          <div className="topbar-right">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="time-selector"
            >
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
              <option value="year">This Year</option>
            </select>
            <button className="btn-primary">Export Report</button>
          </div>
        </div>
      </div>

      <div className="admin-content">
        <div className="stats-grid">
          <StatCard title="Revenue" value={`$${stats.today.revenue.toLocaleString()}`} change={stats.growth.revenue} icon={<DollarSign className="icon" />} color="accent" />
          <StatCard title="Bookings" value={stats.today.bookings} change={stats.growth.bookings} icon={<Package className="icon" />} color="primary" />
          <StatCard title="Active Jobs" value={stats.today.activeJobs} icon={<Truck className="icon" />} color="secondary" />
          <StatCard title="New Users" value={stats.today.newUsers} change={stats.growth.users} icon={<Users className="icon" />} color="success" />
          <StatCard title="Disputes" value={stats.today.disputes} icon={<AlertCircle className="icon" />} color="error" alert />
        </div>

        <div className="charts-grid">
          <div className="chart-card">
            <h3 className="chart-title">Revenue Overview</h3>
            <div className="chart-placeholder">
              <TrendingUp className="icon" />
              <p>Chart visualization would appear here</p>
            </div>
          </div>
          <div className="chart-card">
            <h3 className="chart-title">Bookings Trend</h3>
            <div className="chart-placeholder">
              <Package className="icon" />
              <p>Chart visualization would appear here</p>
            </div>
          </div>
        </div>

        <div className="content-grid">
          <div className="jobs-section">
            <div className="section-header">
              <h3 className="section-title">Active Jobs</h3>
              <button className="view-all-btn">View All</button>
            </div>
            <div className="jobs-list">
              {activeJobs.map((job) => (
                <ActiveJobCard key={job.id} job={job} />
              ))}
            </div>
          </div>

          <div className="activity-section">
            <h3 className="section-title">Recent Activity</h3>
            <div className="activity-list">
              {recentActivityData.map((activity, index) => (
                <ActivityItem key={index} activity={activity} />
              ))}
            </div>
          </div>
        </div>

        <div className="metrics-grid">
          <MetricCard title="On-Time Delivery Rate" value="97%" target="95%" status="good" />
          <MetricCard title="Average Rating" value="4.8" target="4.5" status="good" />
          <MetricCard title="Dispute Rate" value="1.8%" target="<3%" status="good" />
        </div>
      </div>
    </>
  );
};

// ============ Users View ============
const UsersView = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const usersPerPage = 10;

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const params = { limit: 50 };
      if (filterType !== 'all') params.role = filterType;
      if (filterStatus !== 'all') params.status = filterStatus;
      if (searchTerm) params.search = searchTerm;

      const response = await adminAPI.getUsers(params);

      if (response.success && response.data) {
        setUsers(response.data.map(u => ({
          id: u._id,
          fullName: u.fullName || u.companyName || 'N/A',
          email: u.email,
          phone: u.phone,
          userType: u.userType,
          status: u.status || 'active',
          verified: u.isVerified || false,
          rating: u.rating?.average || 0,
          totalBookings: 0, // Would need separate query
          joinDate: u.createdAt,
          lastActive: u.lastLogin || u.updatedAt
        })));
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      // Fallback to mock data
      const mockUsers = [
        { id: 1, fullName: 'John Moyo', email: 'john@example.com', phone: '+263771234567', userType: 'shipper', status: 'active', verified: true, rating: 4.8, totalBookings: 45, joinDate: '2024-06-15', lastActive: '2025-01-10' },
        { id: 2, fullName: 'Trust Ncube', email: 'trust@example.com', phone: '+263772345678', userType: 'transporter', status: 'active', verified: true, rating: 4.9, totalBookings: 120, joinDate: '2024-03-20', lastActive: '2025-01-10' },
        { id: 3, fullName: 'Sarah Dube', email: 'sarah@example.com', phone: '+263773456789', userType: 'shipper', status: 'active', verified: true, rating: 4.5, totalBookings: 23, joinDate: '2024-08-10', lastActive: '2025-01-09' },
      ];
      setUsers(mockUsers);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.phone.includes(searchTerm);
    const matchesType = filterType === 'all' || user.userType === filterType;
    const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesType && matchesStatus;
  });

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  const getUserTypeIcon = (type) => {
    switch (type) {
      case 'shipper': return <Package className="icon" />;
      case 'transporter': return <Truck className="icon" />;
      case 'corporate': return <Building className="icon" />;
      case 'trailer_owner': return <Truck className="icon" />;
      default: return <Users className="icon" />;
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      active: { class: 'status-active', label: 'Active' },
      pending: { class: 'status-pending', label: 'Pending' },
      suspended: { class: 'status-suspended', label: 'Suspended' },
      inactive: { class: 'status-inactive', label: 'Inactive' }
    };
    const config = statusConfig[status] || statusConfig.inactive;
    return <span className={`status-badge ${config.class}`}>{config.label}</span>;
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  return (
    <>
      <div className="admin-topbar">
        <div className="topbar-content">
          <div className="topbar-left">
            <h1 className="page-title">Users Management</h1>
            <p className="page-subtitle">{filteredUsers.length} total users</p>
          </div>
          <div className="topbar-right">
            <button className="btn-secondary" onClick={loadUsers}>
              <RefreshCw className="icon" /> Refresh
            </button>
            <button className="btn-primary">
              <Download className="icon" /> Export
            </button>
          </div>
        </div>
      </div>

      <div className="admin-content">
        {/* Filters */}
        <div className="filters-bar">
          <div className="search-box">
            <Search className="icon" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="filter-select">
            <option value="all">All Types</option>
            <option value="shipper">Shippers</option>
            <option value="transporter">Transporters</option>
            <option value="corporate">Corporate</option>
            <option value="trailer_owner">Trailer Owners</option>
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* Users Table */}
        <div className="data-table-container">
          {loading ? (
            <div className="loading-state">
              <RefreshCw className="icon spinning" />
              <p>Loading users...</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Rating</th>
                  <th>Bookings</th>
                  <th>Joined</th>
                  <th>Last Active</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="user-cell">
                        <div className="user-avatar">
                          {user.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="user-info">
                          <span className="user-name">{user.fullName}</span>
                          <span className="user-email">{user.email}</span>
                        </div>
                        {user.verified && <Shield className="icon verified-badge" title="Verified" />}
                      </div>
                    </td>
                    <td>
                      <div className="type-badge">
                        {getUserTypeIcon(user.userType)}
                        <span>{user.userType.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td>{getStatusBadge(user.status)}</td>
                    <td>
                      {user.rating > 0 ? (
                        <div className="rating-cell">
                          <Star className="icon star-icon" />
                          <span>{user.rating.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="no-rating">N/A</span>
                      )}
                    </td>
                    <td>{user.totalBookings}</td>
                    <td>{new Date(user.joinDate).toLocaleDateString()}</td>
                    <td>{new Date(user.lastActive).toLocaleDateString()}</td>
                    <td>
                      <div className="action-buttons">
                        <button className="action-btn" onClick={() => handleViewUser(user)} title="View Details">
                          <Eye className="icon" />
                        </button>
                        <button className="action-btn" title="Edit">
                          <Edit className="icon" />
                        </button>
                        {user.status === 'active' ? (
                          <button className="action-btn danger" title="Suspend">
                            <Ban className="icon" />
                          </button>
                        ) : (
                          <button className="action-btn success" title="Activate">
                            <CheckCircle className="icon" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="icon" />
            </button>
            <span className="pagination-info">
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="pagination-btn"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="icon" />
            </button>
          </div>
        )}
      </div>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowUserModal(false)}>
          <div className="modal-content user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User Details</h2>
              <button className="modal-close" onClick={() => setShowUserModal(false)}>
                <XCircle className="icon" />
              </button>
            </div>
            <div className="modal-body">
              <div className="user-profile-header">
                <div className="large-avatar">
                  {selectedUser.fullName.charAt(0).toUpperCase()}
                </div>
                <div className="user-profile-info">
                  <h3>{selectedUser.fullName}</h3>
                  <p className="user-type-label">{selectedUser.userType.replace('_', ' ')}</p>
                  {getStatusBadge(selectedUser.status)}
                </div>
              </div>

              <div className="user-details-grid">
                <div className="detail-item">
                  <Mail className="icon" />
                  <div>
                    <label>Email</label>
                    <p>{selectedUser.email}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <Phone className="icon" />
                  <div>
                    <label>Phone</label>
                    <p>{selectedUser.phone}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <Calendar className="icon" />
                  <div>
                    <label>Join Date</label>
                    <p>{new Date(selectedUser.joinDate).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <Star className="icon" />
                  <div>
                    <label>Rating</label>
                    <p>{selectedUser.rating > 0 ? selectedUser.rating.toFixed(1) : 'No ratings yet'}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <Package className="icon" />
                  <div>
                    <label>Total Bookings</label>
                    <p>{selectedUser.totalBookings}</p>
                  </div>
                </div>
                <div className="detail-item">
                  <Shield className="icon" />
                  <div>
                    <label>Verification</label>
                    <p>{selectedUser.verified ? 'Verified' : 'Not Verified'}</p>
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button className="btn-secondary">View Bookings</button>
                <button className="btn-secondary">Send Message</button>
                {selectedUser.status === 'active' ? (
                  <button className="btn-danger">Suspend Account</button>
                ) : selectedUser.status === 'pending' ? (
                  <button className="btn-success">Approve Account</button>
                ) : (
                  <button className="btn-success">Reactivate Account</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============ Jobs View ============
const JobsView = () => {
  const [jobs, setJobs] = useState([
    { id: 'PT-2025-001234', shipper: 'John Moyo', transporter: 'Trust Ncube', route: 'Harare → Bulawayo', status: 'in_transit', amount: 450, createdAt: '2025-01-10' },
    { id: 'PT-2025-001235', shipper: 'ABC Manufacturing', transporter: 'Mike Chikwanha', route: 'Mutare → Harare', status: 'loading', amount: 320, createdAt: '2025-01-10' },
    { id: 'PT-2025-001236', shipper: 'Sarah Dube', transporter: 'James Moyo', route: 'Harare → Gweru', status: 'awaiting_pickup', amount: 280, createdAt: '2025-01-09' },
    { id: 'PT-2025-001230', shipper: 'Grace Mutasa', transporter: 'Peter Ndlovu', route: 'Bulawayo → Victoria Falls', status: 'completed', amount: 680, createdAt: '2025-01-08' },
  ]);
  const [filterStatus, setFilterStatus] = useState('all');

  const filteredJobs = filterStatus === 'all' ? jobs : jobs.filter(j => j.status === filterStatus);

  const getStatusBadge = (status) => {
    const config = {
      pending: { class: 'status-pending', label: 'Pending' },
      awaiting_pickup: { class: 'status-awaiting', label: 'Awaiting Pickup' },
      loading: { class: 'status-loading', label: 'Loading' },
      in_transit: { class: 'status-in-transit', label: 'In Transit' },
      completed: { class: 'status-completed', label: 'Completed' },
      cancelled: { class: 'status-cancelled', label: 'Cancelled' }
    };
    const c = config[status] || config.pending;
    return <span className={`status-badge ${c.class}`}>{c.label}</span>;
  };

  return (
    <>
      <div className="admin-topbar">
        <div className="topbar-content">
          <div className="topbar-left">
            <h1 className="page-title">Jobs Management</h1>
            <p className="page-subtitle">{filteredJobs.length} jobs</p>
          </div>
          <div className="topbar-right">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="in_transit">In Transit</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="admin-content">
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Job ID</th>
                <th>Route</th>
                <th>Shipper</th>
                <th>Transporter</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job.id}>
                  <td><span className="job-id">{job.id}</span></td>
                  <td>{job.route}</td>
                  <td>{job.shipper}</td>
                  <td>{job.transporter}</td>
                  <td>{getStatusBadge(job.status)}</td>
                  <td className="amount-cell">${job.amount}</td>
                  <td>{new Date(job.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn" title="View Details"><Eye className="icon" /></button>
                      <button className="action-btn" title="Track"><MapPin className="icon" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

// ============ Payments View ============
const PaymentsView = () => {
  const [payments, setPayments] = useState([
    { id: 'PAY-001', bookingRef: 'PT-2025-001234', payer: 'John Moyo', amount: 450, method: 'ecocash', status: 'completed', date: '2025-01-10T10:30:00' },
    { id: 'PAY-002', bookingRef: 'PT-2025-001235', payer: 'ABC Manufacturing', amount: 320, method: 'bank_transfer', status: 'pending', date: '2025-01-10T09:15:00' },
    { id: 'PAY-003', bookingRef: 'PT-2025-001230', payer: 'Grace Mutasa', amount: 680, method: 'innbucks', status: 'completed', date: '2025-01-08T14:20:00' },
    { id: 'PAY-004', bookingRef: 'PT-2025-001228', payer: 'Trust Ncube', amount: 280, method: 'ecocash', status: 'failed', date: '2025-01-07T16:45:00' },
    { id: 'PAY-005', bookingRef: 'PT-2025-001225', payer: 'Mike Chikwanha', amount: 520, method: 'card', status: 'refunded', date: '2025-01-06T11:00:00' },
  ]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  const filteredPayments = payments.filter(p => {
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchesMethod = filterMethod === 'all' || p.method === filterMethod;
    return matchesStatus && matchesMethod;
  });

  const totalRevenue = filteredPayments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = filteredPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'ecocash': return '📱';
      case 'innbucks': return '💵';
      case 'bank_transfer': return '🏦';
      case 'card': return '💳';
      default: return '💰';
    }
  };

  const getStatusBadge = (status) => {
    const config = {
      completed: { class: 'status-completed', label: 'Completed' },
      pending: { class: 'status-pending', label: 'Pending' },
      failed: { class: 'status-failed', label: 'Failed' },
      refunded: { class: 'status-refunded', label: 'Refunded' }
    };
    const c = config[status] || config.pending;
    return <span className={`status-badge ${c.class}`}>{c.label}</span>;
  };

  return (
    <>
      <div className="admin-topbar">
        <div className="topbar-content">
          <div className="topbar-left">
            <h1 className="page-title">Payments</h1>
            <p className="page-subtitle">Manage all platform transactions</p>
          </div>
          <div className="topbar-right">
            <button className="btn-secondary">
              <Download className="icon" /> Export
            </button>
          </div>
        </div>
      </div>

      <div className="admin-content">
        {/* Payment Stats */}
        <div className="stats-grid stats-grid-4">
          <StatCard title="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={<DollarSign className="icon" />} color="success" />
          <StatCard title="Pending Payments" value={`$${pendingAmount.toLocaleString()}`} icon={<Clock className="icon" />} color="accent" />
          <StatCard title="Completed" value={filteredPayments.filter(p => p.status === 'completed').length} icon={<CheckCircle className="icon" />} color="primary" />
          <StatCard title="Failed" value={filteredPayments.filter(p => p.status === 'failed').length} icon={<XCircle className="icon" />} color="error" />
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} className="filter-select">
            <option value="all">All Methods</option>
            <option value="ecocash">EcoCash</option>
            <option value="innbucks">InnBucks</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="card">Card</option>
          </select>
        </div>

        {/* Payments Table */}
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Booking</th>
                <th>Payer</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.map((payment) => (
                <tr key={payment.id}>
                  <td><span className="payment-id">{payment.id}</span></td>
                  <td><span className="booking-ref">{payment.bookingRef}</span></td>
                  <td>{payment.payer}</td>
                  <td>
                    <div className="payment-method">
                      <span className="method-icon">{getPaymentMethodIcon(payment.method)}</span>
                      <span>{payment.method.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="amount-cell">${payment.amount.toFixed(2)}</td>
                  <td>{getStatusBadge(payment.status)}</td>
                  <td>{new Date(payment.date).toLocaleString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn" title="View Details"><Eye className="icon" /></button>
                      <button className="action-btn" title="Receipt"><FileText className="icon" /></button>
                      {payment.status === 'pending' && (
                        <button className="action-btn success" title="Confirm"><CheckCircle className="icon" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

// ============ Disputes View ============
const DisputesView = () => {
  const [disputes, setDisputes] = useState([
    { id: 'DSP-001', bookingRef: 'PT-2025-001228', complainant: 'Sarah Dube', complainantType: 'shipper', respondent: 'Mike Chikwanha', type: 'damaged_goods', status: 'open', priority: 'high', amount: 450, description: 'Cargo arrived with significant water damage', createdAt: '2025-01-09T14:30:00' },
    { id: 'DSP-002', bookingRef: 'PT-2025-001220', complainant: 'Trust Ncube', complainantType: 'transporter', respondent: 'Grace Mutasa', type: 'non_payment', status: 'investigating', priority: 'medium', amount: 320, description: 'Payment not received after delivery confirmation', createdAt: '2025-01-08T09:15:00' },
    { id: 'DSP-003', bookingRef: 'PT-2025-001215', complainant: 'ABC Manufacturing', complainantType: 'shipper', respondent: 'Peter Ndlovu', type: 'late_delivery', status: 'resolved', priority: 'low', amount: 0, description: 'Delivery was 6 hours late', resolution: 'Partial refund of $50 issued', createdAt: '2025-01-06T11:00:00', resolvedAt: '2025-01-07T16:30:00' },
  ]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  const filteredDisputes = filterStatus === 'all' ? disputes : disputes.filter(d => d.status === filterStatus);

  const getStatusBadge = (status) => {
    const config = {
      open: { class: 'status-open', label: 'Open' },
      investigating: { class: 'status-investigating', label: 'Investigating' },
      resolved: { class: 'status-resolved', label: 'Resolved' },
      closed: { class: 'status-closed', label: 'Closed' }
    };
    const c = config[status] || config.open;
    return <span className={`status-badge ${c.class}`}>{c.label}</span>;
  };

  const getPriorityBadge = (priority) => {
    const config = {
      high: { class: 'priority-high', label: 'High' },
      medium: { class: 'priority-medium', label: 'Medium' },
      low: { class: 'priority-low', label: 'Low' }
    };
    const c = config[priority] || config.medium;
    return <span className={`priority-badge ${c.class}`}>{c.label}</span>;
  };

  const handleViewDispute = (dispute) => {
    setSelectedDispute(dispute);
    setShowDisputeModal(true);
  };

  return (
    <>
      <div className="admin-topbar">
        <div className="topbar-content">
          <div className="topbar-left">
            <h1 className="page-title">Disputes</h1>
            <p className="page-subtitle">{filteredDisputes.filter(d => d.status !== 'resolved').length} open disputes</p>
          </div>
          <div className="topbar-right">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>
        </div>
      </div>

      <div className="admin-content">
        {/* Disputes Stats */}
        <div className="stats-grid stats-grid-4">
          <StatCard title="Open" value={disputes.filter(d => d.status === 'open').length} icon={<AlertCircle className="icon" />} color="error" />
          <StatCard title="Investigating" value={disputes.filter(d => d.status === 'investigating').length} icon={<Search className="icon" />} color="accent" />
          <StatCard title="Resolved" value={disputes.filter(d => d.status === 'resolved').length} icon={<CheckCircle className="icon" />} color="success" />
          <StatCard title="Avg Resolution Time" value="2.5 days" icon={<Clock className="icon" />} color="primary" />
        </div>

        {/* Disputes List */}
        <div className="disputes-list">
          {filteredDisputes.map((dispute) => (
            <div key={dispute.id} className="dispute-card">
              <div className="dispute-header">
                <div className="dispute-info">
                  <span className="dispute-id">{dispute.id}</span>
                  <span className="booking-ref">{dispute.bookingRef}</span>
                </div>
                <div className="dispute-badges">
                  {getPriorityBadge(dispute.priority)}
                  {getStatusBadge(dispute.status)}
                </div>
              </div>

              <div className="dispute-parties">
                <div className="party complainant">
                  <span className="party-label">Complainant ({dispute.complainantType})</span>
                  <span className="party-name">{dispute.complainant}</span>
                </div>
                <span className="vs-label">vs</span>
                <div className="party respondent">
                  <span className="party-label">Respondent</span>
                  <span className="party-name">{dispute.respondent}</span>
                </div>
              </div>

              <div className="dispute-details">
                <div className="dispute-type">
                  <AlertCircle className="icon" />
                  <span>{dispute.type.replace('_', ' ')}</span>
                </div>
                {dispute.amount > 0 && (
                  <div className="dispute-amount">
                    <DollarSign className="icon" />
                    <span>Claim: ${dispute.amount}</span>
                  </div>
                )}
                <div className="dispute-date">
                  <Calendar className="icon" />
                  <span>{new Date(dispute.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <p className="dispute-description">{dispute.description}</p>

              {dispute.resolution && (
                <div className="dispute-resolution">
                  <CheckCircle className="icon" />
                  <span>{dispute.resolution}</span>
                </div>
              )}

              <div className="dispute-actions">
                <button className="btn-secondary" onClick={() => handleViewDispute(dispute)}>
                  View Details
                </button>
                {dispute.status !== 'resolved' && (
                  <>
                    <button className="btn-secondary">
                      <MessageSquare className="icon" /> Contact Parties
                    </button>
                    <button className="btn-primary">
                      Resolve
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dispute Resolution Modal */}
      {showDisputeModal && selectedDispute && (
        <div className="modal-overlay" onClick={() => setShowDisputeModal(false)}>
          <div className="modal-content dispute-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Dispute Details - {selectedDispute.id}</h2>
              <button className="modal-close" onClick={() => setShowDisputeModal(false)}>
                <XCircle className="icon" />
              </button>
            </div>
            <div className="modal-body">
              <div className="dispute-full-details">
                <div className="detail-row">
                  <label>Booking Reference:</label>
                  <span>{selectedDispute.bookingRef}</span>
                </div>
                <div className="detail-row">
                  <label>Type:</label>
                  <span>{selectedDispute.type.replace('_', ' ')}</span>
                </div>
                <div className="detail-row">
                  <label>Claim Amount:</label>
                  <span>${selectedDispute.amount}</span>
                </div>
                <div className="detail-row">
                  <label>Description:</label>
                  <p>{selectedDispute.description}</p>
                </div>
              </div>

              {selectedDispute.status !== 'resolved' && (
                <div className="resolution-form">
                  <h3>Resolution</h3>
                  <textarea placeholder="Enter resolution details..." rows={4}></textarea>
                  <div className="resolution-options">
                    <label>
                      <input type="radio" name="resolution" value="favor_complainant" />
                      Rule in favor of complainant
                    </label>
                    <label>
                      <input type="radio" name="resolution" value="favor_respondent" />
                      Rule in favor of respondent
                    </label>
                    <label>
                      <input type="radio" name="resolution" value="partial" />
                      Partial resolution
                    </label>
                  </div>
                  <div className="refund-input">
                    <label>Refund Amount (if applicable):</label>
                    <input type="number" placeholder="0.00" />
                  </div>
                </div>
              )}

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowDisputeModal(false)}>Cancel</button>
                {selectedDispute.status !== 'resolved' && (
                  <button className="btn-primary">Submit Resolution</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============ Reviews View ============
const ReviewsView = () => {
  const [reviews] = useState([
    { id: 1, reviewer: 'John Moyo', reviewee: 'Trust Ncube', rating: 5, comment: 'Excellent service, very professional!', bookingRef: 'PT-2025-001230', date: '2025-01-09' },
    { id: 2, reviewer: 'ABC Manufacturing', reviewee: 'Mike Chikwanha', rating: 4, comment: 'Good delivery, slight delay but communicated well.', bookingRef: 'PT-2025-001225', date: '2025-01-08' },
    { id: 3, reviewer: 'Trust Ncube', reviewee: 'Sarah Dube', rating: 5, comment: 'Great shipper, cargo was well packaged.', bookingRef: 'PT-2025-001222', date: '2025-01-07' },
  ]);

  return (
    <>
      <div className="admin-topbar">
        <div className="topbar-content">
          <div className="topbar-left">
            <h1 className="page-title">Reviews</h1>
            <p className="page-subtitle">Platform ratings and feedback</p>
          </div>
        </div>
      </div>

      <div className="admin-content">
        <div className="reviews-list">
          {reviews.map((review) => (
            <div key={review.id} className="review-card">
              <div className="review-header">
                <div className="review-parties">
                  <span className="reviewer">{review.reviewer}</span>
                  <span className="arrow">→</span>
                  <span className="reviewee">{review.reviewee}</span>
                </div>
                <div className="review-rating">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`icon star ${i < review.rating ? 'filled' : ''}`} />
                  ))}
                </div>
              </div>
              <p className="review-comment">{review.comment}</p>
              <div className="review-footer">
                <span className="booking-ref">{review.bookingRef}</span>
                <span className="review-date">{new Date(review.date).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

// ============ Settings View ============
const SettingsView = () => {
  return (
    <>
      <div className="admin-topbar">
        <div className="topbar-content">
          <div className="topbar-left">
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Platform configuration</p>
          </div>
        </div>
      </div>

      <div className="admin-content">
        <div className="settings-sections">
          <div className="settings-section">
            <h3>Platform Settings</h3>
            <div className="settings-grid">
              <div className="setting-item">
                <label>Platform Commission (%)</label>
                <input type="number" defaultValue="15" />
              </div>
              <div className="setting-item">
                <label>Minimum Booking Amount ($)</label>
                <input type="number" defaultValue="50" />
              </div>
              <div className="setting-item">
                <label>Auto-cancel Timeout (hours)</label>
                <input type="number" defaultValue="24" />
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Notifications</h3>
            <div className="settings-toggle-list">
              <div className="toggle-item">
                <span>Email Notifications</span>
                <input type="checkbox" defaultChecked />
              </div>
              <div className="toggle-item">
                <span>SMS Notifications</span>
                <input type="checkbox" defaultChecked />
              </div>
              <div className="toggle-item">
                <span>WhatsApp Notifications</span>
                <input type="checkbox" defaultChecked />
              </div>
            </div>
          </div>

          <button className="btn-primary">Save Changes</button>
        </div>
      </div>
    </>
  );
};

// ============ Shared Components ============
const NavItem = ({ icon, label, active, badge, sidebarOpen, onClick }) => (
  <button
    className={`nav-item ${active ? 'nav-item-active' : ''}`}
    onClick={onClick}
  >
    <span className="nav-icon">{icon}</span>
    {sidebarOpen && (
      <>
        <span className="nav-label">{label}</span>
        {badge && <span className="nav-badge">{badge}</span>}
      </>
    )}
  </button>
);

const StatCard = ({ title, value, change, icon, color, alert }) => {
  const colorClass = `stat-card-${color}`;

  return (
    <div className={`stat-card ${colorClass}`}>
      <div className="stat-header">
        <div className="stat-icon-wrapper">{icon}</div>
        {change !== undefined && (
          <div className={`stat-change ${change >= 0 ? 'positive' : 'negative'}`}>
            {change >= 0 ? <TrendingUp className="icon" /> : <TrendingDown className="icon" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="stat-title">{title}</p>
      <p className={`stat-value ${alert ? 'stat-alert' : ''}`}>{value}</p>
    </div>
  );
};

const ActiveJobCard = ({ job }) => {
  const statusConfig = {
    in_transit: { class: 'status-in-transit', label: 'In Transit' },
    loading: { class: 'status-loading', label: 'Loading' },
    awaiting_pickup: { class: 'status-awaiting', label: 'Awaiting Pickup' }
  };
  const status = statusConfig[job.status];

  return (
    <div className="job-card">
      <div className="job-header">
        <span className="job-id">{job.id}</span>
        <span className={`job-status ${status.class}`}>{status.label}</span>
      </div>
      <div className="job-route">
        <MapPin className="icon" />
        <span>{job.route}</span>
      </div>
      <div className="job-details">
        <span>Driver: {job.driver}</span>
        <span>ETA: {job.eta}</span>
      </div>
      <div className="job-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${job.progress}%` }} />
        </div>
        <div className="progress-text">{job.progress}%</div>
      </div>
    </div>
  );
};

const ActivityItem = ({ activity }) => {
  const typeIcons = {
    booking: <Package className="icon" />,
    payment: <DollarSign className="icon" />,
    delivery: <CheckCircle className="icon" />,
    user: <Users className="icon" />,
    dispute: <AlertCircle className="icon" />
  };

  return (
    <div className="activity-item">
      <div className="activity-icon">{typeIcons[activity.type]}</div>
      <div className="activity-content">
        <p className="activity-event">{activity.event}</p>
        <p className="activity-user">{activity.user}</p>
        <p className="activity-time">{activity.time}</p>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, target, status }) => (
  <div className="metric-card">
    <p className="metric-title">{title}</p>
    <div className="metric-value-section">
      <p className="metric-value">{value}</p>
      {status === 'good' && <CheckCircle className="icon success" />}
    </div>
    <p className="metric-target">Target: {target}</p>
  </div>
);

export default AdminDashboard;
