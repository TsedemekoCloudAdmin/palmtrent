// routes/documentExpiry.js
const express = require('express');
const router = express.Router();
const {
  runExpiryCheck,
  getMyDocumentSummary,
  getUserDocumentSummary,
  getExpiringDocumentsDashboard
} = require('../controllers/documentExpiryController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Get my document summary
router.get('/my-summary', getMyDocumentSummary);

// Admin routes
router.get('/admin/dashboard', getExpiringDocumentsDashboard);
router.get('/admin/user/:userId', getUserDocumentSummary);
router.post('/admin/run-check', runExpiryCheck);

module.exports = router;
