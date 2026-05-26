// routes/documentExpiry.js
const express = require('express');
const router = express.Router();
const {
  runExpiryCheck,
  getMyDocumentSummary,
  getUserDocumentSummary,
  getExpiringDocumentsDashboard
} = require('../controllers/documentExpiryController');
const { protect, authorize } = require('../middleware/auth');

// Internal scheduler hook. Controller verifies x-internal-key against INTERNAL_JOB_KEY.
router.post('/internal/run-check', runExpiryCheck);

// All routes require authentication
router.use(protect);

// Get my document summary
router.get('/my-summary', getMyDocumentSummary);

// Admin routes
router.get('/admin/dashboard', authorize('admin'), getExpiringDocumentsDashboard);
router.get('/admin/user/:userId', authorize('admin'), getUserDocumentSummary);
router.post('/admin/run-check', authorize('admin'), runExpiryCheck);

module.exports = router;
