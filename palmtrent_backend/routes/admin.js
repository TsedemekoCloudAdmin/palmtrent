const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getUsers,
  getUserById,
  updateUser,
  verifyUser,
  getBookings,
  getDisputes,
  resolveDispute,
  getPayments,
  confirmPayment,
  getRentals,
  getRatings,
  getReports,
  getPendingVerifications,
  verifyCorporateAccount,
  verifyVehicle,
  getAuditLogs,
  getIntegrationSettings,
  updateIntegrationSetting,
  testIntegrationSetting,
  getPreferences,
  updatePreferences
} = require('../controllers/adminController');
const monetizationController = require('../controllers/monetizationController');
const InsuranceProvider = require('../models/InsuranceProvider');
const { protect, authorize } = require('../middleware/auth');
const { seedAll: seedReferenceData } = require('../scripts/seedReferenceData');
const { seedVehicleModels } = require('../scripts/seedVehicleModels');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// One-off production setup utilities
router.post('/seed/reference-data', async (req, res) => {
  try {
    const summary = await seedReferenceData({ connect: false, exit: false });
    res.json({
      success: true,
      message: 'Reference data seeded successfully',
      data: summary
    });
  } catch (error) {
    console.error('Reference data seed error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Unable to seed reference data'
    });
  }
});

router.post('/seed/vehicle-models', async (req, res) => {
  try {
    const summary = await seedVehicleModels({ connect: false, exit: false });
    res.json({
      success: true,
      message: 'Vehicle and trailer model data seeded successfully',
      data: summary
    });
  } catch (error) {
    console.error('Vehicle model seed error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Unable to seed vehicle and trailer model data'
    });
  }
});

// Users
router.get('/users', getUsers);
router.get('/users/:id', getUserById);
router.put('/users/:id', updateUser);
router.put('/users/:id/verify', verifyUser);

// Verifications
router.get('/verifications', getPendingVerifications);
router.put('/corporate/:id/verify', verifyCorporateAccount);
router.put('/vehicles/:id/verify', verifyVehicle);
router.get('/audit-logs', getAuditLogs);

// Integration settings
router.get('/preferences', getPreferences);
router.put('/preferences', updatePreferences);
router.get('/integrations', getIntegrationSettings);
router.put('/integrations/:provider', updateIntegrationSetting);
router.post('/integrations/:provider/test', testIntegrationSetting);

// Bookings
router.get('/bookings', getBookings);

// Disputes
router.get('/disputes', getDisputes);
router.post('/disputes/:id/resolve', resolveDispute);

// Payments
router.get('/payments', getPayments);
router.post('/payments/:id/confirm', confirmPayment);

// Fleet rentals
router.get('/rentals', getRentals);

// Ratings
router.get('/ratings', getRatings);

// Reports
router.get('/reports/:type', getReports);

// Monetization: plans, subscriptions, commission rules, ledger, payouts
router.get('/monetization', monetizationController.getMonetizationOverview);
router.post('/monetization/plans', monetizationController.upsertPlan);
router.put('/monetization/plans/:id', monetizationController.updatePlan);
router.post('/monetization/commission-rules', monetizationController.upsertCommissionRule);
router.put('/monetization/commission-rules/:id', monetizationController.updateCommissionRule);
router.post('/monetization/subscriptions', monetizationController.createSubscription);
router.put('/monetization/subscriptions/:id', monetizationController.updateSubscription);
router.post('/monetization/ledger', monetizationController.recordLedgerEntry);
router.post('/monetization/payouts', monetizationController.createPayout);
router.put('/monetization/payouts/:id', monetizationController.updatePayout);

const normalizeInsuranceProviderPayload = (body = {}) => {
  const code = String(body.code || body.name || '').trim().toUpperCase();
  const products = Array.isArray(body.products) ? body.products.map((product, index) => ({
    productCode: String(product.productCode || `${code}-P${index + 1}`).trim().toUpperCase(),
    productName: String(product.productName || product.name || 'Cargo Cover').trim(),
    description: product.description || '',
    coverageType: product.coverageType || 'standard',
    coveragePercentage: Number(product.coveragePercentage || 0),
    premiumRate: Number(product.premiumRate || 0),
    excessAmount: Number(product.excessAmount || 0),
    excessPercentage: Number(product.excessPercentage || 0),
    maxCoverage: Number(product.maxCoverage || 0),
    minPremium: Number(product.minPremium || 0),
    cargoTypes: Array.isArray(product.cargoTypes)
      ? product.cargoTypes
      : String(product.cargoTypes || 'general').split(',').map(item => item.trim()).filter(Boolean),
    exclusions: Array.isArray(product.exclusions)
      ? product.exclusions
      : String(product.exclusions || '').split('\n').map(item => item.trim()).filter(Boolean),
    termsAndConditions: product.termsAndConditions || '',
    claimProcessingDays: Number(product.claimProcessingDays || 0),
    active: product.active !== false
  })).filter(product => product.productName && product.premiumRate > 0) : [];

  return {
    name: String(body.name || body.displayName || '').trim(),
    code,
    displayName: String(body.displayName || body.name || '').trim(),
    logo: body.logo || '',
    description: body.description || '',
    contactInfo: {
      email: body.contactInfo?.email || body.email || '',
      phone: body.contactInfo?.phone || body.phone || '',
      website: body.contactInfo?.website || body.website || '',
      claimsPhone: body.contactInfo?.claimsPhone || body.claimsPhone || '',
      claimsEmail: body.contactInfo?.claimsEmail || body.claimsEmail || ''
    },
    address: {
      street: body.address?.street || body.street || '',
      city: body.address?.city || body.city || '',
      country: body.address?.country || body.country || 'Zimbabwe'
    },
    products,
    commissionRate: Number(body.commissionRate || 0),
    priority: Number(body.priority || 0),
    active: body.active !== false
  };
};

// Insurance providers and cargo cover products
router.get('/insurance/providers', async (req, res) => {
  try {
    const providers = await InsuranceProvider.find({}).sort({ priority: -1, displayName: 1 });
    res.json({ success: true, count: providers.length, data: providers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to load insurance providers' });
  }
});

router.post('/insurance/providers', async (req, res) => {
  try {
    const payload = normalizeInsuranceProviderPayload(req.body);
    if (!payload.name || !payload.code || !payload.displayName) {
      return res.status(400).json({ success: false, message: 'Provider name, display name and code are required.' });
    }
    if (!payload.products.length) {
      return res.status(400).json({ success: false, message: 'Add at least one active insurance product with a premium rate.' });
    }

    const provider = await InsuranceProvider.findOneAndUpdate(
      { code: payload.code },
      payload,
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ success: true, message: 'Insurance provider saved.', data: provider });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to save insurance provider' });
  }
});

router.put('/insurance/providers/:id', async (req, res) => {
  try {
    const payload = normalizeInsuranceProviderPayload(req.body);
    if (!payload.name || !payload.code || !payload.displayName) {
      return res.status(400).json({ success: false, message: 'Provider name, display name and code are required.' });
    }
    if (!payload.products.length) {
      return res.status(400).json({ success: false, message: 'Add at least one active insurance product with a premium rate.' });
    }

    const provider = await InsuranceProvider.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });
    if (!provider) {
      return res.status(404).json({ success: false, message: 'Insurance provider not found.' });
    }
    res.json({ success: true, message: 'Insurance provider updated.', data: provider });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message || 'Unable to update insurance provider' });
  }
});

module.exports = router;
