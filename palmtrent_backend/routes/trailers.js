const express = require('express');
const router = express.Router();
const {
  getMyTrailers,
  getTrailerById,
  createTrailer,
  updateTrailer,
  deleteTrailer,
  updateTrailerStatus,
  updateRentalSettings,
  getTrailerRentals,
  getAvailableTrailers
} = require('../controllers/trailerController');
const { protect, authorize } = require('../middleware/auth');

// Public routes
router.get('/available', getAvailableTrailers);

// Protected routes
router.use(protect);

// Trailer CRUD
router.route('/')
  .post(authorize('trailer_owner', 'transporter', 'admin'), createTrailer);

router.get('/my-trailers', authorize('trailer_owner', 'transporter', 'admin'), getMyTrailers);
router.get('/my-fleet', authorize('trailer_owner', 'transporter', 'admin'), getMyTrailers);

router.route('/:id')
  .get(getTrailerById)
  .put(updateTrailer)
  .delete(deleteTrailer);

// Status and settings
router.patch('/:id/status', authorize('trailer_owner', 'transporter', 'admin'), updateTrailerStatus);
router.patch('/:id/rental-settings', authorize('trailer_owner', 'transporter', 'admin'), updateRentalSettings);

// Trailer rentals
router.get('/:id/rentals', getTrailerRentals);

module.exports = router;
