const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const { protect } = require('../middleware/auth');

const getIdentifierCandidates = (identifier) => {
  const raw = String(identifier || '').trim();
  const upper = raw.toUpperCase();
  const compact = upper.replace(/[^A-Z0-9]/g, '');
  const candidates = new Set([raw, upper]);
  if (compact && compact !== upper) candidates.add(compact);

  const yearMatch = compact.match(/^PT(\d{4})([A-Z0-9]+)$/);
  if (yearMatch) {
    candidates.add(`PT-${yearMatch[1]}-${yearMatch[2]}`);
  }

  const timestampMatch = compact.match(/^PT([A-Z0-9]{8,})([A-Z0-9]{6})$/);
  if (timestampMatch) {
    candidates.add(`PT-${timestampMatch[1]}-${timestampMatch[2]}`);
  }

  return [...candidates].filter(Boolean);
};

const buildTrackingPayload = async (identifier) => {
  const identifierCandidates = getIdentifierCandidates(identifier);
  const objectIdCandidate = String(identifier || '').match(/^[a-f\d]{24}$/i);
  const booking = await Booking.findOne({
    $or: [
      { bookingReference: { $in: identifierCandidates } },
      ...(objectIdCandidate ? [{ _id: identifier }] : [])
    ]
  }).populate('transporter', 'fullName phone rating');

  const shipmentQuery = booking
    ? { bookingReference: booking.bookingReference }
    : objectIdCandidate
      ? { _id: identifier }
      : {
          $or: [
            { bookingReference: { $in: identifierCandidates } },
            { shipmentId: { $in: identifierCandidates } }
          ]
        };

  const shipment = await Shipment.findOne(shipmentQuery)
    .populate('transporter', 'fullName phone rating');

  if (!booking && !shipment) return null;

  return {
    booking: booking || null,
    shipment: shipment || null,
    status: shipment?.status || booking?.status,
    reference: booking?.bookingReference || shipment?.bookingReference,
    route: shipment?.route || booking?.route,
    transporter: shipment?.transporter || booking?.transporter,
    currentLocation: shipment?.currentLocation,
    tracking: shipment?.tracking || []
  };
};

router.get('/public/:trackingId', async (req, res) => {
  try {
    const data = await buildTrackingPayload(req.params.trackingId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Tracking not found' });
    }
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch tracking', error: error.message });
  }
});

router.get('/:trackingId', protect, async (req, res) => {
  try {
    const data = await buildTrackingPayload(req.params.trackingId);
    if (!data) {
      return res.status(404).json({ success: false, message: 'Tracking not found' });
    }

    const booking = data.booking;
    const shipment = data.shipment;
    const userId = req.user.id;
    const hasAccess = req.user.userType === 'admin' ||
      booking?.shipper?.toString?.() === userId ||
      booking?.user?.toString?.() === userId ||
      booking?.transporter?._id?.toString?.() === userId ||
      shipment?.shipper?.toString?.() === userId ||
      shipment?.transporter?._id?.toString?.() === userId;

    if (!hasAccess) {
      return res.status(403).json({ success: false, message: 'Not authorized to track this shipment' });
    }

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch tracking', error: error.message });
  }
});

// POST /api/v1/tracking/location
// Background-safe REST fallback for GPS updates from transporter/driver when the
// WebSocket is unavailable (app backgrounded on iOS, Doze mode on Android).
// Persists the location to the shipment and broadcasts via Socket.io if the server
// has an active socket for this user.
router.post('/location', protect, async (req, res) => {
  try {
    const { bookingId, latitude, longitude, heading = 0, speed = 0 } = req.body;
    const userId = req.user.id;

    if (!bookingId || latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: 'bookingId, latitude and longitude are required' });
    }

    if (req.user.userType !== 'transporter' && req.user.userType !== 'driver') {
      return res.status(403).json({ success: false, message: 'Only transporters or drivers can submit location updates' });
    }

    const isObjectId = (v) => /^[a-f\d]{24}$/i.test(String(v));
    const shipment = await Shipment.findOne({
      $or: [
        { bookingReference: bookingId },
        ...(isObjectId(bookingId) ? [{ _id: bookingId }, { booking: bookingId }] : [])
      ]
    }).select('_id booking bookingReference transporter shipper assignedDriver');

    if (shipment) {
      // Persist latest position.
      await Shipment.updateOne(
        { _id: shipment._id },
        {
          currentLocation: { type: 'Point', coordinates: [longitude, latitude] },
          $push: {
            tracking: {
              $each: [{
                location: { type: 'Point', coordinates: [longitude, latitude] },
                timestamp: new Date(),
                event: 'location_updated',
                note: 'Background location update'
              }],
              $slice: -200
            }
          }
        }
      );

      // Best-effort: broadcast via Socket.io if the server has the shipper connected.
      try {
        const { getIO } = require('../socket/socketHandler');
        const io = getIO();
        if (io && shipment.shipper) {
          const payload = {
            bookingId,
            latitude,
            longitude,
            heading,
            speed,
            timestamp: new Date(),
            transporterId: userId,
            reference: shipment.bookingReference,
            bookingObjectId: shipment.booking?.toString(),
            shipmentObjectId: shipment._id?.toString()
          };
          io.to(`user:${shipment.shipper.toString()}`).emit('tracking:location', payload);
          [`tracking:${bookingId}`, `tracking:${shipment._id}`, `tracking:${shipment.bookingReference}`]
            .filter(Boolean)
            .forEach(room => io.to(room).emit('tracking:location', payload));
        }
      } catch (_) { /* socket broadcast is best-effort */ }
    }

    res.json({ success: true, message: 'Location updated' });
  } catch (error) {
    console.error('Background location update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update location', error: error.message });
  }
});

module.exports = router;
