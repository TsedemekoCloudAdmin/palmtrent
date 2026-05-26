jest.mock('../models/User', () => ({
  findById: jest.fn()
}));

jest.mock('../models/Vehicle', () => ({}));
jest.mock('../models/Booking', () => ({}));

jest.mock('../models/Shipment', () => ({
  find: jest.fn()
}));

jest.mock('../services/auditService', () => ({
  recordAudit: jest.fn()
}));

const User = require('../models/User');
const Shipment = require('../models/Shipment');
const matchingService = require('../services/matchingService');

function queryResult(value) {
  const query = {
    select: jest.fn(() => query),
    lean: jest.fn().mockResolvedValue(value)
  };
  return query;
}

describe('matchingService production filters', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('removes vehicles with overlapping active shipment schedules', async () => {
    Shipment.find.mockReturnValue(queryResult([
      { vehicle: { toString: () => 'vehicle-busy' } }
    ]));

    const available = await matchingService.filterAvailableVehicles([
      { _id: { toString: () => 'vehicle-ready' } },
      { _id: { toString: () => 'vehicle-busy' } }
    ], {
      route: {
        pickup: { date: new Date('2026-05-22T08:00:00.000Z') },
        delivery: { deadline: new Date('2026-05-22T18:00:00.000Z') }
      }
    });

    expect(available.map(vehicle => vehicle._id.toString())).toEqual(['vehicle-ready']);
    expect(Shipment.find).toHaveBeenCalledWith(expect.objectContaining({
      vehicle: { $in: expect.any(Array) },
      status: { $in: expect.arrayContaining(['assigned', 'in_transit']) },
      $or: expect.any(Array)
    }));
  });

  test('tracks accepted and declined offers before recalculating acceptance rate', async () => {
    const transporter = {
      stats: {
        acceptedOffers: 2,
        declinedOffers: 1,
        completedJobs: 4
      },
      save: jest.fn().mockResolvedValue()
    };
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(transporter)
    });

    const stats = await matchingService.recordTransporterOfferResponse('transporter-1', 'declined');

    expect(stats).toEqual(expect.objectContaining({
      acceptedOffers: 2,
      declinedOffers: 2,
      acceptanceRate: 50,
      completedJobs: 4
    }));
    expect(transporter.save).toHaveBeenCalledTimes(1);
  });
});
