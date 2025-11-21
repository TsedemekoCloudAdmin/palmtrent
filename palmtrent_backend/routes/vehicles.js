const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  assignDriver,
  getAvailableForRental,
  updateRentalSettings
} = require('../controllers/vehicleController');

router.route('/')
  .get(protect, getVehicles)
  .post(protect, createVehicle);

router.route('/available-for-rental')
  .get(getAvailableForRental);

router.route('/:id')
  .get(protect, getVehicle)
  .put(protect, updateVehicle)
  .delete(protect, deleteVehicle);

router.route('/:id/assign-driver')
  .put(protect, assignDriver);

router.route('/:id/rental-settings')
  .put(protect, updateRentalSettings);

module.exports = router;