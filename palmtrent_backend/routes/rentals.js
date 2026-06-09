const express = require('express');
const router = express.Router();
const {
  getAvailableRentals,
  getRentalDetails,
  createRentalRequest,
  createWalkInRental,
  getMyRentals,
  getMyListings,
  getActiveRentals,
  approveRental,
  rejectRental,
  confirmPickup,
  confirmReturn,
  getRentalById,
  getRentalTracking,
  updateRentalLocation,
  initiateRentalPayment,
  confirmRentalPayment,
  checkRentalPaymentStatus
} = require('../controllers/rentalController');
const { protect, requireRentalPermission } = require('../middleware/auth');

// Public routes
router.get('/available', getAvailableRentals);
router.get('/item/:id', getRentalDetails);

// Protected routes
router.use(protect);

// Rental requests
router.post('/request', createRentalRequest);
router.post('/walk-in', requireRentalPermission('rentals:write'), createWalkInRental);
router.get('/my-rentals', getMyRentals);
router.get('/my-listings', getMyListings);
router.get('/active', getActiveRentals);
router.get('/:id/tracking', getRentalTracking);
router.put('/:id/location', updateRentalLocation);
router.get('/:id', getRentalById);

// Owner actions (staff need the rentals:write permission)
router.post('/:id/approve', requireRentalPermission('rentals:write'), approveRental);
router.post('/:id/reject', requireRentalPermission('rentals:write'), rejectRental);
router.post('/:id/pay', initiateRentalPayment);
router.get('/:id/payment-status', checkRentalPaymentStatus);
router.post('/payment/confirm', confirmRentalPayment);

// Pickup and return
router.post('/:id/confirm-pickup', requireRentalPermission('rentals:write'), confirmPickup);
router.post('/:id/confirm-return', requireRentalPermission('rentals:write'), confirmReturn);

module.exports = router;
