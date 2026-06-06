import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Package, Shield, MapPin, Star, Clock, DollarSign, Users,
  ArrowRight, Check, Menu, X, Eye, EyeOff, Search, Loader, AlertCircle,
  Mail, Lock, User, Phone, Building
} from 'lucide-react';
import { authAPI, paymentsAPI, publicAPI, trackingAPI } from '../services/api';
import './styles/LandingPage.css';
import logo from '../assets/logo3.png';

const PHONE_VERIFICATION_DISABLED = import.meta.env.VITE_DISABLE_PHONE_VERIFICATION !== 'false';
const FALLBACK_STATS = {
  activeTransporters: '2,000+',
  completedDeliveries: '10,000+',
  averageRating: '4.8/5'
};

const getTrackingAddress = (point) => point?.address || point?.city || point?.name || 'N/A';

const isPlanCompatibleWithUser = (planAudience, userType) => (
  planAudience === userType ||
  (planAudience === 'trailer_owner' && ['transporter', 'rental_owner'].includes(userType)) ||
  (planAudience === 'rental_owner' && ['trailer_owner', 'rental_owner'].includes(userType))
);

const getSignupTypeForPlan = (plan) => (
  plan?.audience === 'trailer_owner' ? 'rental_owner' : plan?.audience
);

const getRoleHomePath = (user) => {
  switch (user?.userType) {
    case 'admin':
      return '/admin';
    case 'corporate':
      return '/corp';
    case 'trailer_owner':
    case 'rental_owner':
    case 'transporter':
    case 'driver':
      return '/fleet';
    case 'shipper':
    default:
      return '/shipper';
  }
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userType, setUserType] = useState('shipper');
  const [isYearly, setIsYearly] = useState(false);

  // Modal states
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [showTrackingModal, setShowTrackingModal] = useState(false);

  // Auth form states
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    userType: 'shipper'
  });
  const [verificationCode, setVerificationCode] = useState('');
  const [verificationPhone, setVerificationPhone] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [verificationVerified, setVerificationVerified] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [landingStats, setLandingStats] = useState({});
  const [landingPlans, setLandingPlans] = useState([]);
  const [selectedPlanCode, setSelectedPlanCode] = useState('');
  const [subscriptionMessage, setSubscriptionMessage] = useState('');

  // Tracking states
  const [trackingId, setTrackingId] = useState('');
  const [trackingResult, setTrackingResult] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');

  useEffect(() => {
    let mounted = true;

    publicAPI.getLanding()
      .then((response) => {
        if (!mounted) return;
        setLandingStats(response.data?.stats || {});
        setLandingPlans(response.data?.plans || []);
      })
      .catch((error) => {
        console.warn('Could not load landing page data:', error.message);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const displayStats = useMemo(() => {
    const formatCount = (value, fallback) => {
      const number = Number(value || 0);
      if (number <= 500) return fallback;
      return `${new Intl.NumberFormat('en-US').format(number)}+`;
    };

    const ratingCount = Number(landingStats.ratingCount || 0);
    const averageRating = Number(landingStats.averageRating || 0);

    return {
      activeTransporters: formatCount(landingStats.activeTransporters, FALLBACK_STATS.activeTransporters),
      completedDeliveries: formatCount(landingStats.completedDeliveries, FALLBACK_STATS.completedDeliveries),
      averageRating: ratingCount > 500 && averageRating > 0
        ? `${averageRating.toFixed(1)}/5`
        : FALLBACK_STATS.averageRating
    };
  }, [landingStats]);

  const visiblePlans = useMemo(() => {
    const preferredCycle = isYearly ? 'annual' : 'monthly';
    const preferred = landingPlans.filter((plan) => plan.billingCycle === preferredCycle);
    return preferred.length ? preferred : landingPlans;
  }, [isYearly, landingPlans]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const response = await authAPI.login(loginForm.email, loginForm.password);
      if (response.token || response.data?.token) {
        setShowLoginModal(false);
        const currentUser = authAPI.getCurrentUser();
        navigate(currentUser?.mustChangePassword ? '/change-password' : getRoleHomePath(currentUser));
      }
    } catch (error) {
      setAuthError(error.message || 'Login failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const normalizeZimbabwePhone = (phone) => {
    const cleaned = String(phone || '').replace(/[\s-]/g, '');
    if (cleaned.startsWith('+263')) return cleaned;
    if (cleaned.startsWith('263')) return `+${cleaned}`;
    if (cleaned.startsWith('0')) return `+263${cleaned.slice(1)}`;
    return cleaned;
  };

  const validateRegisterForm = () => {
    setAuthError('');

    if (registerForm.password !== registerForm.confirmPassword) {
      setAuthError('Passwords do not match');
      return false;
    }

    if (registerForm.password.length < 8) {
      setAuthError('Password must be at least 8 characters');
      return false;
    }

    const phone = normalizeZimbabwePhone(registerForm.phone);
    if (!/^\+263[0-9]{9}$/.test(phone)) {
      setAuthError('Please enter a valid Zimbabwean phone number in +263 format');
      return false;
    }

    return true;
  };

  const sendRegistrationCode = async () => {
    if (!validateRegisterForm()) return;

    const phone = normalizeZimbabwePhone(registerForm.phone);
    setAuthLoading(true);

    try {
      await authAPI.sendVerificationCode(phone);
      setVerificationPhone(phone);
      setVerificationSent(true);
      setVerificationVerified(false);
      setVerificationCode('');
    } catch (error) {
      setAuthError(error.message || 'Could not send verification code.');
    } finally {
      setAuthLoading(false);
    }
  };

  const verifyRegistrationCode = async () => {
    setAuthError('');
    if (!verificationCode.trim()) {
      setAuthError('Enter the verification code sent to your phone');
      return;
    }

    setAuthLoading(true);

    try {
      await authAPI.verifyCode(verificationPhone, verificationCode.trim());
      setVerificationVerified(true);
      await submitRegistration();
    } catch (error) {
      setAuthError(error.message || 'Could not verify phone number.');
    } finally {
      setAuthLoading(false);
    }
  };

  const resendRegistrationCode = async () => {
    setAuthError('');
    setAuthLoading(true);

    try {
      await authAPI.resendVerificationCode(verificationPhone || normalizeZimbabwePhone(registerForm.phone));
      setVerificationCode('');
    } catch (error) {
      setAuthError(error.message || 'Could not resend verification code.');
    } finally {
      setAuthLoading(false);
    }
  };

  const submitRegistration = async () => {
    const phone = verificationPhone || normalizeZimbabwePhone(registerForm.phone);
    const response = await authAPI.register({
      fullName: registerForm.fullName,
      email: registerForm.email,
      phone,
      password: registerForm.password,
      userType: registerForm.userType
    });

    if (!(response.token || response.data?.token)) {
      throw new Error(response.message || 'Account created, but sign-in did not complete. Please try signing in.');
    }

    const registrationPlanCode = selectedPlanCode || (registerForm.userType === 'driver' ? 'driver_annual' : '');
    if (registrationPlanCode) {
      try {
        const subscription = await publicAPI.createSubscription(registrationPlanCode);
        setSubscriptionMessage(subscription.message || 'Subscription selected. Complete payment to activate access.');
        const redirected = await startSubscriptionPayment(subscription.data);
        if (redirected) return;
      } catch (error) {
        setSubscriptionMessage(error.message || 'Account created. Subscription selection still needs to be completed.');
      }
    }

    setShowRegisterModal(false);
    setVerificationSent(false);
    setVerificationVerified(false);
    setVerificationCode('');
    setSelectedPlanCode('');
    navigate(getRoleHomePath(authAPI.getCurrentUser()));
  };

  const startSubscriptionPayment = async (subscription) => {
    const subscriptionId = subscription?._id || subscription?.id;
    const amount = Number(subscription?.amount || subscription?.plan?.price || 0);
    const paymentStatus = subscription?.payment?.status;

    if (!subscriptionId || amount <= 0 || paymentStatus === 'paid' || paymentStatus === 'not_required') {
      return false;
    }

    const currentUser = authAPI.getCurrentUser() || {};
    const customer = {
      email: currentUser.email || registerForm.email,
      phone: currentUser.phone || normalizeZimbabwePhone(registerForm.phone)
    };
    const paymentResponse = await publicAPI.createSubscriptionPayment(subscriptionId, 'clicknpay', customer);
    const payment = paymentResponse.data || {};

    if (!payment.paymentRequired) {
      return false;
    }

    const checkout = await paymentsAPI.startCheckout(payment.paymentReference, customer);
    const redirectUrl = checkout.data?.redirectUrl;

    if (!redirectUrl) {
      throw new Error('Payment was created, but no checkout link was returned.');
    }

    sessionStorage.setItem('palmtrent_pending_payment_reference', payment.paymentReference);
    sessionStorage.setItem('palmtrent_pending_payment_context', 'subscription');
    sessionStorage.setItem('palmtrent_pending_subscription_name', subscription?.plan?.name || 'Subscription');
    window.location.href = redirectUrl;
    return true;
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!validateRegisterForm()) return;

    if (PHONE_VERIFICATION_DISABLED) {
      setAuthLoading(true);
      try {
        await submitRegistration();
      } catch (error) {
        setAuthError(error.message || 'Registration failed. Please try again.');
      } finally {
        setAuthLoading(false);
      }
      return;
    }

    if (!verificationSent || verificationPhone !== normalizeZimbabwePhone(registerForm.phone)) {
      await sendRegistrationCode();
      return;
    }

    if (!verificationVerified) {
      await verifyRegistrationCode();
      return;
    }

    setAuthLoading(true);

    try {
      await submitRegistration();
    } catch (error) {
      setAuthError(error.message || 'Registration failed. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleForgotPassword = async (event) => {
    event.preventDefault();
    const email = (forgotEmail || loginForm.email).trim();
    setAuthError('');
    setAuthSuccess('');
    if (!email) {
      setAuthError('Enter your account email address.');
      return;
    }

    try {
      setAuthLoading(true);
      await authAPI.forgotPassword(email);
      setAuthSuccess('If an account with that email exists, a password reset link has been sent.');
      setForgotEmail('');
      setShowForgotPassword(false);
    } catch (error) {
      setAuthError(error.message || 'Could not send reset link.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleTrackShipment = async (e, options = {}) => {
    e.preventDefault();
    const normalizedTrackingId = trackingId.trim();
    setTrackingError('');
    setTrackingResult(null);

    if (!normalizedTrackingId) {
      setTrackingError('Please enter a tracking ID');
      return;
    }

    setTrackingLoading(true);

    try {
      const result = await trackingAPI.trackPublic(normalizedTrackingId);
      if (options.navigateOnSuccess) {
        navigate(`/tracking/${encodeURIComponent(normalizedTrackingId)}`);
        return;
      }
      setTrackingResult(result.data || result);
    } catch (error) {
      setTrackingError(error.message || 'Tracking ID not found. Please check and try again.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const openRegisterWithType = (type, planCode = '') => {
    setRegisterForm(prev => ({ ...prev, userType: type }));
    setSelectedPlanCode(planCode);
    setVerificationSent(false);
    setVerificationVerified(false);
    setVerificationCode('');
    setAuthError('');
    setShowRegisterModal(true);
  };

  const handleHeroUserTypeChange = (type) => {
    setUserType(type);
    setRegisterForm(prev => ({ ...prev, userType: type }));
  };

  const switchToRegister = () => {
    setShowLoginModal(false);
    setAuthError('');
    setAuthSuccess('');
    setShowForgotPassword(false);
    setSelectedPlanCode('');
    setVerificationSent(false);
    setVerificationVerified(false);
    setVerificationCode('');
    setRegisterForm(prev => ({ ...prev, userType }));
    setShowRegisterModal(true);
  };

  const switchToLogin = () => {
    setShowRegisterModal(false);
    setAuthError('');
    setAuthSuccess('');
    setSelectedPlanCode('');
    setShowLoginModal(true);
  };

  const formatPlanPrice = (plan) => {
    if (!plan) return '';
    if (Number(plan.price || 0) === 0) return 'Contact Sales';
    return `${plan.currency || 'USD'} ${new Intl.NumberFormat('en-US', {
      maximumFractionDigits: Number.isInteger(plan.price) ? 0 : 2
    }).format(plan.price)}`;
  };

  const formatPlanPeriod = (plan) => {
    if (!plan || Number(plan.price || 0) === 0) return '';
    const periods = {
      monthly: '/month',
      quarterly: '/quarter',
      annual: '/year'
    };
    return periods[plan.billingCycle] || `/${plan.billingCycle}`;
  };

  const handlePlanSignup = async (plan) => {
    setAuthError('');
    setSubscriptionMessage('');
    const currentUser = authAPI.getCurrentUser();

    if (!currentUser) {
      openRegisterWithType(getSignupTypeForPlan(plan), plan.code);
      return;
    }

    if (!isPlanCompatibleWithUser(plan.audience, currentUser.userType)) {
      setSubscriptionMessage(`This plan is for ${plan.audience.replace('_', ' ')} accounts. Sign in with the matching account type or create a new account.`);
      return;
    }

    try {
      setAuthLoading(true);
      const response = await publicAPI.createSubscription(plan.code);
      setSubscriptionMessage(response.message || 'Subscription selected. Complete payment to activate access.');
      const redirected = await startSubscriptionPayment(response.data);
      if (redirected) return;
      navigate(getRoleHomePath(currentUser));
    } catch (error) {
      setSubscriptionMessage(error.message || 'Could not select this subscription.');
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="navbar">
        <div className="nav-container">
          <div className="logo">
            <img src={logo} alt="Palmtrent" className="logo-image" />
          </div>

          {/* Desktop Menu */}
          <div className="nav-links">
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#pricing" className="nav-link">Pricing</a>
            <button
              className="nav-button track-btn"
              onClick={() => setShowTrackingModal(true)}
            >
              <Search className="icon" />
              Track Shipment
            </button>
            <button
              className="nav-button secondary"
              onClick={() => setShowLoginModal(true)}
            >
              Sign In
            </button>
            <button
              className="nav-button primary"
              onClick={() => openRegisterWithType(userType)}
            >
              Get Started
            </button>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="mobile-menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X className="icon" /> : <Menu className="icon" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="mobile-menu">
            <div className="mobile-menu-content">
              <a href="#features" className="mobile-nav-link">Features</a>
              <a href="#how-it-works" className="mobile-nav-link">How It Works</a>
              <a href="#pricing" className="mobile-nav-link">Pricing</a>
              <button
                className="mobile-nav-button track"
                onClick={() => { setShowTrackingModal(true); setMenuOpen(false); }}
              >
                <Search className="icon" />
                Track Shipment
              </button>
              <button
                className="mobile-nav-button secondary"
                onClick={() => { setShowLoginModal(true); setMenuOpen(false); }}
              >
                Sign In
              </button>
              <button
                className="mobile-nav-button primary"
                onClick={() => { openRegisterWithType(userType); setMenuOpen(false); }}
              >
                Get Started
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Zimbabwe's #1 <span className="highlight">Logistics Marketplace</span>
            </h1>
            <p className="hero-description">
              Connect with verified transporters or find loads for your truck. Safe, transparent, and efficient transport services across Zimbabwe and SADC.
            </p>

            {/* Quick Track Widget */}
            <div className="quick-track-widget">
              <form onSubmit={(event) => handleTrackShipment(event, { navigateOnSuccess: true })} className="quick-track-form">
                <div className="track-input-wrapper">
                  <Search className="icon" />
                  <input
                    type="text"
                    placeholder="Enter tracking ID (e.g., PT-2025-XXXXXX)"
                    value={trackingId}
                    onChange={(e) => setTrackingId(e.target.value)}
                  />
                </div>
                <button type="submit" className="track-submit-btn" disabled={trackingLoading}>
                  {trackingLoading ? <Loader className="icon spinning" /> : 'Track'}
                </button>
              </form>
            </div>

            {/* Trust Indicators */}
            <div className="trust-indicators">
              <div className="trust-item">
                <Check className="icon success" />
                <span>Verified Drivers</span>
              </div>
              <div className="trust-item">
                <Check className="icon success" />
                <span>Real-time Tracking</span>
              </div>
              <div className="trust-item">
                <Check className="icon success" />
                <span>Secure Payments</span>
              </div>
            </div>
          </div>

          {/* Hero Stats */}
          <div className="hero-stats">
            <div className="stats-grid">
              <StatCard
                icon={<Users className="icon primary" />}
                value={displayStats.activeTransporters}
                label="Active Transporters"
              />
              <StatCard
                icon={<Package className="icon success" />}
                value={displayStats.completedDeliveries}
                label="Deliveries Completed"
              />
              <StatCard
                icon={<Star className="icon warning" />}
                value={displayStats.averageRating}
                label="Average Rating"
              />
              <StatCard
                icon={<MapPin className="icon accent" />}
                value="All Cities"
                label="Zimbabwe Coverage"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="features-section">
        <div className="container">
          <div className="section-header">
            <h2>Why Choose Palmtrent?</h2>
            <p>Everything you need for safe and efficient transport</p>
          </div>

          <div className="features-grid">
            <FeatureCard
              icon={<Shield className="icon" />}
              title="Verified & Trusted"
              description="All drivers verified with valid licenses, insurance, and background checks"
            />
            <FeatureCard
              icon={<MapPin className="icon" />}
              title="Real-time Tracking"
              description="Track your cargo live with GPS. Know exactly where your goods are"
            />
            <FeatureCard
              icon={<DollarSign className="icon" />}
              title="Secure Payments"
              description="Escrow protection. Funds released only after successful delivery"
            />
            <FeatureCard
              icon={<Clock className="icon" />}
              title="Fast Matching"
              description="Get matched with transporters in minutes, not hours or days"
            />
            <FeatureCard
              icon={<Package className="icon" />}
              title="Insurance Options"
              description="Protect your cargo with comprehensive insurance from trusted partners"
            />
            <FeatureCard
              icon={<Star className="icon" />}
              title="Ratings & Reviews"
              description="Transparent feedback system ensures quality and accountability"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="how-it-works">
        <div className="container">
          <div className="section-header">
            <h2>How It Works</h2>
            <p>Get started in 3 simple steps</p>
          </div>

          <div className="steps-grid">
            <StepCard
              number="1"
              title="Create Your Booking"
              description="Enter pickup and delivery locations, cargo details, and get instant quotes"
            />
            <StepCard
              number="2"
              title="Get Matched"
              description="We find verified transporters nearby and match you with the best option"
            />
            <StepCard
              number="3"
              title="Track & Deliver"
              description="Track your shipment in real-time and confirm delivery with digital proof"
            />
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="pricing-section">
        <div className="container">
          <div className="section-header">
            <h2>Transparent Pricing</h2>
            <p>Choose a subscription plan managed by Palmtrent administrators</p>
          </div>

          {/* Pricing Toggle */}
          <div className="pricing-toggle">
            <span className="toggle-label">Monthly</span>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={isYearly}
                onChange={(e) => setIsYearly(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
            <span className="toggle-label">
              Yearly
            </span>
          </div>

          {subscriptionMessage && (
            <div className="auth-success pricing-message">{subscriptionMessage}</div>
          )}

          <div className="pricing-grid">
            {visiblePlans.map((plan, index) => (
              <PricingCard
                key={plan.code || plan.id}
                title={plan.name}
                audience={plan.audience}
                description={plan.description}
                price={formatPlanPrice(plan)}
                period={formatPlanPeriod(plan)}
                features={plan.features?.length ? plan.features : ['Subscription benefits configured by admin']}
                buttonText="Select Subscription"
                featured={index === 1 || plan.limits?.priorityMatching}
                onButtonClick={() => handlePlanSignup(plan)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Get Started?</h2>
            <p>Join thousands of shippers and transporters using Palmtrent</p>
            <div className="cta-buttons">
              <button
                className="cta-button primary"
                onClick={() => openRegisterWithType('shipper')}
              >
                Book Transport Now
              </button>
              <button
                className="cta-button secondary"
                onClick={() => openRegisterWithType('transporter')}
              >
                Register as Transporter
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="logo">
                <img src={logo} alt="Palmtrent" className="logo-image" />
              </div>
              <p>Zimbabwe's trusted logistics marketplace</p>
            </div>

            <div className="footer-links-grid">
              <div className="footer-links">
                <h3>Company</h3>
                <ul>
                  <li><a href="#features">About Us</a></li>
                  <li><a href="mailto:careers@palmtrent.co.zw">Careers</a></li>
                </ul>
              </div>

              <div className="footer-links">
                <h3>Support</h3>
                <ul>
                  <li><a href="mailto:support@palmtrent.co.zw">Help Center</a></li>
                  <li><a href="mailto:hello@palmtrent.co.zw">Contact Us</a></li>
                  <li><a href="/terms">Terms of Service</a></li>
                </ul>
              </div>

              <div className="footer-links">
                <h3>Contact</h3>
                <ul>
                  <li>+263 77 XXX XXXX</li>
                  <li>hello@palmtrent.co.zw</li>
                  <li>Harare, Zimbabwe</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <p>&copy; 2025 Palmtrent. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ============ MODALS ============ */}

      {/* Login Modal */}
      {showLoginModal && (
        <div className="modal-overlay" onClick={() => setShowLoginModal(false)}>
          <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowLoginModal(false)}>
              <X className="icon" />
            </button>

            <div className="auth-modal-header">
              <img src={logo} alt="Palmtrent" className="auth-logo" />
              <h2>Welcome Back</h2>
              <p>Sign in to your Palmtrent account</p>
            </div>

            {authError && (
              <div className="auth-error">
                <AlertCircle className="icon" />
                <span>{authError}</span>
              </div>
            )}
            {authSuccess && (
              <div className="auth-success">
                <Check className="icon" />
                <span>{authSuccess}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="auth-form">
              <div className="form-group">
                <label>Email Address</label>
                <div className="input-with-icon">
                  <Mail className="icon" />
                  <input
                    type="email"
                    placeholder="Enter your email"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Password</label>
                <div className="input-with-icon">
                  <Lock className="icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                    required
                  />
                  <button
                    type="button"
                    className="toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="icon" /> : <Eye className="icon" />}
                  </button>
                </div>
              </div>

              <div className="form-options">
                <label className="checkbox-label">
                  <input type="checkbox" />
                  <span>Remember me</span>
                </label>
                <button type="button" className="forgot-password" onClick={() => {
                  setAuthError('');
                  setAuthSuccess('');
                  setShowForgotPassword(value => !value);
                  setForgotEmail(loginForm.email);
                }}>Forgot password?</button>
              </div>

              {showForgotPassword && (
                <div className="forgot-password-panel">
                  <label>Reset Email</label>
                  <div className="input-with-icon">
                    <Mail className="icon" />
                    <input
                      type="email"
                      placeholder="Enter your account email"
                      value={forgotEmail}
                      onChange={(event) => setForgotEmail(event.target.value)}
                    />
                  </div>
                  <button type="button" className="btn-secondary auth-inline-btn" onClick={handleForgotPassword} disabled={authLoading}>
                    {authLoading ? <Loader className="icon spinning" /> : 'Send Reset Link'}
                  </button>
                </div>
              )}

              <button type="submit" className="auth-submit-btn" disabled={authLoading}>
                {authLoading ? <Loader className="icon spinning" /> : 'Sign In'}
              </button>
            </form>

            <div className="auth-footer">
              <p>Don't have an account? <button onClick={switchToRegister}>Sign Up</button></p>
            </div>
          </div>
        </div>
      )}

      {/* Register Modal */}
      {showRegisterModal && (
        <div className="modal-overlay" onClick={() => setShowRegisterModal(false)}>
          <div className="auth-modal register-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowRegisterModal(false)}>
              <X className="icon" />
            </button>

            <div className="auth-modal-header">
              <img src={logo} alt="Palmtrent" className="auth-logo" />
              <h2>Create Account</h2>
              <p>Join Palmtrent today</p>
            </div>

            {authError && (
              <div className="auth-error">
                <AlertCircle className="icon" />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="auth-form">
              {/* User Type Selection */}
              <div className="user-type-selector">
                <button
                  type="button"
                  className={`type-option ${registerForm.userType === 'shipper' ? 'active' : ''}`}
                  onClick={() => setRegisterForm(prev => ({ ...prev, userType: 'shipper' }))}
                >
                  <Package className="icon" />
                  <span>Shipper</span>
                  <small>Book transport and track deliveries</small>
                </button>
                <button
                  type="button"
                  className={`type-option ${registerForm.userType === 'transporter' ? 'active' : ''}`}
                  onClick={() => setRegisterForm(prev => ({ ...prev, userType: 'transporter' }))}
                >
                  <Truck className="icon" />
                  <span>Transporter</span>
                  <small>Carry goods and rent out vehicles</small>
                </button>
                <button
                  type="button"
                  className={`type-option ${registerForm.userType === 'rental_owner' ? 'active' : ''}`}
                  onClick={() => setRegisterForm(prev => ({ ...prev, userType: 'rental_owner' }))}
                >
                  <Building className="icon" />
                  <span>Rental Owner</span>
                  <small>Rent cars, bakkies, vans, trailers, or other vehicles</small>
                </button>
                <button
                  type="button"
                  className={`type-option ${registerForm.userType === 'trailer_owner' ? 'active' : ''}`}
                  onClick={() => setRegisterForm(prev => ({ ...prev, userType: 'trailer_owner' }))}
                >
                  <Truck className="icon" />
                  <span>Trailer Owner</span>
                  <small>Rent trailers, tractor units, trucks, and full rigs</small>
                </button>
                <button
                  type="button"
                  className={`type-option ${registerForm.userType === 'driver' ? 'active' : ''}`}
                  onClick={() => setRegisterForm(prev => ({ ...prev, userType: 'driver' }))}
                >
                  <User className="icon" />
                  <span>Driver</span>
                  <small>Create a work profile and set availability</small>
                </button>
                <button
                  type="button"
                  className={`type-option ${registerForm.userType === 'corporate' ? 'active' : ''}`}
                  onClick={() => setRegisterForm(prev => ({ ...prev, userType: 'corporate' }))}
                >
                  <Building className="icon" />
                  <span>Corporate</span>
                  <small>Business account</small>
                </button>
              </div>

              <div className="form-group">
                <label>Full Name</label>
                <div className="input-with-icon">
                  <User className="icon" />
                  <input
                    type="text"
                    placeholder="Enter your full name"
                    value={registerForm.fullName}
                    onChange={(e) => setRegisterForm(prev => ({ ...prev, fullName: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Email Address</label>
                  <div className="input-with-icon">
                    <Mail className="icon" />
                    <input
                      type="email"
                      placeholder="Enter your email"
                      value={registerForm.email}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Phone Number</label>
                  <div className="input-with-icon">
                    <Phone className="icon" />
                    <input
                      type="tel"
                      placeholder="+263 77 XXX XXXX"
                      value={registerForm.phone}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, phone: e.target.value }))}
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Password</label>
                  <div className="input-with-icon">
                    <Lock className="icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Create password"
                      value={registerForm.password}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                      required
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="icon" /> : <Eye className="icon" />}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Confirm Password</label>
                  <div className="input-with-icon">
                    <Lock className="icon" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Confirm password"
                      value={registerForm.confirmPassword}
                      onChange={(e) => setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                      required
                    />
                    <button
                      type="button"
                      className="toggle-password"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="icon" /> : <Eye className="icon" />}
                    </button>
                  </div>
                </div>
              </div>

              {!PHONE_VERIFICATION_DISABLED && verificationSent && (
                <div className="form-group">
                  <label>Phone Verification Code</label>
                  <div className="input-with-icon">
                    <Phone className="icon" />
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter the 6-digit code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                    />
                  </div>
                  <div className="verification-actions">
                    <span>{verificationVerified ? 'Phone verified' : `Code sent to ${verificationPhone}`}</span>
                    <button type="button" onClick={resendRegistrationCode} disabled={authLoading}>
                      Resend code
                    </button>
                  </div>
                </div>
              )}

              <div className="form-options">
                <label className="checkbox-label">
                  <input type="checkbox" required />
                  <span>I agree to the <a href="/terms" target="_blank" rel="noreferrer">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noreferrer">Privacy Policy</a></span>
                </label>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={authLoading}>
                {authLoading ? (
                  <Loader className="icon spinning" />
                ) : PHONE_VERIFICATION_DISABLED ? (
                  'Create Account'
                ) : verificationSent && !verificationVerified ? (
                  'Verify & Create Account'
                ) : (
                  'Send Verification Code'
                )}
              </button>
            </form>

            <div className="auth-footer">
              <p>Already have an account? <button onClick={switchToLogin}>Sign In</button></p>
            </div>
          </div>
        </div>
      )}

      {/* Tracking Modal */}
      {showTrackingModal && (
        <div className="modal-overlay" onClick={() => setShowTrackingModal(false)}>
          <div className="tracking-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={() => setShowTrackingModal(false)}>
              <X className="icon" />
            </button>

            <div className="tracking-modal-header">
              <MapPin className="icon" />
              <h2>Track Your Shipment</h2>
              <p>Enter your booking reference to track your shipment</p>
            </div>

            <form onSubmit={handleTrackShipment} className="tracking-form">
              <div className="tracking-input-wrapper">
                <Search className="icon" />
                <input
                  type="text"
                  placeholder="Enter tracking ID (e.g., PT-2025-001234)"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                />
              </div>
              <button type="submit" className="tracking-submit-btn" disabled={trackingLoading}>
                {trackingLoading ? <Loader className="icon spinning" /> : 'Track Shipment'}
              </button>
            </form>

            {trackingError && (
              <div className="tracking-error">
                <AlertCircle className="icon" />
                <span>{trackingError}</span>
              </div>
            )}

            {trackingResult && (
              <div className="tracking-result">
                <div className="tracking-status-header">
                  <div className={`status-indicator ${trackingResult.status}`}></div>
                  <div>
                    <h3>{trackingResult.reference || trackingResult.bookingReference || trackingId}</h3>
                    <span className="status-text">{trackingResult.status?.replace('_', ' ') || 'Unknown'}</span>
                  </div>
                </div>

                <div className="tracking-route">
                  <div className="route-point pickup">
                    <div className="point-dot"></div>
                    <div className="point-info">
                      <span className="point-label">Pickup</span>
                      <span className="point-address">{getTrackingAddress(trackingResult.pickupLocation || trackingResult.route?.pickup || trackingResult.origin)}</span>
                    </div>
                  </div>
                  <div className="route-line"></div>
                  <div className="route-point delivery">
                    <div className="point-dot"></div>
                    <div className="point-info">
                      <span className="point-label">Delivery</span>
                      <span className="point-address">{getTrackingAddress(trackingResult.deliveryLocation || trackingResult.route?.delivery || trackingResult.destination)}</span>
                    </div>
                  </div>
                </div>

                {trackingResult.transporter && (
                  <div className="tracking-transporter">
                    <span className="transporter-label">Assigned Transporter:</span>
                    <span className="transporter-name">{trackingResult.transporter.fullName || trackingResult.transporter.name}</span>
                  </div>
                )}

                <button
                  className="view-full-tracking"
                  onClick={() => {
                    setShowTrackingModal(false);
                    navigate(`/tracking/${encodeURIComponent(trackingId.trim())}`);
                  }}
                >
                  View Full Tracking <ArrowRight className="icon" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ icon, value, label }) => (
  <div className="stat-card">
    <div className="stat-icon">{icon}</div>
    <div className="stat-value">{value}</div>
    <div className="stat-label">{label}</div>
  </div>
);

const FeatureCard = ({ icon, title, description }) => (
  <div className="feature-card">
    <div className="feature-icon">{icon}</div>
    <h3 className="feature-title">{title}</h3>
    <p className="feature-description">{description}</p>
  </div>
);

const StepCard = ({ number, title, description }) => (
  <div className="step-card">
    <div className="step-number">{number}</div>
    <h3 className="step-title">{title}</h3>
    <p className="step-description">{description}</p>
  </div>
);

const PricingCard = ({ title, audience, description, price, period, features, buttonText, featured, onButtonClick }) => (
  <div className={`pricing-card ${featured ? 'featured' : ''}`}>
    {featured && <div className="pricing-badge">Most Popular</div>}
    <div className="pricing-header">
      <h3 className="pricing-title">{title}</h3>
      {audience && <div className="pricing-audience">{audience.replace('_', ' ')}</div>}
      <div className="pricing-price">{price}</div>
      <div className="pricing-period">{period}</div>
      {description && <p className="pricing-description">{description}</p>}
    </div>

    <ul className="pricing-features">
      {features.map((feature, index) => (
        <li key={index} className="pricing-feature">
          <Check className="icon" />
          {feature}
        </li>
      ))}
    </ul>

    <button
      className={`cta-button ${featured ? 'primary' : 'secondary'} pricing-button`}
      onClick={onButtonClick}
    >
      {buttonText}
    </button>
  </div>
);

export default LandingPage;
