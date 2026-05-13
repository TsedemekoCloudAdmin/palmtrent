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
  getRentals,
  getRatings,
  getReports,
  getPendingVerifications,
  verifyCorporateAccount,
  verifyVehicle,
  getAuditLogs,
  getIntegrationSettings,
  updateIntegrationSetting,
  testIntegrationSetting
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication and admin role
router.use(protect);
router.use(authorize('admin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

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

// Fleet rentals
router.get('/rentals', getRentals);

// Ratings
router.get('/ratings', getRatings);

// Reports
router.get('/reports/:type', getReports);

module.exports = router;
