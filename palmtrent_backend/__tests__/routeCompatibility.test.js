const express = require('express');
const http = require('http');

jest.mock('../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = { _id: 'user-1', id: 'user-1', userType: 'admin' };
    next();
  },
  authorize: () => (req, res, next) => next(),
  requireRentalPermission: () => (req, res, next) => next()
}));

jest.mock('../controllers/vehicleController', () => ({
  getVehicles: jest.fn((req, res) => res.status(200).json({ handler: 'getVehicles' })),
  getVehicle: jest.fn((req, res) => res.status(200).json({ handler: 'getVehicle' })),
  createVehicle: jest.fn(),
  updateVehicle: jest.fn(),
  deleteVehicle: jest.fn(),
  assignDriver: jest.fn(),
  getAvailableForRental: jest.fn(),
  updateRentalSettings: jest.fn(),
  types: jest.fn(),
  recommend: jest.fn(),
  uploadVehiclePhoto: jest.fn(),
  getVehiclePhotos: jest.fn(),
  deleteVehiclePhoto: jest.fn()
}));

jest.mock('../controllers/trailerController', () => ({
  getMyTrailers: jest.fn(),
  getTrailerById: jest.fn(),
  createTrailer: jest.fn(),
  updateTrailer: jest.fn(),
  deleteTrailer: jest.fn(),
  updateTrailerStatus: jest.fn((req, res) => res.status(200).json({ handler: 'updateTrailerStatus' })),
  updateRentalSettings: jest.fn((req, res) => res.status(200).json({ handler: 'updateRentalSettings' })),
  getTrailerRentals: jest.fn(),
  getAvailableTrailers: jest.fn(),
  addMaintenanceRecord: jest.fn()
}));

jest.mock('../controllers/ratingController', () => ({
  submitRating: jest.fn((req, res) => res.status(201).json({
    handler: 'submitRating',
    bookingId: req.params.bookingId
  })),
  getUserRating: jest.fn(),
  getUserReviews: jest.fn(),
  getBookingRatings: jest.fn(),
  respondToRating: jest.fn(),
  flagRating: jest.fn(),
  checkCanRate: jest.fn(),
  getMyRatings: jest.fn(),
  getMyGivenRatings: jest.fn()
}));

jest.mock('../controllers/paymentController', () => ({
  getPayments: jest.fn((req, res) => res.status(200).json({ handler: 'getPayments' })),
  createPayment: jest.fn(),
  initiatePayment: jest.fn(),
  confirmCashPayment: jest.fn(),
  checkPaymentStatus: jest.fn(),
  handlePaynowWebhook: jest.fn(),
  getPaymentByReference: jest.fn((req, res) => res.status(200).json({
    handler: 'getPaymentByReference',
    reference: req.params.reference
  })),
  checkPaymentExpiry: jest.fn(),
  initiateAgentPayment: jest.fn(),
  verifyAgentPayment: jest.fn(),
  handleEcocashAgentWebhook: jest.fn(),
  testAgentWebhook: jest.fn(),
  reconcileEcocashAgentPayments: jest.fn(),
  getEscrowStatus: jest.fn(),
  confirmDeliveryForEscrow: jest.fn(),
  raiseEscrowDispute: jest.fn(),
  cancelAndRefund: jest.fn(),
  recordCashCollection: jest.fn(),
  adminReleaseFunds: jest.fn(),
  adminProcessScheduledReleases: jest.fn(),
  adminResolveDispute: jest.fn(),
  adminGetEscrowSummary: jest.fn(),
  getTransporterBalance: jest.fn(),
  requestWithdrawal: jest.fn(),
  getWithdrawalHistory: jest.fn(),
  updatePayoutPreferences: jest.fn(),
  getPayoutPreferences: jest.fn()
}));

const vehicleController = require('../controllers/vehicleController');
const trailerController = require('../controllers/trailerController');
const ratingController = require('../controllers/ratingController');
const paymentController = require('../controllers/paymentController');

function createApp(prefix, routeModule) {
  const app = express();
  app.use(express.json());
  app.use(prefix, routeModule);
  return app;
}

function request(app, method, path, body) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const payload = body ? JSON.stringify(body) : null;
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        method,
        headers: payload ? {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        } : {}
      }, (res) => {
        let raw = '';
        res.on('data', chunk => {
          raw += chunk;
        });
        res.on('end', () => {
          server.close(() => {
            resolve({
              status: res.statusCode,
              body: raw ? JSON.parse(raw) : null
            });
          });
        });
      });

      req.on('error', error => {
        server.close(() => reject(error));
      });

      if (payload) req.write(payload);
      req.end();
    });
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

test('mobile vehicle fleet alias resolves before the dynamic vehicle id route', async () => {
  const app = createApp('/vehicles', require('../routes/vehicles'));

  const response = await request(app, 'GET', '/vehicles/my-vehicles');

  expect(response.status).toBe(200);
  expect(response.body.handler).toBe('getVehicles');
  expect(vehicleController.getVehicles).toHaveBeenCalledTimes(1);
  expect(vehicleController.getVehicle).not.toHaveBeenCalled();
});

test('trailer status and rental settings accept PUT from web and mobile clients', async () => {
  const app = createApp('/trailers', require('../routes/trailers'));

  const statusResponse = await request(app, 'PUT', '/trailers/trailer-1/status', { status: 'available' });
  const settingsResponse = await request(app, 'PUT', '/trailers/trailer-1/rental-settings', { dailyRate: 120 });

  expect(statusResponse.status).toBe(200);
  expect(statusResponse.body.handler).toBe('updateTrailerStatus');
  expect(settingsResponse.status).toBe(200);
  expect(settingsResponse.body.handler).toBe('updateRentalSettings');
  expect(trailerController.updateTrailerStatus).toHaveBeenCalledTimes(1);
  expect(trailerController.updateRentalSettings).toHaveBeenCalledTimes(1);
});

test('generic rating submission maps to the booking-scoped rating controller', async () => {
  const app = createApp('/ratings', require('../routes/ratings'));

  const response = await request(app, 'POST', '/ratings', {
    bookingId: 'booking-1',
    overallRating: 5
  });

  expect(response.status).toBe(201);
  expect(response.body).toEqual({
    handler: 'submitRating',
    bookingId: 'booking-1'
  });
  expect(ratingController.submitRating).toHaveBeenCalledTimes(1);
});

test('generic rating submission requires a booking id', async () => {
  const app = createApp('/ratings', require('../routes/ratings'));

  const response = await request(app, 'POST', '/ratings', { overallRating: 5 });

  expect(response.status).toBe(400);
  expect(response.body.message).toBe('bookingId is required to submit a rating');
  expect(ratingController.submitRating).not.toHaveBeenCalled();
});

test('payments list resolves before the payment reference route', async () => {
  const app = createApp('/payments', require('../routes/payments'));

  const listResponse = await request(app, 'GET', '/payments');
  const detailResponse = await request(app, 'GET', '/payments/PAY-123');

  expect(listResponse.status).toBe(200);
  expect(listResponse.body.handler).toBe('getPayments');
  expect(detailResponse.status).toBe(200);
  expect(detailResponse.body).toEqual({
    handler: 'getPaymentByReference',
    reference: 'PAY-123'
  });
  expect(paymentController.getPayments).toHaveBeenCalledTimes(1);
  expect(paymentController.getPaymentByReference).toHaveBeenCalledTimes(1);
});
