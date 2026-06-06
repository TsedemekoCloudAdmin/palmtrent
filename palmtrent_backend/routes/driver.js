// routes/drivers.js
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  getDrivers,
  getDriver,
  createDriver,
  updateDriver,
  deleteDriver,
  updateDriverStatus,
  searchMarketplaceDrivers,
  getMyDriverProfile,
  updateMyDriverProfile,
  updateMyAvailability,
  inviteDriverToApp
} = require('../controllers/driverController');

router.route('/marketplace')
  .get(protect, searchMarketplaceDrivers);

router.route('/me')
  .get(protect, getMyDriverProfile)
  .put(protect, updateMyDriverProfile);

router.route('/me/availability')
  .put(protect, updateMyAvailability);

router.route('/')
  .get(protect, getDrivers)
  .post(protect, createDriver);

router.route('/:id')
  .get(protect, getDriver)
  .put(protect, updateDriver)
  .delete(protect, deleteDriver);

router.route('/:id/status')
  .put(protect, updateDriverStatus);

router.route('/:id/invite')
  .post(protect, inviteDriverToApp);

module.exports = router;
