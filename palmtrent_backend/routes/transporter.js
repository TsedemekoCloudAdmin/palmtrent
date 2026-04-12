const express = require('express');
const router = express.Router();
const {
  getAvailableJobs,
  getDashboardStats,
  getRecentActivity,
  getMyJobs,
  getJobDetails,
  acceptJob,
  rejectJob,
  startPickup,
  confirmPickup,
  startTransit,
  updateLocation,
  arriveAtDelivery,
  confirmDelivery,
  getEarnings
} = require('../controllers/transporterController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Dashboard
router.get('/dashboard-stats', getDashboardStats);
router.get('/recent-activity', getRecentActivity);
router.get('/earnings', getEarnings);

// Jobs
router.get('/available-jobs', getAvailableJobs);
router.get('/my-jobs', getMyJobs);
router.get('/jobs/:jobId', getJobDetails);
router.post('/jobs/:jobId/accept', acceptJob);
router.post('/jobs/:jobId/reject', rejectJob);

// Shipment status updates
router.post('/shipments/:shipmentId/start-pickup', startPickup);
router.post('/shipments/:shipmentId/confirm-pickup', confirmPickup);
router.post('/shipments/:shipmentId/start-transit', startTransit);
router.post('/shipments/:shipmentId/update-location', updateLocation);
router.post('/shipments/:shipmentId/arrive-delivery', arriveAtDelivery);
router.post('/shipments/:shipmentId/confirm-delivery', confirmDelivery);

module.exports = router;