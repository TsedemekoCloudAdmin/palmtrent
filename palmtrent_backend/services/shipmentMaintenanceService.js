const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');

async function backfillShipmentBookingLinks() {
  const shipments = await Shipment.find({
    booking: { $exists: false },
    bookingReference: { $exists: true, $nin: [null, ''] }
  });
  const results = [];

  for (const shipment of shipments) {
    try {
      const booking = await Booking.findOne({ bookingReference: shipment.bookingReference })
        .select('_id bookingReference');

      if (!booking) {
        results.push({
          shipmentId: shipment._id,
          bookingReference: shipment.bookingReference,
          status: 'booking_not_found'
        });
        continue;
      }

      shipment.booking = booking._id;
      await shipment.save();
      await Booking.updateOne(
        { _id: booking._id },
        { $addToSet: { shipments: shipment._id } }
      );

      results.push({
        shipmentId: shipment._id,
        bookingId: booking._id,
        bookingReference: shipment.bookingReference,
        status: 'linked'
      });
    } catch (error) {
      results.push({
        shipmentId: shipment._id,
        bookingReference: shipment.bookingReference,
        status: 'failed',
        error: error.message
      });
    }
  }

  return results;
}

module.exports = {
  backfillShipmentBookingLinks
};
