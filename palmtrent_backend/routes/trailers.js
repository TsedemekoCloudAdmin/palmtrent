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
const { protect } = require('../middleware/auth');

// Public routes
router.get('/available', getAvailableTrailers);

// Protected routes
router.use(protect);

// Trailer CRUD
router.route('/')
  .post(createTrailer);

router.get('/my-trailers', getMyTrailers);

router.route('/:id')
  .get(getTrailerById)
  .put(updateTrailer)
  .delete(deleteTrailer);

// Status and settings
router.patch('/:id/status', updateTrailerStatus);
router.patch('/:id/rental-settings', updateRentalSettings);

// Trailer rentals
router.get('/:id/rentals', getTrailerRentals);

module.exports = router;
