const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentActivity,
  getTrailers,
  getStaffUsers,
  createStaffUser
} = require('../controllers/trailerOwnersController');
const { protect, authorize, requireRentalPermission } = require('../middleware/auth');

// All routes require authentication
router.use(protect);
router.use(authorize('trailer_owner', 'rental_owner', 'transporter', 'admin'));

router.get('/recent-activity', getRecentActivity);

router.get('/dashboard-stats', getDashboardStats);

router.get('/trailers', getTrailers);
router.get('/staff', getStaffUsers);
// Only owners/managers (staff:manage) may create staff.
router.post('/staff', requireRentalPermission('staff:manage'), createStaffUser);
module.exports = router;
