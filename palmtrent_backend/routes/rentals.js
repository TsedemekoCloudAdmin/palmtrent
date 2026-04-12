const express = require('express');
const router = express.Router();
const {
  getAvailableRentals,
  getRentalDetails,
  createRentalRequest,
  getMyRentals,
  getMyListings,
  getActiveRentals,
  approveRental,
  rejectRental,
  confirmPickup,
  confirmReturn,
  getRentalById
} = require('../controllers/rentalController');
const { protect } = require('../middleware/auth');

// Public routes
router.get('/available', getAvailableRentals);
router.get('/item/:id', getRentalDetails);

// Protected routes
router.use(protect);

// Rental requests
router.post('/request', createRentalRequest);
router.get('/my-rentals', getMyRentals);
router.get('/my-listings', getMyListings);
router.get('/active', getActiveRentals);
router.get('/:id', getRentalById);

// Owner actions
router.post('/:id/approve', approveRental);
router.post('/:id/reject', rejectRental);

// Pickup and return
router.post('/:id/confirm-pickup', confirmPickup);
router.post('/:id/confirm-return', confirmReturn);

module.exports = router;
