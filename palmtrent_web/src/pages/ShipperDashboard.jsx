import React, { useState, useRef, useEffect } from 'react';
import {
  Package, MapPin, TrendingUp, TrendingDown, Clock, DollarSign, Plus,
  Filter, Search, Download, FileText, Star, Truck, Menu,
  Bell, User, Home, BarChart3, Heart, MessageCircle,
  HelpCircle, LogOut, CheckCircle, AlertCircle, Users, Shield,
  ChevronDown, Settings, X, Calendar, ArrowRight, Phone,
  Navigation, Eye, RefreshCw, ChevronLeft, ChevronRight,
  CreditCard, Loader, Check, Upload, Image
} from 'lucide-react';
import {
  bookingsAPI,
  trackingAPI,
  authAPI,
  paymentsAPI,
  publicAPI,
  ratingsAPI,
  referenceAPI,
  shipperAPI,
  shipmentsAPI,
  subscriptionCheckoutAPI,
  resolveApiUrl,
  downloadAuthorizedBlob
} from '../services/api';
import logo from '../assets/logo3.png';
import './styles/ShipperDashboard.css';

const loadSocketService = () => import('../services/socket').then(module => module.default);

const getBookingId = (booking) => booking.bookingReference || booking.bookingId || booking._id;
const getRecordId = (record) => record?._id || record?.recordId || record?.id;
const getRecordLabel = (record) => record?.name || record?.label || record?.displayName || '';
const getRecordIds = (records = []) => records.map(item => String(getRecordId(item) || item)).filter(Boolean);
const getShipmentId = (booking) => {
  const shipment = booking?.shipments?.[0] || booking?.shipment;
  return shipment?._id || shipment?.id || shipment;
};
const getRouteLabel = (booking) => {
  const pickup = booking.route?.pickup?.address || booking.route?.pickup?.city || booking.pickup?.city || booking.origin || 'N/A';
  const delivery = booking.route?.delivery?.address || booking.route?.delivery?.city || booking.delivery?.city || booking.destination || 'N/A';
  return `${pickup} -> ${delivery}`;
};
const getBookingAmount = (booking) => booking.totalAmount || booking.pricing?.totals?.total || booking.pricing?.total || 0;
const getUserDisplayName = (user = {}) => user.fullName || user.name || user.email || 'Shipper';

const normalizeZimbabwePhone = (phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('263') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+263${digits.slice(1)}`;
  if (!digits.startsWith('0') && digits.length === 9) return `+263${digits}`;
  if (String(phone).trim().startsWith('+263') && digits.length === 12) return `+${digits}`;
  return String(phone || '').trim();
};

const hydrateAccountForm = (user = {}) => ({
  fullName: user.fullName || '',
  email: user.email || '',
  phone: user.phone || '',
  companyName: user.companyName || '',
  address: {
    street: user.address?.street || '',
    city: user.address?.city || '',
    state: user.address?.state || '',
    country: user.address?.country || 'Zimbabwe'
  }
});
const getUserFirstName = (user = {}) => {
  const displayName = getUserDisplayName(user);
  return displayName.includes('@') ? displayName.split('@')[0] : displayName.split(' ')[0];
};
const getUserInitials = (user = {}) => {
  const displayName = getUserDisplayName(user).trim();
  const parts = displayName.includes('@') ? [displayName[0]] : displayName.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'S';
};
const getProgress = (status) => ({
  pending_payment: 5,
  payment_confirmed: 10,
  finding_transporter: 15,
  matched: 25,
  transporter_assigned: 35,
  confirmed: 40,
  en_route_pickup: 50,
  pickup_started: 60,
  picked_up: 70,
  in_progress: 75,
  in_transit: 80,
  arrived_delivery: 90,
  delivered: 100,
  completed: 100
}[status] || 10);

const openPODDownload = async (download) => {
  const url = download?.url || download?.pdfUrl;
  if (!url) {
    throw new Error('Proof of delivery document is not available yet.');
  }

  if (download.provider === 'local' || url.startsWith('/api/') || url.startsWith('/uploads/')) {
    const blob = await downloadAuthorizedBlob(url);
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `${download.podReference || 'proof-of-delivery'}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
    return;
  }

  window.open(resolveApiUrl(url), '_blank', 'noopener,noreferrer');
};

const downloadPODForBooking = async (booking) => {
  const bookingRecordId = getRecordId(booking);
  let source = booking;

  if (!getShipmentId(source)) {
    if (!bookingRecordId) {
      throw new Error('Booking record is missing.');
    }
    const bookingResponse = await bookingsAPI.getById(bookingRecordId);
    source = bookingResponse.data || bookingResponse;
  }

  const shipmentId = getShipmentId(source);
  if (!shipmentId) {
    throw new Error('This booking does not have a shipment record yet.');
  }

  const response = await shipmentsAPI.getPODDocument(shipmentId);
  await openPODDownload(response.data || response);
};

