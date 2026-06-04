import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Truck, Package, DollarSign, TrendingUp, TrendingDown,
  AlertCircle, CheckCircle, Clock, MapPin, Star, Settings, Menu,
  Search, Filter, Download, Eye, Edit, Ban, RefreshCw, XCircle,
  ChevronLeft, ChevronRight, MoreVertical, Phone, Mail, Calendar,
  CreditCard, Building, MessageSquare, FileText, Shield, Check
} from 'lucide-react';
import { adminAPI, authAPI, trackingAPI, resolveApiUrl } from '../services/api';
import './styles/AdminDashboard.css';
import logo from '../assets/logo3.png';

const downloadCsv = (filename, rows) => {
  const data = rows.length ? rows : [{ message: 'No records available' }];
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(header => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const getPaymentMethodLabel = (method) => {
  switch (method) {
    case 'ecocash': return 'EC';
    case 'onemoney': return 'OM';
    case 'openapi_africa':
    case 'clicknpay': return 'CP';
    case 'bank_transfer': return 'BT';
    case 'card': return 'CC';
    case 'cash_agent':
    case 'cash_on_pickup':
    case 'cash_on_delivery': return 'CA';
    default: return 'PM';
  }
};

const AUTHORITY_OPTIONS = [
  { value: 'Civil Registry', label: 'Civil Registry' },
  { value: 'CVR', label: 'CVR' },
  { value: 'VID', label: 'VID' },
  { value: 'ZINARA', label: 'ZINARA' },
  { value: 'Insurance Provider', label: 'Insurance Provider' },
  { value: 'Employer Reference', label: 'Employer Reference' },
  { value: 'Other', label: 'Other' }
];

const METHOD_OPTIONS = [
  { value: 'portal', label: 'Online portal' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'in_person', label: 'In person' },
  { value: 'api', label: 'API' },
  { value: 'other', label: 'Other' }
];

const getDocumentLabel = (type = 'other') => String(type)
  .split('_')
  .map(word => word.charAt(0).toUpperCase() + word.slice(1))
  .join(' ');

const getDefaultAuthority = (documentType = '') => {
  const type = String(documentType).toLowerCase();
  if (type.includes('national_id') || type.includes('passport')) return 'Civil Registry';
  if (type.includes('driver_license')) return 'CVR';
  if (type.includes('vid')) return 'VID';
  if (type.includes('zinara')) return 'ZINARA';
  if (type.includes('insurance')) return 'Insurance Provider';
  return 'Other';
};

const createAuthorityCheck = (document = null) => ({
  documentId: document?._id || '',
  documentType: document?.type || 'general',
  authority: getDefaultAuthority(document?.type),
  method: 'portal',
  referenceNumber: '',
  result: 'inconclusive',
  expiryDate: document?.expiryDate ? String(document.expiryDate).slice(0, 10) : '',
  notes: ''
});

const AdminDashboard = () => {
  const [timeRange, setTimeRange] = useState('today');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [jobsUserFilter, setJobsUserFilter] = useState(null);
  const [unattendedDisputes, setUnattendedDisputes] = useState(0);
  const [pendingVerifications, setPendingVerifications] = useState(0);

  const loadAdminBadges = useCallback(async () => {
    try {
      const response = await adminAPI.getDashboardStats();
      setUnattendedDisputes(Number(response.data?.claims?.unattendedDisputes || 0));
      setPendingVerifications(Number(response.data?.users?.pendingVerifications || 0));
    } catch (error) {
      console.error('Unable to load admin badge counts:', error);
      setUnattendedDisputes(0);
      setPendingVerifications(0);
    }
  }, []);

  useEffect(() => {
    loadAdminBadges();
  }, [activeTab, loadAdminBadges]);

  const handleNavClick = (tab) => {
    setActiveTab(tab);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView timeRange={timeRange} setTimeRange={setTimeRange} setActiveTab={setActiveTab} />;
      case 'users':
        return <UsersView setActiveTab={setActiveTab} setJobsUserFilter={setJobsUserFilter} />;
      case 'verifications':
        return <UsersView verificationMode setActiveTab={setActiveTab} setJobsUserFilter={setJobsUserFilter} onVerificationChanged={loadAdminBadges} />;
      case 'jobs':
        return <JobsView userFilter={jobsUserFilter} clearUserFilter={() => setJobsUserFilter(null)} />;
      case 'payments':
        return <PaymentsView />;
      case 'rentals':
        return <RentalsView />;
      case 'monetization':
        return <MonetizationView />;
      case 'insurance':
        return <InsuranceView />;
      case 'disputes':
        return <DisputesView onDisputesChanged={loadAdminBadges} />;
      case 'reviews':
        return <ReviewsView />;
      case 'support':
        return <SupportView />;
      case 'settings':
        return <SettingsView />;
      default:
        return <DashboardView timeRange={timeRange} setTimeRange={setTimeRange} setActiveTab={setActiveTab} />;
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
                <img src={logo} alt="Palmtrent" />
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
            icon={<Shield />}
            label="Verifications"
            badge={pendingVerifications > 0 ? pendingVerifications : null}
            active={activeTab === 'verifications'}
            sidebarOpen={sidebarOpen}
            onClick={() => handleNavClick('verifications')}
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
            icon={<DollarSign />}
            label="Monetization"
            active={activeTab === 'monetization'}
            sidebarOpen={sidebarOpen}
            onClick={() => handleNavClick('monetization')}
          />
          <NavItem
            icon={<Shield />}
            label="Insurance"
            active={activeTab === 'insurance'}
            sidebarOpen={sidebarOpen}
            onClick={() => handleNavClick('insurance')}
          />
          <NavItem
            icon={<AlertCircle />}
            label="Disputes"
            badge={unattendedDisputes > 0 ? unattendedDisputes : null}
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
            icon={<MessageSquare />}
            label="Support"
            active={activeTab === 'support'}
            sidebarOpen={sidebarOpen}
            onClick={() => handleNavClick('support')}
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
const DashboardView = ({ timeRange, setTimeRange, setActiveTab }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    today: { revenue: 0, bookings: 0, activeJobs: 0, platformUsers: 0, disputes: 0 },
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
              platformUsers: data.users?.platformTotal ?? data.users?.total ?? 0,
              disputes: data.claims?.unattendedDisputes || 0
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
  const exportDashboardReport = () => {
    downloadCsv(`admin-dashboard-${timeRange}.csv`, [
      { metric: 'Revenue', value: stats.today.revenue },
      { metric: 'Bookings', value: stats.today.bookings },
      { metric: 'Active Jobs', value: stats.today.activeJobs },
      { metric: 'Current Users', value: stats.today.platformUsers },
      { metric: 'Disputes', value: stats.today.disputes }
    ]);
  };

  if (loading) {
    return (
      <div className="admin-content">
        <div className="loading-state"><RefreshCw className="icon spinning" /><p>Loading dashboard...</p></div>
      </div>
    );
  }

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
            <button className="btn-primary" onClick={exportDashboardReport}>Export Report</button>
          </div>
        </div>
      </div>

      <div className="admin-content">
        <div className="stats-grid">
          <StatCard title="Revenue" value={`$${stats.today.revenue.toLocaleString()}`} change={stats.growth.revenue} icon={<DollarSign className="icon" />} color="accent" />
          <StatCard title="Bookings" value={stats.today.bookings} change={stats.growth.bookings} icon={<Package className="icon" />} color="primary" />
          <StatCard title="Active Jobs" value={stats.today.activeJobs} icon={<Truck className="icon" />} color="secondary" />
          <StatCard title="Current Users" value={stats.today.platformUsers} change={stats.growth.users} icon={<Users className="icon" />} color="success" />
          <StatCard title="Disputes" value={stats.today.disputes} icon={<AlertCircle className="icon" />} color="error" alert />
        </div>
        <div className="content-grid">
          <div className="jobs-section">
            <div className="section-header">
              <h3 className="section-title">Active Jobs</h3>
              <button className="view-all-btn" onClick={() => setActiveTab('jobs')}>View All</button>
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
const UsersView = ({ setActiveTab, setJobsUserFilter, verificationMode = false, onVerificationChanged }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState(verificationMode ? 'pending' : 'all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [userMessage, setUserMessage] = useState('');
  const [roleEditUser, setRoleEditUser] = useState(null);
  const [roleEditValue, setRoleEditValue] = useState('shipper');
  const [shipperNationalId, setShipperNationalId] = useState('');
  const [verificationForm, setVerificationForm] = useState({
    status: 'approved',
    notes: '',
    authorityChecks: [createAuthorityCheck()]
  });
  const usersPerPage = 10;

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      setUserMessage('');
      const params = { limit: 50 };
      if (filterType !== 'all') params.role = filterType;
      if (verificationMode) {
        params.status = 'verification_required';
      } else if (filterStatus !== 'all') {
        params.status = filterStatus;
      }
      if (searchTerm) params.search = searchTerm;

      const response = await adminAPI.getUsers(params);

      if (response.success && response.data) {
        setUsers(response.data.map(u => ({
          id: u._id,
          fullName: u.fullName || u.companyName || 'N/A',
          email: u.email,
          phone: u.phone,
          userType: u.userType,
          status: verificationMode
            ? (u.verification?.status || (u.isVerified ? 'approved' : 'not_started'))
            : (u.status || 'active'),
          accountStatus: u.status || 'active',
          verified: u.isVerified || false,
          verification: u.verification || {},
          governmentId: u.governmentId || u.verification?.personalInfo?.idNumber || '',
          rating: u.rating?.average || 0,
          totalBookings: u.totalBookings || 0,
          joinDate: u.createdAt,
          lastActive: u.lastLogin || u.updatedAt
        })));
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      setUsers([]);
      setUserMessage(error.message || 'Unable to load users.');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, searchTerm, verificationMode]);

  useEffect(() => {
    setFilterStatus(verificationMode ? 'pending' : 'all');
    setCurrentPage(1);
  }, [verificationMode]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.phone.includes(searchTerm);
    const matchesType = filterType === 'all' || user.userType === filterType;
    const matchesStatus = verificationMode || filterStatus === 'all' || user.status === filterStatus;
    const matchesVerificationQueue = !verificationMode || user.userType !== 'shipper';
    return matchesSearch && matchesType && matchesStatus && matchesVerificationQueue;
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

  const handleViewUser = async (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
    setVerificationForm({
      status: user.verified ? 'approved' : 'approved',
      notes: '',
      authorityChecks: [createAuthorityCheck()]
    });
    setShipperNationalId(user.governmentId || '');
    try {
      const response = await adminAPI.getUserById(user.id);
      const details = response.data || {};
      const userDetails = details.user || {};
      const totalBookings = (details.bookingStats || []).reduce((sum, item) => sum + Number(item.count || 0), 0);
      const verification = userDetails.verification || user.verification || {};
      const documents = verification.documents || [];
      const existingChecks = verification.authorityChecks || [];
      const authorityChecks = documents.length
        ? documents.map(document => createAuthorityCheck(document))
        : [createAuthorityCheck()];

      setSelectedUser(current => current?.id === user.id ? {
        ...current,
        ...userDetails,
        id: userDetails._id || current.id,
        fullName: userDetails.fullName || userDetails.companyName || current.fullName,
        verified: userDetails.isVerified || verification.isVerified || current.verified,
        verification,
        governmentId: userDetails.governmentId || verification.personalInfo?.idNumber || current.governmentId || '',
        totalBookings,
        rating: details.rating?.avgRating || current.rating || 0,
        totalRatings: details.rating?.totalRatings || 0
      } : current);
      setVerificationForm({
        status: verification.status === 'rejected' ? 'rejected' : 'approved',
        notes: verification.notes || '',
        authorityChecks: authorityChecks.length ? authorityChecks : [createAuthorityCheck()],
        previousChecks: existingChecks
      });
      setShipperNationalId(userDetails.governmentId || verification.personalInfo?.idNumber || '');
    } catch (error) {
      console.error('Unable to load user details:', error);
    }
  };

  const closeUserModal = () => {
    setShowUserModal(false);
    setSelectedUser(null);
  };

  const updateAuthorityCheck = (index, field, value) => {
    setVerificationForm(prev => ({
      ...prev,
      authorityChecks: prev.authorityChecks.map((check, checkIndex) => (
        checkIndex === index ? { ...check, [field]: value } : check
      ))
    }));
  };

  const addAuthorityCheck = () => {
    setVerificationForm(prev => ({
      ...prev,
      authorityChecks: [...prev.authorityChecks, createAuthorityCheck()]
    }));
  };

  const removeAuthorityCheck = (index) => {
    setVerificationForm(prev => ({
      ...prev,
      authorityChecks: prev.authorityChecks.length > 1
        ? prev.authorityChecks.filter((_, checkIndex) => checkIndex !== index)
        : prev.authorityChecks
    }));
  };

  const saveVerificationDecision = async (status) => {
    if (!selectedUser) return;

    const checks = verificationForm.authorityChecks
      .map(check => ({
        ...check,
        referenceNumber: check.referenceNumber.trim(),
        notes: check.notes.trim()
      }))
      .filter(check => check.authority || check.referenceNumber || check.notes);

    try {
      const payload = {
        status,
        notes: verificationForm.notes,
        authorityChecks: checks.filter(check => !check.documentId),
        documentChecks: checks.filter(check => check.documentId)
      };
      const response = await adminAPI.verifyUser(selectedUser.id, payload);
      const updatedUser = response.data || {};
      setSelectedUser(current => current ? {
        ...current,
        verified: updatedUser.isVerified || false,
        verification: updatedUser.verification || current.verification
      } : current);
      await loadUsers();
      await onVerificationChanged?.();
      closeUserModal();
      setUserMessage(status === 'approved'
        ? 'Documents checked and user approved.'
        : 'Verification decision saved.');
    } catch (error) {
      setUserMessage(error.message || 'Unable to save verification decision.');
    }
  };

  const saveShipperNationalId = async () => {
    if (!selectedUser) return;

    try {
      const verification = selectedUser.verification || {};
      const response = await adminAPI.updateUser(selectedUser.id, {
        governmentId: shipperNationalId,
        verification: {
          ...verification,
          personalInfo: {
            ...(verification.personalInfo || {}),
            idNumber: shipperNationalId
          }
        }
      });
      const updatedUser = response.data || {};
      setSelectedUser(current => current ? {
        ...current,
        governmentId: updatedUser.governmentId || shipperNationalId,
        verification: updatedUser.verification || current.verification
      } : current);
      await loadUsers();
      setUserMessage('Shipper national ID saved.');
    } catch (error) {
      setUserMessage(error.message || 'Unable to save national ID.');
    }
  };

  const openUserBookings = (user) => {
    setJobsUserFilter({ id: user.id, name: user.fullName });
    setShowUserModal(false);
    setSelectedUser(null);
    setActiveTab('jobs');
  };

  const exportUsers = () => {
    downloadCsv('admin-users.csv', filteredUsers.map(user => ({
      name: user.fullName,
      email: user.email,
      phone: user.phone,
      type: user.userType,
      status: user.status,
      verified: user.verified,
      rating: user.rating,
      joined: user.joinDate
    })));
  };

  const updateSelectedUserStatus = async (status) => {
    try {
      await adminAPI.updateUser(selectedUser.id, { status });
      closeUserModal();
      await loadUsers();
      setUserMessage(`User marked ${status}.`);
    } catch (error) {
      setUserMessage(error.message || 'Unable to update user status.');
    }
  };

  const editUserRole = (user) => {
    setRoleEditUser(user);
    setRoleEditValue(user.userType || 'shipper');
    setUserMessage('');
  };

  const saveUserRole = async () => {
    if (!roleEditUser) return;
    try {
      await adminAPI.updateUser(roleEditUser.id, { userType: roleEditValue });
      await loadUsers();
      setUserMessage(`${roleEditUser.fullName} role updated to ${roleEditValue}.`);
      setRoleEditUser(null);
    } catch (error) {
      setUserMessage(error.message || 'Unable to update user.');
    }
  };

  const updateUserStatus = async (user, status) => {
    try {
      await adminAPI.updateUser(user.id, { status });
      await loadUsers();
      setUserMessage(`${user.fullName} marked ${status}.`);
    } catch (error) {
      setUserMessage(error.message || 'Unable to update user status.');
    }
  };

  return (
    <>
      <div className="admin-topbar">
        <div className="topbar-content">
          <div className="topbar-left">
            <h1 className="page-title">{verificationMode ? 'Verifications' : 'Users Management'}</h1>
            <p className="page-subtitle">
              {verificationMode
                ? `${filteredUsers.length} transporter, trailer owner, or corporate records awaiting review`
                : `${filteredUsers.length} total users`}
            </p>
          </div>
          <div className="topbar-right">
            <button className="btn-secondary" onClick={loadUsers}>
              <RefreshCw className="icon" /> Refresh
            </button>
            <button className="btn-primary" onClick={exportUsers}>
              <Download className="icon" /> Export
            </button>
          </div>
        </div>
      </div>

      <div className="admin-content">
        {userMessage && (
          <div className="integration-message">
            <AlertCircle className="icon" />
            <span>{userMessage}</span>
          </div>
        )}
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
            {!verificationMode && <option value="shipper">Shippers</option>}
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
                        <button className="action-btn" title="Edit" onClick={() => editUserRole(user)}>
                          <Edit className="icon" />
                        </button>
                        {user.status === 'active' ? (
                          <button className="action-btn danger" title="Suspend" onClick={() => updateUserStatus(user, 'suspended')}>
                            <Ban className="icon" />
                          </button>
                        ) : (
                          <button className="action-btn success" title="Activate" onClick={() => updateUserStatus(user, 'active')}>
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
        <div className="modal-overlay" onClick={closeUserModal}>
          <div className="modal-content user-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User Details</h2>
              <button className="modal-close" onClick={closeUserModal}>
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

              {selectedUser.userType === 'shipper' && (
                <div className="authority-verification-panel">
                  <div className="section-header">
                    <div>
                      <h3 className="section-title">National ID On Request</h3>
                      <p className="verification-helper">Shippers are not platform-verified accounts, but admins can record a national ID number when it is requested for an investigation, dispute, high-value booking, or compliance review.</p>
                    </div>
                  </div>
                  <div className="settings-form verification-notes">
                    <label>National ID Number</label>
                    <input
                      value={shipperNationalId}
                      onChange={(event) => setShipperNationalId(event.target.value)}
                      placeholder="Enter national ID number when requested"
                    />
                  </div>
                  <div className="inline-actions">
                    <button className="btn-primary" onClick={saveShipperNationalId}>Save National ID</button>
                  </div>
                </div>
              )}

              {selectedUser.userType !== 'shipper' && (
              <div className="authority-verification-panel">
                <div className="section-header">
                  <div>
                    <h3 className="section-title">Authority Verification</h3>
                    <p className="verification-helper">Record checks made against CVR, VID, ZINARA, insurers, or identity authorities before approving documents.</p>
                  </div>
                  <button className="btn-secondary" onClick={addAuthorityCheck}>Add Check</button>
                </div>

                <div className="document-review-list">
                  {(selectedUser.verification?.documents || []).length > 0 ? (
                    selectedUser.verification.documents.map(document => (
                      <div className="document-review-card" key={document._id || document.url}>
                        <div>
                          <strong>{getDocumentLabel(document.type)}</strong>
                          <p>{document.originalName || 'Uploaded document'}</p>
                        </div>
                        <div className="document-review-actions">
                          {document.verified && <span className="status-badge status-active">Checked</span>}
                          {document.url && (
                            <a className="btn-secondary" href={resolveApiUrl(document.url)} target="_blank" rel="noreferrer">
                              <FileText className="icon" /> Open
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state compact">
                      <FileText className="icon" />
                      <p>No uploaded verification documents are attached to this profile yet.</p>
                    </div>
                  )}
                </div>

                <div className="authority-checks-grid">
                  {verificationForm.authorityChecks.map((check, index) => (
                    <div className="authority-check-card" key={`${check.documentId || 'general'}-${index}`}>
                      <div className="authority-check-header">
                        <strong>{getDocumentLabel(check.documentType)}</strong>
                        <button className="action-btn danger" onClick={() => removeAuthorityCheck(index)} disabled={verificationForm.authorityChecks.length === 1}>
                          <XCircle className="icon" />
                        </button>
                      </div>
                      <div className="settings-form authority-check-form">
                        <label>Document</label>
                        <select value={check.documentId} onChange={(event) => {
                          const document = (selectedUser.verification?.documents || []).find(item => item._id === event.target.value);
                          updateAuthorityCheck(index, 'documentId', event.target.value);
                          updateAuthorityCheck(index, 'documentType', document?.type || 'general');
                          updateAuthorityCheck(index, 'authority', getDefaultAuthority(document?.type));
                        }}>
                          <option value="">General profile check</option>
                          {(selectedUser.verification?.documents || []).map(document => (
                            <option key={document._id || document.url} value={document._id}>{getDocumentLabel(document.type)}</option>
                          ))}
                        </select>

                        <label>Authority</label>
                        <select value={check.authority} onChange={(event) => updateAuthorityCheck(index, 'authority', event.target.value)}>
                          {AUTHORITY_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>

                        <label>Method</label>
                        <select value={check.method} onChange={(event) => updateAuthorityCheck(index, 'method', event.target.value)}>
                          {METHOD_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                        </select>

                        <label>Result</label>
                        <select value={check.result} onChange={(event) => updateAuthorityCheck(index, 'result', event.target.value)}>
                          <option value="passed">Passed</option>
                          <option value="failed">Failed</option>
                          <option value="inconclusive">Inconclusive</option>
                        </select>

                        <label>Authority Reference</label>
                        <input value={check.referenceNumber} onChange={(event) => updateAuthorityCheck(index, 'referenceNumber', event.target.value)} placeholder="Reference, ticket, receipt, or case number" />

                        <label>Document Expiry</label>
                        <input type="date" value={check.expiryDate} onChange={(event) => updateAuthorityCheck(index, 'expiryDate', event.target.value)} />

                        <label>Notes</label>
                        <textarea value={check.notes} onChange={(event) => updateAuthorityCheck(index, 'notes', event.target.value)} placeholder="Who was contacted, what was confirmed, and any exceptions." />
                      </div>
                    </div>
                  ))}
                </div>

                {(verificationForm.previousChecks || []).length > 0 && (
                  <div className="previous-checks">
                    <h4>Previous authority checks</h4>
                    {verificationForm.previousChecks.map((check, index) => (
                      <div className="previous-check-row" key={`${check.referenceNumber || check.authority}-${index}`}>
                        <span>{getDocumentLabel(check.documentType)} - {check.authority}</span>
                        <strong>{check.result}</strong>
                      </div>
                    ))}
                  </div>
                )}

                <div className="settings-form verification-notes">
                  <label>Admin verification notes</label>
                  <textarea
                    value={verificationForm.notes}
                    onChange={(event) => setVerificationForm(prev => ({ ...prev, notes: event.target.value }))}
                    placeholder="Summarize authority verification outcome for the audit trail."
                  />
                </div>
              </div>
              )}

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => openUserBookings(selectedUser)}>View Bookings</button>
                <button className="btn-secondary" onClick={() => window.location.href = `mailto:${selectedUser.email}`}>Send Message</button>
                {selectedUser.userType !== 'shipper' && (
                  <>
                    <button className="btn-danger" onClick={() => saveVerificationDecision('rejected')}>Reject Verification</button>
                    <button className="btn-success" onClick={() => saveVerificationDecision('approved')}>Approve Verification</button>
                  </>
                )}
                {selectedUser.status === 'active' ? (
                  <button className="btn-danger" onClick={() => updateSelectedUserStatus('suspended')}>Suspend Account</button>
                ) : selectedUser.status === 'pending' ? (
                  <button className="btn-success" onClick={() => updateSelectedUserStatus('active')}>Approve Account</button>
                ) : (
                  <button className="btn-success" onClick={() => updateSelectedUserStatus('active')}>Reactivate Account</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {roleEditUser && (
        <div className="modal-overlay" onClick={() => setRoleEditUser(null)}>
          <div className="modal-content user-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Edit User Role</h2>
              <button className="modal-close" onClick={() => setRoleEditUser(null)}><XCircle className="icon" /></button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div><span>User</span><strong>{roleEditUser.fullName}</strong></div>
                <div><span>Email</span><strong>{roleEditUser.email}</strong></div>
              </div>
              <div className="settings-form">
                <label>Role</label>
                <select value={roleEditValue} onChange={(event) => setRoleEditValue(event.target.value)}>
                  <option value="shipper">Shipper</option>
                  <option value="transporter">Transporter</option>
                  <option value="corporate">Corporate</option>
                  <option value="trailer_owner">Trailer Owner</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setRoleEditUser(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveUserRole}>Save Role</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============ Jobs View ============
const JobsView = ({ userFilter, clearUserFilter }) => {
  const [jobs, setJobs] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedJob, setSelectedJob] = useState(null);
  const [trackingDetails, setTrackingDetails] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);

  useEffect(() => {
    const loadJobs = async () => {
      try {
        const params = filterStatus === 'all' ? { limit: 50 } : { status: filterStatus, limit: 50 };
        if (userFilter?.id) params.userId = userFilter.id;
        const response = await adminAPI.getBookings(params);
        setJobs((response.data || []).map(booking => ({
          id: booking.bookingId || booking.bookingReference || booking._id,
          dbId: booking._id,
          shipper: booking.shipper?.fullName || booking.shipper?.name || 'N/A',
          transporter: booking.transporter?.fullName || booking.transporter?.name || 'Pending',
          route: `${booking.pickup?.city || booking.route?.pickup?.city || booking.route?.pickup?.address || 'N/A'} - ${booking.delivery?.city || booking.route?.delivery?.city || booking.route?.delivery?.address || 'N/A'}`,
          pickup: booking.route?.pickup?.address || booking.pickup?.address || booking.pickup?.city || 'N/A',
          delivery: booking.route?.delivery?.address || booking.delivery?.address || booking.delivery?.city || 'N/A',
          status: booking.status,
          amount: booking.pricing?.total || booking.pricing?.totals?.total || booking.totalAmount || 0,
          createdAt: booking.createdAt,
          cargo: booking.cargoDetails?.description || booking.cargoDetails?.type || 'N/A',
          paymentStatus: booking.paymentStatus || booking.payment?.status || 'N/A'
        })));
      } catch (error) {
        console.error('Failed to load jobs:', error);
        setJobs([]);
      }
    };
    loadJobs();
  }, [filterStatus, userFilter]);

  const filteredJobs = filterStatus === 'all' ? jobs : jobs.filter(j => j.status === filterStatus);
  const viewJob = (job) => {
    setSelectedJob(job);
    setTrackingDetails(null);
  };
  const trackJob = async (job) => {
    setSelectedJob(job);
    setTrackingLoading(true);
    setTrackingDetails(null);
    try {
      const response = await trackingAPI.track(job.id);
      setTrackingDetails(response.data || response);
    } catch (error) {
      setTrackingDetails({ error: error.message || 'Unable to load tracking details.' });
    } finally {
      setTrackingLoading(false);
    }
  };

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
            <p className="page-subtitle">{userFilter ? `${filteredJobs.length} job(s) for ${userFilter.name}` : `${filteredJobs.length} jobs`}</p>
          </div>
          <div className="topbar-right">
            {userFilter && (
              <button className="btn-secondary" onClick={clearUserFilter}>
                <XCircle className="icon" /> Clear User
              </button>
            )}
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
        {selectedJob && (
          <div className="settings-section admin-job-detail-panel">
            <div className="settings-section-header">
              <div>
                <h3>{selectedJob.id}</h3>
                <p>{selectedJob.route}</p>
              </div>
              <button className="btn-secondary" onClick={() => { setSelectedJob(null); setTrackingDetails(null); }}>
                <XCircle className="icon" /> Close
              </button>
            </div>
            <div className="user-details-grid">
              <div className="detail-item"><Package className="icon" /><div><label>Status</label><p>{selectedJob.status?.replace(/_/g, ' ')}</p></div></div>
              <div className="detail-item"><DollarSign className="icon" /><div><label>Amount</label><p>${Number(selectedJob.amount || 0).toLocaleString()}</p></div></div>
              <div className="detail-item"><Users className="icon" /><div><label>Shipper</label><p>{selectedJob.shipper}</p></div></div>
              <div className="detail-item"><Truck className="icon" /><div><label>Transporter</label><p>{selectedJob.transporter}</p></div></div>
              <div className="detail-item"><MapPin className="icon" /><div><label>Pickup</label><p>{selectedJob.pickup}</p></div></div>
              <div className="detail-item"><MapPin className="icon" /><div><label>Delivery</label><p>{selectedJob.delivery}</p></div></div>
            </div>
            {trackingLoading && <div className="settings-empty">Loading tracking details...</div>}
            {trackingDetails && (
              <div className="admin-tracking-panel">
                {trackingDetails.error ? (
                  <p className="integration-message">{trackingDetails.error}</p>
                ) : (
                  <>
                    <h4>Live Tracking</h4>
                    <div className="detail-row"><label>Reference</label><span>{trackingDetails.reference || selectedJob.id}</span></div>
                    <div className="detail-row"><label>Current Status</label><span>{trackingDetails.status?.replace(/_/g, ' ') || selectedJob.status}</span></div>
                    <div className="detail-row"><label>Current Location</label><span>{trackingDetails.currentLocation?.address || 'Location not reported yet'}</span></div>
                    <div className="detail-row"><label>Tracking Events</label><span>{trackingDetails.tracking?.length || 0}</span></div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
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
                      <button className="action-btn" title="View Details" onClick={() => viewJob(job)}><Eye className="icon" /></button>
                      <button className="action-btn" title="Track" onClick={() => trackJob(job)}><MapPin className="icon" /></button>
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
  const [paymentMessage, setPaymentMessage] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);

  const loadPayments = useCallback(async () => {
    try {
      const params = { limit: 50 };
      if (filterStatus !== 'all') params.status = filterStatus;
      if (filterMethod !== 'all') params.method = filterMethod;
      const response = await adminAPI.getPayments(params);
      setPayments((response.data || []).map(payment => ({
        id: payment.paymentReference || payment._id,
        dbId: payment._id,
        bookingRef: payment.booking?.bookingReference || payment.booking?.bookingId || payment.rental?.rentalReference || 'N/A',
        payer: payment.customer?.email || payment.booking?.user?.email || payment.user?.fullName || 'N/A',
        amount: Number(payment.amount || 0),
        method: payment.paymentMethod || payment.method || payment.gateway || 'N/A',
        status: payment.status || 'pending',
        date: payment.createdAt
      })));
    } catch (error) {
      console.error('Failed to load payments:', error);
      setPayments([]);
    }
  }, [filterStatus, filterMethod]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filteredPayments = payments.filter(p => {
    const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
    const matchesMethod = filterMethod === 'all' || p.method === filterMethod;
    return matchesStatus && matchesMethod;
  });

  const isCompletedPayment = (status) => ['completed', 'confirmed'].includes(status);
  const canAdminConfirmPayment = (status) => ['pending', 'initiated', 'processing'].includes(status);
  const totalRevenue = filteredPayments.filter(p => isCompletedPayment(p.status)).reduce((sum, p) => sum + p.amount, 0);
  const pendingAmount = filteredPayments.filter(p => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0);
  const exportPayments = () => {
    downloadCsv('admin-payments.csv', filteredPayments.map(payment => ({
      paymentId: payment.id,
      booking: payment.bookingRef,
      payer: payment.payer,
      method: payment.method,
      amount: payment.amount,
      status: payment.status,
      date: payment.date
    })));
  };
  const viewPayment = (payment) => setSelectedPayment(payment);
  const downloadReceipt = (payment) => {
    downloadCsv(`receipt-${payment.id}.csv`, [payment]);
  };
  const confirmPayment = async (payment) => {
    try {
      setPaymentMessage('');
      await adminAPI.confirmPayment(payment.dbId, 'Confirmed from admin payments screen');
      await loadPayments();
      setPaymentMessage(`Payment ${payment.id} confirmed.`);
    } catch (error) {
      setPaymentMessage(error.message || 'Unable to confirm payment.');
    }
  };

  const _getPaymentMethodIcon = (method) => {
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
      confirmed: { class: 'status-completed', label: 'Confirmed' },
      pending: { class: 'status-pending', label: 'Pending' },
      initiated: { class: 'status-pending', label: 'Initiated' },
      processing: { class: 'status-pending', label: 'Processing' },
      failed: { class: 'status-failed', label: 'Failed' },
      cancelled: { class: 'status-failed', label: 'Cancelled' },
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
            <button className="btn-secondary" onClick={exportPayments}>
              <Download className="icon" /> Export
            </button>
          </div>
        </div>
      </div>

      <div className="admin-content">
        {paymentMessage && (
          <div className="integration-message">
            <AlertCircle className="icon" />
            <span>{paymentMessage}</span>
          </div>
        )}
        {/* Payment Stats */}
        <div className="stats-grid stats-grid-4">
          <StatCard title="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} icon={<DollarSign className="icon" />} color="success" />
          <StatCard title="Pending Payments" value={`$${pendingAmount.toLocaleString()}`} icon={<Clock className="icon" />} color="accent" />
          <StatCard title="Completed" value={filteredPayments.filter(p => isCompletedPayment(p.status)).length} icon={<CheckCircle className="icon" />} color="primary" />
          <StatCard title="Failed" value={filteredPayments.filter(p => p.status === 'failed').length} icon={<XCircle className="icon" />} color="error" />
        </div>

        {/* Filters */}
        <div className="filters-bar">
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
            <option value="all">All Status</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="initiated">Initiated</option>
            <option value="processing">Processing</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="refunded">Refunded</option>
          </select>
          <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} className="filter-select">
            <option value="all">All Methods</option>
            <option value="ecocash">EcoCash</option>
            <option value="onemoney">OneMoney</option>
            <option value="openapi_africa">OpenAPI Africa</option>
            <option value="clicknpay">ClicknPay</option>
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
                      <span className="method-icon">{getPaymentMethodLabel(payment.method)}</span>
                      <span>{payment.method.replace('_', ' ')}</span>
                    </div>
                  </td>
                  <td className="amount-cell">${payment.amount.toFixed(2)}</td>
                  <td>{getStatusBadge(payment.status)}</td>
                  <td>{new Date(payment.date).toLocaleString()}</td>
                  <td>
                    <div className="action-buttons">
                      <button className="action-btn" title="View Details" onClick={() => viewPayment(payment)}><Eye className="icon" /></button>
                      <button className="action-btn" title="Receipt" onClick={() => downloadReceipt(payment)}><FileText className="icon" /></button>
                      {canAdminConfirmPayment(payment.status) && (
                        <button className="action-btn success" title="Confirm" onClick={() => confirmPayment(payment)}><CheckCircle className="icon" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedPayment && (
        <div className="modal-overlay" onClick={() => setSelectedPayment(null)}>
          <div className="modal-content payment-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>Payment Details</h2>
              <button className="modal-close" onClick={() => setSelectedPayment(null)}>
                <XCircle className="icon" />
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div><span>Payment</span><strong>{selectedPayment.id}</strong></div>
                <div><span>Booking</span><strong>{selectedPayment.bookingRef}</strong></div>
                <div><span>Payer</span><strong>{selectedPayment.payer}</strong></div>
                <div><span>Method</span><strong>{selectedPayment.method.replace(/_/g, ' ')}</strong></div>
                <div><span>Amount</span><strong>${selectedPayment.amount.toFixed(2)}</strong></div>
                <div><span>Status</span><strong>{selectedPayment.status}</strong></div>
                <div><span>Date</span><strong>{new Date(selectedPayment.date).toLocaleString()}</strong></div>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => downloadReceipt(selectedPayment)}><FileText className="icon" /> Receipt</button>
              <button className="btn-primary" onClick={() => setSelectedPayment(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

// ============ Disputes View ============
const DisputesView = ({ onDisputesChanged }) => {
  const [disputes, setDisputes] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [resolutionText, setResolutionText] = useState('');
  const [disputeMessage, setDisputeMessage] = useState('');

  const loadDisputes = useCallback(async () => {
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
      onDisputesChanged?.();
    } catch (error) {
      console.error('Failed to load disputes:', error);
      setDisputes([]);
      setDisputeMessage(error.message || 'Unable to load disputes.');
    }
  }, [filterStatus, onDisputesChanged]);

  useEffect(() => {
    loadDisputes();
  }, [loadDisputes]);

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
    setResolutionText(dispute.resolution || '');
    setDisputeMessage('');
    setShowDisputeModal(true);
  };

  const handleResolveDispute = async (dispute = selectedDispute) => {
    const resolution = resolutionText.trim();
    if (!resolution) {
      setDisputeMessage('Resolution details are required before closing a dispute.');
      return;
    }
    if (!resolution || !dispute) return;
    try {
      await adminAPI.resolveDispute(dispute.bookingId || dispute.id, { resolution, status: 'resolved' });
      setShowDisputeModal(false);
      setSelectedDispute(null);
      setResolutionText('');
      await loadDisputes();
      onDisputesChanged?.();
      setDisputeMessage(`Dispute ${dispute.bookingRef || dispute.id} resolved.`);
    } catch (error) {
      setDisputeMessage(error.message || 'Unable to resolve dispute.');
    }
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
        {disputeMessage && (
          <div className="integration-message">
            <AlertCircle className="icon" />
            <span>{disputeMessage}</span>
          </div>
        )}
        {/* Disputes Stats */}
        <div className="stats-grid stats-grid-4">
          <StatCard title="Open" value={disputes.filter(d => d.status === 'open').length} icon={<AlertCircle className="icon" />} color="error" />
          <StatCard title="Investigating" value={disputes.filter(d => d.status === 'investigating').length} icon={<Search className="icon" />} color="accent" />
          <StatCard title="Resolved" value={disputes.filter(d => d.status === 'resolved').length} icon={<CheckCircle className="icon" />} color="success" />
          <StatCard title="Unattended" value={disputes.filter(d => !['resolved', 'closed'].includes(d.status)).length} icon={<Clock className="icon" />} color="primary" />
        </div>

        {/* Disputes List */}
        <div className="disputes-list">
          {!filteredDisputes.length && (
            <div className="empty-state">No disputes match the selected status.</div>
          )}
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
                    <button className="btn-secondary" onClick={() => window.location.href = `mailto:?subject=Dispute ${dispute.id}&body=Booking ${dispute.bookingRef}`}>
                      <MessageSquare className="icon" /> Contact Parties
                    </button>
                    <button className="btn-primary" onClick={() => handleViewDispute(dispute)}>
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
                  <textarea placeholder="Enter resolution details..." rows={4} value={resolutionText} onChange={e => setResolutionText(e.target.value)}></textarea>
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
                  <button className="btn-primary" onClick={() => handleResolveDispute(selectedDispute)}>Submit Resolution</button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============ Monetization View ============
const MonetizationView = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    plans: [],
    commissionRules: [],
    subscriptions: [],
    ledgerSummary: [],
    payouts: []
  });
  const [monetizationMessage, setMonetizationMessage] = useState('');
  const [showPlanBuilder, setShowPlanBuilder] = useState(false);
  const [showRuleBuilder, setShowRuleBuilder] = useState(false);
  const [showSubscriptionManager, setShowSubscriptionManager] = useState(false);
  const [showPayoutManager, setShowPayoutManager] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [editingSubscription, setEditingSubscription] = useState(null);
  const [editingPayout, setEditingPayout] = useState(null);
  const [subscriptionUsers, setSubscriptionUsers] = useState([]);
  const [subscriptionForm, setSubscriptionForm] = useState({
    user: '',
    plan: '',
    status: 'active',
    paymentStatus: 'pending',
    paymentMethod: '',
    paymentReference: '',
    amount: '',
    currency: 'USD',
    currentPeriodEnd: '',
    nextBillingAt: '',
    seatsIncluded: 1,
    seatsUsed: 1
  });
  const [planForm, setPlanForm] = useState({
    code: 'transporter_custom',
    name: 'Transporter Custom',
    audience: 'transporter',
    description: '',
    price: 25,
    currency: 'USD',
    billingCycle: 'monthly',
    trialDays: 0,
    vehicles: 1,
    drivers: 1,
    fleetAssets: 1,
    corporateSeats: 1,
    monthlyBookings: 25,
    apiAccess: false,
    priorityMatching: false,
    shipmentCommissionDiscount: 0,
    rentalCommissionDiscount: 0,
    features: '',
    sortOrder: 100,
    active: true
  });
  const [ruleForm, setRuleForm] = useState({
    code: 'shipment_custom',
    name: 'Shipment Custom Rule',
    target: 'shipment',
    audience: 'all',
    paymentMethod: 'all',
    accountTier: 'all',
    platformFeeRate: 0.12,
    transporterCommissionRate: 0.15,
    rentalCommissionRate: 0.10,
    minimumFee: 5,
    maximumFee: '',
    priority: 50,
    effectiveFrom: '',
    effectiveTo: '',
    notes: '',
    enabled: true
  });
  const [payoutForm, setPayoutForm] = useState({
    status: 'pending',
    method: 'bank_transfer',
    gatewayReference: '',
    failureReason: '',
    accountName: '',
    accountNumber: '',
    bankName: '',
    phone: ''
  });

  const loadMonetization = async () => {
    setLoading(true);
    try {
      setMonetizationMessage('');
      const response = await adminAPI.getMonetization();
      setData(response.data || {});
    } catch (error) {
      setMonetizationMessage(error.message || 'Unable to load monetization settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonetization();
  }, []);

  const updatePlanField = (field, value) => setPlanForm(form => ({ ...form, [field]: value }));
  const updateRuleField = (field, value) => setRuleForm(form => ({ ...form, [field]: value }));
  const updateSubscriptionField = (field, value) => setSubscriptionForm(form => ({ ...form, [field]: value }));

  const formatDateInput = (value) => {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
  };

  const getPlanId = (plan) => plan?._id || plan?.id || '';
  const getUserId = (user) => user?._id || user?.id || '';

  const resetPlanForm = () => {
    setEditingPlan(null);
    setPlanForm({
      code: 'transporter_custom',
      name: 'Transporter Custom',
      audience: 'transporter',
      description: '',
      price: 25,
      currency: 'USD',
      billingCycle: 'monthly',
      trialDays: 0,
      vehicles: 1,
      drivers: 1,
      fleetAssets: 1,
      corporateSeats: 1,
      monthlyBookings: 25,
      apiAccess: false,
      priorityMatching: false,
      shipmentCommissionDiscount: 0,
      rentalCommissionDiscount: 0,
      features: '',
      sortOrder: 100,
      active: true
    });
  };

  const openPlanBuilder = (plan = null) => {
    if (!plan) {
      resetPlanForm();
      setShowPlanBuilder(true);
      return;
    }

    setEditingPlan(plan);
    setPlanForm({
      code: plan.code || '',
      name: plan.name || '',
      audience: plan.audience || 'transporter',
      description: plan.description || '',
      price: plan.price ?? 0,
      currency: plan.currency || 'USD',
      billingCycle: plan.billingCycle || 'monthly',
      trialDays: plan.trialDays ?? 0,
      vehicles: plan.limits?.vehicles ?? 1,
      drivers: plan.limits?.drivers ?? 1,
      fleetAssets: plan.limits?.fleetAssets ?? 1,
      corporateSeats: plan.limits?.corporateSeats ?? 1,
      monthlyBookings: plan.limits?.monthlyBookings ?? 25,
      apiAccess: Boolean(plan.limits?.apiAccess),
      priorityMatching: Boolean(plan.limits?.priorityMatching),
      shipmentCommissionDiscount: plan.commissionAdjustments?.shipmentCommissionDiscount ?? 0,
      rentalCommissionDiscount: plan.commissionAdjustments?.rentalCommissionDiscount ?? 0,
      features: Array.isArray(plan.features) ? plan.features.join('\n') : '',
      sortOrder: plan.sortOrder ?? 100,
      active: Boolean(plan.active)
    });
    setShowPlanBuilder(true);
  };

  const resetRuleForm = () => {
    setEditingRule(null);
    setRuleForm({
      code: 'shipment_custom',
      name: 'Shipment Custom Rule',
      target: 'shipment',
      audience: 'all',
      paymentMethod: 'all',
      accountTier: 'all',
      platformFeeRate: 0.12,
      transporterCommissionRate: 0.15,
      rentalCommissionRate: 0.10,
      minimumFee: 5,
      maximumFee: '',
      priority: 50,
      effectiveFrom: '',
      effectiveTo: '',
      notes: '',
      enabled: true
    });
  };

  const openRuleBuilder = (rule = null) => {
    if (!rule) {
      resetRuleForm();
      setShowRuleBuilder(true);
      return;
    }

    setEditingRule(rule);
    setRuleForm({
      code: rule.code || '',
      name: rule.name || '',
      target: rule.target || 'shipment',
      audience: rule.audience || 'all',
      paymentMethod: rule.paymentMethod || 'all',
      accountTier: rule.accountTier || 'all',
      platformFeeRate: rule.platformFeeRate ?? 0,
      transporterCommissionRate: rule.transporterCommissionRate ?? 0,
      rentalCommissionRate: rule.rentalCommissionRate ?? 0,
      minimumFee: rule.minimumFee ?? 0,
      maximumFee: rule.maximumFee ?? '',
      priority: rule.priority ?? 100,
      effectiveFrom: formatDateInput(rule.effectiveFrom),
      effectiveTo: formatDateInput(rule.effectiveTo),
      notes: rule.notes || '',
      enabled: Boolean(rule.enabled)
    });
    setShowRuleBuilder(true);
  };

  const openPayoutManager = (payout, nextStatus = '') => {
    setEditingPayout(payout);
    setPayoutForm({
      status: nextStatus || payout.status || 'pending',
      method: payout.method || 'bank_transfer',
      gatewayReference: payout.gatewayReference || '',
      failureReason: payout.failureReason || '',
      accountName: payout.destination?.accountName || '',
      accountNumber: payout.destination?.accountNumber || '',
      bankName: payout.destination?.bankName || '',
      phone: payout.destination?.phone || ''
    });
    setShowPayoutManager(true);
  };

  const loadSubscriptionUsers = async () => {
    try {
      const response = await adminAPI.getUsers({ limit: 200 });
      setSubscriptionUsers(response.data || []);
    } catch (error) {
      setSubscriptionUsers([]);
      setMonetizationMessage(error.message || 'Unable to load users for subscription management.');
    }
  };

  const openSubscriptionManager = async (subscription = null) => {
    const plans = data.plans || [];
    const selectedPlan = subscription?.plan || plans[0] || {};
    const defaultPeriodEnd = new Date();
    defaultPeriodEnd.setMonth(defaultPeriodEnd.getMonth() + 1);

    setEditingSubscription(subscription);
    setSubscriptionForm({
      user: getUserId(subscription?.user),
      plan: getPlanId(selectedPlan),
      status: subscription?.status || 'active',
      paymentStatus: subscription?.payment?.status || (Number(selectedPlan.price || 0) > 0 ? 'pending' : 'not_required'),
      paymentMethod: subscription?.payment?.method || '',
      paymentReference: subscription?.payment?.reference || '',
      amount: subscription?.amount ?? selectedPlan.price ?? '',
      currency: subscription?.currency || selectedPlan.currency || 'USD',
      currentPeriodEnd: formatDateInput(subscription?.currentPeriodEnd || defaultPeriodEnd),
      nextBillingAt: formatDateInput(subscription?.nextBillingAt || subscription?.currentPeriodEnd || defaultPeriodEnd),
      seatsIncluded: subscription?.seats?.included || selectedPlan.limits?.corporateSeats || 1,
      seatsUsed: subscription?.seats?.used || 1
    });
    await loadSubscriptionUsers();
    setShowSubscriptionManager(true);
  };

  const handleSubscriptionPlanChange = (planId) => {
    const plan = (data.plans || []).find(item => getPlanId(item) === planId);
    setSubscriptionForm(form => ({
      ...form,
      plan: planId,
      amount: plan?.price ?? form.amount,
      currency: plan?.currency || form.currency,
      paymentStatus: Number(plan?.price || 0) > 0 ? form.paymentStatus || 'pending' : 'not_required',
      seatsIncluded: plan?.limits?.corporateSeats || form.seatsIncluded || 1
    }));
  };

  const savePlan = async () => {
    try {
      const payload = {
        ...planForm,
        price: Number(planForm.price),
        trialDays: Number(planForm.trialDays),
        sortOrder: Number(planForm.sortOrder || 100),
        currency: String(planForm.currency || 'USD').toUpperCase(),
        features: String(planForm.features || '')
          .split('\n')
          .map(feature => feature.trim())
          .filter(Boolean),
        limits: {
          vehicles: Number(planForm.vehicles || 1),
          drivers: Number(planForm.drivers || 1),
          fleetAssets: Number(planForm.fleetAssets || 1),
          corporateSeats: Number(planForm.corporateSeats || 1),
          monthlyBookings: Number(planForm.monthlyBookings || 25),
          apiAccess: Boolean(planForm.apiAccess),
          priorityMatching: Boolean(planForm.priorityMatching)
        },
        commissionAdjustments: {
          shipmentCommissionDiscount: Number(planForm.shipmentCommissionDiscount || 0),
          rentalCommissionDiscount: Number(planForm.rentalCommissionDiscount || 0)
        }
      };
      if (editingPlan) await adminAPI.updatePlan(editingPlan._id, payload);
      else await adminAPI.savePlan(payload);
      await loadMonetization();
      setMonetizationMessage(editingPlan ? 'Plan updated.' : 'Plan saved.');
      setShowPlanBuilder(false);
      setEditingPlan(null);
    } catch (error) {
      setMonetizationMessage(error.message || 'Unable to save plan.');
    }
  };

  const saveCommissionRule = async () => {
    try {
      const payload = {
        ...ruleForm,
        platformFeeRate: Number(ruleForm.platformFeeRate),
        transporterCommissionRate: Number(ruleForm.transporterCommissionRate),
        rentalCommissionRate: Number(ruleForm.rentalCommissionRate),
        minimumFee: Number(ruleForm.minimumFee),
        maximumFee: ruleForm.maximumFee === '' ? null : Number(ruleForm.maximumFee),
        priority: Number(ruleForm.priority),
        effectiveFrom: ruleForm.effectiveFrom || null,
        effectiveTo: ruleForm.effectiveTo || null
      };
      if (editingRule) await adminAPI.updateCommissionRule(editingRule._id, payload);
      else await adminAPI.saveCommissionRule(payload);
      await loadMonetization();
      setMonetizationMessage(editingRule ? 'Commission rule updated.' : 'Commission rule saved.');
      setShowRuleBuilder(false);
      setEditingRule(null);
    } catch (error) {
      setMonetizationMessage(error.message || 'Unable to save commission rule.');
    }
  };

  const togglePlan = async (plan) => {
    await adminAPI.updatePlan(plan._id, { active: !plan.active });
    await loadMonetization();
  };

  const toggleRule = async (rule) => {
    await adminAPI.updateCommissionRule(rule._id, { enabled: !rule.enabled });
    await loadMonetization();
  };

  const updateSubscriptionStatus = async (subscription, status) => {
    await adminAPI.updateSubscription(subscription._id, { status });
    await loadMonetization();
  };

  const markSubscriptionPaid = async (subscription) => {
    await adminAPI.updateSubscription(subscription._id, {
      status: 'active',
      payment: {
        ...(subscription.payment || {}),
        status: 'paid',
        paidAt: new Date().toISOString(),
        reference: subscription.payment?.reference || `ADMIN-${Date.now()}`
      }
    });
    await loadMonetization();
  };

  const saveManagedSubscription = async () => {
    if (!subscriptionForm.user || !subscriptionForm.plan) {
      setMonetizationMessage('Select both a subscriber and a plan.');
      return;
    }

    const plan = (data.plans || []).find(item => getPlanId(item) === subscriptionForm.plan);
    const payload = {
      user: subscriptionForm.user,
      plan: subscriptionForm.plan,
      status: subscriptionForm.status,
      billingCycle: plan?.billingCycle,
      amount: Number(subscriptionForm.amount || 0),
      currency: subscriptionForm.currency || plan?.currency || 'USD',
      currentPeriodEnd: subscriptionForm.currentPeriodEnd || undefined,
      nextBillingAt: subscriptionForm.nextBillingAt || undefined,
      payment: {
        status: subscriptionForm.paymentStatus,
        method: subscriptionForm.paymentMethod || undefined,
        reference: subscriptionForm.paymentReference || undefined,
        paidAt: subscriptionForm.paymentStatus === 'paid' ? new Date().toISOString() : undefined
      },
      seats: {
        included: Number(subscriptionForm.seatsIncluded || 1),
        used: Number(subscriptionForm.seatsUsed || 1)
      }
    };

    try {
      if (editingSubscription) {
        await adminAPI.updateSubscription(editingSubscription._id, payload);
        setMonetizationMessage('Subscription updated.');
      } else {
        await adminAPI.createSubscription(payload);
        setMonetizationMessage('Subscription assigned.');
      }
      setShowSubscriptionManager(false);
      setEditingSubscription(null);
      await loadMonetization();
    } catch (error) {
      setMonetizationMessage(error.message || 'Unable to save subscription.');
    }
  };

  const saveManagedPayout = async () => {
    if (!editingPayout) return;
    if (['failed', 'cancelled'].includes(payoutForm.status) && !payoutForm.failureReason.trim()) {
      setMonetizationMessage(`Add a reason before marking payout ${payoutForm.status}.`);
      return;
    }

    const payload = {
      status: payoutForm.status,
      method: payoutForm.method,
      gatewayReference: payoutForm.gatewayReference || undefined,
      failureReason: payoutForm.failureReason || undefined,
      destination: {
        accountName: payoutForm.accountName || undefined,
        accountNumber: payoutForm.accountNumber || undefined,
        bankName: payoutForm.bankName || undefined,
        phone: payoutForm.phone || undefined
      }
    };

    try {
      await adminAPI.updatePayout(editingPayout._id, payload);
      setMonetizationMessage(`Payout ${editingPayout.payoutReference} updated.`);
      setShowPayoutManager(false);
      setEditingPayout(null);
      await loadMonetization();
    } catch (error) {
      setMonetizationMessage(error.message || 'Unable to update payout.');
    }
  };

  const ledgerTotals = (data.ledgerSummary || []).reduce((acc, item) => {
    const key = `${item._id.direction}_${item._id.category}`;
    acc[key] = item.total;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="admin-content">
        <div className="loading-state"><RefreshCw className="icon spinning" /><p>Loading monetization...</p></div>
      </div>
    );
  }

  return (
    <>
      <div className="admin-topbar">
        <div className="topbar-content">
          <div className="topbar-left">
            <h1 className="page-title">Monetization</h1>
            <p className="page-subtitle">Manage platform plans, subscriptions, commissions, ledger and payouts</p>
          </div>
          <div className="topbar-right">
            <button className="btn-secondary" onClick={loadMonetization}><RefreshCw className="icon" /> Refresh</button>
          </div>
        </div>
      </div>

      <div className="admin-content">
        {monetizationMessage && (
          <div className="integration-message">
            <AlertCircle className="icon" />
            <span>{monetizationMessage}</span>
          </div>
        )}
        <div className="stats-grid stats-grid-4">
          <StatCard title="Platform Fees" value={`$${Number(ledgerTotals.credit_platform_fee || 0).toLocaleString()}`} icon={<DollarSign className="icon" />} color="success" />
          <StatCard title="Commissions" value={`$${Number(ledgerTotals.credit_commission || 0).toLocaleString()}`} icon={<TrendingUp className="icon" />} color="primary" />
          <StatCard title="Subscriptions" value={`$${Number(ledgerTotals.credit_subscription_fee || 0).toLocaleString()}`} icon={<CreditCard className="icon" />} color="accent" />
          <StatCard title="Payouts" value={`$${Number(ledgerTotals.debit_payout || 0).toLocaleString()}`} icon={<Truck className="icon" />} color="secondary" />
        </div>

        <div className="builder-actions-grid">
          <div className="builder-action-card">
            <div className="builder-action-icon">
              <CreditCard className="icon" />
            </div>
            <div>
              <h3>Plan Builder</h3>
              <p>Create subscription plans, limits, billing cycle, and availability for each account type.</p>
            </div>
            <button className="btn-primary" onClick={() => openPlanBuilder()}>Open Plan Builder</button>
          </div>

          <div className="builder-action-card">
            <div className="builder-action-icon">
              <TrendingUp className="icon" />
            </div>
            <div>
              <h3>Commission Rule Builder</h3>
              <p>Configure platform fees, transporter commissions, rental rates, payment methods, and priority.</p>
            </div>
            <button className="btn-primary" onClick={() => openRuleBuilder()}>Open Rule Builder</button>
          </div>

          <div className="builder-action-card">
            <div className="builder-action-icon">
              <Users className="icon" />
            </div>
            <div>
              <h3>Subscription Manager</h3>
              <p>Assign plans to users, update subscriber billing status, payment confirmation, seats, and renewal dates.</p>
            </div>
            <button className="btn-primary" onClick={() => openSubscriptionManager()}>Manage Subscription</button>
          </div>
        </div>

        <div className="data-table-container">
          <h3>Plans</h3>
          <table className="data-table">
            <thead><tr><th>Plan</th><th>Audience</th><th>Price</th><th>Cycle</th><th>Limits</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {(data.plans || []).map(plan => (
                <tr key={plan._id}>
                  <td>{plan.name}<br /><span className="booking-ref">{plan.code}</span></td>
                  <td>{plan.audience}</td>
                  <td>${plan.price}</td>
                  <td>{plan.billingCycle}</td>
                  <td>{plan.limits?.vehicles || 0} vehicles / {plan.limits?.fleetAssets || 0} assets / {plan.limits?.corporateSeats || 0} seats</td>
                  <td>{plan.active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-secondary" onClick={() => openPlanBuilder(plan)}>Edit</button>
                      <button className="btn-secondary" onClick={() => togglePlan(plan)}>{plan.active ? 'Disable' : 'Enable'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="data-table-container">
          <h3>Commission Rules</h3>
          <table className="data-table">
            <thead><tr><th>Rule</th><th>Target</th><th>Audience</th><th>Payment</th><th>Platform</th><th>Transporter</th><th>Rental</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {(data.commissionRules || []).map(rule => (
                <tr key={rule._id}>
                  <td>{rule.name}<br /><span className="booking-ref">{rule.code}</span></td>
                  <td>{rule.target}</td>
                  <td>{rule.audience}</td>
                  <td>{rule.paymentMethod}</td>
                  <td>{Number(rule.platformFeeRate * 100).toFixed(1)}%</td>
                  <td>{Number(rule.transporterCommissionRate * 100).toFixed(1)}%</td>
                  <td>{Number(rule.rentalCommissionRate * 100).toFixed(1)}%</td>
                  <td>{rule.enabled ? 'Enabled' : 'Disabled'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-secondary" onClick={() => openRuleBuilder(rule)}>Edit</button>
                      <button className="btn-secondary" onClick={() => toggleRule(rule)}>{rule.enabled ? 'Disable' : 'Enable'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="data-table-container">
          <div className="table-section-header">
            <h3>Subscriptions</h3>
            <button className="btn-primary" onClick={() => openSubscriptionManager()}>Assign Subscription</button>
          </div>
          <table className="data-table">
            <thead><tr><th>User</th><th>Plan</th><th>Status</th><th>Payment</th><th>Amount</th><th>Next Billing</th><th>Actions</th></tr></thead>
            <tbody>
              {(data.subscriptions || []).map(subscription => (
                <tr key={subscription._id}>
                  <td>{subscription.user?.fullName || subscription.user?.email || 'N/A'}</td>
                  <td>{subscription.plan?.name || 'N/A'}</td>
                  <td>{subscription.status}</td>
                  <td>{subscription.payment?.status || 'pending'}</td>
                  <td>${subscription.amount}</td>
                  <td>{subscription.nextBillingAt ? new Date(subscription.nextBillingAt).toLocaleDateString() : 'N/A'}</td>
                  <td>
                    {subscription.payment?.status !== 'paid' && (
                      <button className="btn-success" onClick={() => markSubscriptionPaid(subscription)}>Mark Paid</button>
                    )}
                    <button className="btn-secondary" onClick={() => openSubscriptionManager(subscription)}>Manage</button>
                    <button className="btn-secondary" onClick={() => updateSubscriptionStatus(subscription, 'active')}>Activate</button>
                    <button className="btn-danger" onClick={() => updateSubscriptionStatus(subscription, 'suspended')}>Suspend</button>
                  </td>
                </tr>
              ))}
              {!(data.subscriptions || []).length && <tr><td colSpan="7">No subscriptions yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="data-table-container">
          <h3>Payouts</h3>
          <table className="data-table">
            <thead><tr><th>Reference</th><th>Recipient</th><th>Source</th><th>Amount</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {(data.payouts || []).map(payout => (
                <tr key={payout._id}>
                  <td>{payout.payoutReference}</td>
                  <td>{payout.recipient?.fullName || payout.recipient?.email || 'N/A'}</td>
                  <td>{payout.sourceType}</td>
                  <td>${payout.amount}</td>
                  <td>{payout.status}</td>
                  <td>
                    <div className="table-actions">
                      <button className="btn-secondary" onClick={() => openPayoutManager(payout)}>Manage</button>
                      {payout.status === 'pending' && (
                        <button className="btn-secondary" onClick={() => openPayoutManager(payout, 'approved')}>Approve</button>
                      )}
                      {['approved', 'processing'].includes(payout.status) && (
                        <button className="btn-success" onClick={() => openPayoutManager(payout, 'paid')}>Mark Paid</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!(data.payouts || []).length && <tr><td colSpan="6">No payouts yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showPayoutManager && editingPayout && (
        <div className="modal-overlay" onClick={() => { setShowPayoutManager(false); setEditingPayout(null); }}>
          <div className="modal-content builder-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header builder-modal-header">
              <div>
                <p className="modal-kicker">Payouts</p>
                <h2>Manage Payout</h2>
              </div>
              <button className="modal-close" onClick={() => { setShowPayoutManager(false); setEditingPayout(null); }}>
                <XCircle className="icon" />
              </button>
            </div>
            <div className="modal-body">
              <div className="payout-summary-card">
                <div>
                  <span>Reference</span>
                  <strong>{editingPayout.payoutReference}</strong>
                </div>
                <div>
                  <span>Recipient</span>
                  <strong>{editingPayout.recipient?.fullName || editingPayout.recipient?.email || 'N/A'}</strong>
                </div>
                <div>
                  <span>Amount</span>
                  <strong>{editingPayout.currency || 'USD'} {Number(editingPayout.amount || 0).toLocaleString()}</strong>
                </div>
                <div>
                  <span>Current Status</span>
                  <strong>{editingPayout.status}</strong>
                </div>
              </div>
              <div className="builder-form-grid">
                <label>
                  Payout Status
                  <select value={payoutForm.status} onChange={event => setPayoutForm(form => ({ ...form, status: event.target.value }))}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="processing">Processing</option>
                    <option value="paid">Paid</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </label>
                <label>
                  Method
                  <select value={payoutForm.method} onChange={event => setPayoutForm(form => ({ ...form, method: event.target.value }))}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="ecocash">EcoCash</option>
                    <option value="onemoney">OneMoney</option>
                    <option value="cash">Cash</option>
                    <option value="openapi_africa">ClicknPay</option>
                  </select>
                </label>
                <label>
                  Gateway Reference
                  <input value={payoutForm.gatewayReference} onChange={event => setPayoutForm(form => ({ ...form, gatewayReference: event.target.value }))} placeholder="Processor reference" />
                </label>
                <label>
                  Phone
                  <input value={payoutForm.phone} onChange={event => setPayoutForm(form => ({ ...form, phone: event.target.value }))} placeholder="+263..." />
                </label>
                <label>
                  Account Name
                  <input value={payoutForm.accountName} onChange={event => setPayoutForm(form => ({ ...form, accountName: event.target.value }))} placeholder="Recipient name" />
                </label>
                <label>
                  Account Number
                  <input value={payoutForm.accountNumber} onChange={event => setPayoutForm(form => ({ ...form, accountNumber: event.target.value }))} placeholder="Bank or wallet account" />
                </label>
                <label>
                  Bank Name
                  <input value={payoutForm.bankName} onChange={event => setPayoutForm(form => ({ ...form, bankName: event.target.value }))} placeholder="Bank name" />
                </label>
                <label className="builder-field-wide">
                  Failure / Cancellation Reason
                  <textarea value={payoutForm.failureReason} onChange={event => setPayoutForm(form => ({ ...form, failureReason: event.target.value }))} placeholder="Required when failing or cancelling a payout" rows="4" />
                </label>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => { setShowPayoutManager(false); setEditingPayout(null); }}>Cancel</button>
                <button className="btn-primary" onClick={saveManagedPayout}>Save Payout</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPlanBuilder && (
        <div className="modal-overlay" onClick={() => { setShowPlanBuilder(false); setEditingPlan(null); }}>
          <div className="modal-content builder-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header builder-modal-header">
              <div>
                <p className="modal-kicker">Monetization</p>
                <h2>{editingPlan ? 'Edit Plan' : 'Plan Builder'}</h2>
              </div>
              <button className="modal-close" onClick={() => { setShowPlanBuilder(false); setEditingPlan(null); }}>
                <XCircle className="icon" />
              </button>
            </div>
            <div className="modal-body">
              <div className="builder-form-grid">
                <label>
                  Plan Code
                  <input value={planForm.code} onChange={e => updatePlanField('code', e.target.value)} placeholder="transporter_growth" />
                </label>
                <label>
                  Plan Name
                  <input value={planForm.name} onChange={e => updatePlanField('name', e.target.value)} placeholder="Transporter Growth" />
                </label>
                <label className="builder-field-wide">
                  Description
                  <input value={planForm.description} onChange={e => updatePlanField('description', e.target.value)} placeholder="Short public plan description" />
                </label>
                <label>
                  Audience
                  <select value={planForm.audience} onChange={e => updatePlanField('audience', e.target.value)}>
                    <option value="transporter">Transporter</option>
                    <option value="trailer_owner">Trailer Owner</option>
                    <option value="corporate">Corporate</option>
                    <option value="shipper">Shipper</option>
                  </select>
                </label>
                <label>
                  Billing Cycle
                  <select value={planForm.billingCycle} onChange={e => updatePlanField('billingCycle', e.target.value)}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </select>
                </label>
                <label>
                  Price
                  <input type="number" min="0" value={planForm.price} onChange={e => updatePlanField('price', e.target.value)} placeholder="25" />
                </label>
                <label>
                  Currency
                  <input value={planForm.currency} onChange={e => updatePlanField('currency', e.target.value.toUpperCase())} placeholder="USD" />
                </label>
                <label>
                  Trial Days
                  <input type="number" min="0" value={planForm.trialDays} onChange={e => updatePlanField('trialDays', e.target.value)} placeholder="0" />
                </label>
                <label>
                  Vehicle Limit
                  <input type="number" min="0" value={planForm.vehicles || ''} onChange={e => updatePlanField('vehicles', e.target.value)} placeholder="1" />
                </label>
                <label>
                  Driver Limit
                  <input type="number" min="0" value={planForm.drivers || ''} onChange={e => updatePlanField('drivers', e.target.value)} placeholder="1" />
                </label>
                <label>
                  Fleet Asset Limit
                  <input type="number" min="0" value={planForm.fleetAssets || ''} onChange={e => updatePlanField('fleetAssets', e.target.value)} placeholder="15" />
                </label>
                <label>
                  Corporate Seats
                  <input type="number" min="0" value={planForm.corporateSeats || ''} onChange={e => updatePlanField('corporateSeats', e.target.value)} placeholder="25" />
                </label>
                <label>
                  Monthly Bookings
                  <input type="number" min="0" value={planForm.monthlyBookings || ''} onChange={e => updatePlanField('monthlyBookings', e.target.value)} placeholder="25" />
                </label>
                <label>
                  Shipment Commission Discount
                  <input type="number" min="0" step="0.01" value={planForm.shipmentCommissionDiscount || ''} onChange={e => updatePlanField('shipmentCommissionDiscount', e.target.value)} placeholder="0.03" />
                </label>
                <label>
                  Rental Commission Discount
                  <input type="number" min="0" step="0.01" value={planForm.rentalCommissionDiscount || ''} onChange={e => updatePlanField('rentalCommissionDiscount', e.target.value)} placeholder="0.02" />
                </label>
                <label>
                  Sort Order
                  <input type="number" min="0" value={planForm.sortOrder || ''} onChange={e => updatePlanField('sortOrder', e.target.value)} placeholder="100" />
                </label>
                <label className="builder-field-wide">
                  Features
                  <textarea value={planForm.features || ''} onChange={e => updatePlanField('features', e.target.value)} placeholder="One feature per line" rows="4" />
                </label>
                <label className="builder-checkbox">
                  <input type="checkbox" checked={Boolean(planForm.priorityMatching)} onChange={e => updatePlanField('priorityMatching', e.target.checked)} />
                  Priority matching
                </label>
                <label className="builder-checkbox">
                  <input type="checkbox" checked={Boolean(planForm.apiAccess)} onChange={e => updatePlanField('apiAccess', e.target.checked)} />
                  API access
                </label>
                <label className="builder-checkbox">
                  <input type="checkbox" checked={Boolean(planForm.active)} onChange={e => updatePlanField('active', e.target.checked)} />
                  Active plan
                </label>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => { setShowPlanBuilder(false); setEditingPlan(null); }}>Cancel</button>
                <button className="btn-primary" onClick={savePlan}>{editingPlan ? 'Update Plan' : 'Save Plan'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showRuleBuilder && (
        <div className="modal-overlay" onClick={() => { setShowRuleBuilder(false); setEditingRule(null); }}>
          <div className="modal-content builder-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header builder-modal-header">
              <div>
                <p className="modal-kicker">Monetization</p>
                <h2>{editingRule ? 'Edit Commission Rule' : 'Commission Rule Builder'}</h2>
              </div>
              <button className="modal-close" onClick={() => { setShowRuleBuilder(false); setEditingRule(null); }}>
                <XCircle className="icon" />
              </button>
            </div>
            <div className="modal-body">
              <div className="builder-form-grid">
                <label>
                  Rule Code
                  <input value={ruleForm.code} onChange={e => updateRuleField('code', e.target.value)} placeholder="shipment_custom" />
                </label>
                <label>
                  Rule Name
                  <input value={ruleForm.name} onChange={e => updateRuleField('name', e.target.value)} placeholder="Shipment Custom Rule" />
                </label>
                <label>
                  Target
                  <select value={ruleForm.target} onChange={e => updateRuleField('target', e.target.value)}>
                    <option value="shipment">Shipment</option>
                    <option value="rental">Rental</option>
                    <option value="subscription">Subscription</option>
                  </select>
                </label>
                <label>
                  Audience
                  <select value={ruleForm.audience} onChange={e => updateRuleField('audience', e.target.value)}>
                    <option value="all">All</option>
                    <option value="shipper">Shipper</option>
                    <option value="transporter">Transporter</option>
                    <option value="trailer_owner">Trailer Owner</option>
                    <option value="corporate">Corporate</option>
                  </select>
                </label>
                <label>
                  Payment Method
                  <input value={ruleForm.paymentMethod} onChange={e => updateRuleField('paymentMethod', e.target.value)} placeholder="all/openapi_africa/cash_on_delivery" />
                </label>
                <label>
                  Account Tier
                  <input value={ruleForm.accountTier} onChange={e => updateRuleField('accountTier', e.target.value)} placeholder="all/transporter_growth" />
                </label>
                <label>
                  Platform Fee Rate
                  <input type="number" step="0.01" min="0" value={ruleForm.platformFeeRate} onChange={e => updateRuleField('platformFeeRate', e.target.value)} placeholder="0.12" />
                </label>
                <label>
                  Transporter Commission Rate
                  <input type="number" step="0.01" min="0" value={ruleForm.transporterCommissionRate} onChange={e => updateRuleField('transporterCommissionRate', e.target.value)} placeholder="0.15" />
                </label>
                <label>
                  Rental Commission Rate
                  <input type="number" step="0.01" min="0" value={ruleForm.rentalCommissionRate} onChange={e => updateRuleField('rentalCommissionRate', e.target.value)} placeholder="0.10" />
                </label>
                <label>
                  Minimum Fee
                  <input type="number" min="0" value={ruleForm.minimumFee} onChange={e => updateRuleField('minimumFee', e.target.value)} placeholder="5" />
                </label>
                <label>
                  Maximum Fee
                  <input type="number" min="0" value={ruleForm.maximumFee} onChange={e => updateRuleField('maximumFee', e.target.value)} placeholder="Optional cap" />
                </label>
                <label>
                  Priority
                  <input type="number" min="0" value={ruleForm.priority} onChange={e => updateRuleField('priority', e.target.value)} placeholder="50" />
                </label>
                <label>
                  Effective From
                  <input type="date" value={ruleForm.effectiveFrom} onChange={e => updateRuleField('effectiveFrom', e.target.value)} />
                </label>
                <label>
                  Effective To
                  <input type="date" value={ruleForm.effectiveTo} onChange={e => updateRuleField('effectiveTo', e.target.value)} />
                </label>
                <label className="builder-field-wide">
                  Notes
                  <textarea value={ruleForm.notes} onChange={e => updateRuleField('notes', e.target.value)} placeholder="Internal notes for this rule" rows="4" />
                </label>
                <label className="builder-checkbox">
                  <input type="checkbox" checked={Boolean(ruleForm.enabled)} onChange={e => updateRuleField('enabled', e.target.checked)} />
                  Enabled
                </label>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => { setShowRuleBuilder(false); setEditingRule(null); }}>Cancel</button>
                <button className="btn-primary" onClick={saveCommissionRule}>{editingRule ? 'Update Rule' : 'Save Commission Rule'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSubscriptionManager && (
        <div className="modal-overlay" onClick={() => setShowSubscriptionManager(false)}>
          <div className="modal-content builder-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header builder-modal-header">
              <div>
                <p className="modal-kicker">Subscribers</p>
                <h2>{editingSubscription ? 'Manage Subscription' : 'Assign Subscription'}</h2>
              </div>
              <button className="modal-close" onClick={() => setShowSubscriptionManager(false)}>
                <XCircle className="icon" />
              </button>
            </div>
            <div className="modal-body">
              <div className="builder-form-grid">
                <label>
                  Subscriber
                  <select
                    value={subscriptionForm.user}
                    onChange={event => updateSubscriptionField('user', event.target.value)}
                    disabled={Boolean(editingSubscription)}
                  >
                    <option value="">Select a user</option>
                    {subscriptionUsers.map(user => (
                      <option key={getUserId(user)} value={getUserId(user)}>
                        {user.fullName || user.companyName || user.email} - {user.userType}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Plan
                  <select value={subscriptionForm.plan} onChange={event => handleSubscriptionPlanChange(event.target.value)}>
                    <option value="">Select a plan</option>
                    {(data.plans || []).map(plan => (
                      <option key={getPlanId(plan)} value={getPlanId(plan)}>
                        {plan.name} - {plan.audience} - {plan.currency || 'USD'} {plan.price}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Subscription Status
                  <select value={subscriptionForm.status} onChange={event => updateSubscriptionField('status', event.target.value)}>
                    <option value="trialing">Trialing</option>
                    <option value="active">Active</option>
                    <option value="past_due">Past Due</option>
                    <option value="suspended">Suspended</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="expired">Expired</option>
                  </select>
                </label>
                <label>
                  Payment Status
                  <select value={subscriptionForm.paymentStatus} onChange={event => updateSubscriptionField('paymentStatus', event.target.value)}>
                    <option value="not_required">Not Required</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="failed">Failed</option>
                    <option value="waived">Waived</option>
                  </select>
                </label>
                <label>
                  Amount
                  <input type="number" min="0" step="0.01" value={subscriptionForm.amount} onChange={event => updateSubscriptionField('amount', event.target.value)} />
                </label>
                <label>
                  Currency
                  <input value={subscriptionForm.currency} onChange={event => updateSubscriptionField('currency', event.target.value.toUpperCase())} />
                </label>
                <label>
                  Current Period End
                  <input type="date" value={subscriptionForm.currentPeriodEnd} onChange={event => updateSubscriptionField('currentPeriodEnd', event.target.value)} />
                </label>
                <label>
                  Next Billing
                  <input type="date" value={subscriptionForm.nextBillingAt} onChange={event => updateSubscriptionField('nextBillingAt', event.target.value)} />
                </label>
                <label>
                  Payment Method
                  <input value={subscriptionForm.paymentMethod} onChange={event => updateSubscriptionField('paymentMethod', event.target.value)} placeholder="ecocash, clicknpay, bank_transfer" />
                </label>
                <label>
                  Payment Reference
                  <input value={subscriptionForm.paymentReference} onChange={event => updateSubscriptionField('paymentReference', event.target.value)} placeholder="ADMIN-..." />
                </label>
                <label>
                  Seats Included
                  <input type="number" min="1" value={subscriptionForm.seatsIncluded} onChange={event => updateSubscriptionField('seatsIncluded', event.target.value)} />
                </label>
                <label>
                  Seats Used
                  <input type="number" min="1" value={subscriptionForm.seatsUsed} onChange={event => updateSubscriptionField('seatsUsed', event.target.value)} />
                </label>
              </div>
              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setShowSubscriptionManager(false)}>Cancel</button>
                <button className="btn-primary" onClick={saveManagedSubscription}>
                  {editingSubscription ? 'Save Subscription' : 'Assign Subscription'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

// ============ Insurance View ============
const emptyInsuranceProduct = {
  productCode: '',
  productName: '',
  coverageType: 'standard',
  coveragePercentage: 85,
  premiumRate: 0.015,
  minPremium: 10,
  excessAmount: 0,
  maxCoverage: 0,
  claimProcessingDays: 10,
  cargoTypes: 'general',
  exclusions: '',
  active: true
};

const emptyInsuranceProvider = {
  name: '',
  code: '',
  displayName: '',
  description: '',
  email: '',
  phone: '',
  claimsEmail: '',
  claimsPhone: '',
  website: '',
  commissionRate: 0.15,
  priority: 0,
  active: true,
  products: [{ ...emptyInsuranceProduct }]
};

const hydrateInsuranceProviderForm = (provider = null) => {
  if (!provider) return { ...emptyInsuranceProvider, products: [{ ...emptyInsuranceProduct }] };
  return {
    name: provider.name || '',
    code: provider.code || '',
    displayName: provider.displayName || '',
    description: provider.description || '',
    email: provider.contactInfo?.email || '',
    phone: provider.contactInfo?.phone || '',
    claimsEmail: provider.contactInfo?.claimsEmail || '',
    claimsPhone: provider.contactInfo?.claimsPhone || '',
    website: provider.contactInfo?.website || '',
    commissionRate: provider.commissionRate ?? 0.15,
    priority: provider.priority ?? 0,
    active: provider.active !== false,
    products: (provider.products?.length ? provider.products : [{ ...emptyInsuranceProduct }]).map(product => ({
      productCode: product.productCode || '',
      productName: product.productName || '',
      coverageType: product.coverageType || 'standard',
      coveragePercentage: product.coveragePercentage ?? 85,
      premiumRate: product.premiumRate ?? 0.015,
      minPremium: product.minPremium ?? 10,
      excessAmount: product.excessAmount ?? 0,
      maxCoverage: product.maxCoverage ?? 0,
      claimProcessingDays: product.claimProcessingDays ?? 10,
      cargoTypes: Array.isArray(product.cargoTypes) ? product.cargoTypes.join(', ') : product.cargoTypes || 'general',
      exclusions: Array.isArray(product.exclusions) ? product.exclusions.join('\n') : product.exclusions || '',
      active: product.active !== false
    }))
  };
};

const InsuranceView = () => {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [form, setForm] = useState(hydrateInsuranceProviderForm());

  const loadProviders = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getInsuranceProviders();
      setProviders(response.data || []);
      setMessage('');
    } catch (error) {
      setMessage(error.message || 'Unable to load insurance providers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProviders();
  }, []);

  const updateField = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const updateProduct = (index, field, value) => setForm(current => ({
    ...current,
    products: current.products.map((product, productIndex) => (
      productIndex === index ? { ...product, [field]: value } : product
    ))
  }));

  const openBuilder = (provider = null) => {
    setEditingProvider(provider);
    setForm(hydrateInsuranceProviderForm(provider));
    setShowBuilder(true);
  };

  const saveProvider = async () => {
    const payload = {
      ...form,
      products: form.products.map(product => ({
        ...product,
        coveragePercentage: Number(product.coveragePercentage || 0),
        premiumRate: Number(product.premiumRate || 0),
        minPremium: Number(product.minPremium || 0),
        excessAmount: Number(product.excessAmount || 0),
        maxCoverage: Number(product.maxCoverage || 0),
        claimProcessingDays: Number(product.claimProcessingDays || 0),
        cargoTypes: product.cargoTypes,
        exclusions: product.exclusions
      }))
    };

    try {
      if (editingProvider) await adminAPI.updateInsuranceProvider(editingProvider._id, payload);
      else await adminAPI.createInsuranceProvider(payload);
      setMessage(editingProvider ? 'Insurance provider updated.' : 'Insurance provider saved.');
      setShowBuilder(false);
      setEditingProvider(null);
      await loadProviders();
    } catch (error) {
      setMessage(error.message || 'Unable to save insurance provider.');
    }
  };

  const toggleProvider = async (provider) => {
    await adminAPI.updateInsuranceProvider(provider._id, {
      ...hydrateInsuranceProviderForm(provider),
      active: provider.active === false
    });
    await loadProviders();
  };

  return (
    <>
      <div className="admin-topbar">
        <div className="topbar-content">
          <div className="topbar-left">
            <h1 className="page-title">Insurance</h1>
            <p className="page-subtitle">Manage cargo insurers, service offerings, rates, and active quote products</p>
          </div>
          <div className="topbar-right">
            <button className="btn-secondary" onClick={loadProviders}><RefreshCw className="icon" /> Refresh</button>
            <button className="btn-primary" onClick={() => openBuilder()}>Add Provider</button>
          </div>
        </div>
      </div>

      <div className="admin-content">
        {message && <div className="alert-info">{message}</div>}
        <div className="data-table-container">
          <table className="data-table">
            <thead><tr><th>Provider</th><th>Products</th><th>Rates</th><th>Claims</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {providers.map(provider => (
                <tr key={provider._id}>
                  <td><strong>{provider.displayName}</strong><br /><small>{provider.contactInfo?.email || provider.code}</small></td>
                  <td>{provider.products?.length || 0}</td>
                  <td>{(provider.products || []).map(product => `${product.coverageType}: ${(Number(product.premiumRate || 0) * 100).toFixed(2)}%`).join(', ')}</td>
                  <td>{provider.contactInfo?.claimsEmail || provider.contactInfo?.claimsPhone || 'Not set'}</td>
                  <td>{provider.active === false ? 'Inactive' : 'Active'}</td>
                  <td className="action-buttons">
                    <button className="btn-secondary" onClick={() => openBuilder(provider)}><Edit className="icon" /> Edit</button>
                    <button className={provider.active === false ? 'btn-primary' : 'btn-danger'} onClick={() => toggleProvider(provider)}>
                      {provider.active === false ? 'Enable' : 'Disable'}
                    </button>
                  </td>
                </tr>
              ))}
              {!providers.length && <tr><td colSpan="6">{loading ? 'Loading providers...' : 'No insurance providers configured.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {showBuilder && (
        <div className="modal-overlay" onClick={() => setShowBuilder(false)}>
          <div className="modal-content builder-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header builder-modal-header">
              <div>
                <p className="modal-kicker">Insurance</p>
                <h2>{editingProvider ? 'Edit Provider' : 'Insurance Provider Builder'}</h2>
              </div>
              <button className="modal-close" onClick={() => setShowBuilder(false)}><XCircle className="icon" /></button>
            </div>
            <div className="modal-body">
              <div className="builder-form-grid">
                <label>Name<input value={form.name} onChange={(e) => updateField('name', e.target.value)} /></label>
                <label>Code<input value={form.code} onChange={(e) => updateField('code', e.target.value.toUpperCase())} /></label>
                <label>Display Name<input value={form.displayName} onChange={(e) => updateField('displayName', e.target.value)} /></label>
                <label>Email<input type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} /></label>
                <label>Phone<input value={form.phone} onChange={(e) => updateField('phone', e.target.value)} /></label>
                <label>Claims Email<input type="email" value={form.claimsEmail} onChange={(e) => updateField('claimsEmail', e.target.value)} /></label>
                <label>Claims Phone<input value={form.claimsPhone} onChange={(e) => updateField('claimsPhone', e.target.value)} /></label>
                <label>Website<input value={form.website} onChange={(e) => updateField('website', e.target.value)} /></label>
                <label>Commission Rate<input type="number" step="0.001" value={form.commissionRate} onChange={(e) => updateField('commissionRate', e.target.value)} /></label>
                <label>Priority<input type="number" value={form.priority} onChange={(e) => updateField('priority', e.target.value)} /></label>
                <label>Description<textarea value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={3} /></label>
              </div>

              <div className="builder-section-heading">
                <h3>Products And Rates</h3>
                <button className="btn-secondary" onClick={() => updateField('products', [...form.products, { ...emptyInsuranceProduct }])}>Add Product</button>
              </div>

              {form.products.map((product, index) => (
                <div className="builder-product-card" key={index}>
                  <div className="builder-form-grid">
                    <label>Product Code<input value={product.productCode} onChange={(e) => updateProduct(index, 'productCode', e.target.value.toUpperCase())} /></label>
                    <label>Product Name<input value={product.productName} onChange={(e) => updateProduct(index, 'productName', e.target.value)} /></label>
                    <label>Coverage<select value={product.coverageType} onChange={(e) => updateProduct(index, 'coverageType', e.target.value)}><option value="basic">Basic</option><option value="standard">Standard</option><option value="comprehensive">Comprehensive</option><option value="premium">Premium</option></select></label>
                    <label>Premium Rate<input type="number" step="0.001" value={product.premiumRate} onChange={(e) => updateProduct(index, 'premiumRate', e.target.value)} /></label>
                    <label>Coverage %<input type="number" value={product.coveragePercentage} onChange={(e) => updateProduct(index, 'coveragePercentage', e.target.value)} /></label>
                    <label>Min Premium<input type="number" value={product.minPremium} onChange={(e) => updateProduct(index, 'minPremium', e.target.value)} /></label>
                    <label>Excess<input type="number" value={product.excessAmount} onChange={(e) => updateProduct(index, 'excessAmount', e.target.value)} /></label>
                    <label>Max Cover<input type="number" value={product.maxCoverage} onChange={(e) => updateProduct(index, 'maxCoverage', e.target.value)} /></label>
                    <label>Claim Days<input type="number" value={product.claimProcessingDays} onChange={(e) => updateProduct(index, 'claimProcessingDays', e.target.value)} /></label>
                    <label>Cargo Types<input value={product.cargoTypes} onChange={(e) => updateProduct(index, 'cargoTypes', e.target.value)} placeholder="general, agricultural" /></label>
                    <label>Exclusions<textarea value={product.exclusions} onChange={(e) => updateProduct(index, 'exclusions', e.target.value)} rows={2} /></label>
                  </div>
                  <button className="btn-danger" onClick={() => updateField('products', form.products.filter((_, productIndex) => productIndex !== index))}>Remove Product</button>
                </div>
              ))}
            </div>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setShowBuilder(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveProvider}>Save Provider</button>
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

// ============ Support View ============
const SupportView = () => {
  const [tickets, setTickets] = useState([]);
  const [filterStatus, setFilterStatus] = useState('open');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [message, setMessage] = useState('');

  const loadTickets = useCallback(async () => {
    try {
      const response = await adminAPI.getSupportTickets(filterStatus === 'all' ? {} : { status: filterStatus });
      setTickets(response.data || []);
    } catch (error) {
      setMessage(error.message || 'Unable to load support tickets.');
      setTickets([]);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const updateTicketStatus = async (ticket, status) => {
    try {
      await adminAPI.updateSupportTicket(ticket._id, { status });
      setMessage(`Ticket ${ticket.ticketReference} marked ${status}.`);
      await loadTickets();
      if (selectedTicket?._id === ticket._id) {
        setSelectedTicket(null);
      }
    } catch (error) {
      setMessage(error.message || 'Unable to update ticket.');
    }
  };

  const sendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;
    try {
      const response = await adminAPI.replyToSupportTicket(selectedTicket._id, replyText.trim());
      setSelectedTicket(response.data);
      setReplyText('');
      setMessage(`Reply added to ${selectedTicket.ticketReference}.`);
      await loadTickets();
    } catch (error) {
      setMessage(error.message || 'Unable to add reply.');
    }
  };

  const statusBadge = (status) => {
    const config = {
      open: { class: 'status-open', label: 'Open' },
      pending: { class: 'status-pending', label: 'Pending' },
      resolved: { class: 'status-resolved', label: 'Resolved' },
      closed: { class: 'status-closed', label: 'Closed' }
    };
    const current = config[status] || config.open;
    return <span className={`status-badge ${current.class}`}>{current.label}</span>;
  };

  const priorityBadge = (priority) => {
    const config = {
      urgent: { class: 'priority-high', label: 'Urgent' },
      high: { class: 'priority-high', label: 'High' },
      normal: { class: 'priority-medium', label: 'Normal' },
      low: { class: 'priority-low', label: 'Low' }
    };
    const current = config[priority] || config.normal;
    return <span className={`priority-badge ${current.class}`}>{current.label}</span>;
  };

  return (
    <>
      <div className="admin-topbar">
        <div className="topbar-content">
          <div className="topbar-left">
            <h1 className="page-title">Support</h1>
            <p className="page-subtitle">{tickets.filter(ticket => !['resolved', 'closed'].includes(ticket.status)).length} active tickets</p>
          </div>
          <div className="topbar-right">
            <button className="btn-secondary" onClick={loadTickets}>
              <RefreshCw className="icon" /> Refresh
            </button>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="filter-select">
              <option value="all">All Status</option>
              <option value="open">Open</option>
              <option value="pending">Pending</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
      </div>

      <div className="admin-content">
        {message && <div className="integration-message">{message}</div>}

        <div className="stats-grid stats-grid-4">
          <StatCard title="Open" value={tickets.filter(ticket => ticket.status === 'open').length} icon={<MessageSquare className="icon" />} color="error" />
          <StatCard title="Pending" value={tickets.filter(ticket => ticket.status === 'pending').length} icon={<Clock className="icon" />} color="accent" />
          <StatCard title="Resolved" value={tickets.filter(ticket => ticket.status === 'resolved').length} icon={<CheckCircle className="icon" />} color="success" />
          <StatCard title="Urgent" value={tickets.filter(ticket => ticket.priority === 'urgent').length} icon={<AlertCircle className="icon" />} color="error" />
        </div>

        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Requester</th>
                <th>Category</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(ticket => (
                <tr key={ticket._id}>
                  <td>
                    <div className="user-info">
                      <div className="user-details">
                        <span className="user-name">{ticket.ticketReference}</span>
                        <span className="user-email">{ticket.subject}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="user-details">
                      <span className="user-name">{ticket.requester?.fullName || ticket.contact?.name || 'N/A'}</span>
                      <span className="user-email">{ticket.requester?.email || ticket.contact?.email || ''}</span>
                    </div>
                  </td>
                  <td>{ticket.category}</td>
                  <td>{priorityBadge(ticket.priority)}</td>
                  <td>{statusBadge(ticket.status)}</td>
                  <td>{ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : 'N/A'}</td>
                  <td>
                    <div className="table-actions">
                      <button className="action-btn" title="View" onClick={() => setSelectedTicket(ticket)}>
                        <Eye className="icon" />
                      </button>
                      {!['resolved', 'closed'].includes(ticket.status) && (
                        <button className="action-btn success" title="Resolve" onClick={() => updateTicketStatus(ticket, 'resolved')}>
                          <Check className="icon" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {tickets.length === 0 && (
                <tr>
                  <td colSpan="7">No support tickets found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedTicket && (
        <div className="modal-overlay" onClick={() => setSelectedTicket(null)}>
          <div className="modal-content dispute-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h2>{selectedTicket.ticketReference}</h2>
              <button className="modal-close" onClick={() => setSelectedTicket(null)}>
                <XCircle className="icon" />
              </button>
            </div>
            <div className="modal-body">
              <div className="dispute-full-details">
                <div className="detail-row">
                  <label>Status:</label>
                  <span>{statusBadge(selectedTicket.status)}</span>
                </div>
                <div className="detail-row">
                  <label>Requester:</label>
                  <span>{selectedTicket.requester?.fullName || selectedTicket.contact?.name || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <label>Message:</label>
                  <p>{selectedTicket.message}</p>
                </div>
              </div>

              <div className="resolution-form">
                <h3>Conversation</h3>
                {(selectedTicket.conversation || []).map((entry, index) => (
                  <div key={`${entry.createdAt || index}-${entry.authorRole}`} className="dispute-resolution">
                    <MessageSquare className="icon" />
                    <span>{entry.authorRole || 'user'}: {entry.message}</span>
                  </div>
                ))}
                <textarea
                  placeholder="Write a response..."
                  rows={4}
                  value={replyText}
                  onChange={(event) => setReplyText(event.target.value)}
                />
              </div>

              <div className="modal-actions">
                <button className="btn-secondary" onClick={() => updateTicketStatus(selectedTicket, 'pending')}>Mark Pending</button>
                <button className="btn-secondary" onClick={() => updateTicketStatus(selectedTicket, 'closed')}>Close</button>
                <button className="btn-primary" onClick={sendReply}>Send Reply</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
};

// ============ Settings View ============
const SettingsView = () => {
  const [integrations, setIntegrations] = useState([]);
  const [integrationForms, setIntegrationForms] = useState({});
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);
  const [savingProvider, setSavingProvider] = useState(null);
  const [testingProvider, setTestingProvider] = useState(null);
  const [integrationMessage, setIntegrationMessage] = useState('');
  const [preferences, setPreferences] = useState({
    platformSettings: {
      platformCommissionRate: 15,
      minimumBookingAmount: 50,
      autoCancelTimeoutHours: 24
    },
    notifications: {
      email: true,
      sms: true,
      whatsapp: true
    }
  });
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [seedingReferenceData, setSeedingReferenceData] = useState(false);
  const [seedingVehicleModels, setSeedingVehicleModels] = useState(false);

  useEffect(() => {
    loadIntegrations();
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const response = await adminAPI.getPreferences();
      const data = response.data || {};
      setPreferences({
        platformSettings: {
          platformCommissionRate: data.platformSettings?.platformCommissionRate ?? 15,
          minimumBookingAmount: data.platformSettings?.minimumBookingAmount ?? 50,
          autoCancelTimeoutHours: data.platformSettings?.autoCancelTimeoutHours ?? 24
        },
        notifications: {
          email: data.notifications?.email !== false,
          sms: data.notifications?.sms !== false,
          whatsapp: data.notifications?.whatsapp !== false
        }
      });
    } catch (error) {
      setIntegrationMessage(error.message || 'Unable to load admin preferences');
    }
  };

  const updatePlatformPreference = (field, value) => {
    setPreferences(current => ({
      ...current,
      platformSettings: {
        ...current.platformSettings,
        [field]: value
      }
    }));
  };

  const updateNotificationPreference = (field, value) => {
    setPreferences(current => ({
      ...current,
      notifications: {
        ...current.notifications,
        [field]: value
      }
    }));
  };

  const savePreferences = async () => {
    try {
      setSavingPreferences(true);
      setIntegrationMessage('');
      const response = await adminAPI.updatePreferences(preferences);
      setIntegrationMessage(response.message || 'Admin preferences saved');
      await loadPreferences();
    } catch (error) {
      setIntegrationMessage(error.message || 'Unable to save admin preferences');
    } finally {
      setSavingPreferences(false);
    }
  };

  const waitForSeedJob = async (jobId, successMessageBuilder) => {
    let attempts = 0;
    const maxAttempts = 120;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts += 1;

      const response = await adminAPI.getSeedJob(jobId);
      const job = response.data || {};

      if (job.status === 'completed') {
        setIntegrationMessage(successMessageBuilder(job.result || {}));
        return;
      }

      if (job.status === 'failed') {
        throw new Error(job.error || 'Seed job failed');
      }

      setIntegrationMessage(`${job.label || 'Seed'} is still running...`);
    }

    throw new Error('Seed is still running. Please wait a minute and refresh Settings to check again.');
  };

  const seedReferenceData = async () => {
    try {
      setSeedingReferenceData(true);
      setIntegrationMessage('');
      const response = await adminAPI.seedReferenceData();
      const job = response.data || {};
      setIntegrationMessage(response.message || 'Reference data seed started');
      await waitForSeedJob(job.id || 'reference-data', (summary) => (
        `Reference data seeded successfully (${summary.vehicleTypes || 0} vehicle types, ${summary.vehicleMakes || 0} makes, ${summary.cargoTypes || 0} cargo types, ${summary.trailerTypes || 0} trailer types)`
      ));
    } catch (error) {
      setIntegrationMessage(error.message || 'Unable to seed reference data');
    } finally {
      setSeedingReferenceData(false);
    }
  };

  const seedVehicleModels = async () => {
    try {
      setSeedingVehicleModels(true);
      setIntegrationMessage('');
      const response = await adminAPI.seedVehicleModels();
      const job = response.data || {};
      setIntegrationMessage(response.message || 'Vehicle and trailer model seed started');
      await waitForSeedJob(job.id || 'vehicle-models', (summary) => (
        `Vehicle and trailer models seeded successfully (${summary.makesProcessed || 0} makes, ${summary.modelsSeeded || 0} models processed)`
      ));
    } catch (error) {
      setIntegrationMessage(error.message || 'Unable to seed vehicle and trailer models');
    } finally {
      setSeedingVehicleModels(false);
    }
  };

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
          {integrationMessage && (
            <div className="integration-message">
              <AlertCircle className="icon" />
              <span>{integrationMessage}</span>
            </div>
          )}

          <div className="settings-section">
            <h3>Platform Settings</h3>
            <div className="settings-grid">
              <div className="setting-item">
                <label>Platform Commission (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={preferences.platformSettings.platformCommissionRate}
                  onChange={event => updatePlatformPreference('platformCommissionRate', event.target.value)}
                />
              </div>
              <div className="setting-item">
                <label>Minimum Booking Amount ($)</label>
                <input
                  type="number"
                  min="0"
                  value={preferences.platformSettings.minimumBookingAmount}
                  onChange={event => updatePlatformPreference('minimumBookingAmount', event.target.value)}
                />
              </div>
              <div className="setting-item">
                <label>Auto-cancel Timeout (hours)</label>
                <input
                  type="number"
                  min="1"
                  value={preferences.platformSettings.autoCancelTimeoutHours}
                  onChange={event => updatePlatformPreference('autoCancelTimeoutHours', event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>Notifications</h3>
            <div className="settings-toggle-list">
              <div className="toggle-item">
                <span>Email Notifications</span>
                <input
                  type="checkbox"
                  checked={preferences.notifications.email}
                  onChange={event => updateNotificationPreference('email', event.target.checked)}
                />
              </div>
              <div className="toggle-item">
                <span>SMS Notifications</span>
                <input
                  type="checkbox"
                  checked={preferences.notifications.sms}
                  onChange={event => updateNotificationPreference('sms', event.target.checked)}
                />
              </div>
              <div className="toggle-item">
                <span>WhatsApp Notifications</span>
                <input
                  type="checkbox"
                  checked={preferences.notifications.whatsapp}
                  onChange={event => updateNotificationPreference('whatsapp', event.target.checked)}
                />
              </div>
            </div>
          </div>

          <button className="btn-primary" onClick={savePreferences} disabled={savingPreferences}>
            {savingPreferences ? 'Saving...' : 'Save Changes'}
          </button>

          <div className="settings-section">
            <div className="settings-section-header">
              <div>
                <h3>Production Reference Setup</h3>
                <p>Load vehicle types, cargo recommendations, trailer types, makes, and models used by fleet forms.</p>
              </div>
            </div>
            <div className="setup-action-grid">
              <div className="setup-action-card">
                <h4>Core Reference Data</h4>
                <p>Seeds cargo types, vehicle types, trailer types, payment options, insurance options, cities, and rules.</p>
                <button
                  className="btn-secondary"
                  onClick={seedReferenceData}
                  disabled={seedingReferenceData}
                >
                  <RefreshCw className={`icon ${seedingReferenceData ? 'spinning' : ''}`} />
                  {seedingReferenceData ? 'Seeding...' : 'Seed Reference Data'}
                </button>
              </div>
              <div className="setup-action-card">
                <h4>Vehicle & Trailer Models</h4>
                <p>Seeds truck, bakkie, van, trailer, and wood carrier makes and models for add/update fleet forms.</p>
                <button
                  className="btn-secondary"
                  onClick={seedVehicleModels}
                  disabled={seedingVehicleModels}
                >
                  <RefreshCw className={`icon ${seedingVehicleModels ? 'spinning' : ''}`} />
                  {seedingVehicleModels ? 'Seeding...' : 'Seed Vehicle Models'}
                </button>
              </div>
            </div>
          </div>

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
    awaiting_pickup: { class: 'status-awaiting', label: 'Awaiting Pickup' },
    pending_payment: { class: 'status-awaiting', label: 'Pending Payment' },
    payment_confirmed: { class: 'status-awaiting', label: 'Payment Confirmed' },
    finding_transporter: { class: 'status-awaiting', label: 'Finding Transporter' },
    matched: { class: 'status-awaiting', label: 'Matched' },
    transporter_assigned: { class: 'status-loading', label: 'Assigned' },
    confirmed: { class: 'status-loading', label: 'Confirmed' },
    en_route_pickup: { class: 'status-loading', label: 'En Route' },
    picked_up: { class: 'status-loading', label: 'Picked Up' },
    in_progress: { class: 'status-in-transit', label: 'In Progress' },
    arrived_delivery: { class: 'status-in-transit', label: 'Arrived' },
    delivered: { class: 'status-in-transit', label: 'Delivered' },
    completed: { class: 'status-in-transit', label: 'Completed' }
  };
  const status = statusConfig[job.status] || {
    class: 'status-awaiting',
    label: job.status?.replace(/_/g, ' ') || 'Pending'
  };

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
