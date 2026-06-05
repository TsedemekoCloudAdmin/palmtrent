const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentActivity,
  getTrailers,
  getStaffUsers,
  createStaffUser
} = require('../controllers/trailerOwnersController');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);
router.use(authorize('trailer_owner', 'rental_owner', 'transporter', 'admin'));

router.get('/recent-activity', getRecentActivity);

router.get('/dashboard-stats', getDashboardStats);

router.get('/trailers', getTrailers);
router.get('/staff', getStaffUsers);
router.post('/staff', createStaffUser);
module.exports = router;
