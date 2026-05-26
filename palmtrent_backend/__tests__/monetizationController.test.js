jest.mock('../models/Plan', () => ({}));
jest.mock('../models/Subscription', () => ({}));
jest.mock('../models/CommissionRule', () => ({}));
jest.mock('../models/PlatformLedger', () => ({}));
jest.mock('../models/Payout', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn()
}));
jest.mock('../services/monetizationService', () => ({}));
jest.mock('../services/auditService', () => ({
  recordAudit: jest.fn()
}));

const Payout = require('../models/Payout');
const { updatePayout } = require('../controllers/monetizationController');

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('monetizationController payout updates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects status changes from paid payouts', async () => {
    Payout.findById.mockResolvedValue({ _id: 'payout-1', status: 'paid' });
    const res = response();

    await updatePayout({
      params: { id: 'payout-1' },
      body: { status: 'approved' },
      user: { _id: 'admin-1' }
    }, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Cannot change payout status from paid to approved'
    }));
    expect(Payout.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  test('does not allow settlement amounts to be edited after payout creation', async () => {
    Payout.findById.mockResolvedValue({ _id: 'payout-1', status: 'pending' });
    const res = response();

    await updatePayout({
      params: { id: 'payout-1' },
      body: { amount: 999 },
      user: { _id: 'admin-1' }
    }, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Payout amount cannot be changed after creation'
    }));
    expect(Payout.findByIdAndUpdate).not.toHaveBeenCalled();
  });
});
