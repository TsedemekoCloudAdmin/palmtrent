const express = require('express');
const router = express.Router();
const {
  getVehicleMakes,
  getVehicleModels,
  getVehicleTypes,
  getVehicleTypesGrouped,
  recommendVehicleType,
  getCargoTypes,
  getCargoTypesGrouped,
  getTrailerTypes,
  getInsuranceOptions,
  getInsuranceOptionsByCategory,
  getInsuranceQuotes,
  getAllReferenceData
} = require('../controllers/referenceDataController');

// Get all reference data in one call (for app initialization)
router.get('/all', getAllReferenceData);

// Vehicle Makes
router.get('/vehicle-makes', getVehicleMakes);
router.get('/vehicle-makes/:makeId/models', getVehicleModels);

// Vehicle Types
router.get('/vehicle-types', getVehicleTypes);
router.get('/vehicle-types/grouped', getVehicleTypesGrouped);
router.get('/vehicle-types/recommend', recommendVehicleType);

// Cargo Types
router.get('/cargo-types', getCargoTypes);
router.get('/cargo-types/grouped', getCargoTypesGrouped);

// Trailer Types
router.get('/trailer-types', getTrailerTypes);

// Insurance Options
router.get('/insurance-options', getInsuranceOptions);
router.get('/insurance-options/by-category', getInsuranceOptionsByCategory);
router.post('/insurance-quotes', getInsuranceQuotes);

module.exports = router;
