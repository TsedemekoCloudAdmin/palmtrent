jest.mock('../models/Shipment', () => ({
  countDocuments: jest.fn(),
  find: jest.fn(),
  aggregate: jest.fn()
}));

jest.mock('../models/Booking', () => ({}));
jest.mock('../models/Escrow', () => ({}));
jest.mock('../models/User', () => ({}));
jest.mock('../models/Rental', () => ({}));

jest.mock('../services/escrowService', () => ({}));
jest.mock('../services/notificationService', () => ({}));
jest.mock('../controllers/whatsappController', () => ({}));
jest.mock('../utils/formatDate', () => ({
  formatRelativeTime: jest.fn(() => 'Just now')
}));
jest.mock('../services/auditService', () => ({
  recordAudit: jest.fn()
}));
jest.mock('../services/tractorTrailerMatchingService', () => ({}));
jest.mock('../services/monetizationService', () => ({}));
jest.mock('../services/shipmentEvidenceService', () => ({}));
jest.mock('../services/podService', () => ({}));
jest.mock('../services/matchingService', () => ({}));
jest.mock('../services/uploadFinalizationService', () => ({}));
jest.mock('../services/flowControlService', () => ({
  assertBookingTransition: jest.fn(),
  assertShipmentTransition: jest.fn(),
  assertTransporterEligible: jest.fn(),
  assertVehicleAssignable: jest.fn(),
  isPaymentConfirmed: jest.fn()
}));

const Shipment = require('../models/Shipment');
const {
  getMyJobs,
  getDashboardStats,
  getEarnings
} = require('../controllers/transporterController');

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

function shipmentFindChain(result) {
  const chain = {
    sort: jest.fn(() => chain),
    skip: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    populate: jest.fn(() => chain),
    select: jest.fn(() => chain),
    lean: jest.fn().mockResolvedValue(result)
  };
  return chain;
}

describe('transporterController job listing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('supports comma-separated active shipment statuses from mobile', async () => {
    Shipment.find.mockReturnValue(shipmentFindChain([{ _id: 'shipment-1', status: 'assigned' }]));
    Shipment.countDocuments.mockResolvedValue(1);
    const res = response();

    await getMyJobs({
      user: { id: 'transporter-1' },
      query: {
        status: 'assigned,en_route_pickup,picked_up,in_transit'
      }
    }, res);

    expect(Shipment.find).toHaveBeenCalledWith({
      transporter: 'transporter-1',
      status: { $in: ['assigned', 'en_route_pickup', 'picked_up', 'in_transit'] }
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: [{ _id: 'shipment-1', status: 'assigned' }]
    }));
  });

  test('supports active status alias for transporter jobs', async () => {
    Shipment.find.mockReturnValue(shipmentFindChain([]));
    Shipment.countDocuments.mockResolvedValue(0);
    const res = response();

    await getMyJobs({
      user: { id: 'transporter-1' },
      query: { status: 'active' }
    }, res);

    expect(Shipment.find).toHaveBeenCalledWith({
      transporter: 'transporter-1',
      status: { $in: ['assigned', 'en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery'] }
    });
  });

  test('dashboard active job count includes every in-progress shipment status', async () => {
    Shipment.countDocuments
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(9);
    Shipment.find.mockResolvedValue([{
      transporterEarnings: 120,
      completedAt: new Date('2026-05-25T10:00:00.000Z'),
      schedule: {
        scheduledDeliveryTime: new Date('2026-05-25T11:00:00.000Z')
      }
    }]);
    Shipment.aggregate.mockResolvedValue([{ avgRating: 4.5, totalRatings: 3 }]);
    const res = response();

    await getDashboardStats({
      user: { id: 'transporter-1', _id: 'transporter-1' }
    }, res);

    expect(Shipment.countDocuments).toHaveBeenNthCalledWith(1, {
      transporter: 'transporter-1',
      status: { $in: ['assigned', 'en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery'] }
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        activeJobs: 5,
        pendingPayment: 1,
        earnings: 120,
        totalTrips: 9,
        rating: 4.5,
        onTimeDelivery: 100
      })
    }));
  });
});

describe('transporterController earnings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('all-time earnings do not apply a current-date filter', async () => {
    const completedAt = new Date('2026-05-20T08:00:00.000Z');
    const chain = {
      sort: jest.fn().mockResolvedValue([{
        _id: 'shipment-1',
        bookingReference: 'PT-1',
        origin: 'Harare',
        destination: 'Bulawayo',
        transporterEarnings: 250,
        completedAt
      }])
    };
    Shipment.find.mockReturnValue(chain);
    Shipment.aggregate.mockResolvedValue([{ total: 75 }]);
    const res = response();

    await getEarnings({
      user: { id: 'transporter-1', _id: 'transporter-1' },
      query: { period: 'all' }
    }, res);

    expect(Shipment.find).toHaveBeenCalledWith({
      transporter: 'transporter-1',
      status: 'completed'
    });
    expect(chain.sort).toHaveBeenCalledWith({
      completedAt: -1,
      'timeline.completedAt': -1
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        totalEarnings: 250,
        pendingEarnings: 75,
        completedTrips: 1,
        recentEarnings: [expect.objectContaining({
          reference: 'PT-1',
          route: 'Harare to Bulawayo',
          date: completedAt
        })]
      })
    }));
  });

  test('month earnings filter by either completedAt field', async () => {
    Shipment.find.mockReturnValue({ sort: jest.fn().mockResolvedValue([]) });
    Shipment.aggregate.mockResolvedValue([]);
    const res = response();

    await getEarnings({
      user: { id: 'transporter-1', _id: 'transporter-1' },
      query: { period: 'month' }
    }, res);

    expect(Shipment.find).toHaveBeenCalledWith(expect.objectContaining({
      transporter: 'transporter-1',
      status: 'completed',
      $or: [
        { completedAt: { $gte: expect.any(Date) } },
        { 'timeline.completedAt': { $gte: expect.any(Date) } }
      ]
    }));
  });
});
