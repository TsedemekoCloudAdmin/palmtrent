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
const { protect, authorize } = require('../middleware/auth');
const { seedAll: seedReferenceData } = require('../scripts/seedReferenceData');

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

module.exports = router;
