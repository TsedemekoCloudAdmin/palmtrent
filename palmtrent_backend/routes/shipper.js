const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentActivity
} = require('../controllers/shipperController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/recent-activity', getRecentActivity);

router.get('/dashboard-stats', getDashboardStats);

module.exports = router;