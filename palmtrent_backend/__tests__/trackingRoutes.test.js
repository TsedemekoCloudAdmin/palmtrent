const express = require('express');
const http = require('http');

let mockCurrentUser = { _id: 'shipper-1', id: 'shipper-1', userType: 'shipper' };

jest.mock('../middleware/auth', () => ({
  protect: (req, res, next) => {
    req.user = mockCurrentUser;
    next();
  }
}));

jest.mock('../models/Booking', () => ({
  findOne: jest.fn()
}));

jest.mock('../models/Shipment', () => ({
  findOne: jest.fn()
}));

const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/tracking', require('../routes/tracking'));
  return app;
}

function request(app, method, path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const req = http.request({
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        method
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
      req.end();
    });
  });
}

const mockPopulate = (model, doc) => {
  model.findOne.mockReturnValue({
    populate: jest.fn().mockResolvedValue(doc)
  });
};

describe('tracking routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCurrentUser = { _id: 'shipper-1', id: 'shipper-1', userType: 'shipper' };
  });

  test('public tracking returns the shipment payload without authentication', async () => {
    mockPopulate(Booking, null);
    mockPopulate(Shipment, {
      bookingReference: 'PT-2026-000001',
      status: 'in_transit',
      route: {
        pickup: { address: 'Harare' },
        delivery: { address: 'Bulawayo' }
      },
      tracking: [
        {
          event: 'picked_up',
          note: 'Cargo collected',
          timestamp: '2026-05-26T10:00:00.000Z'
        }
      ]
    });

    const response = await request(createApp(), 'GET', '/tracking/public/PT-2026-000001');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        reference: 'PT-2026-000001',
        status: 'in_transit',
        tracking: expect.arrayContaining([
          expect.objectContaining({ event: 'picked_up' })
        ])
      })
    }));
  });

  test('public tracking accepts compact booking references pasted without the first dash', async () => {
    mockPopulate(Booking, null);
    mockPopulate(Shipment, {
      bookingReference: 'PT-2025-00123456',
      status: 'in_transit',
      tracking: []
    });

    const response = await request(createApp(), 'GET', '/tracking/public/PT2025-00123456');

    expect(Shipment.findOne).toHaveBeenCalledWith({
      $or: [
        { bookingReference: { $in: ['PT2025-00123456', 'PT202500123456', 'PT-2025-00123456'] } },
        { shipmentId: { $in: ['PT2025-00123456', 'PT202500123456', 'PT-2025-00123456'] } }
      ]
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      reference: 'PT-2025-00123456'
    }));
  });

  test('authenticated tracking allows the booking shipper', async () => {
    mockPopulate(Booking, {
      bookingReference: 'PT-2026-000002',
      shipper: 'shipper-1',
      route: {
        pickup: { address: 'Mutare' },
        delivery: { address: 'Gweru' }
      }
    });
    mockPopulate(Shipment, {
      bookingReference: 'PT-2026-000002',
      shipper: 'shipper-1',
      status: 'en_route_pickup',
      tracking: []
    });

    const response = await request(createApp(), 'GET', '/tracking/PT-2026-000002');

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      reference: 'PT-2026-000002',
      status: 'en_route_pickup'
    }));
  });

  test('authenticated tracking blocks unrelated users', async () => {
    mockPopulate(Booking, {
      bookingReference: 'PT-2026-000003',
      shipper: 'other-shipper',
      transporter: { _id: 'other-transporter' }
    });
    mockPopulate(Shipment, {
      bookingReference: 'PT-2026-000003',
      shipper: 'other-shipper',
      transporter: { _id: 'other-transporter' },
      status: 'in_transit',
      tracking: []
    });

    const response = await request(createApp(), 'GET', '/tracking/PT-2026-000003');

    expect(response.status).toBe(403);
    expect(response.body).toEqual(expect.objectContaining({
      success: false,
      message: 'Not authorized to track this shipment'
    }));
  });
});
