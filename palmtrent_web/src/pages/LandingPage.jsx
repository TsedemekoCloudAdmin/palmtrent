import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck, Package, Shield, MapPin, Star, Clock, DollarSign, Users,
  ArrowRight, Check, Menu, X, Eye, EyeOff, Search, Loader, AlertCircle,
  Mail, Lock, User, Phone, Building
} from 'lucide-react';
import { authAPI, trackingAPI } from '../services/api';
import './styles/LandingPage.css';
import logo from '../assets/logo3.png';

const PHONE_VERIFICATION_DISABLED = import.meta.env.VITE_DISABLE_PHONE_VERIFICATION === 'true';

const getRoleHomePath = (user) => {
  switch (user?.userType) {
    case 'admin':
      return '/admin';
    case 'corporate':
      return '/corp';
    case 'trailer_owner':
    case 'transporter':
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

  // Tracking states
  const [trackingId, setTrackingId] = useState('');
  const [trackingResult, setTrackingResult] = useState(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      const response = await authAPI.login(loginForm.email, loginForm.password);
      if (response.token || response.data?.token) {
        setShowLoginModal(false);
        navigate(getRoleHomePath(authAPI.getCurrentUser()));
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

    if (response.token || response.data?.token) {
      setShowRegisterModal(false);
      setVerificationSent(false);
      setVerificationVerified(false);
      setVerificationCode('');
      navigate(getRoleHomePath(authAPI.getCurrentUser()));
    }
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

  const handleTrackShipment = async (e) => {
    e.preventDefault();
    setTrackingError('');
    setTrackingResult(null);

    if (!trackingId.trim()) {
      setTrackingError('Please enter a tracking ID');
      return;
    }

    setTrackingLoading(true);

    try {
      const result = await trackingAPI.trackPublic(trackingId.trim());
      setTrackingResult(result.data || result);
    } catch (error) {
      setTrackingError(error.message || 'Tracking ID not found. Please check and try again.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const openRegisterWithType = (type) => {
    setRegisterForm(prev => ({ ...prev, userType: type }));
    setVerificationSent(false);
    setVerificationVerified(false);
    setVerificationCode('');
    setAuthError('');
    setShowRegisterModal(true);
  };

  const switchToRegister = () => {
    setShowLoginModal(false);
    setAuthError('');
    setAuthSuccess('');
    setShowForgotPassword(false);
    setVerificationSent(false);
    setVerificationVerified(false);
    setVerificationCode('');
    setShowRegisterModal(true);
  };

  const switchToLogin = () => {
    setShowRegisterModal(false);
    setAuthError('');
    setAuthSuccess('');
    setShowLoginModal(true);
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
              onClick={() => setShowRegisterModal(true)}
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
                onClick={() => { setShowRegisterModal(true); setMenuOpen(false); }}
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
              <form onSubmit={handleTrackShipment} className="quick-track-form">
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

            {/* User Type Toggle */}
            <div className="user-toggle">
              <button
                onClick={() => setUserType('shipper')}
                className={`toggle-btn ${userType === 'shipper' ? 'active' : ''}`}
              >
                <Package className="icon" />
                I Need Transport
              </button>
              <button
                onClick={() => setUserType('transporter')}
                className={`toggle-btn ${userType === 'transporter' ? 'active' : ''}`}
              >
                <Truck className="icon" />
                I Own a Truck
              </button>
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
                value="2,000+"
                label="Active Transporters"
              />
              <StatCard
                icon={<Package className="icon success" />}
                value="10,000+"
                label="Deliveries Completed"
              />
              <StatCard
                icon={<Star className="icon warning" />}
                value="4.8/5"
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
            <p>Choose the plan that works best for your business</p>
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
              <span className="save-badge">Save 20%</span>
            </span>
          </div>

          <div className="pricing-grid">
            <PricingCard
              title="Starter"
              price={isYearly ? "ZWL 9,600" : "ZWL 1,000"}
              period={isYearly ? "/year" : "/month"}
              features={[
                "Up to 10 shipments/month",
                "Basic tracking",
                "Email support",
                "Verified transporters",
                "Payment protection"
              ]}
              buttonText="Get Started"
              featured={false}
              onButtonClick={() => openRegisterWithType('shipper')}
            />

            <PricingCard
              title="Professional"
              price={isYearly ? "ZWL 24,000" : "ZWL 2,500"}
              period={isYearly ? "/year" : "/month"}
              features={[
                "Up to 50 shipments/month",
                "Advanced tracking",
                "Priority support",
                "Dedicated account manager",
                "Insurance options",
                "Analytics dashboard",
                "Custom reporting"
              ]}
              buttonText="Start Free Trial"
              featured={true}
              onButtonClick={() => openRegisterWithType('shipper')}
            />

            <PricingCard
              title="Enterprise"
              price="Custom"
              period=""
              features={[
                "Unlimited shipments",
                "Real-time API access",
                "24/7 phone support",
                "Custom integrations",
                "White-label solutions",
                "Advanced analytics",
                "SLA guarantees",
                "Dedicated support team"
              ]}
              buttonText="Contact Sales"
              featured={false}
              onButtonClick={() => openRegisterWithType('corporate')}
            />
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
                  <small>I need transport</small>
                </button>
                <button
                  type="button"
                  className={`type-option ${registerForm.userType === 'transporter' ? 'active' : ''}`}
                  onClick={() => setRegisterForm(prev => ({ ...prev, userType: 'transporter' }))}
                >
                  <Truck className="icon" />
                  <span>Transporter</span>
                  <small>I have a truck</small>
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
                    <h3>{trackingResult.bookingReference || trackingId}</h3>
                    <span className="status-text">{trackingResult.status?.replace('_', ' ') || 'Unknown'}</span>
                  </div>
                </div>

                <div className="tracking-route">
                  <div className="route-point pickup">
                    <div className="point-dot"></div>
                    <div className="point-info">
                      <span className="point-label">Pickup</span>
                      <span className="point-address">{trackingResult.pickupLocation?.address || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="route-line"></div>
                  <div className="route-point delivery">
                    <div className="point-dot"></div>
                    <div className="point-info">
                      <span className="point-label">Delivery</span>
                      <span className="point-address">{trackingResult.deliveryLocation?.address || 'N/A'}</span>
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
                    navigate(`/tracking/${trackingId}`);
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

const PricingCard = ({ title, price, period, features, buttonText, featured, onButtonClick }) => (
  <div className={`pricing-card ${featured ? 'featured' : ''}`}>
    {featured && <div className="pricing-badge">Most Popular</div>}
    <div className="pricing-header">
      <h3 className="pricing-title">{title}</h3>
      <div className="pricing-price">{price}</div>
      <div className="pricing-period">{period}</div>
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
