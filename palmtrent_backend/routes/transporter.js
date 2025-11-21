const express = require('express');
const router = express.Router();
const {
  getAvailableJobs,
  getDashboardStats,
  getRecentActivity
} = require('../controllers/transporterController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/recent-activity', getRecentActivity);

router.get('/available-jobs', getAvailableJobs);

router.get('/dashboard-stats', getDashboardStats);

module.exports = router;