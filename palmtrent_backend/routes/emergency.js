const express = require('express');
const router = express.Router();
const {
  triggerSOS,
  updateLocation,
  cancelEmergency,
  getEmergencyHistory,
  getEmergencyStatus,
  getEmergencyContacts,
  updateEmergencyContacts,
  getActiveEmergencies,
  acknowledgeEmergency,
  dispatchResponder,
  resolveEmergency
} = require('../controllers/emergencyController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// User routes
router.post('/sos', triggerSOS);
router.get('/contacts', getEmergencyContacts);
router.put('/contacts', updateEmergencyContacts);
router.get('/history', getEmergencyHistory);
router.get('/admin/active', authorize('admin'), getActiveEmergencies);
router.get('/:id', getEmergencyStatus);
router.put('/:id/location', updateLocation);
router.put('/:id/cancel', cancelEmergency);

// Admin/Support routes
router.put('/:id/acknowledge', authorize('admin'), acknowledgeEmergency);
router.put('/:id/dispatch', authorize('admin'), dispatchResponder);
router.put('/:id/resolve', authorize('admin'), resolveEmergency);

module.exports = router;
