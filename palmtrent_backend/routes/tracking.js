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

module.exports = router;