export const ShipperDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState('overview');
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const currentUser = authAPI.getCurrentUser() || {};
  const userDisplayName = getUserDisplayName(currentUser);
  const userInitials = getUserInitials(currentUser);

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
    { id: 'new-booking', label: 'New Booking', icon: <Plus className="icon" /> },
    { id: 'track', label: 'Track Shipments', icon: <MapPin className="icon" /> },
    { id: 'bookings', label: 'My Bookings', icon: <FileText className="icon" /> },
    { id: 'payments', label: 'Payments', icon: <DollarSign className="icon" /> },
    { id: 'favorites', label: 'Favorites', icon: <Heart className="icon" /> },
    { id: 'reviews', label: 'Reviews', icon: <Star className="icon" /> },
    { id: 'account', label: 'Account', icon: <Settings className="icon" /> },
  ];

  const userMenuItems = [
    { id: 'overview', label: 'Dashboard', icon: <Home className="shipper-dropdown-icon" /> },
    { id: 'account', label: 'Profile', icon: <User className="shipper-dropdown-icon" /> },
    { id: 'bookings', label: 'My Bookings', icon: <FileText className="shipper-dropdown-icon" /> },
    { id: 'payments', label: 'Payments', icon: <CreditCard className="shipper-dropdown-icon" /> },
    { id: 'track', label: 'Track Shipments', icon: <MapPin className="shipper-dropdown-icon" /> },
    { id: 'logout', label: 'Logout', icon: <LogOut className="shipper-dropdown-icon" /> },
  ];

  const handleUserMenuClick = (itemId) => {
    setUserDropdownOpen(false);
    if (itemId === 'logout') {
      authAPI.logout();
      return;
    }
    setActiveNav(itemId);
  };

  const renderContent = () => {
    switch (activeNav) {
      case 'overview':
        return <OverviewTab setActiveNav={setActiveNav} />;
      case 'new-booking':
        return <NewBookingTab setActiveNav={setActiveNav} />;
      case 'track':
        return <TrackShipmentsTab />;
      case 'bookings':
        return <BookingsTab />;
      case 'payments':
        return <PaymentsTab />;
      case 'favorites':
        return <FavoritesTab setActiveNav={setActiveNav} />;
      case 'reviews':
        return <ReviewsTab />;
      case 'account':
        return <AccountTab currentUser={currentUser} />;
      default:
        return <OverviewTab setActiveNav={setActiveNav} />;
    }
  };

  return (
    <div className="shipper-dashboard">
      {/* Sidebar */}
      <div className={`shipper-sidebar ${sidebarOpen ? 'shipper-sidebar-open' : 'shipper-sidebar-closed'}`}>
        <div className="shipper-sidebar-header">
          {sidebarOpen && (
            <div className="shipper-sidebar-brand">
              <div className="shipper-brand-logo">
                <img src={logo} alt="Palmtrent" />
              </div>
              <span className="shipper-brand-text">Palmtrent</span>
            </div>
          )}
          <button className="shipper-sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
            <Menu className="icon" />
          </button>
        </div>

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

      {/* Main Content */}
      <div className="shipper-main-content">
        <div className="shipper-topbar">
          <div className="shipper-topbar-content">
            <div className="shipper-topbar-left">
              <h1 className="shipper-page-title">
                {activeNav === 'overview' && 'Dashboard'}
                {activeNav === 'new-booking' && 'New Booking'}
                {activeNav === 'track' && 'Track Shipments'}
                {activeNav === 'bookings' && 'My Bookings'}
                {activeNav === 'payments' && 'Payments'}
                {activeNav === 'favorites' && 'Favorite Transporters'}
                {activeNav === 'reviews' && 'My Reviews'}
                {activeNav === 'account' && 'Account'}
              </h1>
              <p className="shipper-page-subtitle">Welcome back, {getUserFirstName(currentUser)}</p>
            </div>
            <div className="shipper-topbar-right">
              <button className="shipper-notification-btn" onClick={() => setActiveNav('track')}>
                <Bell className="icon" />
              </button>

              <div className={`shipper-user-dropdown ${userDropdownOpen ? 'open' : ''}`} ref={userDropdownRef}>
                <button className="shipper-user-trigger" onClick={() => setUserDropdownOpen(!userDropdownOpen)}>
                  <div className="shipper-user-avatar"><span className="shipper-user-avatar-text">{userInitials}</span></div>
                  <div className="shipper-user-info">
                    <p className="shipper-user-name">{userDisplayName}</p>
                    <p className="shipper-user-role">
                      {currentUser.corporateAccount ? 'Corporate Shipper' : 'Shipper'}
                    </p>
                  </div>
                  <ChevronDown className="shipper-dropdown-arrow" size={16} />
                </button>

                <div className="shipper-dropdown-menu">
                  <div className="shipper-dropdown-header">
                    <div className="shipper-dropdown-user">
                      <div className="shipper-dropdown-avatar"><span className="shipper-dropdown-avatar-text">{userInitials}</span></div>
                      <div className="shipper-dropdown-user-info">
                        <p className="shipper-dropdown-user-name">{userDisplayName}</p>
                        <p className="shipper-dropdown-user-email">{currentUser.email || currentUser.phone || 'Signed in'}</p>
                      </div>
                    </div>
                  </div>
                  <div className="shipper-dropdown-items">
                    {userMenuItems.map((item, index) => (
                      <React.Fragment key={item.id}>
                        <button className="shipper-dropdown-item" onClick={() => handleUserMenuClick(item.id)}>
                          {item.icon}
                          <span>{item.label}</span>
                        </button>
                        {index === userMenuItems.length - 2 && <div className="shipper-dropdown-divider" />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="shipper-content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

// ============ Overview Tab ============
const OverviewTab = ({ setActiveNav }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ activeShipments: 0, completed: 0, totalSpent: 0, avgRating: 0 });
  const [growth, setGrowth] = useState({ shipments: 0, completed: 0, spending: 0 });
  const [activeShipments, setActiveShipments] = useState([]);
  const [recentBookings, setRecentBookings] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [podMessage, setPodMessage] = useState('');

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        const [dashboardRes, bookingsRes, activityRes] = await Promise.all([
          shipperAPI.getDashboardStats(),
          bookingsAPI.getAll({ limit: 10 }),
          shipperAPI.getRecentActivity()
        ]);
        const dashboard = dashboardRes.data || {};
        const bookings = bookingsRes.data || [];
        const active = bookings.filter(b => !['delivered', 'completed', 'cancelled'].includes(b.status));

        setStats({
          activeShipments: dashboard.activeShipments || dashboard.activeJobs || 0,
          completed: dashboard.completed || dashboard.totalShipments || 0,
          totalSpent: dashboard.totalSpent || dashboard.spending || 0,
          avgRating: dashboard.avgRating || 0
        });

        setGrowth(dashboard.growth || { shipments: 0, completed: 0, spending: 0 });

        // Format active shipments
        setActiveShipments(active.slice(0, 3).map(b => ({
          id: getBookingId(b),
          recordId: b._id,
          shipmentId: getShipmentId(b),
          status: b.status,
          progress: getProgress(b.status),
          route: getRouteLabel(b),
          driver: b.transporter?.fullName || 'Pending Assignment',
          phone: b.transporter?.phone || '',
          eta: b.route?.delivery?.deadline ? new Date(b.route.delivery.deadline).toLocaleTimeString() : 'TBD'
        })));

        // Format recent bookings
        setRecentBookings(bookings.slice(0, 5).map(b => ({
          id: getBookingId(b),
          recordId: b._id,
          shipments: b.shipments || [],
          date: new Date(b.createdAt).toLocaleDateString(),
          status: b.status,
          route: getRouteLabel(b),
          amount: getBookingAmount(b)
        })));

        setRecentActivity((activityRes.data || []).map(item => ({
          time: item.date || '',
          event: item.title || item.status || 'Activity',
          user: item.amount || '',
          type: item.status || 'activity'
        })));

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
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

  const downloadPODWithMessage = async (booking) => {
    setPodMessage('');
    try {
      await downloadPODForBooking(booking);
    } catch (error) {
      setPodMessage(error.message || 'Unable to download proof of delivery.');
    }
  };

  return (
    <>
      <div className="shipper-stats-grid">
        <ShipperStatCard title="Active Shipments" value={stats.activeShipments} change={growth.shipments} icon={<Truck className="icon" />} color="primary" />
        <ShipperStatCard title="Completed" value={stats.completed} change={growth.completed} icon={<Package className="icon" />} color="success" />
        <ShipperStatCard title="Total Spent" value={`$${stats.totalSpent.toLocaleString()}`} change={growth.spending} icon={<DollarSign className="icon" />} color="accent" />
        <ShipperStatCard title="Your Rating" value={stats.avgRating} icon={<Star className="icon" />} color="secondary" />
      </div>

      <div className="shipper-quick-actions">
        <div className="shipper-quick-actions-content">
          <h2 className="shipper-quick-actions-title">Ready to ship?</h2>
          <p className="shipper-quick-actions-subtitle">Book transport in just a few clicks and get instant quotes</p>
          <button onClick={() => setActiveNav('new-booking')} className="shipper-quick-actions-btn">
            <Plus className="icon" /> Create New Booking
          </button>
        </div>
      </div>

      <div className="shipper-content-grid">
        <div className="shipper-shipments-section">
          <div className="shipper-section-header">
            <h3 className="shipper-section-title">Active Shipments</h3>
            <button className="shipper-view-all-btn" onClick={() => setActiveNav('track')}>View All →</button>
          </div>
          <div className="shipper-shipments-list">
            {activeShipments.map((shipment) => (
              <ShipperShipmentCard
                key={shipment.id}
                shipment={shipment}
                onTrack={() => setActiveNav('track')}
              />
            ))}
          </div>
        </div>

        <div className="shipper-activity-section">
          <div className="shipper-section-header">
            <h3 className="shipper-section-title">Recent Activity</h3>
          </div>
          <div className="shipper-activity-list">
            {recentActivity.map((activity, index) => (
              <ShipperActivityItem key={index} activity={activity} />
            ))}
          </div>
        </div>
      </div>

      <div className="shipper-bookings-section">
        <div className="shipper-section-header">
          <h3 className="shipper-section-title">Recent Bookings</h3>
          <button className="shipper-view-all-btn" onClick={() => setActiveNav('bookings')}>View All →</button>
        </div>
        {podMessage && <div className="shipper-modal-error">{podMessage}</div>}
        <table className="shipper-bookings-table">
          <thead>
            <tr><th>Job ID</th><th>Date</th><th>Route</th><th>Status</th><th>Amount</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {recentBookings.map((booking) => (
              <tr key={booking.id}>
                <td><span className="shipper-shipment-id">{booking.id}</span></td>
                <td>{booking.date}</td>
                <td>{booking.route}</td>
                <td><span className="shipper-booking-status shipper-status-delivered">{booking.status}</span></td>
                <td>${booking.amount}</td>
                <td>
                  <button
                    className="shipper-booking-action"
                    disabled={!['delivered', 'completed'].includes(booking.status)}
                    onClick={() => downloadPODWithMessage(booking)}
                  >
                    View POD
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

const AccountTab = ({ currentUser }) => {
  const [form, setForm] = useState(hydrateAccountForm(currentUser));
  const [subscription, setSubscription] = useState(null);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [payingSubscription, setPayingSubscription] = useState(false);

  useEffect(() => {
    let mounted = true;
    publicAPI.getMySubscription()
      .then(response => {
        if (mounted) setSubscription(response.data || null);
      })
      .catch(() => {
        if (mounted) setSubscription(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const updateAddress = (field, value) => setForm((current) => ({
    ...current,
    address: {
      ...(current.address || {}),
      [field]: value
    }
  }));

  const saveProfile = async (event) => {
    event.preventDefault();
    setSaving(true);
    setStatus('');
    try {
      const normalizedPhone = normalizeZimbabwePhone(form.phone);
      const email = String(form.email || '').trim().toLowerCase();
      if (!String(form.fullName || '').trim()) throw new Error('Full name is required.');
      if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('Enter a valid email address.');
      if (!/^\+263[0-9]{9}$/.test(normalizedPhone)) throw new Error('Enter a valid Zimbabwean mobile number in +263 format.');

      const response = await authAPI.updateProfile({
        fullName: String(form.fullName || '').trim(),
        email,
        phone: normalizedPhone,
        companyName: String(form.companyName || '').trim(),
        address: {
          street: String(form.address?.street || '').trim(),
          city: String(form.address?.city || '').trim(),
          state: String(form.address?.state || '').trim(),
          country: String(form.address?.country || 'Zimbabwe').trim()
        }
      });
      const user = response.data?.user || response.user || authAPI.getCurrentUser() || {};
      setForm(hydrateAccountForm(user));
      setStatus('Profile updated.');
    } catch (error) {
      setStatus(error.message || 'Could not update profile.');
    } finally {
      setSaving(false);
    }
  };

  const paySubscription = async () => {
    if (!subscription) return;
    setPayingSubscription(true);
    setStatus('');
    try {
      const redirected = await subscriptionCheckoutAPI.start(subscription, {
        email: form.email,
        phone: form.phone
      });
      if (!redirected) setStatus('Subscription does not require payment or is already paid.');
    } catch (error) {
      setStatus(error.message || 'Could not start subscription payment.');
    } finally {
      setPayingSubscription(false);
    }
  };

  const subscriptionPaymentStatus = subscription?.payment?.status || '';
  const canPaySubscription = subscription &&
    Number(subscription.amount || subscription.plan?.price || 0) > 0 &&
    !['paid', 'not_required'].includes(subscriptionPaymentStatus);

  return (
    <div className="shipper-account-grid">
      <section className="shipper-account-card">
        <h2>Profile</h2>
        {status && <div className="shipper-account-message">{status}</div>}
        <form className="shipper-account-form" onSubmit={saveProfile}>
          <label>Full Name
            <input value={form.fullName} onChange={(event) => update('fullName', event.target.value)} required />
          </label>
          <label>Email
            <input type="email" value={form.email} onChange={(event) => update('email', event.target.value)} required />
          </label>
          <label>Phone
            <input value={form.phone} onChange={(event) => update('phone', event.target.value)} required />
          </label>
          <small className="shipper-account-hint">Use your Zimbabwean mobile number in +263 format.</small>
          <label>Company Name
            <input value={form.companyName} onChange={(event) => update('companyName', event.target.value)} />
          </label>
          <label>Street Address
            <textarea value={form.address?.street || ''} onChange={(event) => updateAddress('street', event.target.value)} rows={2} />
          </label>
          <div className="shipper-account-row">
            <label>City
              <input value={form.address?.city || ''} onChange={(event) => updateAddress('city', event.target.value)} />
            </label>
            <label>Province / State
              <input value={form.address?.state || ''} onChange={(event) => updateAddress('state', event.target.value)} />
            </label>
          </div>
          <label>Country
            <input value={form.address?.country || ''} onChange={(event) => updateAddress('country', event.target.value)} />
          </label>
          <button type="submit" className="shipper-account-primary" disabled={saving}>
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </form>
      </section>

      <section className="shipper-account-card">
        <h2>Session</h2>
        <p>Signed in as {currentUser.email || currentUser.phone || currentUser.fullName || 'Palmtrent user'}.</p>
        {subscription && (
          <div className="shipper-subscription-summary">
            <strong>{subscription.plan?.name || 'Current Subscription'}</strong>
            <span>Payment {subscriptionPaymentStatus || 'pending'}</span>
            {canPaySubscription && (
              <button type="button" className="shipper-account-primary" onClick={paySubscription} disabled={payingSubscription}>
                {payingSubscription ? 'Opening ClicknPay...' : 'Pay with ClicknPay'}
              </button>
            )}
          </div>
        )}
        <button type="button" className="shipper-account-secondary" onClick={authAPI.logout}>
          <LogOut className="icon" />
          Sign Out
        </button>
      </section>
    </div>
  );
};

// ============ New Booking Tab ============
const NewBookingTab = ({ setActiveNav }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [bookingData, setBookingData] = useState({
    pickupAddress: '', pickupCity: '', pickupPhone: '',
    deliveryAddress: '', deliveryCity: '', deliveryPhone: '',
    cargoType: '', cargoWeight: '', cargoDescription: '',
    vehicleType: '', trailerType: '', pickupDate: '', pickupTime: '',
    insurance: false, insuranceValue: '', coverageType: 'standard',
    paymentMethod: 'clicknpay'
  });
  const [quote, setQuote] = useState(null);
  const [bookingMessage, setBookingMessage] = useState('');
  const [referenceData, setReferenceData] = useState({ cargoTypes: [], vehicleTypes: [], trailerTypes: [] });
  const [insuranceQuotes, setInsuranceQuotes] = useState([]);
  const [selectedInsuranceQuote, setSelectedInsuranceQuote] = useState(null);
  const [insuranceLoading, setInsuranceLoading] = useState(false);

  const defaultCargoTypes = ['General Goods', 'Furniture', 'Electronics', 'Agricultural', 'Building Materials', 'Machinery', 'Other'];
  const defaultVehicleTypes = ['Small Truck (1-2 tons)', 'Medium Truck (3-5 tons)', 'Large Truck (6-10 tons)', 'Flatbed Trailer', 'Container Truck'];
  const cargoTypes = referenceData.cargoTypes.length ? referenceData.cargoTypes.map(item => item.name || item.label) : defaultCargoTypes;
  const selectedCargoType = referenceData.cargoTypes.find(item => (item.name || item.label) === bookingData.cargoType);
  const selectedCargoId = String(getRecordId(selectedCargoType) || '');
  const recommendedVehicleIds = getRecordIds(selectedCargoType?.recommendedVehicleTypes);
  const recommendedTrailerIds = getRecordIds(selectedCargoType?.recommendedTrailerTypes);
  const fallbackVehicleCategories = {
    bulk: ['truck', 'tractor'],
    liquid: ['truck'],
    refrigerated: ['truck'],
    hazardous: ['truck'],
    live: ['truck']
  }[selectedCargoType?.category] || [];
  const recommendedVehicles = recommendedVehicleIds.length
    ? selectedCargoType.recommendedVehicleTypes
    : referenceData.vehicleTypes.filter(item => !fallbackVehicleCategories.length || fallbackVehicleCategories.includes(item.category));
  const recommendedTrailers = recommendedTrailerIds.length
    ? selectedCargoType.recommendedTrailerTypes
    : referenceData.trailerTypes.filter((trailer) => {
      const suitableCargoIds = getRecordIds(trailer.suitableForCargoTypes);
      return selectedCargoId && suitableCargoIds.includes(selectedCargoId);
    });
  // recommendedVehicles may be populated objects OR raw ObjectId strings. Resolve
  // each to a human label (falling back to a lookup in the full vehicle type list)
  // so the options are never blank and stay selectable.
  const resolveVehicleLabel = (item) => {
    const direct = getRecordLabel(item);
    if (direct) return direct;
    const id = String(getRecordId(item) || item || '');
    return getRecordLabel(referenceData.vehicleTypes.find(v => String(getRecordId(v)) === id));
  };
  const recommendedVehicleLabels = recommendedVehicles.map(resolveVehicleLabel).filter(Boolean);
  const allVehicleLabels = referenceData.vehicleTypes.map(getRecordLabel).filter(Boolean);
  const vehicleTypes = (bookingData.cargoType && recommendedVehicleLabels.length)
    ? recommendedVehicleLabels
    : (allVehicleLabels.length ? allVehicleLabels : defaultVehicleTypes);
  const cities = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo', 'Chinhoyi', 'Victoria Falls', 'Beitbridge'];

  const normalizeInsuranceCargoType = (cargoType) => {
    const match = referenceData.cargoTypes.find(item => (item.name || item.label) === cargoType);
    if (match?.insuranceCategory) {
      const mappedCategory = {
        agriculture: 'agricultural',
        dangerous_goods: 'hazmat',
        hazardous: 'hazmat',
        livestock: 'livestock',
        general: 'general'
      }[match.insuranceCategory];
      if (mappedCategory) return mappedCategory;
    }
    const value = String(cargoType || '').toLowerCase();
    if (value.includes('electronic')) return 'electronics';
    if (value.includes('agric')) return 'agricultural';
    if (value.includes('machinery')) return 'machinery';
    if (value.includes('furniture')) return 'fragile';
    if (value.includes('livestock')) return 'livestock';
    if (value.includes('hazard')) return 'hazmat';
    return 'general';
  };

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const response = await referenceAPI.getAll();
        const data = response.data || {};
        setReferenceData({
          cargoTypes: data.cargoTypes || [],
          vehicleTypes: data.vehicleTypes || [],
          trailerTypes: data.trailerTypes || []
        });
      } catch {
        setReferenceData({ cargoTypes: [], vehicleTypes: [], trailerTypes: [] });
      }
    };

    loadReferenceData();
  }, []);

  const handleInputChange = (field, value) => {
    setBookingData(prev => ({
      ...prev,
      [field]: value,
      ...(field === 'cargoType' ? { vehicleType: '', trailerType: '' } : {})
    }));
    if (['insurance', 'insuranceValue', 'coverageType', 'cargoType'].includes(field)) {
      setInsuranceQuotes([]);
      setSelectedInsuranceQuote(null);
    }
  };

  const loadInsuranceQuotes = async () => {
    if (!bookingData.insurance) return;
    const cargoValue = Number(bookingData.insuranceValue || 0);
    if (!cargoValue || cargoValue <= 0 || !bookingData.cargoType) {
      setBookingMessage('Enter cargo type and cargo value before getting insurance quotes.');
      return;
    }

    setInsuranceLoading(true);
    setBookingMessage('');
    try {
      const response = await referenceAPI.getInsuranceQuotes({
        cargoValue,
        cargoType: normalizeInsuranceCargoType(bookingData.cargoType),
        coverageType: bookingData.coverageType
      });
      const quotes = response.data || [];
      setInsuranceQuotes(quotes);
      setSelectedInsuranceQuote(quotes[0] || null);
      if (!quotes.length) setBookingMessage('No active insurance provider has a matching product for this cargo yet.');
    } catch (error) {
      setBookingMessage(error.message || 'Could not load insurance quotes.');
    } finally {
      setInsuranceLoading(false);
    }
  };

  const buildInsuranceSelection = () => (
    bookingData.insurance && selectedInsuranceQuote
      ? { ...selectedInsuranceQuote, required: true, selected: true }
      : { required: false }
  );

  const calculateQuote = async () => {
    setLoading(true);
    setBookingMessage('');
    try {
      const quoteData = {
        pickup: { city: bookingData.pickupCity, address: bookingData.pickupAddress },
        delivery: { city: bookingData.deliveryCity, address: bookingData.deliveryAddress },
        cargo: { type: bookingData.cargoType, weight: parseFloat(bookingData.cargoWeight) || 1 },
        vehicleType: bookingData.vehicleType,
        vehicleRecommendation: { vehicleType: bookingData.vehicleType, trailerType: bookingData.trailerType },
        insurance: buildInsuranceSelection(),
        insuranceValue: bookingData.insurance ? parseFloat(bookingData.insuranceValue) : 0
      };

      const response = await bookingsAPI.getQuote(quoteData);

      if (response.success && response.data) {
        const pricing = response.data;
        const selectedPremium = bookingData.insurance && selectedInsuranceQuote ? Number(selectedInsuranceQuote.premium || 0) : 0;
        const currentInsurance = Number(pricing.breakdown?.insurance || pricing.insurance || 0);
        const currentTotal = Number(pricing.totals?.total || pricing.total || 0);
        const adjustedTotal = currentTotal - currentInsurance + selectedPremium;
        setQuote({
          ...pricing,
          breakdown: {
            ...(pricing.breakdown || {}),
            insurance: selectedPremium
          },
          totals: {
            ...(pricing.totals || {}),
            total: adjustedTotal
          },
          subtotal: pricing.totals?.subtotal || pricing.subtotal || 0,
          insurance: selectedPremium,
          platformFee: pricing.breakdown?.platformFee || pricing.platformFee || 0,
          total: adjustedTotal,
          estimatedDistance: pricing.route?.distance || pricing.estimatedDistance || 0,
          estimatedTime: pricing.route?.estimatedDuration || pricing.estimatedTime || 'TBD'
        });
      } else {
        throw new Error(response.message || 'Unable to calculate quote');
      }
      setStep(4);
    } catch (error) {
      console.error('Quote error:', error);
      setBookingMessage(error.message || 'Unable to calculate a quote. Please check the route details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const [bookingRef, setBookingRef] = useState('');

  const submitBooking = async () => {
    setLoading(true);
    setBookingMessage('');
    try {
      const user = authAPI.getCurrentUser();
      const amount = Number(quote?.totals?.total || quote?.total || 0);
      const bookingPayload = {
        pickupLocation: [bookingData.pickupAddress, bookingData.pickupCity].filter(Boolean).join(', '),
        deliveryLocation: [bookingData.deliveryAddress, bookingData.deliveryCity].filter(Boolean).join(', '),
        pickupDate: bookingData.pickupDate,
        cargoType: bookingData.cargoType,
        weight: parseFloat(bookingData.cargoWeight),
        cargoValue: bookingData.insurance ? parseFloat(bookingData.insuranceValue || 0) : 0,
        specialInstructions: bookingData.cargoDescription,
        vehicleRecommendation: { vehicleType: bookingData.vehicleType, trailerType: bookingData.trailerType },
        vehicles: [{
          vehicleType: bookingData.vehicleType,
          trailerType: bookingData.trailerType,
          weight: parseFloat(bookingData.cargoWeight) || 0,
          description: bookingData.cargoDescription || bookingData.cargoType
        }],
        insurance: buildInsuranceSelection(),
        paymentMethod: bookingData.paymentMethod,
        pricing: quote,
        amount,
        customer: {
          email: user?.email || ''
        }
      };

      const response = await bookingsAPI.createWithPayment(bookingPayload);

      if (!response.success) {
        throw new Error(response.message || 'Booking failed');
      }

      const booking = response.data?.booking;
      const payment = response.data?.payment;
      setBookingRef(booking?.bookingReference || booking?._id || '');

      if (!payment?.paymentReference) {
        throw new Error('Booking was created but payment checkout could not be started');
      }

      const checkout = await paymentsAPI.startCheckout(payment.paymentReference, bookingPayload.customer);
      const redirectUrl = checkout.data?.redirectUrl;
      if (!redirectUrl) {
        throw new Error('ClicknPay did not return a checkout URL');
      }

      sessionStorage.setItem('palmtrent_pending_payment_reference', payment.paymentReference);
      sessionStorage.setItem('palmtrent_pending_booking_reference', booking?.bookingReference || '');
      window.location.assign(redirectUrl);
    } catch (error) {
      console.error('Booking error:', error);
      setBookingMessage(error.message || 'Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="new-booking-container">
      {bookingMessage && <div className="shipper-modal-error">{bookingMessage}</div>}
      {/* Progress Steps */}
      <div className="booking-progress">
        {['Locations', 'Cargo Details', 'Schedule', 'Review & Pay', 'Confirmation'].map((label, index) => (
          <div key={index} className={`progress-step ${step > index + 1 ? 'completed' : ''} ${step === index + 1 ? 'active' : ''}`}>
            <div className="step-number">{step > index + 1 ? <Check className="icon" /> : index + 1}</div>
            <span className="step-label">{label}</span>
          </div>
        ))}
      </div>

      {/* Step 1: Locations */}
      {step === 1 && (
        <div className="booking-step">
          <h2 className="step-title">Pickup & Delivery Locations</h2>
          <div className="location-forms">
            <div className="location-card pickup">
              <h3><MapPin className="icon" /> Pickup Location</h3>
              <div className="form-group">
                <label>City</label>
                <select value={bookingData.pickupCity} onChange={(e) => handleInputChange('pickupCity', e.target.value)}>
                  <option value="">Select city</option>
                  {cities.map(city => <option key={city} value={city}>{city}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Full Address</label>
                <input type="text" placeholder="Enter pickup address" value={bookingData.pickupAddress} onChange={(e) => handleInputChange('pickupAddress', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Contact Phone</label>
                <input type="tel" placeholder="+263 77 XXX XXXX" value={bookingData.pickupPhone} onChange={(e) => handleInputChange('pickupPhone', e.target.value)} />
              </div>
            </div>

            <div className="location-divider"><ArrowRight className="icon" /></div>

            <div className="location-card delivery">
              <h3><MapPin className="icon" /> Delivery Location</h3>
              <div className="form-group">
                <label>City</label>
                <select value={bookingData.deliveryCity} onChange={(e) => handleInputChange('deliveryCity', e.target.value)}>
                  <option value="">Select city</option>
                  {cities.map(city => <option key={city} value={city}>{city}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Full Address</label>
                <input type="text" placeholder="Enter delivery address" value={bookingData.deliveryAddress} onChange={(e) => handleInputChange('deliveryAddress', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Contact Phone</label>
                <input type="tel" placeholder="+263 77 XXX XXXX" value={bookingData.deliveryPhone} onChange={(e) => handleInputChange('deliveryPhone', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="step-actions">
            <button className="btn-primary" onClick={() => setStep(2)} disabled={!bookingData.pickupCity || !bookingData.deliveryCity}>
              Continue <ArrowRight className="icon" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Cargo Details */}
      {step === 2 && (
        <div className="booking-step">
          <h2 className="step-title">Cargo & Vehicle Details</h2>
          <div className="cargo-form">
            <div className="form-row">
              <div className="form-group">
                <label>Cargo Type</label>
                <select value={bookingData.cargoType} onChange={(e) => handleInputChange('cargoType', e.target.value)}>
                  <option value="">Select cargo type</option>
                  {cargoTypes.map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Estimated Weight (tons)</label>
                <input type="number" placeholder="e.g., 2.5" value={bookingData.cargoWeight} onChange={(e) => handleInputChange('cargoWeight', e.target.value)} />
              </div>
            </div>

            <div className="form-group">
              <label>Cargo Description</label>
              <textarea placeholder="Describe your cargo (e.g., 10 pallets of bottled water)" value={bookingData.cargoDescription} onChange={(e) => handleInputChange('cargoDescription', e.target.value)} rows={3} />
            </div>

            <div className="form-group">
              <label>{bookingData.cargoType && recommendedVehicles.length ? 'Recommended Vehicle Type' : 'Vehicle Type Required'}</label>
              <div className="vehicle-options">
                {vehicleTypes.map(type => (
                  <button type="button" key={type} className={`vehicle-option ${bookingData.vehicleType === type ? 'selected' : ''}`} onClick={() => handleInputChange('vehicleType', type)}>
                    <Truck className="icon" />
                    <span>{type}</span>
                  </button>
                ))}
              </div>
              {bookingData.cargoType && selectedCargoType?.specialRequirements?.length > 0 && (
                <div className="cargo-requirements">
                  {selectedCargoType.specialRequirements.map(requirement => <span key={requirement}>{requirement}</span>)}
                </div>
              )}
            </div>

            {bookingData.cargoType && recommendedTrailers.length > 0 && (
              <div className="form-group">
                <label>Recommended Trailer Type</label>
                <div className="vehicle-options trailer-recommendations">
                  {recommendedTrailers.map(trailer => {
                    const trailerName = getRecordLabel(trailer);
                    return (
                      <button
                        type="button"
                        key={getRecordId(trailer) || trailerName}
                        className={`vehicle-option ${bookingData.trailerType === trailerName ? 'selected' : ''}`}
                        onClick={() => handleInputChange('trailerType', trailerName)}
                      >
                        <Package className="icon" />
                        <span>{trailerName}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="insurance-section">
              <label className="checkbox-label">
                <input type="checkbox" checked={bookingData.insurance} onChange={(e) => handleInputChange('insurance', e.target.checked)} />
                <span>Add cargo insurance</span>
              </label>
              {bookingData.insurance && (
                <div className="insurance-quote-panel">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Cargo Value (USD)</label>
                      <input type="number" placeholder="Enter cargo value" value={bookingData.insuranceValue} onChange={(e) => handleInputChange('insuranceValue', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label>Coverage Type</label>
                      <select value={bookingData.coverageType} onChange={(e) => handleInputChange('coverageType', e.target.value)}>
                        <option value="basic">Basic</option>
                        <option value="standard">Standard</option>
                        <option value="comprehensive">Comprehensive</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>
                  </div>
                  <button type="button" className="btn-secondary" onClick={loadInsuranceQuotes} disabled={insuranceLoading}>
                    {insuranceLoading ? <Loader className="icon spinning" /> : <Shield className="icon" />}
                    Get Insurance Quotes
                  </button>
                  <div className="insurance-quotes">
                    {insuranceQuotes.map((insuranceQuote) => (
                      <button
                        type="button"
                        key={`${insuranceQuote.providerCode}-${insuranceQuote.productCode}`}
                        className={`insurance-quote-card ${selectedInsuranceQuote?.providerCode === insuranceQuote.providerCode && selectedInsuranceQuote?.productCode === insuranceQuote.productCode ? 'selected' : ''}`}
                        onClick={() => setSelectedInsuranceQuote(insuranceQuote)}
                      >
                        <span>{insuranceQuote.providerName}</span>
                        <strong>${insuranceQuote.premium}</strong>
                        <small>{insuranceQuote.productName} • Covers ${insuranceQuote.coverageAmount}</small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="step-actions">
            <button className="btn-secondary" onClick={() => setStep(1)}><ChevronLeft className="icon" /> Back</button>
            <button className="btn-primary" onClick={() => setStep(3)} disabled={!bookingData.cargoType || !bookingData.vehicleType}>
              Continue <ArrowRight className="icon" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Schedule */}
      {step === 3 && (
        <div className="booking-step">
          <h2 className="step-title">Schedule Pickup</h2>
          <div className="schedule-form">
            <div className="form-row">
              <div className="form-group">
                <label>Pickup Date</label>
                <input type="date" value={bookingData.pickupDate} onChange={(e) => handleInputChange('pickupDate', e.target.value)} min={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="form-group">
                <label>Preferred Time</label>
                <select value={bookingData.pickupTime} onChange={(e) => handleInputChange('pickupTime', e.target.value)}>
                  <option value="">Select time</option>
                  <option value="morning">Morning (6AM - 12PM)</option>
                  <option value="afternoon">Afternoon (12PM - 6PM)</option>
                  <option value="evening">Evening (6PM - 9PM)</option>
                </select>
              </div>
            </div>

            <div className="booking-summary-preview">
              <h4>Booking Summary</h4>
              <div className="summary-item"><span>Route:</span><span>{bookingData.pickupCity} → {bookingData.deliveryCity}</span></div>
              <div className="summary-item"><span>Cargo:</span><span>{bookingData.cargoType} ({bookingData.cargoWeight} tons)</span></div>
              <div className="summary-item"><span>Vehicle:</span><span>{bookingData.vehicleType}</span></div>
              {bookingData.trailerType && <div className="summary-item"><span>Trailer:</span><span>{bookingData.trailerType}</span></div>}
              <div className="summary-item"><span>Date:</span><span>{bookingData.pickupDate || 'Not selected'}</span></div>
            </div>
          </div>
          <div className="step-actions">
            <button className="btn-secondary" onClick={() => setStep(2)}><ChevronLeft className="icon" /> Back</button>
            <button className="btn-primary" onClick={calculateQuote} disabled={!bookingData.pickupDate || loading || (bookingData.insurance && !selectedInsuranceQuote)}>
              {loading ? <Loader className="icon spinning" /> : <>Get Quote <ArrowRight className="icon" /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Pay */}
      {step === 4 && quote && (
        <div className="booking-step">
          <h2 className="step-title">Review & Payment</h2>
          <div className="review-section">
            <div className="quote-card">
              <h3>Price Quote</h3>
              <div className="quote-details">
                <div className="quote-row"><span>Base Fare</span><span>${quote.subtotal}</span></div>
                {bookingData.insurance && <div className="quote-row"><span>Insurance</span><span>${quote.insurance}</span></div>}
                {bookingData.insurance && selectedInsuranceQuote && (
                  <div className="quote-row"><span>Provider</span><span>{selectedInsuranceQuote.providerName}</span></div>
                )}
                <div className="quote-row"><span>Platform Fee (15%)</span><span>${quote.platformFee}</span></div>
                <div className="quote-row total"><span>Total</span><span>${quote.total}</span></div>
              </div>
              <div className="estimate-info">
                <div><Navigation className="icon" /> Est. Distance: {quote.estimatedDistance} km</div>
                <div><Clock className="icon" /> Est. Time: {quote.estimatedTime}</div>
              </div>
            </div>

            <div className="payment-section">
              <h3>Payment Method</h3>
              <div className="payment-options">
                {[
                  {
                    method: 'clicknpay',
                    label: 'ClicknPay Checkout',
                    description: 'Choose card, bank, EcoCash, OneMoney, or any enabled method on ClicknPay'
                  }
                ].map(({ method, label, description }) => (
                  <button key={method} className={`payment-option ${bookingData.paymentMethod === method ? 'selected' : ''}`} onClick={() => handleInputChange('paymentMethod', method)}>
                    <CreditCard className="icon" />
                    <span>{label}</span>
                    <small>{description}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="step-actions">
            <button className="btn-secondary" onClick={() => setStep(3)}><ChevronLeft className="icon" /> Back</button>
            <button className="btn-primary btn-pay" onClick={submitBooking} disabled={loading}>
              {loading ? <Loader className="icon spinning" /> : <>Pay ${quote.total} with ClicknPay</>}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Confirmation */}
      {step === 5 && (
        <div className="booking-step confirmation-step">
          <div className="confirmation-content">
            <div className="success-icon"><CheckCircle className="icon" /></div>
            <h2>Booking Confirmed!</h2>
            <p>Your booking has been created successfully</p>
            <div className="booking-reference">
              <span>Booking Reference:</span>
              <strong>{bookingRef || 'Processing...'}</strong>
            </div>
            <p className="confirmation-note">We're finding the best transporter for you. You'll receive a notification once a driver is assigned.</p>
            <div className="confirmation-actions">
              <button className="btn-primary" onClick={() => setActiveNav('track')}>Track Shipment</button>
              <button className="btn-secondary" onClick={() => { setStep(1); setQuote(null); setBookingData({
                pickupAddress: '', pickupCity: '', pickupPhone: '',
                deliveryAddress: '', deliveryCity: '', deliveryPhone: '',
                cargoType: '', cargoWeight: '', cargoDescription: '',
                vehicleType: '', trailerType: '', pickupDate: '', pickupTime: '',
                insurance: false, insuranceValue: '', coverageType: 'standard', paymentMethod: 'clicknpay'
              }); }}>Create Another Booking</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ Track Shipments Tab ============
const TrackShipmentsTab = () => {
  const [searchId, setSearchId] = useState('');
  const [selectedShipment, setSelectedShipment] = useState(null);
  const [trackingDetail, setTrackingDetail] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');
  const [liveTracking, setLiveTracking] = useState({ connected: false, location: null, status: null, error: '' });
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);
  const subscriptionRef = useRef(null);
  const socketServiceRef = useRef(null);

  useEffect(() => () => {
    if (subscriptionRef.current && socketServiceRef.current) {
      socketServiceRef.current.unsubscribeFromTracking(subscriptionRef.current);
    }
  }, []);

  useEffect(() => {
    const fetchActiveShipments = async () => {
      try {
        setLoading(true);
        const response = await shipperAPI.getActiveShipments();
        const data = response.data || [];

        setShipments(data.map(b => ({
          id: b.bookingReference || b.shipmentId || b._id,
          recordId: b._id,
          subscriptionId: b.booking || b._id || b.bookingReference || b.shipmentId,
          status: b.status,
          progress: getProgress(b.status),
          route: getRouteLabel(b),
          driver: b.transporter?.fullName || 'Pending Assignment',
          phone: b.transporter?.phone || 'N/A',
          eta: b.schedule?.estimatedDelivery ? new Date(b.schedule.estimatedDelivery).toLocaleTimeString() : 'TBD',
          pickup: b.route?.pickup?.address || b.origin || 'N/A',
          delivery: b.route?.delivery?.address || b.destination || 'N/A',
          lastUpdate: b.updatedAt ? getTimeAgo(new Date(b.updatedAt)) : 'N/A',
          location: b.currentLocation?.address || b.tracking?.[b.tracking.length - 1]?.note || 'Location updating...'
        })));
      } catch (error) {
        console.error('Error fetching shipments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveShipments();
  }, []);

  const getTimeAgo = (date) => {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds} secs ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} mins ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  const filteredShipments = shipments.filter(s =>
    s.id.toLowerCase().includes(searchId.toLowerCase()) ||
    s.route.toLowerCase().includes(searchId.toLowerCase())
  );

  const selectShipment = async (shipment) => {
    if (subscriptionRef.current && subscriptionRef.current !== shipment.subscriptionId) {
      socketServiceRef.current?.unsubscribeFromTracking(subscriptionRef.current);
    }

    setSelectedShipment(shipment);
    setTrackingDetail(null);
    setTrackingError('');
    setLiveTracking({ connected: false, location: null, status: null, error: '' });
    setTrackingLoading(true);

    try {
      const response = await trackingAPI.track(shipment.id || shipment.recordId);
      setTrackingDetail(response.data || response);
    } catch (error) {
      console.error('Error fetching tracking detail:', error);
      setTrackingError(error.message || 'Unable to load tracking detail.');
    } finally {
      setTrackingLoading(false);
    }

    const subscriptionId = shipment.subscriptionId || shipment.recordId || shipment.id;
    subscriptionRef.current = subscriptionId;
    try {
      const socketService = socketServiceRef.current || await loadSocketService();
      socketServiceRef.current = socketService;
      socketService.subscribeToTracking(subscriptionId, {
        onSubscribed: (data) => {
          setLiveTracking(current => ({ ...current, connected: true, status: data.status || current.status, error: '' }));
        },
        onLocation: (data) => {
          setLiveTracking(current => ({ ...current, connected: true, location: data, error: '' }));
        },
        onStatus: (data) => {
          setLiveTracking(current => ({ ...current, connected: true, status: data.status || current.status, error: '' }));
        },
        onError: (error) => {
          setLiveTracking(current => ({ ...current, connected: false, error: error?.message || 'Live updates are unavailable.' }));
        }
      });
    } catch (error) {
      setLiveTracking(current => ({ ...current, connected: false, error: error.message || 'Live updates are unavailable.' }));
    }
  };

  const trackingEvents = trackingDetail?.tracking || trackingDetail?.events || [];
  const lastEvent = trackingEvents[trackingEvents.length - 1];
  const liveLatitude = Number(liveTracking.location?.latitude);
  const liveLongitude = Number(liveTracking.location?.longitude);
  const liveLocationLabel = Number.isFinite(liveLatitude) && Number.isFinite(liveLongitude)
    ? `${liveLatitude.toFixed(5)}, ${liveLongitude.toFixed(5)}`
    : '';
  const currentLocation = liveLocationLabel ||
    trackingDetail?.currentLocation?.address ||
    lastEvent?.location?.address ||
    lastEvent?.note ||
    selectedShipment?.location ||
    'Location updating...';
  const lastUpdatedAt = liveTracking.location?.timestamp || lastEvent?.timestamp || lastEvent?.createdAt;
  const lastUpdatedLabel = lastUpdatedAt ? getTimeAgo(new Date(lastUpdatedAt)) : selectedShipment?.lastUpdate;

  if (loading) {
    return (
      <div className="loading-container">
        <Loader className="icon spinning" />
        <p>Loading shipments...</p>
      </div>
    );
  }

  return (
    <div className="track-shipments-container">
      <div className="track-search-bar">
        <Search className="icon" />
        <input type="text" placeholder="Search by booking ID or route..." value={searchId} onChange={(e) => setSearchId(e.target.value)} />
      </div>

      <div className="track-grid">
        <div className="shipments-list-panel">
          <h3>Active Shipments ({filteredShipments.length})</h3>
          {filteredShipments.length > 0 ? (
            filteredShipments.map(shipment => (
              <div key={shipment.id} className={`shipment-list-item ${selectedShipment?.id === shipment.id ? 'selected' : ''}`} onClick={() => selectShipment(shipment)}>
                <div className="shipment-list-header">
                  <span className="shipment-id">{shipment.id}</span>
                  <span className={`status-badge status-${shipment.status.replace(/_/g, '-')}`}>
                    {shipment.status.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="shipment-list-route"><MapPin className="icon" /> {shipment.route}</div>
                <div className="shipment-list-progress">
                  <div className="progress-bar"><div className="progress-fill" style={{ width: `${shipment.progress}%` }} /></div>
                  <span>{shipment.progress}%</span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-panel-state">
              <Package className="icon" />
              <p>No active shipments match your search.</p>
            </div>
          )}
        </div>

        <div className="shipment-detail-panel">
          {selectedShipment ? (
            <>
              <div className="detail-header">
                <h3>{selectedShipment.id}</h3>
                <span className={`status-badge status-${selectedShipment.status.replace(/_/g, '-')}`}>
                  {selectedShipment.status.replace(/_/g, ' ')}
                </span>
              </div>

              <div className="detail-route-status">
                <div className="route-status-header">
                  <div>
                    <span>{liveTracking.connected ? 'Live Route Status' : 'Route Status'}</span>
                    <strong>{currentLocation}</strong>
                  </div>
                  {trackingLoading ? <Loader className="icon spinning" /> : <Navigation className="icon" />}
                </div>
                {liveTracking.connected && <span className="live-tracking-pill">Live updates connected</span>}
                {liveTracking.error && (
                  <div className="tracking-detail-error">
                    <AlertCircle className="icon" />
                    <span>{liveTracking.error}</span>
                  </div>
                )}
                {trackingError && (
                  <div className="tracking-detail-error">
                    <AlertCircle className="icon" />
                    <span>{trackingError}</span>
                  </div>
                )}
                <div className="route-status-grid">
                  <div>
                    <span>Last updated</span>
                    <strong>{lastUpdatedLabel || 'N/A'}</strong>
                  </div>
                  <div>
                    <span>Progress</span>
                    <strong>{selectedShipment.progress}%</strong>
                  </div>
                  <div>
                    <span>ETA</span>
                    <strong>{selectedShipment.eta}</strong>
                  </div>
                  <div>
                    <span>Speed</span>
                    <strong>{liveTracking.location?.speed ? `${Math.round(liveTracking.location.speed)} km/h` : 'N/A'}</strong>
                  </div>
                </div>
              </div>

              <div className="detail-info">
                <div className="info-row"><span>Current Location:</span><strong>{currentLocation}</strong></div>
                <div className="info-row"><span>ETA:</span><strong>{selectedShipment.eta}</strong></div>
              </div>

              <div className="tracking-events-panel">
                <h4>Tracking Events</h4>
                {trackingLoading ? (
                  <div className="tracking-event-state"><Loader className="icon spinning" /><span>Loading tracking events...</span></div>
                ) : trackingEvents.length > 0 ? (
                  trackingEvents.slice(-4).reverse().map((event, index) => (
                    <div className="tracking-event-row" key={event._id || event.id || `${event.status}-${index}`}>
                      <div className="tracking-event-dot" />
                      <div>
                        <strong>{event.status || event.title || 'Shipment update'}</strong>
                        <span>{event.location?.address || event.note || event.description || event.notes || 'Tracking update recorded'}</span>
                        {(event.timestamp || event.createdAt) && <small>{new Date(event.timestamp || event.createdAt).toLocaleString()}</small>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="tracking-event-state"><Clock className="icon" /><span>No tracking events have been published yet.</span></div>
                )}
              </div>

              <div className="route-timeline">
                <div className="timeline-point pickup"><div className="point-dot" /><div><span className="label">Pickup</span><span className="address">{selectedShipment.pickup}</span></div></div>
                <div className="timeline-line" />
                <div className="timeline-point delivery"><div className="point-dot" /><div><span className="label">Delivery</span><span className="address">{selectedShipment.delivery}</span></div></div>
              </div>

              <div className="driver-card">
                <div className="driver-avatar">{selectedShipment.driver.charAt(0)}</div>
                <div className="driver-info"><strong>{selectedShipment.driver}</strong><span>Assigned Driver</span></div>
                {selectedShipment.phone && selectedShipment.phone !== 'N/A' ? (
                  <a href={`tel:${selectedShipment.phone}`} className="call-btn"><Phone className="icon" /> Call</a>
                ) : (
                  <button className="call-btn" disabled><Phone className="icon" /> Pending</button>
                )}
              </div>
            </>
          ) : (
            <div className="no-selection"><Eye className="icon" /><p>Select a shipment to view details</p></div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ Bookings Tab ============
const BookingsTab = () => {
  const [filter, setFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [bookingsMessage, setBookingsMessage] = useState('');

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        setLoading(true);
        const params = { page: currentPage, limit: 10 };
        if (filter !== 'all') params.status = filter;

        const response = await bookingsAPI.getAll(params);
        const data = response.data || [];

        setBookings(data.map(b => ({
          id: getBookingId(b),
          recordId: b._id,
          date: b.createdAt,
          status: b.status,
          amount: getBookingAmount(b),
          route: getRouteLabel(b),
          shipments: b.shipments || [],
          driver: b.transporter?.fullName || 'N/A'
        })));

        if (response.pages || response.total != null) {
          setPagination({
            pages: response.pages || 1,
            total: response.total || 0,
            currentPage: response.currentPage || 1
          });
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

  if (loading) {
    return (
      <div className="loading-container">
        <Loader className="icon spinning" />
        <p>Loading bookings...</p>
      </div>
    );
  }

  const exportBookings = () => {
    const rows = filteredBookings.map(booking => ({
      bookingId: booking.id,
      date: booking.date,
      route: booking.route,
      driver: booking.driver,
      status: booking.status,
      amount: booking.amount
    }));
    const headers = Object.keys(rows[0] || { message: 'No bookings available' });
    const csv = [
      headers.join(','),
      ...(rows.length ? rows : [{ message: 'No bookings available' }]).map(row => headers.map(header => `"${String(row[header] ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'shipper-bookings.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const viewBooking = async (booking) => {
    setDetailError('');
    setDetailLoading(true);
    setSelectedBooking({ ...booking, loading: true });
    try {
      const response = await bookingsAPI.getById(booking.recordId);
      const data = response.data || booking;
      setSelectedBooking({
        ...data,
        id: getBookingId(data),
        recordId: data._id,
        routeLabel: getRouteLabel(data),
        amount: getBookingAmount(data)
      });
    } catch (error) {
      setDetailError(error.message || 'Unable to load booking.');
      setSelectedBooking(booking);
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadPODFromBookings = async (booking) => {
    setBookingsMessage('');
    try {
      await downloadPODForBooking(booking);
    } catch (error) {
      setBookingsMessage(error.message || 'Unable to download proof of delivery.');
    }
  };

  return (
    <>
    <div className="bookings-container">
      {bookingsMessage && <div className="shipper-modal-error">{bookingsMessage}</div>}
      <div className="bookings-header">
        <div className="filter-tabs">
          {['all', 'in_transit', 'delivered', 'cancelled'].map(f => (
            <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f.replace(/_/g, ' ')}
            </button>
          ))}
        </div>
        <button className="btn-secondary" onClick={exportBookings}><Download className="icon" /> Export</button>
      </div>

      <div className="bookings-table-container">
        <table className="shipper-bookings-table">
          <thead>
            <tr><th>Booking ID</th><th>Date</th><th>Route</th><th>Driver</th><th>Status</th><th>Amount</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {filteredBookings.map(booking => (
              <tr key={booking.id}>
                <td><span className="shipper-shipment-id">{booking.id}</span></td>
                <td>{new Date(booking.date).toLocaleDateString()}</td>
                <td>{booking.route}</td>
                <td>{booking.driver}</td>
                <td><span className={`shipper-booking-status shipper-status-${(booking.status || 'pending').replace(/_/g, '-')}`}>{(booking.status || 'pending').replace(/_/g, ' ')}</span></td>
                <td className="amount">${booking.amount}</td>
                <td>
                  <button className="action-btn" onClick={() => viewBooking(booking)}><Eye className="icon" /></button>
                  {['delivered', 'completed'].includes(booking.status) && (
                    <button
                      className="action-btn"
                      onClick={() => downloadPODFromBookings(booking)}
                    >
                      <FileText className="icon" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <button className="pagination-btn" disabled={currentPage <= 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft className="icon" /></button>
        <span>Page {currentPage} of {pagination.pages || 1}</span>
        <button className="pagination-btn" disabled={currentPage >= pagination.pages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight className="icon" /></button>
      </div>
    </div>
    {selectedBooking && (
      <BookingDetailsModal
        booking={selectedBooking}
        loading={detailLoading}
        error={detailError}
        onPodError={setBookingsMessage}
        onClose={() => {
          setSelectedBooking(null);
          setDetailError('');
        }}
      />
    )}
    </>
  );
};

const BookingDetailsModal = ({ booking, loading, error, onClose, onPodError }) => {
  const status = booking.status || 'pending';
  const amount = booking.amount ?? getBookingAmount(booking);
  const pickup = booking.route?.pickup?.address || booking.pickup?.address || 'N/A';
  const delivery = booking.route?.delivery?.address || booking.delivery?.address || 'N/A';
  const cargo = booking.cargoDetails?.description || booking.cargoDetails?.type || booking.cargoType || 'N/A';
  const transporter = booking.transporter?.fullName || booking.driver || 'Pending Assignment';

  return (
    <div className="shipper-modal-backdrop" role="presentation" onClick={onClose}>
      <div className="shipper-modal" role="dialog" aria-modal="true" aria-label="Booking details" onClick={(event) => event.stopPropagation()}>
        <div className="shipper-modal-header">
          <div>
            <p className="shipper-modal-kicker">Booking</p>
            <h3>{booking.id || getBookingId(booking)}</h3>
          </div>
          <button className="shipper-modal-close" onClick={onClose} aria-label="Close booking details"><X className="icon" /></button>
        </div>

        {loading ? (
          <div className="shipper-modal-loading"><Loader className="icon spinning" /> Loading booking details...</div>
        ) : (
          <>
            {error && <div className="shipper-modal-error">{error}</div>}
            <div className="shipper-detail-grid">
              <div><span>Status</span><strong>{status.replace(/_/g, ' ')}</strong></div>
              <div><span>Transporter</span><strong>{transporter}</strong></div>
              <div><span>Amount</span><strong>${Number(amount || 0).toLocaleString()}</strong></div>
              <div><span>Cargo</span><strong>{cargo}</strong></div>
              <div><span>Pickup</span><strong>{pickup}</strong></div>
              <div><span>Delivery</span><strong>{delivery}</strong></div>
            </div>
            <div className="shipper-modal-actions">
              {['delivered', 'completed'].includes(status) && (
                <button className="btn-secondary" onClick={() => downloadPODForBooking(booking).catch(err => onPodError?.(err.message || 'Unable to download proof of delivery.'))}>
                  <FileText className="icon" /> Download POD
                </button>
              )}
              <button className="btn-primary" onClick={onClose}>Done</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ============ Payments Tab ============
const PaymentsTab = () => {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [preferredMethod, setPreferredMethod] = useState('N/A');

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const response = await paymentsAPI.getAll({ limit: 20 });
        const data = response.data || [];

        setPayments(data.map(p => ({
          id: p._id,
          reference: p.paymentReference || p.reference || p._id?.slice(-8).toUpperCase(),
          date: p.createdAt,
          booking: p.booking?.bookingReference || p.booking?.bookingId || p.bookingId || 'N/A',
          amount: p.amount || 0,
          method: p.method || p.paymentMethod || 'N/A',
          status: p.status || 'pending'
        })));

        const completed = data.filter(p => ['completed', 'confirmed'].includes(p.status));
        setTotalSpent(completed.reduce((sum, p) => sum + (p.amount || 0), 0));
        const methodCounts = data.reduce((counts, payment) => {
          const method = payment.method || payment.paymentMethod || 'N/A';
          counts[method] = (counts[method] || 0) + 1;
          return counts;
        }, {});
        const topMethod = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
        setPreferredMethod(topMethod || 'N/A');
      } catch (error) {
        console.error('Error fetching payments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPayments();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <Loader className="icon spinning" />
        <p>Loading payments...</p>
      </div>
    );
  }

  return (
    <div className="payments-container">
      <div className="payments-stats">
        <div className="payment-stat-card"><DollarSign className="icon" /><div><span className="stat-value">${totalSpent}</span><span className="stat-label">Total Spent</span></div></div>
        <div className="payment-stat-card"><FileText className="icon" /><div><span className="stat-value">{payments.length}</span><span className="stat-label">Transactions</span></div></div>
        <div className="payment-stat-card"><CreditCard className="icon" /><div><span className="stat-value">{preferredMethod}</span><span className="stat-label">Preferred Method</span></div></div>
      </div>

      <div className="payments-table-container">
        <table className="shipper-bookings-table">
          <thead>
            <tr><th>Payment ID</th><th>Date</th><th>Booking</th><th>Method</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {payments.map(payment => (
              <tr key={payment.id}>
                <td>{payment.reference}</td>
                <td>{new Date(payment.date).toLocaleDateString()}</td>
                <td><span className="shipper-shipment-id">{payment.booking}</span></td>
                <td>{payment.method}</td>
                <td className="amount">${payment.amount}</td>
                <td><span className={`shipper-booking-status shipper-status-${payment.status}`}>{payment.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// ============ Favorites Tab ============
const FavoritesTab = ({ setActiveNav }) => {
  const [favorites, setFavorites] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const response = await shipperAPI.getFavoriteTransporters();
        setFavorites(response.data || []);
      } catch (error) {
        console.error('Failed to load favorites:', error);
        setFavorites([]);
      }
    };
    loadFavorites();
  }, []);

  const removeFavorite = async (driver) => {
    try {
      const id = driver._id || driver.id;
      await shipperAPI.removeFavorite(id);
      setFavorites(items => items.filter(item => (item._id || item.id) !== id));
      setMessage(`${driver.fullName || driver.name || 'Transporter'} removed from favorites.`);
    } catch (error) {
      setMessage(error.message || 'Unable to remove favorite.');
    }
  };

  return (
    <div className="favorites-container">
      {message && <div className="shipper-modal-error">{message}</div>}
      <div className="favorites-grid">
        {favorites.map(driver => (
          <div key={driver._id || driver.id} className="favorite-card">
            <div className="favorite-header">
              <div className="favorite-avatar">{(driver.fullName || driver.name || 'T').charAt(0)}</div>
              <button className="favorite-btn active" onClick={() => removeFavorite(driver)}><Heart className="icon" /></button>
            </div>
            <h3>{driver.fullName || driver.name || 'Transporter'}</h3>
            <div className="favorite-rating"><Star className="icon" /> {driver.rating?.average || 0} ({driver.rating?.count || 0} trips)</div>
            <p className="favorite-vehicle">{driver.vehicle || driver.verification?.status || ''}</p>
            <div className="favorite-actions">
              <button className="btn-primary" onClick={() => setActiveNav('new-booking')}>Book Now</button>
              <a href={`tel:${driver.phone || ''}`} className="btn-secondary"><Phone className="icon" /></a>
            </div>
          </div>
        ))}
        {!favorites.length && <div className="empty-state">No favorite transporters yet.</div>}
      </div>
    </div>
  );
};

// ============ Reviews Tab ============
const ReviewsTab = () => {
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const loadReviews = async () => {
      try {
        const response = await ratingsAPI.getAll?.() || await ratingsAPI.getForUser(authAPI.getCurrentUser()?._id);
        setReviews(response.data || response.ratings || []);
      } catch (error) {
        console.error('Failed to load reviews:', error);
        setReviews([]);
      }
    };
    loadReviews();
  }, []);

  return (
    <div className="reviews-container">
      <div className="reviews-list">
        {reviews.map(review => (
          <div key={review._id || review.id} className="review-card">
            <div className="review-header">
              <div className="review-driver"><div className="driver-avatar">{(review.ratee?.user?.fullName || review.driver || 'R').charAt(0)}</div><div><strong>{review.ratee?.user?.fullName || review.driver || 'Review'}</strong><span>{review.booking?.bookingReference || review.booking || ''}</span></div></div>
              <div className="review-rating">{[...Array(5)].map((_, i) => <Star key={i} className={`icon ${i < (review.overallRating || review.rating || 0) ? 'filled' : ''}`} />)}</div>
            </div>
            <p className="review-comment">{review.review?.text || review.comment || ''}</p>
            <span className="review-date">{review.createdAt || review.date ? new Date(review.createdAt || review.date).toLocaleDateString() : ''}</span>
          </div>
        ))}
        {!reviews.length && <div className="empty-state">No reviews yet.</div>}
      </div>
    </div>
  );
};

// ============ Shared Components ============
const ShipperNavItem = ({ icon, label, active, sidebarOpen, onClick }) => (
  <button onClick={onClick} className={`shipper-nav-item ${active ? 'shipper-nav-item-active' : ''}`}>
    <span className="shipper-nav-icon">{icon}</span>
    {sidebarOpen && <span className="shipper-nav-label">{label}</span>}
  </button>
);

const ShipperStatCard = ({ title, value, change, icon, color }) => (
  <div className={`shipper-stat-card shipper-stat-card-${color}`}>
    <div className="shipper-stat-header">
      <div className="shipper-stat-icon-wrapper">{icon}</div>
      {change !== undefined && (
        <div className={`shipper-stat-change ${change >= 0 ? 'positive' : 'negative'}`}>
          {change >= 0 ? <TrendingUp className="icon" /> : <TrendingDown className="icon" />}
          {Math.abs(change)}%
        </div>
      )}
    </div>
    <p className="shipper-stat-title">{title}</p>
    <p className="shipper-stat-value">{value}</p>
  </div>
);

const ShipperShipmentCard = ({ shipment, onTrack }) => {
  const statusConfig = {
    in_transit: { class: 'shipper-status-in-transit', label: 'In Transit' },
    pending_payment: { class: 'shipper-status-awaiting', label: 'Pending Payment' },
    payment_confirmed: { class: 'shipper-status-awaiting', label: 'Payment Confirmed' },
    finding_transporter: { class: 'shipper-status-awaiting', label: 'Finding Transporter' },
    matched: { class: 'shipper-status-awaiting', label: 'Matched' },
    transporter_assigned: { class: 'shipper-status-loading', label: 'Assigned' },
    confirmed: { class: 'shipper-status-loading', label: 'Confirmed' },
    en_route_pickup: { class: 'shipper-status-loading', label: 'En Route' },
    picked_up: { class: 'shipper-status-loading', label: 'Picked Up' },
    in_progress: { class: 'shipper-status-in-transit', label: 'In Progress' },
    arrived_delivery: { class: 'shipper-status-in-transit', label: 'Arrived' },
    delivered: { class: 'shipper-status-in-transit', label: 'Delivered' },
    completed: { class: 'shipper-status-in-transit', label: 'Completed' },
    loading: { class: 'shipper-status-loading', label: 'Loading' },
    awaiting_pickup: { class: 'shipper-status-awaiting', label: 'Awaiting Pickup' }
  };
  const status = statusConfig[shipment.status] || { class: 'shipper-status-awaiting', label: shipment.status?.replace(/_/g, ' ') || 'Pending' };

  return (
    <div className="shipper-shipment-card">
      <div className="shipper-shipment-header">
        <span className="shipper-shipment-id">{shipment.id}</span>
        <span className={`shipper-shipment-status ${status.class}`}>{status.label}</span>
      </div>
      <div className="shipper-shipment-route"><MapPin className="icon" /><span>{shipment.route}</span></div>
      <div className="shipper-shipment-details"><span>Driver: {shipment.driver}</span><span><Clock className="icon" style={{ width: 16, height: 16 }} /> ETA: {shipment.eta}</span></div>
      <div className="shipper-shipment-progress">
        <div className="shipper-progress-bar"><div className="shipper-progress-fill" style={{ width: `${shipment.progress}%` }} /></div>
        <div className="shipper-progress-text">{shipment.progress}% Complete</div>
      </div>
      <div className="shipper-shipment-actions">
        <button className="shipper-btn-track" onClick={onTrack}>Track Live</button>
        {shipment.phone ? (
          <a className="shipper-btn-contact" href={`tel:${shipment.phone}`}>Contact</a>
        ) : (
          <button className="shipper-btn-contact" disabled>Contact</button>
        )}
      </div>
    </div>
  );
};

const ShipperActivityItem = ({ activity }) => {
  const typeIcons = { pickup: <Package className="icon" />, payment: <DollarSign className="icon" />, booking: <Plus className="icon" />, assignment: <Users className="icon" /> };
  return (
    <div className="shipper-activity-item">
      <div className="shipper-activity-icon">{typeIcons[activity.type]}</div>
      <div className="shipper-activity-content">
        <p className="shipper-activity-event">{activity.event}</p>
        <p className="shipper-activity-user">{activity.user}</p>
        <p className="shipper-activity-time">{activity.time}</p>
      </div>
    </div>
  );
};

export default ShipperDashboard;
