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
      case 'rentals':
        return <RentalsView />;
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
            icon={<CreditCard />}
            label="Rentals"
            active={activeTab === 'rentals'}
            sidebarOpen={sidebarOpen}
            onClick={() => handleNavClick('rentals')}
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
              users: data.users?.growth || 0,
              onTime: data.operations?.onTimeGrowth || 0
            }
          });
        }

        const [bookingsRes, activityRes] = await Promise.all([
          adminAPI.getBookings({ status: 'in_transit,picked_up,accepted', limit: 5 }),
          adminAPI.getAuditLogs({ limit: 5 })
        ]);
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
        setRecentActivity((activityRes.data || []).map(log => ({
          time: log.createdAt ? new Date(log.createdAt).toLocaleString() : '',
          event: log.action,
          user: log.actor?.fullName || log.actor?.email || 'System',
          type: log.entityType || 'audit'
        })));

      } catch (error) {
        console.error('Error fetching admin dashboard:', error);
        setActiveJobs([]);
        setRecentActivity([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [timeRange]);

  const recentActivityData = recentActivity;

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
      setUsers([]);
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
  const [jobs, setJobs] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const response = await adminAPI.getBookings(filterStatus === 'all' ? { limit: 50 } : { status: filterStatus, limit: 50 });
        setJobs((response.data || []).map(booking => ({
          id: booking.bookingId || booking.bookingReference || booking._id,
          shipper: booking.shipper?.fullName || booking.shipper?.name || 'N/A',
          transporter: booking.transporter?.fullName || booking.transporter?.name || 'Pending',
          route: `${booking.pickup?.city || booking.route?.pickup?.city || 'N/A'} - ${booking.delivery?.city || booking.route?.delivery?.city || 'N/A'}`,
          status: booking.status,
          amount: booking.pricing?.total || booking.pricing?.totals?.total || booking.totalAmount || 0,
          createdAt: booking.createdAt
        })));
      } catch (error) {
        console.error('Failed to load jobs:', error);
        setJobs([]);
      }
    };
    loadJobs();
  }, [filterStatus]);

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

