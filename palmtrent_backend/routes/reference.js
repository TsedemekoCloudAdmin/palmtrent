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

router.get('/payment-options', (req, res) => {
  res.json({
    success: true,
    data: [
      { code: 'openapi_africa', name: 'OpenAPI Africa ClicknPay' },
      { code: 'card', name: 'Card' },
      { code: 'bank_transfer', name: 'Bank Transfer' },
      { code: 'ecocash', name: 'EcoCash' },
      { code: 'onemoney', name: 'OneMoney' },
      { code: 'cash_agent', name: 'Cash via Agent' },
      { code: 'cash_on_pickup', name: 'Cash on Pickup' },
      { code: 'cash_on_delivery', name: 'Cash on Delivery' },
      { code: 'corporate', name: 'Corporate Invoice' }
    ]
  });
});

router.get('/cities', (req, res) => {
  res.json({
    success: true,
    data: ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo', 'Kwekwe', 'Kadoma', 'Chitungwiza', 'Victoria Falls']
  });
});

module.exports = router;
