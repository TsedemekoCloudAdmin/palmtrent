const express = require('express');
const router = express.Router();
const {
  getAllBookings,
  getBookingById,
  createBooking,
  updateBooking,
  confirmBooking,
  confirmPayment,
  cancelBooking
} = require('../controllers/bookingsController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// GET /api/v1/bookings - Get all bookings
router.get('/', getAllBookings);

// POST /api/v1/bookings - Create new booking
router.post('/', createBooking);

// GET /api/v1/bookings/:id - Get booking by ID
router.get('/:id', getBookingById);

// PUT /api/v1/bookings/:id - Update booking
router.put('/:id', updateBooking);

// POST /api/v1/bookings/:id/confirm - Confirm booking
router.post('/:id/confirm', confirmBooking);

// POST /api/v1/bookings/:id/confirm-payment - Confirm payment
router.post('/:id/confirm-payment', confirmPayment);

// POST /api/v1/bookings/:id/cancel - Cancel booking
router.post('/:id/cancel', cancelBooking);

module.exports = router;