// ============ Rentals View ============
const RentalsView = () => {
  const [rentals, setRentals] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRentals = async () => {
      try {
        setLoading(true);
        const response = await adminAPI.getRentals(filterStatus === 'all' ? {} : { status: filterStatus });
        setRentals(response.data || []);
      } catch (error) {
        console.error('Error fetching rentals:', error);
        setRentals([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRentals();
  }, [filterStatus]);

  const totalValue = rentals.reduce((sum, rental) => sum + Number(rental.pricing?.total || 0), 0);
  const pendingCount = rentals.filter(rental => ['pending', 'approved', 'payment_pending'].includes(rental.status)).length;
  const activeCount = rentals.filter(rental => ['confirmed', 'active'].includes(rental.status)).length;
  const settledCount = rentals.filter(rental => rental.settlement?.status === 'settled').length;
  const getStatusBadge = (status) => {
    const normalized = status || 'pending';
    return <span className={`status-badge status-${normalized.replace(/_/g, '-')}`}>{normalized.replace(/_/g, ' ')}</span>;
  };

  return (
    <>
      <div className="admin-topbar">
        <div className="topbar-content">
          <div className="topbar-left">
            <h1 className="page-title">Fleet Rentals</h1>
            <p className="page-subtitle">Monitor rental approvals, payments, linked jobs, and settlement</p>
          </div>
          <div className="topbar-right">
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="payment_pending">Payment Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      <div className="admin-content">
        <div className="stats-grid stats-grid-4">
          <StatCard title="Rental Value" value={`$${totalValue.toLocaleString()}`} icon={<DollarSign className="icon" />} color="success" />
          <StatCard title="Pending Ops" value={pendingCount} icon={<Clock className="icon" />} color="accent" />
          <StatCard title="Active/Ready" value={activeCount} icon={<Truck className="icon" />} color="primary" />
          <StatCard title="Settled" value={settledCount} icon={<CheckCircle className="icon" />} color="secondary" />
        </div>

        <div className="data-table-container">
          {loading ? (
            <div className="loading-state">Loading rentals...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rental</th>
                  <th>Asset</th>
                  <th>Owner</th>
                  <th>Renter</th>
                  <th>Linked Job</th>
                  <th>Payment</th>
                  <th>Settlement</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {rentals.map((rental) => (
                  <tr key={rental._id}>
                    <td>
                      <span className="job-id">{rental.rentalReference}</span>
                      <div>{getStatusBadge(rental.status)}</div>
                    </td>
                    <td>{rental.trailer?.assetName || rental.trailer?.registrationNumber || rental.vehicle?.registrationNumber || rental.itemType}</td>
                    <td>{rental.owner?.fullName || 'Owner'}</td>
                    <td>{rental.renter?.fullName || 'Renter'}</td>
                    <td>{rental.linkedShipment?.booking?.bookingReference || '-'}</td>
                    <td>{rental.payment?.rentalPayment?.status || 'pending'}</td>
                    <td>{rental.settlement?.status || 'pending'}</td>
                    <td className="amount-cell">${rental.pricing?.total || 0}</td>
                  </tr>
                ))}
                {!rentals.length && (
                  <tr>
                    <td colSpan="8">No rentals found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
};

// ============ Payments View ============
const PaymentsView = () => {
  const [payments, setPayments] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMethod, setFilterMethod] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  useEffect(() => {
    const loadPayments = async () => {
      try {
        const params = { limit: 50 };
        if (filterStatus !== 'all') params.status = filterStatus;
        if (filterMethod !== 'all') params.method = filterMethod;
        const response = await adminAPI.getPayments(params);
        setPayments((response.data || []).map(payment => ({
          id: payment.paymentReference || payment._id,
          bookingRef: payment.booking?.bookingReference || payment.booking?.bookingId || payment.rental?.rentalReference || 'N/A',
          payer: payment.customer?.email || payment.user?.fullName || 'N/A',
          amount: Number(payment.amount || 0),
          method: payment.paymentMethod || payment.method || payment.gateway || 'N/A',
          status: payment.status || 'pending',
          date: payment.createdAt
        })));
      } catch (error) {
        console.error('Failed to load payments:', error);
        setPayments([]);
      }
    };
    loadPayments();
  }, [filterStatus, filterMethod]);

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
      case 'openapi_africa': return '💵';
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
            <option value="openapi_africa">OpenAPI Africa</option>
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
  const [disputes, setDisputes] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  useEffect(() => {
    const loadDisputes = async () => {
      try {
        const response = await adminAPI.getDisputes(filterStatus === 'all' ? {} : { status: filterStatus });
        setDisputes((response.data || []).map(booking => ({
          id: booking.dispute?._id || booking._id,
          bookingId: booking._id,
          bookingRef: booking.bookingReference || booking.bookingId || booking._id,
          complainant: booking.dispute?.raisedBy?.fullName || booking.shipper?.fullName || booking.shipper?.name || 'N/A',
          complainantType: booking.dispute?.raisedByRole || 'shipper',
          respondent: booking.transporter?.fullName || booking.transporter?.name || 'N/A',
          type: booking.dispute?.type || booking.dispute?.reason || 'dispute',
          status: booking.dispute?.status || 'open',
          priority: booking.dispute?.priority || 'medium',
          amount: Number(booking.dispute?.claimAmount || booking.dispute?.refundAmount || 0),
          description: booking.dispute?.description || booking.dispute?.notes || '',
          resolution: booking.dispute?.resolution,
          createdAt: booking.dispute?.createdAt || booking.updatedAt
        })));
      } catch (error) {
        console.error('Failed to load disputes:', error);
        setDisputes([]);
      }
    };
    loadDisputes();
  }, [filterStatus]);

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
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const loadReviews = async () => {
      try {
        const response = await adminAPI.getRatings({ limit: 50 });
        setReviews((response.data || []).map(rating => ({
          id: rating._id,
          reviewer: rating.rater?.user?.fullName || rating.rater?.user?.email || 'N/A',
          reviewee: rating.ratee?.user?.fullName || rating.ratee?.user?.email || 'N/A',
          rating: rating.overallRating || 0,
          comment: rating.review?.text || '',
          bookingRef: rating.booking?.bookingReference || rating.booking?.bookingId || 'N/A',
          date: rating.createdAt
        })));
      } catch (error) {
        console.error('Failed to load reviews:', error);
        setReviews([]);
      }
    };
    loadReviews();
  }, []);

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

const INTEGRATION_FIELDS = {
  paynow: [
    { key: 'integrationId', label: 'Integration ID' },
    { key: 'integrationKey', label: 'Integration Key', secret: true },
    { key: 'resultUrl', label: 'Result URL' },
    { key: 'returnUrl', label: 'Return URL' }
  ],
  openapiAfrica: [
    { key: 'baseUrl', label: 'Base URL' },
    { key: 'publicUniqueId', label: 'Public Unique ID' },
    { key: 'returnUrl', label: 'Return URL' },
    { key: 'currency', label: 'Currency' }
  ],
  mapbox: [
    { key: 'accessToken', label: 'Access Token', secret: true }
  ],
  whatsapp: [
    { key: 'phoneNumberId', label: 'Phone Number ID' },
    { key: 'businessAccountId', label: 'Business Account ID' },
    { key: 'accessToken', label: 'Access Token', secret: true },
    { key: 'verifyToken', label: 'Verify Token', secret: true }
  ],
  firebase: [
    { key: 'serviceAccountJson', label: 'Service Account JSON', secret: true, multiline: true }
  ],
  storage: [
    { key: 'driver', label: 'Driver' },
    { key: 'bucket', label: 'Bucket' },
    { key: 'region', label: 'Region' },
    { key: 'baseUrl', label: 'Base URL' },
    { key: 'accessKeyId', label: 'Access Key ID', secret: true },
    { key: 'secretAccessKey', label: 'Secret Access Key', secret: true }
  ],
  email: [
    { key: 'host', label: 'SMTP Host' },
    { key: 'port', label: 'SMTP Port' },
    { key: 'user', label: 'SMTP User' },
    { key: 'pass', label: 'SMTP Password', secret: true },
    { key: 'from', label: 'From Address' }
  ],
  uploadScanner: [
    { key: 'scanCommand', label: 'Scan Command' }
  ]
};

// ============ Settings View ============
const SettingsView = () => {
  const [integrations, setIntegrations] = useState([]);
  const [integrationForms, setIntegrationForms] = useState({});
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [savingProvider, setSavingProvider] = useState(null);
  const [testingProvider, setTestingProvider] = useState(null);
  const [integrationMessage, setIntegrationMessage] = useState('');

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      setLoadingIntegrations(true);
      const response = await adminAPI.getIntegrations();
      const records = response.data || [];
      setIntegrations(records);
      setIntegrationForms(records.reduce((forms, integration) => {
        forms[integration.provider] = {
          enabled: integration.enabled,
          settings: { ...(integration.settings || {}) }
        };
        return forms;
      }, {}));
    } catch (error) {
      setIntegrationMessage(error.message || 'Unable to load integration settings');
    } finally {
      setLoadingIntegrations(false);
    }
  };

  const updateIntegrationForm = (provider, field, value) => {
    setIntegrationForms((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        settings: {
          ...(current[provider]?.settings || {}),
          [field]: value
        }
      }
    }));
  };

  const toggleIntegration = (provider, enabled) => {
    setIntegrationForms((current) => ({
      ...current,
      [provider]: {
        ...current[provider],
        enabled
      }
    }));
  };

  const saveIntegration = async (integration) => {
    try {
      setSavingProvider(integration.provider);
      setIntegrationMessage('');
      const form = integrationForms[integration.provider] || { settings: {}, enabled: false };
      const payload = {
        enabled: form.enabled,
        settings: {}
      };

      (INTEGRATION_FIELDS[integration.provider] || []).forEach((field) => {
        const value = form.settings?.[field.key];
        if (field.secret && (!value || value === '********')) return;
        payload.settings[field.key] = value;
      });

      await adminAPI.updateIntegration(integration.provider, payload);
      setIntegrationMessage(`${integration.label} settings saved`);
      await loadIntegrations();
    } catch (error) {
      setIntegrationMessage(error.message || 'Unable to save integration settings');
    } finally {
      setSavingProvider(null);
    }
  };

  const testIntegration = async (integration) => {
    try {
      setTestingProvider(integration.provider);
      setIntegrationMessage('');
      const response = await adminAPI.testIntegration(integration.provider);
      setIntegrationMessage(response.message || `${integration.label} configuration looks ready`);
      await loadIntegrations();
    } catch (error) {
      setIntegrationMessage(error.message || `${integration.label} configuration needs attention`);
      await loadIntegrations();
    } finally {
      setTestingProvider(null);
    }
  };

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

          <div className="settings-section">
            <div className="settings-section-header">
              <div>
                <h3>Integration Keys</h3>
                <p>Manage provider credentials used by the backend services.</p>
              </div>
              <button className="btn-secondary" onClick={loadIntegrations} disabled={loadingIntegrations}>
                <RefreshCw className="icon" />
                Refresh
              </button>
            </div>

            {integrationMessage && (
              <div className="integration-message">
                <AlertCircle className="icon" />
                <span>{integrationMessage}</span>
              </div>
            )}

            {loadingIntegrations ? (
              <div className="settings-empty">Loading integration settings...</div>
            ) : (
              <div className="integration-list">
                {integrations.map((integration) => {
                  const fields = INTEGRATION_FIELDS[integration.provider] || [];
                  const form = integrationForms[integration.provider] || { settings: {}, enabled: false };
                  const statusClass = `integration-status status-${integration.status}`;

                  return (
                    <div key={integration.provider} className="integration-card">
                      <div className="integration-card-header">
                        <div>
                          <h4>{integration.label}</h4>
                          <span className="integration-category">{integration.category}</span>
                        </div>
                        <div className="integration-header-actions">
                          <span className={statusClass}>
                            {integration.status?.replace('_', ' ') || 'not configured'}
                          </span>
                          <label className="switch-control">
                            <input
                              type="checkbox"
                              checked={Boolean(form.enabled)}
                              onChange={(event) => toggleIntegration(integration.provider, event.target.checked)}
                            />
                            <span>Enabled</span>
                          </label>
                        </div>
                      </div>

                      <div className="integration-fields">
                        {fields.map((field) => {
                          const value = form.settings?.[field.key] || '';
                          const isConfiguredSecret = field.secret && value === '********';
                          return (
                            <div key={field.key} className="setting-item">
                              <label>
                                {field.label}
                                {integration.requiredFields?.includes(field.key) && <span className="required-dot">Required</span>}
                              </label>
                              {field.multiline ? (
                                <textarea
                                  rows="4"
                                  value={isConfiguredSecret ? '' : value}
                                  placeholder={isConfiguredSecret ? 'Configured. Enter a new value to replace it.' : ''}
                                  onChange={(event) => updateIntegrationForm(integration.provider, field.key, event.target.value)}
                                />
                              ) : (
                                <input
                                  type={field.secret ? 'password' : 'text'}
                                  value={isConfiguredSecret ? '' : value}
                                  placeholder={isConfiguredSecret ? 'Configured. Enter a new value to replace it.' : ''}
                                  onChange={(event) => updateIntegrationForm(integration.provider, field.key, event.target.value)}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="integration-footer">
                        <div className="integration-test">
                          {integration.lastTestStatus === 'passed' ? (
                            <CheckCircle className="icon success" />
                          ) : (
                            <AlertCircle className="icon warning" />
                          )}
                          <span>{integration.lastTestMessage || 'No configuration check has been run yet.'}</span>
                        </div>
                        <div className="integration-actions">
                          <button
                            className="btn-secondary"
                            onClick={() => testIntegration(integration)}
                            disabled={testingProvider === integration.provider}
                          >
                            <Check className="icon" />
                            {testingProvider === integration.provider ? 'Checking...' : 'Check'}
                          </button>
                          <button
                            className="btn-primary"
                            onClick={() => saveIntegration(integration)}
                            disabled={savingProvider === integration.provider}
                          >
                            {savingProvider === integration.provider ? 'Saving...' : 'Save'}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
