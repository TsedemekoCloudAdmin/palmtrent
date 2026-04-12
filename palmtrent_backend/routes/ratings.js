// routes/ratings.js
const express = require('express');
const router = express.Router();
const {
  submitRating,
  getUserRating,
  getUserReviews,
  getBookingRatings,
  respondToRating,
  flagRating,
  checkCanRate,
  getMyRatings,
  getMyGivenRatings
} = require('../controllers/ratingController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// My ratings
router.get('/me', getMyRatings);
router.get('/me/given', getMyGivenRatings);

// Submit a rating for a booking
router.post('/booking/:bookingId', submitRating);

// Check if user can rate a booking
router.get('/booking/:bookingId/can-rate', checkCanRate);

// Get ratings for a specific booking
router.get('/booking/:bookingId', getBookingRatings);

// Get a user's rating summary
router.get('/user/:userId', getUserRating);

// Get a user's reviews
router.get('/user/:userId/reviews', getUserReviews);

// Respond to a rating
router.post('/:ratingId/respond', respondToRating);

// Flag a rating for review
router.post('/:ratingId/flag', flagRating);

module.exports = router;
