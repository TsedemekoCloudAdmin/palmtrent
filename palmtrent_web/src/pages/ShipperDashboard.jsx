import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Package, MapPin, TrendingUp, TrendingDown, Clock, DollarSign, Plus,
  Filter, Search, Download, FileText, Star, Truck, Menu,
  Bell, User, Home, BarChart3, Heart, MessageCircle,
  HelpCircle, LogOut, CheckCircle, AlertCircle, Users,
  ChevronDown, Settings, X, Calendar, ArrowRight, Phone,
  Navigation, Eye, RefreshCw, ChevronLeft, ChevronRight,
  CreditCard, Loader, Check, Upload, Image
} from 'lucide-react';
import { bookingsAPI, trackingAPI, authAPI, paymentsAPI, ratingsAPI, shipperAPI, referenceAPI } from '../services/api';
import './styles/ShipperDashboard.css';

export const ShipperDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState('overview');
  const [timeRange, setTimeRange] = useState('today');
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
        return <FavoritesTab />;
      case 'reviews':
        return <ReviewsTab />;
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
              <div className="shipper-brand-logo"><Truck className="icon" /></div>
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
              </h1>
              <p className="shipper-page-subtitle">Welcome back, John</p>
            </div>
            <div className="shipper-topbar-right">
              <div className="shipper-search-container">
                <Search className="shipper-search-icon" />
                <input type="text" placeholder="Search..." className="shipper-search-input" />
              </div>

              <button className="shipper-notification-btn">
                <Bell className="icon" />
                <span className="shipper-notification-badge"></span>
              </button>

              <div className={`shipper-user-dropdown ${userDropdownOpen ? 'open' : ''}`} ref={userDropdownRef}>
                <button className="shipper-user-trigger" onClick={() => setUserDropdownOpen(!userDropdownOpen)}>
                  <div className="shipper-user-avatar"><span className="shipper-user-avatar-text">JM</span></div>
                  <div className="shipper-user-info">
                    <p className="shipper-user-name">John Moyo</p>
                    <p className="shipper-user-role">Premium Shipper</p>
                  </div>
                  <ChevronDown className="shipper-dropdown-arrow" size={16} />
                </button>

                <div className="shipper-dropdown-menu">
                  <div className="shipper-dropdown-header">
                    <div className="shipper-dropdown-user">
                      <div className="shipper-dropdown-avatar"><span className="shipper-dropdown-avatar-text">JM</span></div>
                      <div className="shipper-dropdown-user-info">
                        <p className="shipper-dropdown-user-name">John Moyo</p>
                        <p className="shipper-dropdown-user-email">john.moyo@example.com</p>
                      </div>
                    </div>
                  </div>
                  <div className="shipper-dropdown-items">
                    {userMenuItems.map((item, index) => (
                      <React.Fragment key={item.id}>
                        <button className="shipper-dropdown-item" onClick={() => setUserDropdownOpen(false)}>
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

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);

        // Fetch bookings
        const bookingsRes = await bookingsAPI.getAll({ limit: 10 });
        const bookings = bookingsRes.data || [];

        // Calculate stats from bookings
        const active = bookings.filter(b => ['pending', 'accepted', 'in_transit', 'picked_up'].includes(b.status));
        const completed = bookings.filter(b => b.status === 'delivered');
        const totalSpent = bookings.reduce((sum, b) => sum + (b.pricing?.total || 0), 0);

        setStats({
          activeShipments: active.length,
          completed: completed.length,
          totalSpent,
          avgRating: 4.8 // TODO: fetch from user profile
        });

        setGrowth({ shipments: 12, completed: 8, spending: 15 }); // TODO: calculate from API

        // Format active shipments
        setActiveShipments(active.slice(0, 3).map(b => ({
          id: b.bookingId || b._id,
          route: `${b.pickup?.city || 'N/A'} → ${b.delivery?.city || 'N/A'}`,
          status: b.status,
          progress: b.status === 'in_transit' ? 50 : b.status === 'picked_up' ? 75 : 10,
          driver: b.transporter?.fullName || 'Pending Assignment',
          eta: b.estimatedDelivery ? new Date(b.estimatedDelivery).toLocaleTimeString() : 'TBD'
        })));

        // Format recent bookings
        setRecentBookings(bookings.slice(0, 5).map(b => ({
          id: b.bookingId || b._id,
          date: new Date(b.createdAt).toLocaleDateString(),
          route: `${b.pickup?.city || 'N/A'} → ${b.delivery?.city || 'N/A'}`,
          status: b.status,
          amount: b.pricing?.total || 0
        })));

        // Mock recent activity for now
        setRecentActivity([
          { time: '2 mins ago', event: 'Shipment picked up', user: active[0]?.bookingId || 'PT-001', type: 'pickup' },
          { time: '1 hour ago', event: 'Payment received', user: completed[0]?.bookingId || 'PT-002', type: 'payment' },
          { time: '3 hours ago', event: 'New booking confirmed', user: bookings[0]?.bookingId || 'PT-003', type: 'booking' }
        ]);

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
              <ShipperShipmentCard key={shipment.id} shipment={shipment} />
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
                <td><button className="shipper-booking-action">View POD</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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
    vehicleType: '', pickupDate: '', pickupTime: '',
    insurance: false, insuranceValue: '',
    paymentMethod: 'ecocash'
  });
  const [quote, setQuote] = useState(null);

  const cargoTypes = ['General Goods', 'Furniture', 'Electronics', 'Agricultural', 'Building Materials', 'Machinery', 'Other'];
  const vehicleTypes = ['Small Truck (1-2 tons)', 'Medium Truck (3-5 tons)', 'Large Truck (6-10 tons)', 'Flatbed Trailer', 'Container Truck'];
  const cities = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo', 'Chinhoyi', 'Victoria Falls', 'Beitbridge'];

  const handleInputChange = (field, value) => {
    setBookingData(prev => ({ ...prev, [field]: value }));
  };

  const calculateQuote = async () => {
    setLoading(true);
    try {
      const quoteData = {
        pickup: { city: bookingData.pickupCity, address: bookingData.pickupAddress },
        delivery: { city: bookingData.deliveryCity, address: bookingData.deliveryAddress },
        cargo: { type: bookingData.cargoType, weight: parseFloat(bookingData.cargoWeight) || 1 },
        vehicleType: bookingData.vehicleType,
        insurance: bookingData.insurance,
        insuranceValue: bookingData.insurance ? parseFloat(bookingData.insuranceValue) : 0
      };

      const response = await bookingsAPI.getQuote(quoteData);

      if (response.success && response.data) {
        setQuote(response.data);
      } else {
        // Fallback to client-side calculation
        const basePrice = 150;
        const weightFactor = parseFloat(bookingData.cargoWeight) || 1;
        const vehicleFactor = vehicleTypes.indexOf(bookingData.vehicleType) + 1;
        const distance = Math.random() * 400 + 100;
        const subtotal = basePrice + (weightFactor * 10) + (vehicleFactor * 50) + (distance * 0.5);
        const insuranceCost = bookingData.insurance ? (parseFloat(bookingData.insuranceValue) || 0) * 0.02 : 0;
        const platformFee = subtotal * 0.15;
        const total = subtotal + insuranceCost + platformFee;

        setQuote({
          subtotal: subtotal.toFixed(2),
          insurance: insuranceCost.toFixed(2),
          platformFee: platformFee.toFixed(2),
          total: total.toFixed(2),
          estimatedDistance: distance.toFixed(0),
          estimatedTime: `${Math.ceil(distance / 60)} hours`
        });
      }
      setStep(4);
    } catch (error) {
      console.error('Quote error:', error);
      // Fallback calculation on error
      const basePrice = 150;
      const weightFactor = parseFloat(bookingData.cargoWeight) || 1;
      const vehicleFactor = vehicleTypes.indexOf(bookingData.vehicleType) + 1;
      const distance = 250;
      const subtotal = basePrice + (weightFactor * 10) + (vehicleFactor * 50) + (distance * 0.5);
      const insuranceCost = bookingData.insurance ? (parseFloat(bookingData.insuranceValue) || 0) * 0.02 : 0;
      const platformFee = subtotal * 0.15;
      const total = subtotal + insuranceCost + platformFee;

      setQuote({
        subtotal: subtotal.toFixed(2),
        insurance: insuranceCost.toFixed(2),
        platformFee: platformFee.toFixed(2),
        total: total.toFixed(2),
        estimatedDistance: distance.toFixed(0),
        estimatedTime: `${Math.ceil(distance / 60)} hours`
      });
      setStep(4);
    } finally {
      setLoading(false);
    }
  };

  const [bookingRef, setBookingRef] = useState('');

  const submitBooking = async () => {
    setLoading(true);
    try {
      const bookingPayload = {
        pickup: {
          city: bookingData.pickupCity,
          address: bookingData.pickupAddress,
          contactPhone: bookingData.pickupPhone
        },
        delivery: {
          city: bookingData.deliveryCity,
          address: bookingData.deliveryAddress,
          contactPhone: bookingData.deliveryPhone
        },
        cargo: {
          type: bookingData.cargoType,
          weight: parseFloat(bookingData.cargoWeight),
          description: bookingData.cargoDescription
        },
        vehicleType: bookingData.vehicleType,
        scheduledPickup: {
          date: bookingData.pickupDate,
          timeSlot: bookingData.pickupTime
        },
        insurance: bookingData.insurance,
        insuranceValue: bookingData.insurance ? parseFloat(bookingData.insuranceValue) : 0,
        paymentMethod: bookingData.paymentMethod,
        pricing: quote
      };

      const response = await bookingsAPI.create(bookingPayload);

      if (response.success) {
        setBookingRef(response.data.bookingId || response.data._id);
        setStep(5);
      } else {
        throw new Error(response.message || 'Booking failed');
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert('Failed to create booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="new-booking-container">
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
              <label>Vehicle Type Required</label>
              <div className="vehicle-options">
                {vehicleTypes.map(type => (
                  <button key={type} className={`vehicle-option ${bookingData.vehicleType === type ? 'selected' : ''}`} onClick={() => handleInputChange('vehicleType', type)}>
                    <Truck className="icon" />
                    <span>{type}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="insurance-section">
              <label className="checkbox-label">
                <input type="checkbox" checked={bookingData.insurance} onChange={(e) => handleInputChange('insurance', e.target.checked)} />
                <span>Add cargo insurance</span>
              </label>
              {bookingData.insurance && (
                <div className="form-group">
                  <label>Cargo Value (USD)</label>
                  <input type="number" placeholder="Enter cargo value" value={bookingData.insuranceValue} onChange={(e) => handleInputChange('insuranceValue', e.target.value)} />
                  <small>Insurance premium: 2% of cargo value</small>
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
              <div className="summary-item"><span>Date:</span><span>{bookingData.pickupDate || 'Not selected'}</span></div>
            </div>
          </div>
          <div className="step-actions">
            <button className="btn-secondary" onClick={() => setStep(2)}><ChevronLeft className="icon" /> Back</button>
            <button className="btn-primary" onClick={calculateQuote} disabled={!bookingData.pickupDate || loading}>
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
                {['ecocash', 'innbucks', 'card', 'bank'].map(method => (
                  <button key={method} className={`payment-option ${bookingData.paymentMethod === method ? 'selected' : ''}`} onClick={() => handleInputChange('paymentMethod', method)}>
                    <CreditCard className="icon" />
                    <span>{method === 'ecocash' ? 'EcoCash' : method === 'innbucks' ? 'InnBucks' : method === 'card' ? 'Card' : 'Bank Transfer'}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="step-actions">
            <button className="btn-secondary" onClick={() => setStep(3)}><ChevronLeft className="icon" /> Back</button>
            <button className="btn-primary btn-pay" onClick={submitBooking} disabled={loading}>
              {loading ? <Loader className="icon spinning" /> : <>Pay ${quote.total} & Confirm</>}
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
                vehicleType: '', pickupDate: '', pickupTime: '',
                insurance: false, insuranceValue: '', paymentMethod: 'ecocash'
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
  const [loading, setLoading] = useState(true);
  const [shipments, setShipments] = useState([]);

  useEffect(() => {
    const fetchActiveShipments = async () => {
      try {
        setLoading(true);
        const response = await bookingsAPI.getAll({ status: 'in_transit,picked_up,accepted,pending', limit: 20 });
        const data = response.data || [];

        setShipments(data.map(b => ({
          id: b.bookingId || b._id,
          route: `${b.pickup?.city || 'N/A'} → ${b.delivery?.city || 'N/A'}`,
          status: b.status,
          progress: b.status === 'delivered' ? 100 : b.status === 'in_transit' ? 65 : b.status === 'picked_up' ? 80 : b.status === 'accepted' ? 15 : 5,
          driver: b.transporter?.fullName || 'Pending Assignment',
          phone: b.transporter?.phone || 'N/A',
          eta: b.estimatedDelivery ? new Date(b.estimatedDelivery).toLocaleTimeString() : 'TBD',
          pickup: b.pickup?.address || b.pickup?.city || 'N/A',
          delivery: b.delivery?.address || b.delivery?.city || 'N/A',
          lastUpdate: b.updatedAt ? getTimeAgo(new Date(b.updatedAt)) : 'N/A',
          location: b.currentLocation?.address || 'Location updating...'
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
          {filteredShipments.map(shipment => (
            <div key={shipment.id} className={`shipment-list-item ${selectedShipment?.id === shipment.id ? 'selected' : ''}`} onClick={() => setSelectedShipment(shipment)}>
              <div className="shipment-list-header">
                <span className="shipment-id">{shipment.id}</span>
                <span className={`status-badge status-${shipment.status.replace('_', '-')}`}>
                  {shipment.status.replace('_', ' ')}
                </span>
              </div>
              <div className="shipment-list-route"><MapPin className="icon" /> {shipment.route}</div>
              <div className="shipment-list-progress">
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${shipment.progress}%` }} /></div>
                <span>{shipment.progress}%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="shipment-detail-panel">
          {selectedShipment ? (
            <>
              <div className="detail-header">
                <h3>{selectedShipment.id}</h3>
                <span className={`status-badge status-${selectedShipment.status.replace('_', '-')}`}>
                  {selectedShipment.status.replace('_', ' ')}
                </span>
              </div>

              <div className="detail-map-placeholder">
                <Navigation className="icon" />
                <p>Live Map View</p>
                <small>Last updated: {selectedShipment.lastUpdate}</small>
              </div>

              <div className="detail-info">
                <div className="info-row"><span>Current Location:</span><strong>{selectedShipment.location}</strong></div>
                <div className="info-row"><span>ETA:</span><strong>{selectedShipment.eta}</strong></div>
              </div>

              <div className="route-timeline">
                <div className="timeline-point pickup"><div className="point-dot" /><div><span className="label">Pickup</span><span className="address">{selectedShipment.pickup}</span></div></div>
                <div className="timeline-line" />
                <div className="timeline-point delivery"><div className="point-dot" /><div><span className="label">Delivery</span><span className="address">{selectedShipment.delivery}</span></div></div>
              </div>

              <div className="driver-card">
                <div className="driver-avatar">{selectedShipment.driver.charAt(0)}</div>
                <div className="driver-info"><strong>{selectedShipment.driver}</strong><span>Assigned Driver</span></div>
                <a href={`tel:${selectedShipment.phone}`} className="call-btn"><Phone className="icon" /> Call</a>
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
          amount: b.pricing?.total || 0,
          driver: b.transporter?.fullName || 'N/A'
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
    <div className="bookings-container">
      <div className="bookings-header">
        <div className="filter-tabs">
          {['all', 'in_transit', 'delivered', 'cancelled'].map(f => (
            <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f.replace('_', ' ')}
            </button>
          ))}
        </div>
        <button className="btn-secondary"><Download className="icon" /> Export</button>
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
                <td><span className={`shipper-booking-status shipper-status-${booking.status.replace('_', '-')}`}>{booking.status.replace('_', ' ')}</span></td>
                <td className="amount">${booking.amount}</td>
                <td>
                  <button className="action-btn"><Eye className="icon" /></button>
                  {booking.status === 'delivered' && <button className="action-btn"><FileText className="icon" /></button>}
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
  );
};

// ============ Payments Tab ============
const PaymentsTab = () => {
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState([]);
  const [totalSpent, setTotalSpent] = useState(0);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        setLoading(true);
        const response = await paymentsAPI.getAll({ limit: 20 });
        const data = response.data || [];

        setPayments(data.map(p => ({
          id: p._id,
          date: p.createdAt,
          booking: p.booking?.bookingId || p.bookingId || 'N/A',
          amount: p.amount || 0,
          method: p.method || 'N/A',
          status: p.status || 'pending'
        })));

        const completed = data.filter(p => p.status === 'completed');
        setTotalSpent(completed.reduce((sum, p) => sum + (p.amount || 0), 0));
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
        <div className="payment-stat-card"><CreditCard className="icon" /><div><span className="stat-value">EcoCash</span><span className="stat-label">Preferred Method</span></div></div>
      </div>

      <div className="payments-table-container">
        <table className="shipper-bookings-table">
          <thead>
            <tr><th>Payment ID</th><th>Date</th><th>Booking</th><th>Method</th><th>Amount</th><th>Status</th></tr>
          </thead>
          <tbody>
            {payments.map(payment => (
              <tr key={payment.id}>
                <td>{payment.id}</td>
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
const FavoritesTab = () => {
  const favorites = [
    { id: 1, name: 'Trust Ncube', rating: 4.9, trips: 15, vehicle: 'Medium Truck', phone: '+263 77 123 4567' },
    { id: 2, name: 'Peter Ndlovu', rating: 4.8, trips: 8, vehicle: 'Large Truck', phone: '+263 77 234 5678' },
    { id: 3, name: 'Mike Chikwanha', rating: 4.7, trips: 12, vehicle: 'Flatbed', phone: '+263 77 345 6789' }
  ];

  return (
    <div className="favorites-container">
      <div className="favorites-grid">
        {favorites.map(driver => (
          <div key={driver.id} className="favorite-card">
            <div className="favorite-header">
              <div className="favorite-avatar">{driver.name.charAt(0)}</div>
              <button className="favorite-btn active"><Heart className="icon" /></button>
            </div>
            <h3>{driver.name}</h3>
            <div className="favorite-rating"><Star className="icon" /> {driver.rating} ({driver.trips} trips)</div>
            <p className="favorite-vehicle">{driver.vehicle}</p>
            <div className="favorite-actions">
              <button className="btn-primary">Book Now</button>
              <a href={`tel:${driver.phone}`} className="btn-secondary"><Phone className="icon" /></a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ============ Reviews Tab ============
const ReviewsTab = () => {
  const reviews = [
    { id: 1, driver: 'Trust Ncube', booking: 'PT-2025-001230', rating: 5, comment: 'Excellent service! Delivered on time and handled cargo with care.', date: '2025-01-08' },
    { id: 2, driver: 'Peter Ndlovu', booking: 'PT-2025-001220', rating: 4, comment: 'Good service, slight delay but communicated well.', date: '2025-01-03' }
  ];

  return (
    <div className="reviews-container">
      <div className="reviews-list">
        {reviews.map(review => (
          <div key={review.id} className="review-card">
            <div className="review-header">
              <div className="review-driver"><div className="driver-avatar">{review.driver.charAt(0)}</div><div><strong>{review.driver}</strong><span>{review.booking}</span></div></div>
              <div className="review-rating">{[...Array(5)].map((_, i) => <Star key={i} className={`icon ${i < review.rating ? 'filled' : ''}`} />)}</div>
            </div>
            <p className="review-comment">{review.comment}</p>
            <span className="review-date">{new Date(review.date).toLocaleDateString()}</span>
          </div>
        ))}
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

const ShipperShipmentCard = ({ shipment }) => {
  const statusConfig = {
    in_transit: { class: 'shipper-status-in-transit', label: 'In Transit' },
    loading: { class: 'shipper-status-loading', label: 'Loading' },
    awaiting_pickup: { class: 'shipper-status-awaiting', label: 'Awaiting Pickup' }
  };
  const status = statusConfig[shipment.status];

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
        <button className="shipper-btn-track">Track Live</button>
        <button className="shipper-btn-contact">Contact</button>
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
