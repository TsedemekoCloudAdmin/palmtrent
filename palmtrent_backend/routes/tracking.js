const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const { protect } = require('../middleware/auth');

const buildTrackingPayload = async (identifier) => {
  const booking = await Booking.findOne({
    $or: [
      { bookingReference: identifier },
      ...(identifier.match(/^[a-f\d]{24}$/i) ? [{ _id: identifier }] : [])
    ]
  }).populate('transporter', 'fullName phone rating');

  const shipmentQuery = booking
    ? { bookingReference: booking.bookingReference }
    : identifier.match(/^[a-f\d]{24}$/i)
      ? { _id: identifier }
      : { bookingReference: identifier };

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
