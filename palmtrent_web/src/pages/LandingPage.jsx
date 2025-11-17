import React, { useState } from 'react';
import { Truck, Package, Shield, MapPin, Star, Clock, DollarSign, Users, ArrowRight, Check, Menu, X } from 'lucide-react';
import './styles/LandingPage.css';
import logo from '../assets/logo3.png';

const LandingPage = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [userType, setUserType] = useState('shipper');
  const [isYearly, setIsYearly] = useState(false); 

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
            <button className="nav-button secondary">Sign In</button>
            <button className="nav-button primary">
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
              <button className="mobile-nav-button secondary">Sign In</button>
              <button className="mobile-nav-button primary">
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
              <button className="cta-button primary">
                Book Transport Now
              </button>
              <button className="cta-button secondary">
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
                  <li><a href="#">About Us</a></li>
                  <li><a href="#">Careers</a></li>
                  <li><a href="#">Blog</a></li>
                </ul>
              </div>
              
              <div className="footer-links">
                <h3>Support</h3>
                <ul>
                  <li><a href="#">Help Center</a></li>
                  <li><a href="#">Contact Us</a></li>
                  <li><a href="#">Terms of Service</a></li>
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

const PricingCard = ({ title, price, period, features, buttonText, featured }) => (
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
    
    <button className={`cta-button ${featured ? 'primary' : 'secondary'} pricing-button`}>
      {buttonText}
    </button>
  </div>
);

export default LandingPage;