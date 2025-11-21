const express = require('express');
const router = express.Router();
const {
  getProfile,
  updateProfile,
  getInvoices,
  getAnalytics,
  getDashboardStats
} = require('../controllers/corporateController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// GET /api/v1/corporate/profile - Get corporate profile
router.get('/profile', getProfile);

// PUT /api/v1/corporate/profile - Update corporate profile
router.put('/profile', updateProfile);

// GET /api/v1/corporate/invoices - Get invoices
router.get('/invoices', getInvoices);

// GET /api/v1/corporate/analytics - Get analytics
router.get('/analytics', getAnalytics);

// GET /api/v1/corporate/dashboard-stats - Get dashboard stats
router.get('/dashboard-stats', getDashboardStats);

module.exports = router;