const {
  canCancelEscrow,
  canConfirmEscrowDelivery,
  canManageBookingPayment,
  canManagePayment,
  canReadBooking,
  canReadEscrow,
  canReadPayment,
  canRecordEscrowCashCollection,
  isUploadOwnedByUser
} = require('../services/resourceAccessService');

const user = (_id, userType = 'shipper') => ({ _id, userType });

describe('resourceAccessService', () => {
  const shipper = user('shipper-1');
  const transporter = user('transporter-1', 'transporter');
  const stranger = user('stranger-1');
  const admin = user('admin-1', 'admin');
  const booking = {
    user: shipper._id,
    shipper: { _id: shipper._id },
    transporter: transporter._id
  };

  test('keeps booking payment management with the payer side', () => {
    expect(canReadBooking(shipper, booking)).toBe(true);
    expect(canReadBooking(transporter, booking)).toBe(true);
    expect(canManageBookingPayment(shipper, booking)).toBe(true);
    expect(canManageBookingPayment(transporter, booking)).toBe(false);
    expect(canManageBookingPayment(admin, booking)).toBe(true);
    expect(canReadBooking(stranger, booking)).toBe(false);
  });

  test('scopes booking and rental payment access by party', () => {
    const bookingPayment = { booking };
    const rentalPayment = { rental: { renter: shipper._id, owner: transporter._id } };

    expect(canReadPayment(transporter, bookingPayment)).toBe(true);
    expect(canManagePayment(transporter, bookingPayment)).toBe(false);
    expect(canManagePayment(shipper, bookingPayment)).toBe(true);
    expect(canReadPayment(transporter, rentalPayment)).toBe(true);
    expect(canManagePayment(transporter, rentalPayment)).toBe(false);
    expect(canManagePayment(shipper, rentalPayment)).toBe(true);
    expect(canReadPayment(stranger, bookingPayment)).toBe(false);
  });

  test('separates escrow reads from release and cash collection mutations', () => {
    const escrow = {
      booking,
      shipper: shipper._id,
      transporter: transporter._id
    };

    expect(canReadEscrow(shipper, escrow)).toBe(true);
    expect(canReadEscrow(transporter, escrow)).toBe(true);
    expect(canConfirmEscrowDelivery(shipper, escrow)).toBe(true);
    expect(canConfirmEscrowDelivery(transporter, escrow)).toBe(false);
    expect(canCancelEscrow(shipper, escrow)).toBe(true);
    expect(canCancelEscrow(transporter, escrow)).toBe(false);
    expect(canRecordEscrowCashCollection(transporter, escrow)).toBe(true);
    expect(canRecordEscrowCashCollection(shipper, escrow)).toBe(false);
  });

  test('limits upload filename ownership to the user prefix unless admin', () => {
    expect(isUploadOwnedByUser('shipper-1-proof.pdf', shipper)).toBe(true);
    expect(isUploadOwnedByUser('stranger-1-proof.pdf', shipper)).toBe(false);
    expect(isUploadOwnedByUser('stranger-1-proof.pdf', admin)).toBe(true);
  });
});
