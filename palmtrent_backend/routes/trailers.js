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
  .post(authorize('trailer_owner', 'rental_owner', 'transporter', 'admin'), createTrailer);

router.get('/my-trailers', authorize('trailer_owner', 'rental_owner', 'transporter', 'admin'), getMyTrailers);
router.get('/my-fleet', authorize('trailer_owner', 'rental_owner', 'transporter', 'admin'), getMyTrailers);

router.route('/:id')
  .get(getTrailerById)
  .put(updateTrailer)
  .delete(deleteTrailer);

// Status and settings
router.route('/:id/status')
  .patch(authorize('trailer_owner', 'rental_owner', 'transporter', 'admin'), updateTrailerStatus)
  .put(authorize('trailer_owner', 'rental_owner', 'transporter', 'admin'), updateTrailerStatus);

router.route('/:id/rental-settings')
  .patch(authorize('trailer_owner', 'rental_owner', 'transporter', 'admin'), updateRentalSettings)
  .put(authorize('trailer_owner', 'rental_owner', 'transporter', 'admin'), updateRentalSettings);

// Trailer rentals
router.get('/:id/rentals', getTrailerRentals);

module.exports = router;
