jest.mock('express-validator', () => ({
  validationResult: jest.fn(() => ({
    isEmpty: () => true,
    array: () => []
  }))
}));

jest.mock('../models/PricingConfig', () => ({}));
jest.mock('../models/Shipment', () => ({}));
jest.mock('../models/User', () => ({}));

jest.mock('../models/Booking', () => ({
  create: jest.fn()
}));

jest.mock('../services/pricingService', () => ({}));
jest.mock('../services/distanceService', () => ({}));
jest.mock('../controllers/whatsappController', () => ({}));

jest.mock('../services/auditService', () => ({
  recordAudit: jest.fn()
}));

jest.mock('../services/flowControlService', () => ({
  assertBookingTransition: jest.fn(),
  assertBookingReadyForMatching: jest.fn(),
  assertCorporateCanBook: jest.fn(),
  reserveCorporateCredit: jest.fn(),
  releaseCorporateCredit: jest.fn()
}));

jest.mock('../services/paymentService', () => ({
  createPayment: jest.fn()
}));

const Booking = require('../models/Booking');
const paymentService = require('../services/paymentService');
const { recordAudit } = require('../services/auditService');
const { assertCorporateCanBook } = require('../services/flowControlService');
const { createBookingWithPayment } = require('../controllers/bookingsController');

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('bookingsController createBookingWithPayment', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assertCorporateCanBook.mockResolvedValue(null);
  });

  test('returns agent payment instructions for cash agent bookings without creating another payment later', async () => {
    const booking = {
      _id: 'booking-1',
      bookingReference: 'PT-1',
      status: 'pending_payment',
      paymentStatus: 'pending',
      totalAmount: 75
    };
    const payment = {
      _id: 'payment-1',
      paymentReference: 'PAY-1',
      paymentMethod: 'cash_agent',
      amount: 75,
      currency: 'USD',
      status: 'pending',
      expiresAt: new Date('2026-05-26T12:00:00.000Z'),
      metadata: {},
      save: jest.fn().mockResolvedValue()
    };
    Booking.create.mockResolvedValue(booking);
    paymentService.createPayment.mockResolvedValue(payment);
    const res = response();

    await createBookingWithPayment({
      user: {
        id: 'shipper-1',
        _id: 'shipper-1',
        userType: 'shipper',
        email: 'shipper@example.com',
        phone: '+263771234567'
      },
      body: {
        pickupLocation: 'Harare',
        deliveryLocation: 'Bulawayo',
        pickupDate: '2026-01-01',
        pickupTimeWindow: '08:00',
        cargoType: 'General cargo',
        weight: 1000,
        cargoValue: 200,
        paymentMethod: 'cash_agent',
        amount: 75,
        pricing: { totals: { total: 75 } },
        customer: {
          email: 'shipper@example.com',
          phone: '+263771234567'
        }
      }
    }, res);

    expect(paymentService.createPayment).toHaveBeenCalledWith(
      'booking-1',
      75,
      'cash_agent',
      expect.objectContaining({ email: 'shipper@example.com' })
    );
    expect(payment.save).toHaveBeenCalledTimes(1);
    expect(payment.metadata.agentCode).toMatch(/^PT\d{6}$/);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        payment: expect.objectContaining({
          paymentReference: 'PAY-1',
          agentPayment: expect.objectContaining({
            paymentReference: 'PAY-1',
            agentCode: payment.metadata.agentCode,
            instructions: expect.objectContaining({
              merchantCode: expect.any(String),
              steps: expect.arrayContaining([
                expect.stringContaining(payment.metadata.agentCode)
              ])
            })
          })
        })
      })
    }));
    expect(recordAudit).toHaveBeenCalledWith(expect.objectContaining({
      action: 'booking.created_with_payment',
      metadata: { paymentCreated: true }
    }));
  });

  test('does not attach agent instructions for hosted gateway payments', async () => {
    const booking = {
      _id: 'booking-2',
      bookingReference: 'PT-2',
      status: 'pending_payment',
      paymentStatus: 'pending',
      totalAmount: 120
    };
    const payment = {
      _id: 'payment-2',
      paymentReference: 'PAY-2',
      paymentMethod: 'ecocash',
      amount: 120,
      currency: 'USD',
      status: 'pending',
      expiresAt: new Date('2026-05-26T12:00:00.000Z'),
      metadata: {},
      save: jest.fn()
    };
    Booking.create.mockResolvedValue(booking);
    paymentService.createPayment.mockResolvedValue(payment);
    const res = response();

    await createBookingWithPayment({
      user: { id: 'shipper-1', _id: 'shipper-1', userType: 'shipper' },
      body: {
        pickupLocation: 'Harare',
        deliveryLocation: 'Gweru',
        pickupDate: '2026-01-01',
        pickupTimeWindow: '08:00',
        cargoType: 'General cargo',
        weight: 500,
        paymentMethod: 'ecocash',
        amount: 120,
        pricing: { totals: { total: 120 } }
      }
    }, res);

    expect(payment.save).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        payment: expect.objectContaining({
          paymentReference: 'PAY-2',
          agentPayment: null
        })
      })
    }));
  });
});
