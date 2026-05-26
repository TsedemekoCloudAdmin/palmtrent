jest.mock('../models/Payout', () => ({
  find: jest.fn(),
  updateMany: jest.fn()
}));

const Payout = require('../models/Payout');
const payoutService = require('../services/payoutService');

function mockWithdrawablePayouts(payouts) {
  Payout.find.mockReturnValue({
    sort: jest.fn().mockResolvedValue(payouts)
  });
}

describe('payoutService withdrawals', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('selects only whole settlement payouts for a withdrawal', () => {
    const selection = payoutService.selectWholePayoutsForWithdrawal([
      { _id: 'payout-1', amount: 25 },
      { _id: 'payout-2', amount: 15 },
      { _id: 'payout-3', amount: 10 }
    ], 40);

    expect(selection.exact).toBe(true);
    expect(selection.amount).toBe(40);
    expect(selection.payouts.map(payout => payout._id)).toEqual(['payout-1', 'payout-2']);
  });

  test('reserves matching payout rows before writing the withdrawal destination', async () => {
    mockWithdrawablePayouts([
      { _id: 'payout-1', amount: 30 },
      { _id: 'payout-2', amount: 20 }
    ]);
    Payout.updateMany
      .mockResolvedValueOnce({ matchedCount: 2 })
      .mockResolvedValueOnce({ matchedCount: 2 });

    const withdrawal = await payoutService.reserveWithdrawal({
      recipient: 'transporter-1',
      amount: 50,
      payoutMethod: 'ecocash',
      accountNumber: '0771234567',
      accountName: 'Palm Transport'
    });

    expect(withdrawal).toEqual(expect.objectContaining({
      amount: 50,
      payoutCount: 2,
      payoutIds: ['payout-1', 'payout-2']
    }));
    expect(Payout.updateMany).toHaveBeenCalledTimes(2);
    expect(Payout.updateMany.mock.calls[0][1]).toEqual({
      $set: expect.objectContaining({
        'metadata.withdrawalReference': expect.stringMatching(/^WTH-/),
        'metadata.withdrawalRequestedAt': expect.any(Date)
      })
    });
    expect(Payout.updateMany.mock.calls[1][1]).toEqual({
      $set: {
        method: 'ecocash',
        destination: {
          accountNumber: '0771234567',
          phone: '0771234567',
          accountName: 'Palm Transport'
        }
      }
    });
  });

  test('rejects a partial amount that would split a settlement payout', async () => {
    mockWithdrawablePayouts([{ _id: 'payout-1', amount: 30 }]);

    await expect(payoutService.reserveWithdrawal({
      recipient: 'transporter-1',
      amount: 20,
      payoutMethod: 'bank_transfer',
      accountNumber: '1234567890'
    })).rejects.toThrow('Withdrawal amount must match one or more available settlement payouts');

    expect(Payout.updateMany).not.toHaveBeenCalled();
  });

  test('masks payout account identifiers in client responses', () => {
    expect(payoutService.maskAccountNumber('1234567890')).toBe('1234****7890');
    expect(payoutService.maskAccountNumber('1234')).toBe('****');
  });
});
