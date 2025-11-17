import React, { useState } from 'react';
import { 
  Users, Truck, Package, DollarSign, TrendingUp, TrendingDown, 
  AlertCircle, CheckCircle, Clock, MapPin, Star, Settings, Menu 
} from 'lucide-react';
import './styles/AdminDashboard.css';

const AdminDashboard = () => {
  const [timeRange, setTimeRange] = useState('today');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const stats = {
    today: {
      revenue: 15240,
      bookings: 38,
      activeJobs: 12,
      newUsers: 23,
      disputes: 2
    },
    growth: {
      revenue: 12,
      bookings: 15,
      users: 8,
      onTime: 2
    }
  };

  const activeJobs = [
    {
      id: 'PT-2025-001234',
      shipper: 'John Moyo',
      driver: 'Trust Ncube',
      route: 'Harare → Bulawayo',
      status: 'in_transit',
      progress: 48,
      eta: '5:30 PM'
    },
    {
      id: 'PT-2025-001235',
      shipper: 'ABC Manufacturing',
      driver: 'Mike Chikwanha',
      route: 'Mutare → Harare',
      status: 'loading',
      progress: 5,
      eta: '8:00 PM'
    },
    {
      id: 'PT-2025-001236',
      shipper: 'Sarah Dube',
      driver: 'James Moyo',
      route: 'Harare → Gweru',
      status: 'awaiting_pickup',
      progress: 0,
      eta: '4:00 PM'
    }
  ];

  const recentActivity = [
    { time: '2 mins ago', event: 'New booking created', user: 'John Moyo', type: 'booking' },
    { time: '5 mins ago', event: 'Payment confirmed', user: 'PT-2025-001237', type: 'payment' },
    { time: '8 mins ago', event: 'Delivery completed', user: 'PT-2025-001230', type: 'delivery' },
    { time: '12 mins ago', event: 'New driver registered', user: 'Peter Ndlovu', type: 'user' },
    { time: '15 mins ago', event: 'Dispute raised', user: 'PT-2025-001228', type: 'dispute' }
  ];

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
          <NavItem icon={<Package />} label="Dashboard" active sidebarOpen={sidebarOpen} />
          <NavItem icon={<Users />} label="Users" sidebarOpen={sidebarOpen} />
          <NavItem icon={<Truck />} label="Jobs" sidebarOpen={sidebarOpen} />
          <NavItem icon={<DollarSign />} label="Payments" sidebarOpen={sidebarOpen} />
          <NavItem icon={<AlertCircle />} label="Disputes" badge="2" sidebarOpen={sidebarOpen} />
          <NavItem icon={<Star />} label="Reviews" sidebarOpen={sidebarOpen} />
          <NavItem icon={<Settings />} label="Settings" sidebarOpen={sidebarOpen} />
        </nav>
      </div>

      {/* Main Content */}
      <div className="admin-main-content">
        {/* Top Bar */}
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
              <button className="btn-primary">
                Export Report
              </button>
            </div>
          </div>
        </div>

        <div className="admin-content">
          {/* Stats Grid */}
          <div className="stats-grid">
            <StatCard
              title="Revenue"
              value={`$${stats.today.revenue.toLocaleString()}`}
              change={stats.growth.revenue}
              icon={<DollarSign className="icon" />}
              color="accent"
            />
            <StatCard
              title="Bookings"
              value={stats.today.bookings}
              change={stats.growth.bookings}
              icon={<Package className="icon" />}
              color="primary"
            />
            <StatCard
              title="Active Jobs"
              value={stats.today.activeJobs}
              icon={<Truck className="icon" />}
              color="secondary"
            />
            <StatCard
              title="New Users"
              value={stats.today.newUsers}
              change={stats.growth.users}
              icon={<Users className="icon" />}
              color="success"
            />
            <StatCard
              title="Disputes"
              value={stats.today.disputes}
              icon={<AlertCircle className="icon" />}
              color="error"
              alert
            />
          </div>

          {/* Charts Row */}
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

          {/* Active Jobs & Activity */}
          <div className="content-grid">
            <div className="jobs-section">
              <div className="section-header">
                <h3 className="section-title">Active Jobs</h3>
                <button className="view-all-btn">
                  View All
                </button>
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
                {recentActivity.map((activity, index) => (
                  <ActivityItem key={index} activity={activity} />
                ))}
              </div>
            </div>
          </div>

          {/* Performance Metrics */}
          <div className="metrics-grid">
            <MetricCard
              title="On-Time Delivery Rate"
              value="97%"
              target="95%"
              status="good"
            />
            <MetricCard
              title="Average Rating"
              value="4.8"
              target="4.5"
              status="good"
            />
            <MetricCard
              title="Dispute Rate"
              value="1.8%"
              target="<3%"
              status="good"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const NavItem = ({ icon, label, active, badge, sidebarOpen }) => (
  <button
    className={`nav-item ${active ? 'nav-item-active' : ''}`}
  >
    <span className="nav-icon">{icon}</span>
    {sidebarOpen && (
      <>
        <span className="nav-label">{label}</span>
        {badge && (
          <span className="nav-badge">
            {badge}
          </span>
        )}
      </>
    )}
  </button>
);

const StatCard = ({ title, value, change, icon, color, alert }) => {
  const colorClass = `stat-card-${color}`;
  
  return (
    <div className={`stat-card ${colorClass}`}>
      <div className="stat-header">
        <div className="stat-icon-wrapper">
          {icon}
        </div>
        {change !== undefined && (
          <div className={`stat-change ${change >= 0 ? 'positive' : 'negative'}`}>
            {change >= 0 ? <TrendingUp className="icon" /> : <TrendingDown className="icon" />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <p className="stat-title">{title}</p>
      <p className={`stat-value ${alert ? 'stat-alert' : ''}`}>
        {value}
      </p>
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
        <span className={`job-status ${status.class}`}>
          {status.label}
        </span>
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
          <div 
            className="progress-fill"
            style={{ width: `${job.progress}%` }}
          />
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
      <div className="activity-icon">
        {typeIcons[activity.type]}
      </div>
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