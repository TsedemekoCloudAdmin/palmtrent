const toId = (value) => {
  if (!value) return null;
  if (value._id) return value._id.toString();
  return value.toString();
};

const isAdmin = (user) => user?.userType === 'admin';
const isSameId = (value, user) => Boolean(toId(value) && toId(value) === toId(user));

const canReadBooking = (user, booking) => {
  if (!user || !booking) return false;
  if (isAdmin(user)) return true;

  return [
    booking.user,
    booking.shipper,
    booking.transporter
  ].some(value => isSameId(value, user));
};

const canManageBookingPayment = (user, booking) => {
  if (!user || !booking) return false;
  if (isAdmin(user)) return true;

  return [
    booking.user,
    booking.shipper
  ].some(value => isSameId(value, user));
};

const canReadRental = (user, rental) => {
  if (!user || !rental) return false;
  if (isAdmin(user)) return true;

  return [
    rental.owner,
    rental.renter
  ].some(value => isSameId(value, user));
};

const canReadSubscription = (user, subscription) => {
  if (!user || !subscription) return false;
  if (isAdmin(user)) return true;

  return isSameId(subscription.user, user);
};

const canReadPayment = (user, payment) => {
  if (!user || !payment) return false;
  if (isAdmin(user)) return true;

  if (payment.booking) return canReadBooking(user, payment.booking);
  if (payment.rental) return canReadRental(user, payment.rental);
  if (payment.subscription) return canReadSubscription(user, payment.subscription);
  return false;
};

const canManagePayment = (user, payment) => {
  if (!user || !payment) return false;
  if (isAdmin(user)) return true;

  if (payment.booking) return canManageBookingPayment(user, payment.booking);
  if (payment.rental) return isSameId(payment.rental.renter, user);
  if (payment.subscription) return canReadSubscription(user, payment.subscription);
  return false;
};

const canReadEscrow = (user, escrow) => {
  if (!user || !escrow) return false;
  if (isAdmin(user)) return true;

  if ([escrow.shipper, escrow.transporter].some(value => isSameId(value, user))) {
    return true;
  }

  return escrow.booking ? canReadBooking(user, escrow.booking) : false;
};

const canConfirmEscrowDelivery = (user, escrow) => {
  if (!user || !escrow) return false;
  if (isAdmin(user)) return true;

  if (isSameId(escrow.shipper, user)) return true;
  return escrow.booking ? canManageBookingPayment(user, escrow.booking) : false;
};

const canCancelEscrow = canConfirmEscrowDelivery;

const canRecordEscrowCashCollection = (user, escrow) => {
  if (!user || !escrow) return false;
  if (isAdmin(user)) return true;

  return isSameId(escrow.transporter, user);
};

const isUploadOwnedByUser = (filename, user) => {
  if (!filename || !user) return false;
  if (isAdmin(user)) return true;
  return filename.startsWith(`${toId(user)}-`);
};

module.exports = {
  canCancelEscrow,
  canConfirmEscrowDelivery,
  canManageBookingPayment,
  canManagePayment,
  canReadBooking,
  canReadEscrow,
  canReadPayment,
  canReadSubscription,
  canRecordEscrowCashCollection,
  isAdmin,
  isUploadOwnedByUser
};
