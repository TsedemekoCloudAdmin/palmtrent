jest.mock('../models/InsuranceClaim', () => {
  const InsuranceClaim = jest.fn();
  InsuranceClaim.findOne = jest.fn();
  return InsuranceClaim;
});

jest.mock('../models/Booking', () => ({
  findById: jest.fn()
}));

jest.mock('../services/auditService', () => ({
  recordAudit: jest.fn()
}));

jest.mock('../services/flowControlService', () => ({
  assertBookingTransition: jest.fn()
}));

jest.mock('../services/escrowService', () => ({
  raiseDispute: jest.fn()
}));

const InsuranceClaim = require('../models/InsuranceClaim');
const Booking = require('../models/Booking');
const { createDispute } = require('../controllers/claimsController');

function queryResult(value) {
  const query = {
    populate: jest.fn(() => query),
    then: (resolve, reject) => Promise.resolve(value).then(resolve, reject)
  };
  return query;
}

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('claimsController createDispute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('reuses the active platform dispute boundary for a booking', async () => {
    const existingDispute = {
      _id: 'claim-1',
      claimReference: 'CLM-1',
      status: 'submitted'
    };
    Booking.findById.mockReturnValue(queryResult({
      _id: 'booking-1',
      user: { _id: 'shipper-1' },
      shipper: { _id: 'shipper-1' },
      transporter: { _id: 'transporter-1' }
    }));
    InsuranceClaim.findOne.mockResolvedValue(existingDispute);
    const res = response();

    await createDispute({
      user: { id: 'shipper-1' },
      body: {
        bookingId: 'booking-1',
        issueType: 'cargo_damage',
        description: 'Cargo arrived damaged'
      },
      files: []
    }, res);

    expect(InsuranceClaim.findOne).toHaveBeenCalledWith({
      booking: 'booking-1',
      'metadata.caseType': 'platform_dispute',
      status: { $nin: ['closed', 'withdrawn', 'rejected'] }
    });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      data: expect.objectContaining({
        claimId: existingDispute._id,
        claimReference: existingDispute.claimReference
      })
    }));
    expect(InsuranceClaim).not.toHaveBeenCalled();
  });
});
