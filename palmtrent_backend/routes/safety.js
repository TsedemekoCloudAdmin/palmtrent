const express = require('express');
const router = express.Router();
const {
  submitPreTripChecklist,
  reportIncident,
  reportFatigue,
  reportSpeedAlert,
  getSafetyReports,
  resolveSafetyReport
} = require('../controllers/safetyController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/pre-trip-checklist', submitPreTripChecklist);
router.post('/incidents', reportIncident);
router.post('/fatigue', reportFatigue);
router.post('/speed-alerts', reportSpeedAlert);
router.get('/reports', getSafetyReports);
router.put('/reports/:id/resolve', resolveSafetyReport);

module.exports = router;
