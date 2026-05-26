const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentActivity,
  getTrailers
} = require('../controllers/trailerOwnersController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);
router.use(authorize('trailer_owner', 'transporter', 'admin'));

router.get('/recent-activity', getRecentActivity);

router.get('/dashboard-stats', getDashboardStats);

router.get('/trailers', getTrailers);
module.exports = router;
