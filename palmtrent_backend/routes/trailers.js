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
  getAvailableTrailers,
  addMaintenanceRecord
} = require('../controllers/trailerController');
const { protect, authorize, requireRentalPermission } = require('../middleware/auth');

const FLEET_ROLES = ['trailer_owner', 'rental_owner', 'transporter', 'admin'];

// Public routes
router.get('/available', getAvailableTrailers);

// Protected routes
router.use(protect);

// Trailer CRUD
router.route('/')
  .post(authorize(...FLEET_ROLES), requireRentalPermission('fleet:write'), createTrailer);

router.get('/my-trailers', authorize(...FLEET_ROLES), getMyTrailers);
router.get('/my-fleet', authorize(...FLEET_ROLES), getMyTrailers);

router.route('/:id')
  .get(getTrailerById)
  .put(authorize(...FLEET_ROLES), requireRentalPermission('fleet:write'), updateTrailer)
  .delete(authorize(...FLEET_ROLES), requireRentalPermission('fleet:write'), deleteTrailer);

// Status and settings
router.route('/:id/status')
  .patch(authorize(...FLEET_ROLES), requireRentalPermission('fleet:write'), updateTrailerStatus)
  .put(authorize(...FLEET_ROLES), requireRentalPermission('fleet:write'), updateTrailerStatus);

router.route('/:id/rental-settings')
  .patch(authorize(...FLEET_ROLES), requireRentalPermission('fleet:write'), updateRentalSettings)
  .put(authorize(...FLEET_ROLES), requireRentalPermission('fleet:write'), updateRentalSettings);

// Trailer rentals
router.get('/:id/rentals', getTrailerRentals);

// Maintenance records
router.post('/:id/maintenance', authorize(...FLEET_ROLES), requireRentalPermission('fleet:write'), addMaintenanceRecord);

module.exports = router;
