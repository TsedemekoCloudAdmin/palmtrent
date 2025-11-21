const express = require('express');
const router = express.Router();
const {
  getActiveShipments,
  getAllShipments,
  getShipmentById,
  trackShipment,
  updateLocation,
  updateStatus,
  createShipment
} = require('../controllers/shipmentsController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// GET /api/v1/shipments - Get all shipments
router.get('/', getAllShipments);

// GET /api/v1/shipments/active - Get active shipments
router.get('/active', getActiveShipments);

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

module.exports = router;