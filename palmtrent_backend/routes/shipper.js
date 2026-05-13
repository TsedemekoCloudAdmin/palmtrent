const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getRecentActivity,
  getActiveShipments,
  getFavoriteTransporters,
  addFavoriteTransporter,
  removeFavoriteTransporter
} = require('../controllers/shipperController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/recent-activity', getRecentActivity);
router.get('/activity', getRecentActivity);

router.get('/dashboard-stats', getDashboardStats);
router.get('/dashboard', getDashboardStats);

router.get('/shipments/active', getActiveShipments);

router.get('/favorites', getFavoriteTransporters);
router.post('/favorites', addFavoriteTransporter);
router.delete('/favorites/:transporterId', removeFavoriteTransporter);

module.exports = router;
