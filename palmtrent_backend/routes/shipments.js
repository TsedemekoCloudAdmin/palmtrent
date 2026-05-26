const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const {
  getActiveShipments,
  getAllShipments,
  getShipmentById,
  trackShipment,
  updateLocation,
  updateStatus,
  createShipment,
  uploadProofOfDelivery,
  getProofOfDeliveryDocument,
  emailProofOfDeliveryDocument,
  rateShipment,
  getShipmentAnalytics
} = require('../controllers/shipmentsController');
const { protect } = require('../middleware/auth');

const podDir = path.join(__dirname, '..', 'uploads', 'pod');
fs.mkdirSync(podDir, { recursive: true });

const podUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, podDir),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname || '') || '.jpg';
      cb(null, `${req.user.id}-pod-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    }
  }),
  limits: { fileSize: 8 * 1024 * 1024, files: 8 },
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp)$|^application\/pdf$/.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG, PNG, WebP, and PDF POD files are allowed'));
  }
});

// All routes require authentication
router.use(protect);

// GET /api/v1/shipments - Get all shipments
router.get('/', getAllShipments);

// GET /api/v1/shipments/active - Get active shipments
router.get('/active', getActiveShipments);

// GET /api/v1/shipments/analytics - Shipment analytics
router.get('/analytics', getShipmentAnalytics);

// POST /api/v1/shipments - Create new shipment
router.post('/', createShipment);

// GET /api/v1/shipments/:id - Get single shipment
router.get('/:id', getShipmentById);

// GET /api/v1/shipments/:id/track - Track shipment
router.get('/:id/track', trackShipment);

// PUT /api/v1/shipments/:id/location - Update location (transporter only)
router.put('/:id/location', updateLocation);

// PUT /api/v1/shipments/:id/status - Update status (transporter only)
router.put('/:id/status', updateStatus);

// POST /api/v1/shipments/:id/proof-of-delivery - Upload POD
router.post('/:id/proof-of-delivery', podUpload.array('files', 8), uploadProofOfDelivery);

// GET /api/v1/shipments/:id/proof-of-delivery/document - Prepare a private POD PDF.
router.get('/:id/proof-of-delivery/document', getProofOfDeliveryDocument);

// POST /api/v1/shipments/:id/proof-of-delivery/email - Email a POD PDF attachment.
router.post('/:id/proof-of-delivery/email', emailProofOfDeliveryDocument);

// POST /api/v1/shipments/:id/rate - Rate shipment counterparty
router.post('/:id/rate', rateShipment);

module.exports = router;
