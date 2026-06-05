jest.mock('../services/monetizationService', () => ({
  recordLedgerEntryOnce: jest.fn(),
  createPayoutOnce: jest.fn()
}));

const monetizationService = require('../services/monetizationService');
const emergencySettlementService = require('../services/emergencySettlementService');

describe('emergencySettlementService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects completion when paid roadside assistance is still unpaid', async () => {
    await expect(emergencySettlementService.settleCompletedRoadsideAssistance(
      {
        _id: 'emergency-1',
        billing: { amount: 80, paymentStatus: 'pending' }
      },
      { status: 'on_scene', quote: { total: 80 } },
      { _id: 'responder-1', user: 'provider-user-1' },
      'actor-1'
    )).rejects.toThrow('must be paid or waived');

    expect(monetizationService.recordLedgerEntryOnce).not.toHaveBeenCalled();
    expect(monetizationService.createPayoutOnce).not.toHaveBeenCalled();
  });

  test('records commission, payout, and settlement status for completed paid roadside assistance', async () => {
    monetizationService.createPayoutOnce.mockResolvedValue({
      _id: 'payout-1',
      amount: 65,
      currency: 'USD'
    });

    const emergency = {
      _id: 'emergency-2',
      emergencyType: 'breakdown',
      billing: {
        amount: 80,
        platformFee: 15,
        providerEarnings: 65,
        currency: 'USD',
        paymentStatus: 'paid',
        paymentReference: 'PAY-1',
        paymentSource: 'separate_payment'
      }
    };

    const result = await emergencySettlementService.settleCompletedRoadsideAssistance(
      emergency,
      {
        status: 'on_scene',
        quote: {
          quoteReference: 'SOS-Q-1',
          total: 80,
          currency: 'USD'
        }
      },
      { _id: 'responder-2', user: 'provider-user-2' },
      'actor-2'
    );

    expect(monetizationService.recordLedgerEntryOnce).toHaveBeenCalledWith(
      { sourceType: 'emergency', sourceId: 'emergency-2', category: 'commission', status: 'posted' },
      expect.objectContaining({
        sourceType: 'emergency',
        amount: 15,
        category: 'commission'
      })
    );
    expect(monetizationService.createPayoutOnce).toHaveBeenCalledWith(
      { sourceType: 'emergency', sourceId: 'emergency-2', recipient: 'provider-user-2' },
      expect.objectContaining({
        amount: 65,
        sourceType: 'emergency',
        status: 'pending'
      })
    );
    expect(result.billing).toEqual(expect.objectContaining({
      settlementStatus: 'payout_pending'
    }));
  });
});
