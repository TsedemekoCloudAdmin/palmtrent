jest.mock('../models/Escrow', () => {
  const Escrow = jest.fn();
  Escrow.findOne = jest.fn();
  return Escrow;
});

jest.mock('../models/Payment', () => ({
  findById: jest.fn()
}));

jest.mock('../models/Booking', () => ({
  findById: jest.fn()
}));

jest.mock('../models/Payout', () => ({
  findOne: jest.fn()
}));

jest.mock('../services/monetizationService', () => ({
  calculateShipmentFees: jest.fn(),
  recordLedgerEntryOnce: jest.fn(),
  createPayout: jest.fn()
}));

const Escrow = require('../models/Escrow');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const monetizationService = require('../services/monetizationService');
const escrowService = require('../services/escrowService');

describe('escrowService createEscrow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns the escrow created by a concurrent payment confirmation', async () => {
    const booking = {
      _id: 'booking-1',
      shipper: { _id: 'shipper-1' },
      pricing: {
        totals: {
          platformTotal: 5,
          transporterTotal: 95
        }
      },
      save: jest.fn().mockResolvedValue()
    };
    const existingEscrow = { _id: 'escrow-1', escrowReference: 'ESC-1' };
    const save = jest.fn().mockRejectedValue({ code: 11000 });

    Payment.findById.mockResolvedValue({
      amount: 100,
      currency: 'USD',
      paymentMethod: 'digital'
    });
    Booking.findById.mockReturnValue({
      populate: jest.fn().mockResolvedValue(booking)
    });
    Escrow.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existingEscrow);
    Escrow.mockImplementationOnce(() => ({ save }));

    const escrow = await escrowService.createEscrow('payment-1', booking._id);

    expect(escrow).toBe(existingEscrow);
    expect(save).toHaveBeenCalledTimes(1);
    expect(Escrow.findOne).toHaveBeenLastCalledWith({
      booking: booking._id,
      payment: 'payment-1'
    });
    expect(booking.save).not.toHaveBeenCalled();
    expect(monetizationService.recordLedgerEntryOnce).not.toHaveBeenCalled();
  });
});
