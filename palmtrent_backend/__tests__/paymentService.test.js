jest.mock('../models/Payment', () => ({
  findOne: jest.fn()
}));

jest.mock('../models/Booking', () => ({
  findById: jest.fn()
}));

jest.mock('../models/Shipment', () => ({
  findOne: jest.fn(),
  create: jest.fn()
}));

jest.mock('../services/escrowService', () => ({
  createEscrow: jest.fn()
}));

const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const escrowService = require('../services/escrowService');
const paymentService = require('../services/paymentService');

describe('paymentService payment finalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('routes hosted digital methods through ClicknPay', () => {
    expect(paymentService.getGatewayForMethod('openapi_africa')).toBe('openapi_africa');
    expect(paymentService.getGatewayForMethod('clicknpay')).toBe('openapi_africa');
    expect(paymentService.getGatewayForMethod('ecocash')).toBe('openapi_africa');
    expect(paymentService.getGatewayForMethod('onemoney')).toBe('openapi_africa');
  });

  test('does not downgrade a confirmed payment from a later gateway status', async () => {
    const payment = {
      status: 'confirmed',
      metadata: { retained: true },
      save: jest.fn().mockResolvedValue()
    };
    Payment.findOne.mockResolvedValue(payment);

    await paymentService.updatePaymentStatus('PAY-1', 'cancelled', { source: 'late-webhook' });

    expect(payment.status).toBe('confirmed');
    expect(payment.metadata.retained).toBe(true);
    expect(payment.metadata.ignoredStatusUpdate).toEqual(expect.objectContaining({
      status: 'cancelled',
      metadata: { source: 'late-webhook' }
    }));
    expect(payment.save).toHaveBeenCalledTimes(1);
  });

  test('keeps advanced bookings in place when a payment is finalized again', async () => {
    const paidAt = new Date('2026-05-22T10:00:00.000Z');
    const booking = {
      _id: 'booking-1',
      status: 'matched',
      paymentStatus: 'escrowed',
      payment: {},
      save: jest.fn().mockResolvedValue()
    };
    Booking.findById.mockResolvedValue(booking);
    escrowService.createEscrow.mockResolvedValue({ escrowReference: 'ESC-1' });
    const createShipment = jest.spyOn(paymentService, 'createShipmentFromBooking')
      .mockResolvedValue({ _id: 'shipment-1' });

    await paymentService.finalizeConfirmedBookingPayment({
      _id: 'payment-1',
      booking: booking._id,
      confirmedAt: paidAt
    });

    expect(booking.status).toBe('matched');
    expect(booking.paymentStatus).toBe('escrowed');
    expect(booking.payment).toEqual(expect.objectContaining({
      status: 'confirmed',
      paidAt
    }));
    expect(escrowService.createEscrow).toHaveBeenCalledWith('payment-1', booking._id);
    expect(createShipment).toHaveBeenCalledWith(booking._id);

    createShipment.mockRestore();
  });

  test('reuses an existing shipment for bookings without a shipment list yet', async () => {
    const existingShipmentId = { toString: () => 'shipment-1' };
    const booking = {
      _id: 'booking-1',
      bookingReference: 'BOOK-1',
      shipments: undefined,
      save: jest.fn().mockResolvedValue()
    };
    Booking.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(booking)
    });
    Shipment.findOne.mockResolvedValue({ _id: existingShipmentId, booking: booking._id });

    const shipment = await paymentService.createShipmentFromBooking('booking-1');

    expect(shipment._id).toBe(existingShipmentId);
    expect(booking.shipments).toEqual([existingShipmentId]);
    expect(booking.save).toHaveBeenCalledTimes(1);
    expect(Shipment.create).not.toHaveBeenCalled();
  });

  test('writes the booking relationship when creating a shipment from payment confirmation', async () => {
    const booking = {
      _id: 'booking-2',
      bookingReference: 'BOOK-2',
      user: { _id: 'shipper-2' },
      shipments: [],
      route: { pickup: { date: new Date('2026-05-22T08:00:00.000Z') } },
      save: jest.fn().mockResolvedValue()
    };
    const shipment = { _id: 'shipment-2' };
    Booking.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(booking)
    });
    Shipment.findOne.mockResolvedValue(null);
    Shipment.create.mockResolvedValue(shipment);

    await paymentService.createShipmentFromBooking(booking._id);

    expect(Shipment.create).toHaveBeenCalledWith(expect.objectContaining({
      booking: booking._id,
      bookingReference: booking.bookingReference,
      shipper: booking.user._id
    }));
    expect(booking.shipments).toEqual([shipment._id]);
    expect(booking.save).toHaveBeenCalledTimes(1);
  });
});
