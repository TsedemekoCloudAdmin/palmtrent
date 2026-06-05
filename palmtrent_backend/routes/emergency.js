const express = require('express');
const router = express.Router();
const {
  triggerSOS,
  updateLocation,
  cancelEmergency,
  getEmergencyHistory,
  getEmergencyDecisions,
  getEmergencyStatus,
  getEmergencyContacts,
  updateEmergencyContacts,
  getActiveEmergencies,
  acknowledgeEmergency,
  dispatchResponder,
  resolveEmergency,
  getAdminEmergencies,
  getResponderProfile,
  upsertResponderProfile,
  updateResponderAvailability,
  getResponderRequests,
  respondToEmergency,
  acceptRoadsideQuote,
  rejectRoadsideQuote,
  createEmergencyPayment,
  getAdminResponders,
  verifyResponder
} = require('../controllers/emergencyController');
const { protect, authorize } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// User routes
router.post('/sos', triggerSOS);
router.get('/contacts', getEmergencyContacts);
router.put('/contacts', updateEmergencyContacts);
router.get('/history', getEmergencyHistory);
router.get('/decisions', getEmergencyDecisions);
router.get('/admin/active', authorize('admin'), getActiveEmergencies);
router.get('/admin/list', authorize('admin'), getAdminEmergencies);
router.get('/admin/responders', authorize('admin'), getAdminResponders);
router.put('/admin/responders/:id/verify', authorize('admin'), verifyResponder);
router.get('/responders/me', getResponderProfile);
router.put('/responders/me', upsertResponderProfile);
router.put('/responders/me/availability', updateResponderAvailability);
router.get('/responders/requests', getResponderRequests);
router.get('/:id', getEmergencyStatus);
router.put('/:id/location', updateLocation);
router.put('/:id/cancel', cancelEmergency);
router.post('/:id/payment', createEmergencyPayment);
router.put('/:id/quotes/:responderId/accept', acceptRoadsideQuote);
router.put('/:id/quotes/:responderId/reject', rejectRoadsideQuote);
router.put('/:id/respond', respondToEmergency);

// Admin/Support routes
router.put('/:id/acknowledge', authorize('admin'), acknowledgeEmergency);
router.put('/:id/dispatch', authorize('admin'), dispatchResponder);
router.put('/:id/resolve', authorize('admin'), resolveEmergency);

module.exports = router;
