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
  updateDriverStatus
} = require('../controllers/driverController');

router.route('/')
  .get(protect, getDrivers)
  .post(protect, createDriver);

router.route('/:id')
  .get(protect, getDriver)
  .put(protect, updateDriver)
  .delete(protect, deleteDriver);

router.route('/:id/status')
  .put(protect, updateDriverStatus);

module.exports = router;