jest.mock('../models/Booking', () => ({}));
jest.mock('../models/Payment', () => ({}));
jest.mock('../models/Rental', () => ({}));
jest.mock('../models/Escrow', () => ({}));

jest.mock('../models/Payout', () => ({
  find: jest.fn()
}));

jest.mock('../models/User', () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn()
}));

jest.mock('../services/paymentService', () => ({}));
jest.mock('../services/escrowService', () => ({}));
jest.mock('../services/openApiAfricaService', () => ({}));
jest.mock('../services/payoutService', () => ({
  WITHDRAWAL_STATUSES: ['pending', 'approved', 'processing'],
  listWithdrawablePayouts: jest.fn(),
  amountTotal: jest.fn((items) => items.reduce((sum, item) => sum + Number(item.amount || 0), 0)),
  reserveWithdrawal: jest.fn(),
  maskAccountNumber: jest.fn((value = '') => {
    const text = String(value);
    return text.length <= 4 ? '****' : `${text.slice(0, 4)}****${text.slice(-4)}`;
  })
}));
jest.mock('../services/integrationSettingsService', () => ({
  getIntegrationConfig: jest.fn()
}));
jest.mock('../services/resourceAccessService', () => ({
  canCancelEscrow: jest.fn(),
  canConfirmEscrowDelivery: jest.fn(),
  canManageBookingPayment: jest.fn(),
  canManagePayment: jest.fn(),
  canReadEscrow: jest.fn(),
  canReadPayment: jest.fn(),
  canRecordEscrowCashCollection: jest.fn(),
  isAdmin: jest.fn()
}));

const User = require('../models/User');
const payoutService = require('../services/payoutService');
const {
  requestWithdrawal,
  updatePayoutPreferences
} = require('../controllers/paymentController');

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('paymentController withdrawal endpoints', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('queues a withdrawal through payoutService and masks the destination', async () => {
    payoutService.reserveWithdrawal.mockResolvedValue({
      withdrawalReference: 'WTH-1',
      amount: 50,
      payoutCount: 2
    });
    const res = response();

    await requestWithdrawal({
      user: { id: 'transporter-1' },
      body: {
        amount: 50,
        payoutMethod: 'ecocash',
        accountNumber: '0771234567',
        accountName: 'Palm Driver'
      }
    }, res);

    expect(payoutService.reserveWithdrawal).toHaveBeenCalledWith({
      recipient: 'transporter-1',
      amount: 50,
      payoutMethod: 'ecocash',
      accountNumber: '0771234567',
      accountName: 'Palm Driver',
      bankName: undefined
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        withdrawalReference: 'WTH-1',
        amount: 50,
        accountNumber: '0771****4567',
        status: 'pending'
      })
    }));
  });

  test('rejects invalid withdrawal payout methods', async () => {
    const res = response();

    await requestWithdrawal({
      user: { id: 'transporter-1' },
      body: {
        amount: 50,
        payoutMethod: 'cash',
        accountNumber: '0771234567'
      }
    }, res);

    expect(payoutService.reserveWithdrawal).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('saves validated payout preferences', async () => {
    const preference = {
      method: 'bank_transfer',
      accountNumber: '1234567890',
      accountName: 'Palm Driver',
      bankName: 'CBZ'
    };
    User.findByIdAndUpdate.mockReturnValue({
      select: jest.fn().mockResolvedValue({ payoutPreferences: preference })
    });
    const res = response();

    await updatePayoutPreferences({
      user: { id: 'transporter-1' },
      body: {
        payoutMethod: 'bank_transfer',
        accountNumber: ' 1234567890 ',
        accountName: ' Palm Driver ',
        bankName: ' CBZ '
      }
    }, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
      'transporter-1',
      expect.objectContaining({
        'payoutPreferences.method': 'bank_transfer',
        'payoutPreferences.accountNumber': '1234567890',
        'payoutPreferences.accountName': 'Palm Driver',
        'payoutPreferences.bankName': 'CBZ',
        'payoutPreferences.updatedAt': expect.any(Date)
      }),
      { new: true }
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: preference
    }));
  });

  test('rejects invalid payout preference methods before updating user', async () => {
    const res = response();

    await updatePayoutPreferences({
      user: { id: 'transporter-1' },
      body: {
        payoutMethod: 'cash',
        accountNumber: '1234567890'
      }
    }, res);

    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
