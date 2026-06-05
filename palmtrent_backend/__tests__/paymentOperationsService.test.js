jest.mock('../models/Booking', () => ({
  find: jest.fn()
}));

jest.mock('../models/Rental', () => ({
  find: jest.fn()
}));

jest.mock('../models/Subscription', () => ({
  find: jest.fn()
}));

jest.mock('../models/Emergency', () => ({
  find: jest.fn()
}));

jest.mock('../models/Payment', () => ({
  find: jest.fn(),
  countDocuments: jest.fn()
}));

const Booking = require('../models/Booking');
const Rental = require('../models/Rental');
const Subscription = require('../models/Subscription');
const Emergency = require('../models/Emergency');
const Payment = require('../models/Payment');
const paymentOperationsService = require('../services/paymentOperationsService');

function selectResult(items) {
  return { select: jest.fn().mockResolvedValue(items) };
}

function paymentQueryResult(items) {
  return {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(items)
  };
}

describe('paymentOperationsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('builds scoped payment query for non-admin users', async () => {
    Booking.find.mockReturnValue(selectResult([{ _id: 'booking-1' }]));
    Rental.find.mockReturnValue(selectResult([{ _id: 'rental-1' }]));
    Subscription.find.mockReturnValue(selectResult([{ _id: 'subscription-1' }]));
    Emergency.find.mockReturnValue(selectResult([{ _id: 'emergency-1' }]));

    const query = await paymentOperationsService.buildVisiblePaymentQuery(
      { _id: '507f1f77bcf86cd799439011', userType: 'shipper' },
      { status: 'confirmed' }
    );

    expect(query).toEqual({
      status: 'confirmed',
      $or: [
        { booking: { $in: ['booking-1'] } },
        { rental: { $in: ['rental-1'] } },
        { subscription: { $in: ['subscription-1'] } },
        { emergency: { $in: ['emergency-1'] } }
      ]
    });
  });

  test('lists and serializes visible payments', async () => {
    Payment.find.mockReturnValue(paymentQueryResult([
      { paymentReference: 'PAY-1', paymentMethod: 'clicknpay' }
    ]));
    Payment.countDocuments.mockResolvedValue(1);

    const result = await paymentOperationsService.listVisiblePayments(
      { userType: 'admin' },
      { limit: '10' }
    );

    expect(result.data).toEqual([
      { paymentReference: 'PAY-1', paymentMethod: 'clicknpay', method: 'clicknpay' }
    ]);
    expect(result.pagination).toEqual(expect.objectContaining({
      page: 1,
      limit: 10,
      total: 1
    }));
  });
});
