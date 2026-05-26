const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
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
  getEarnings,
  getEarningStats,
  getPerformance,
  submitVerification,
  getTrailerPairingOptions,
  requestTrailerPairing
} = require('../controllers/transporterController');
const vehicleController = require('../controllers/vehicleController');
const { protect, authorize, requireVerified } = require('../middleware/auth');

const verificationDir = path.join(__dirname, '..', 'uploads', 'verification');
fs.mkdirSync(verificationDir, { recursive: true });

const verificationUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, verificationDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.jpg';
      const safeField = file.fieldname.replace(/[^a-z0-9_-]/gi, '').toLowerCase();
      cb(null, `${req.user.id}-${safeField}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/^image\/|application\/pdf$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image and PDF files are allowed'));
  }
});

// All routes require authentication
router.use(protect);
router.use(authorize('transporter'));

// Dashboard
router.get('/dashboard-stats', getDashboardStats);
router.get('/recent-activity', getRecentActivity);
router.get('/earnings', getEarnings);
router.get('/earnings/stats', getEarningStats);
router.get('/performance', getPerformance);

// Vehicle aliases used by transporter mobile services
router.get('/vehicles', vehicleController.getVehicles);
router.post('/vehicles', vehicleController.createVehicle);
router.put('/vehicles/:id', vehicleController.updateVehicle);
router.put('/vehicles/:id/status', vehicleController.updateVehicle);

// Verification
router.post('/verify', verificationUpload.fields([
  { name: 'idFront', maxCount: 1 },
  { name: 'idBack', maxCount: 1 },
  { name: 'licenseFront', maxCount: 1 },
  { name: 'licenseBack', maxCount: 1 },
  { name: 'selfie', maxCount: 1 }
]), submitVerification);

// Jobs
router.get('/available-jobs', requireVerified('transporter'), getAvailableJobs);
router.get('/my-jobs', getMyJobs);
router.get('/jobs/:jobId', getJobDetails);
router.get('/jobs/:jobId/trailer-options', requireVerified('transporter'), getTrailerPairingOptions);
router.post('/jobs/:jobId/trailer-rental', requireVerified('transporter'), requestTrailerPairing);
router.post('/jobs/:jobId/accept', requireVerified('transporter'), acceptJob);
router.post('/jobs/:jobId/reject', rejectJob);

// Shipment status updates
router.post('/shipments/:shipmentId/start-pickup', requireVerified('transporter'), startPickup);
router.post('/shipments/:shipmentId/confirm-pickup', requireVerified('transporter'), confirmPickup);
router.post('/shipments/:shipmentId/start-transit', requireVerified('transporter'), startTransit);
router.post('/shipments/:shipmentId/update-location', requireVerified('transporter'), updateLocation);
router.post('/shipments/:shipmentId/arrive-delivery', requireVerified('transporter'), arriveAtDelivery);
router.post('/shipments/:shipmentId/confirm-delivery', requireVerified('transporter'), confirmDelivery);

module.exports = router;
