const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const courier = require('../controllers/courierController');

router.use(protect);

// Depots
router.get('/depots', courier.listDepots);
router.post('/depots', courier.createDepot);

// Sender / shared-user facing
router.get('/my-shipments', courier.myShipments);

// Live weight-based pricing quote
router.post('/quote', courier.quote);

// Shipment lifecycle (agent)
router.post('/shipments', courier.createShipment);
router.get('/shipments', courier.listShipments);
router.get('/shipments/:id', courier.getShipment);
router.get('/shipments/:id/label', courier.getLabel);
router.get('/shipments/:id/zpl', courier.getZpl);
router.post('/shipments/:id/zpl/print', courier.printZpl);
router.post('/shipments/:id/load', courier.markLoaded);
router.post('/shipments/:id/depart', courier.markDeparted);
router.post('/shipments/:id/arrive', courier.markArrived);
router.post('/shipments/:id/collect', courier.markCollected);
router.post('/shipments/:id/cancel', courier.cancelShipment);

// Sharing / extra contacts (sender)
router.post('/shipments/:id/share', courier.shareShipment);
router.post('/shipments/:id/contacts', courier.addContact);

module.exports = router;
