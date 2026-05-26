jest.mock('../models/Booking', () => ({
  find: jest.fn()
}));

jest.mock('../models/Rental', () => ({
  find: jest.fn()
}));

jest.mock('../models/Payment', () => ({
  find: jest.fn(),
  countDocuments: jest.fn()
}));

jest.mock('../services/paymentService', () => ({}));
jest.mock('../services/escrowService', () => ({}));
jest.mock('../services/openApiAfricaService', () => ({}));
jest.mock('../services/payoutService', () => ({}));
jest.mock('../services/integrationSettingsService', () => ({
  getIntegrationConfig: jest.fn()
}));

const Booking = require('../models/Booking');
const Rental = require('../models/Rental');
const Payment = require('../models/Payment');
const { getPayments } = require('../controllers/paymentController');

const createRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn()
});

const createPaymentFindChain = (payments = []) => {
  const chain = {
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(payments)
  };
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
});

test('getPayments scopes non-admin users to their bookings and rentals', async () => {
  Booking.find.mockReturnValue({
    select: jest.fn().mockResolvedValue([{ _id: 'booking-1' }])
  });
  Rental.find.mockReturnValue({
    select: jest.fn().mockResolvedValue([{ _id: 'rental-1' }])
  });
  Payment.find.mockReturnValue(createPaymentFindChain([
    {
      _id: 'payment-1',
      paymentReference: 'PAY-1',
      paymentMethod: 'clicknpay',
      amount: 25,
      status: 'confirmed'
    }
  ]));
  Payment.countDocuments.mockResolvedValue(1);

  const req = {
    user: { _id: 'user-1', id: 'user-1', userType: 'shipper' },
    query: { limit: '10', status: 'confirmed' }
  };
  const res = createRes();

  await getPayments(req, res);

  expect(Booking.find).toHaveBeenCalledWith({
    $or: [
      { user: 'user-1' },
      { shipper: 'user-1' },
      { transporter: 'user-1' }
    ]
  });
  expect(Rental.find).toHaveBeenCalledWith({
    $or: [
      { owner: 'user-1' },
      { renter: 'user-1' }
    ]
  });
  expect(Payment.find).toHaveBeenCalledWith({
    status: 'confirmed',
    $or: [
      { booking: { $in: ['booking-1'] } },
      { rental: { $in: ['rental-1'] } }
    ]
  });
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    success: true,
    count: 1,
    data: [expect.objectContaining({
      paymentReference: 'PAY-1',
      method: 'clicknpay'
    })]
  }));
});

test('getPayments lets admins list all payments with filters', async () => {
  Payment.find.mockReturnValue(createPaymentFindChain([]));
  Payment.countDocuments.mockResolvedValue(0);

  const req = {
    user: { _id: 'admin-1', id: 'admin-1', userType: 'admin' },
    query: { gateway: 'openapi_africa', paymentMethod: 'ecocash' }
  };
  const res = createRes();

  await getPayments(req, res);

  expect(Booking.find).not.toHaveBeenCalled();
  expect(Rental.find).not.toHaveBeenCalled();
  expect(Payment.find).toHaveBeenCalledWith({
    paymentMethod: 'ecocash',
    gateway: 'openapi_africa'
  });
  expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
    success: true,
    count: 0
  }));
});
