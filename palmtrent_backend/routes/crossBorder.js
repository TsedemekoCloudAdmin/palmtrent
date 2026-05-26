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
  uploadBookingDocument,
  getBookingCompliance,
  reviewBookingDocument,
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
router.get('/bookings/:bookingId/compliance', getBookingCompliance);
router.post('/bookings/:bookingId/documents', uploadBookingDocument);

// Admin routes
router.patch('/bookings/:bookingId/documents/:documentId/review', authorize('admin'), reviewBookingDocument);
router.patch('/border-status/:countryCode/:borderPostName', authorize('admin'), updateBorderStatus);
router.post('/seed', authorize('admin'), seedDestinations);

module.exports = router;
