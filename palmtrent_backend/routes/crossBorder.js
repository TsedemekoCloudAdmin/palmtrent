const express = require('express');
const router = express.Router();
const {
  getDestinations,
  getDestinationByCode,
  getBorderPosts,
  getRequiredDocuments,
  calculatePrice,
  updateBorderStatus,
  createCrossBorderBooking,
  getMyCrossBorderBookings,
  seedDestinations
} = require('../controllers/crossBorderController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/destinations', getDestinations);
router.get('/destinations/:countryCode', getDestinationByCode);
router.get('/border-posts/:countryCode', getBorderPosts);
router.get('/documents/:countryCode', getRequiredDocuments);
router.post('/calculate-price', calculatePrice);

// Protected routes
router.use(protect);

// Bookings
router.post('/bookings', createCrossBorderBooking);
router.get('/my-bookings', getMyCrossBorderBookings);

// Admin routes
router.patch('/border-status/:countryCode/:borderPostName', updateBorderStatus);
router.post('/seed', seedDestinations);

module.exports = router;
