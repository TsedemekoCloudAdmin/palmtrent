const express = require('express');
const router = express.Router();
const {
  getAllBookings,
  getBookingById,
  createBooking,
  updateBooking,
  confirmBooking,
  confirmPayment,
  cancelBooking,
  calculatePricing,
  getBookingStats,
  getPricingConfig,
  updatePricingConfig,
  createBookingWithPayment,
  getBookingDocuments,
  addBookingDocument,
  payBookingCommission,
  getBookingCommission
} = require('../controllers/bookingsController');
const {
  findTransporters,
  getMatches,
  broadcastToTransporters,
  getAvailableJobs,
  acceptJob,
  declineJob
} = require('../controllers/matchingController');
const { protect, authorize, requireVerified } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// ============ STATIC ROUTES MUST COME BEFORE PARAMETERIZED ROUTES ============

// GET /api/v1/bookings/my-bookings - Get current user's bookings (MUST be before /:id)
router.get('/my-bookings', getAllBookings);

// POST /api/v1/bookings/calculate-pricing - Calculate pricing (MUST be before /:id)
router.post('/calculate-pricing', calculatePricing);

// POST /api/v1/bookings/update-pricing-config - Update pricing config (MUST be before /:id)
router.post('/update-pricing-config', authorize('admin'), updatePricingConfig);

// POST /api/v1/bookings/create-with-payment - Create booking with payment (MUST be before /:id)
router.post('/create-with-payment', createBookingWithPayment);

router.get('/stats', getBookingStats);
router.get('/pricing-config', getPricingConfig);

// JOB ENDPOINTS - For transporters (MUST be before /:id)
// GET /api/v1/bookings/jobs/available - Get available jobs for transporter
router.get('/jobs/available', authorize('transporter'), getAvailableJobs);

// POST /api/v1/bookings/jobs/:id/accept - Accept a job
router.post('/jobs/:id/accept', authorize('transporter'), requireVerified('transporter'), acceptJob);

// POST /api/v1/bookings/jobs/:id/decline - Decline a job
router.post('/jobs/:id/decline', authorize('transporter'), requireVerified('transporter'), declineJob);

// ============ BASE ROUTES ============

// GET /api/v1/bookings - Get all bookings
router.get('/', getAllBookings);

// POST /api/v1/bookings - Create new booking
router.post('/', createBooking);

// ============ PARAMETERIZED ROUTES (MUST BE LAST) ============

// GET /api/v1/bookings/:id - Get booking by ID
router.get('/:id', getBookingById);

// PUT /api/v1/bookings/:id - Update booking
router.put('/:id', updateBooking);

// POST /api/v1/bookings/:id/confirm-booking - Confirm booking
router.post('/:id/confirm-booking', confirmBooking);

// POST /api/v1/bookings/:id/confirm-payment - Confirm payment
router.post('/:id/confirm-payment', confirmPayment);

// POST /api/v1/bookings/:id/cancel - Cancel booking
router.post('/:id/cancel', cancelBooking);

// Business documents (PO, Delivery Note, GRV, etc.)
router.get('/:id/documents', getBookingDocuments);
router.post('/:id/documents', addBookingDocument);

// Cash-job commission remittance (transporter remits before accepting)
router.get('/:id/commission', getBookingCommission);
router.post('/:id/commission/pay', authorize('transporter'), payBookingCommission);

// MATCHING ENDPOINTS - Transporter-Booking Matching
// POST /api/v1/bookings/:id/find-transporters - Manually trigger matching for a booking
router.post('/:id/find-transporters', authorize('admin', 'shipper', 'corporate'), findTransporters);

// GET /api/v1/bookings/:id/matches - Get match results for a booking
router.get('/:id/matches', getMatches);

// POST /api/v1/bookings/:id/broadcast - Broadcast booking to top transporters
router.post('/:id/broadcast', authorize('admin', 'shipper', 'corporate'), broadcastToTransporters);

module.exports = router;
