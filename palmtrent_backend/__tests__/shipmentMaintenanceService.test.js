jest.mock('../models/Booking', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn()
}));

jest.mock('../models/Shipment', () => ({
  find: jest.fn()
}));

const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const shipmentMaintenanceService = require('../services/shipmentMaintenanceService');

function bookingQuery(value) {
  return {
    select: jest.fn().mockResolvedValue(value)
  };
}

describe('shipmentMaintenanceService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('links legacy shipments to bookings and adds them back to the booking shipment list', async () => {
    const shipment = {
      _id: 'shipment-1',
      bookingReference: 'BOOK-1',
      save: jest.fn().mockResolvedValue()
    };
    Shipment.find.mockResolvedValue([shipment]);
    Booking.findOne.mockReturnValue(bookingQuery({
      _id: 'booking-1',
      bookingReference: 'BOOK-1'
    }));
    Booking.updateOne.mockResolvedValue({ modifiedCount: 1 });

    const results = await shipmentMaintenanceService.backfillShipmentBookingLinks();

    expect(Shipment.find).toHaveBeenCalledWith({
      booking: { $exists: false },
      bookingReference: { $exists: true, $nin: [null, ''] }
    });
    expect(shipment.booking).toBe('booking-1');
    expect(shipment.save).toHaveBeenCalledTimes(1);
    expect(Booking.updateOne).toHaveBeenCalledWith(
      { _id: 'booking-1' },
      { $addToSet: { shipments: shipment._id } }
    );
    expect(results).toEqual([
      expect.objectContaining({
        shipmentId: shipment._id,
        bookingId: 'booking-1',
        status: 'linked'
      })
    ]);
  });

  test('reports shipments whose booking reference no longer resolves', async () => {
    Shipment.find.mockResolvedValue([{
      _id: 'shipment-orphan',
      bookingReference: 'BOOK-MISSING'
    }]);
    Booking.findOne.mockReturnValue(bookingQuery(null));

    const results = await shipmentMaintenanceService.backfillShipmentBookingLinks();

    expect(results).toEqual([
      expect.objectContaining({
        shipmentId: 'shipment-orphan',
        bookingReference: 'BOOK-MISSING',
        status: 'booking_not_found'
      })
    ]);
    expect(Booking.updateOne).not.toHaveBeenCalled();
  });
});
