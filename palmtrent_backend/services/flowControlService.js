const Booking = require('../models/Booking');
const CorporateAccount = require('../models/CorporateAccount');
const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');

const bookingTransitions = {
  draft: ['pending_payment', 'cancelled'],
  pending_payment: ['payment_confirmed', 'cancelled'],
  payment_confirmed: ['finding_transporter', 'cancelled'],
  pending: ['pending_payment', 'finding_transporter', 'cancelled'],
  finding_transporter: ['transporter_assigned', 'matched', 'cancelled'],
  matched: ['transporter_assigned', 'cancelled'],
  transporter_assigned: ['confirmed', 'en_route_pickup', 'cancelled', 'disputed'],
  confirmed: ['en_route_pickup', 'cancelled', 'disputed'],
  en_route_pickup: ['pickup_started', 'picked_up', 'cancelled', 'disputed'],
  pickup_started: ['picked_up', 'cancelled', 'disputed'],
  picked_up: ['in_progress', 'in_transit', 'disputed'],
  in_progress: ['in_transit', 'arrived_delivery', 'disputed'],
  in_transit: ['arrived_delivery', 'delivered', 'disputed'],
  arrived_delivery: ['delivered', 'disputed'],
  delivered: ['completed', 'disputed'],
  completed: [],
  disputed: ['completed', 'cancelled'],
  cancelled: []
};

const shipmentTransitions = {
  pending_payment: ['payment_confirmed', 'cancelled'],
  payment_confirmed: ['assigned', 'cancelled'],
  assigned: ['en_route_pickup', 'cancelled', 'incident'],
  matched: ['assigned', 'cancelled'],
  en_route_pickup: ['picked_up', 'cancelled', 'incident'],
  picked_up: ['in_transit', 'incident'],
  in_transit: ['arrived_delivery', 'delivered', 'incident'],
  arrived_delivery: ['delivered', 'incident'],
  delivered: ['completed', 'incident'],
  completed: [],
  cancelled: [],
  incident: ['in_transit', 'delivered', 'cancelled']
};

function isPaymentConfirmed(booking) {
  return ['confirmed', 'escrowed', 'released'].includes(booking?.paymentStatus) ||
    ['confirmed', 'escrowed', 'released'].includes(booking?.payment?.status) ||
    Boolean(booking?.paymentConfirmedAt);
}

function assertTransition(map, currentStatus, nextStatus, entityName) {
  if (currentStatus === nextStatus) return;
  const allowed = map[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    throw new Error(`Invalid ${entityName} status transition from '${currentStatus}' to '${nextStatus}'`);
  }
}

function assertBookingTransition(currentStatus, nextStatus) {
  assertTransition(bookingTransitions, currentStatus, nextStatus, 'booking');
}

function assertShipmentTransition(currentStatus, nextStatus) {
  assertTransition(shipmentTransitions, currentStatus, nextStatus, 'shipment');
}

function getUserVerificationIssues(user, role = user?.userType) {
  const status = user?.verification?.status;
  const verified = user?.isVerified || user?.verification?.isVerified || ['approved', 'verified'].includes(status);
  const issues = [];

  if (user?.status && user.status !== 'active') issues.push('User account is not active');
  if (user?.isActive === false) issues.push('User account is inactive');
  if (!verified && ['transporter', 'corporate'].includes(role)) issues.push(`${role} verification is not approved`);
  if (role === 'transporter' && user?.verification?.driverLicense?.expiryDate) {
    const expiry = new Date(user.verification.driverLicense.expiryDate);
    if (expiry < new Date()) issues.push('Driver license has expired');
  }

  return issues;
}

function getVehicleComplianceIssues(vehicle) {
  const now = new Date();
  const issues = [];

  if (!vehicle) issues.push('Vehicle was not found');
  if (vehicle && vehicle.status !== 'available') issues.push('Vehicle is not available');
  if (vehicle?.verification?.status && vehicle.verification.status !== 'approved') issues.push('Vehicle verification is not approved');
  if (vehicle?.insurance?.expiryDate && new Date(vehicle.insurance.expiryDate) < now) issues.push('Vehicle insurance has expired');
  if (vehicle?.documents?.license?.expiryDate && new Date(vehicle.documents.license.expiryDate) < now) issues.push('Vehicle license has expired');
  if (vehicle?.documents?.roadworthyCertificate?.expiryDate && new Date(vehicle.documents.roadworthyCertificate.expiryDate) < now) issues.push('Roadworthy certificate has expired');

  (vehicle?.documents?.permits || []).forEach(permit => {
    if (permit.expiryDate && new Date(permit.expiryDate) < now) {
      issues.push(`${permit.type || 'Vehicle permit'} has expired`);
    }
  });

  return issues;
}

function getDriverComplianceIssues(driver) {
  const issues = [];
  if (!driver) issues.push('Driver was not found');
  if (driver && !['available', 'active'].includes(driver.status)) issues.push('Driver is not available');
  if (driver?.availability?.isAvailable === false) issues.push('Driver availability is disabled');
  const licenseExpiry = driver?.licenseExpiry || driver?.license?.expiryDate;
  if (licenseExpiry && new Date(licenseExpiry) < new Date()) issues.push('Driver license has expired');
  return issues;
}

async function assertTransporterEligible(transporterId) {
  const transporter = await require('../models/User').findById(transporterId);
  const issues = getUserVerificationIssues(transporter, 'transporter');
  if (issues.length) throw new Error(`Transporter is not eligible: ${issues.join('; ')}`);
  return transporter;
}

async function assertVehicleAssignable(vehicleId, ownerId) {
  const vehicle = await Vehicle.findById(vehicleId);
  const issues = getVehicleComplianceIssues(vehicle);
  if (vehicle?.owner?.toString() !== ownerId.toString()) issues.push('Vehicle does not belong to this account');

  const activeShipment = await require('../models/Shipment').findOne({
    vehicle: vehicleId,
    status: { $in: ['assigned', 'en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery'] }
  }).select('_id bookingReference status');
  if (activeShipment) issues.push(`Vehicle is already assigned to active shipment ${activeShipment.bookingReference}`);

  if (issues.length) throw new Error(`Vehicle cannot be assigned: ${issues.join('; ')}`);
  return vehicle;
}

async function assertDriverAssignable(driverId, ownerId) {
  const driver = await Driver.findById(driverId);
  const issues = getDriverComplianceIssues(driver);
  if (driver?.owner?.toString() !== ownerId.toString()) issues.push('Driver does not belong to this account');
  if (driver?.assignedVehicle) issues.push('Driver is already assigned to a vehicle');
  if (issues.length) throw new Error(`Driver cannot be assigned: ${issues.join('; ')}`);
  return driver;
}

async function assertBookingReadyForMatching(booking) {
  if (!isPaymentConfirmed(booking)) {
    throw new Error('Payment must be confirmed before matching or broadcasting');
  }
  if (!['payment_confirmed', 'pending', 'finding_transporter'].includes(booking.status)) {
    throw new Error(`Booking cannot be matched from status '${booking.status}'`);
  }
}

async function assertCorporateCanBook(user, amount = 0) {
  if (user.userType !== 'corporate' && !user.corporateAccount) return null;

  const account = await CorporateAccount.findOne({
    $or: [
      { _id: user.corporateAccount },
      { user: user._id || user.id },
      { 'settings.allowedUsers.user': user._id || user.id }
    ]
  });

  if (!account) throw new Error('Corporate account was not found');
  if (account.status !== 'active') throw new Error('Corporate account must be active before booking shipments');

  const maxBookingValue = account.settings?.maxBookingValue || Number.MAX_SAFE_INTEGER;
  if (amount > maxBookingValue) throw new Error(`Booking value exceeds corporate max booking value of ${maxBookingValue}`);

  const availableCredit = (account.creditLimit || 0) - (account.currentBalance || 0);
  if (account.preferredPaymentMethod !== 'bank_transfer' && amount > availableCredit) {
    throw new Error(`Booking value exceeds available corporate credit of ${availableCredit}`);
  }

  return account;
}

async function reserveCorporateCredit(corporateAccountId, amount) {
  if (!corporateAccountId || !amount) return;
  await CorporateAccount.findByIdAndUpdate(corporateAccountId, { $inc: { currentBalance: amount } });
}

async function releaseCorporateCredit(corporateAccountId, amount) {
  if (!corporateAccountId || !amount) return;
  await CorporateAccount.findByIdAndUpdate(corporateAccountId, { $inc: { currentBalance: -Math.abs(amount) } });
}

module.exports = {
  bookingTransitions,
  shipmentTransitions,
  isPaymentConfirmed,
  assertBookingTransition,
  assertShipmentTransition,
  getUserVerificationIssues,
  getVehicleComplianceIssues,
  getDriverComplianceIssues,
  assertTransporterEligible,
  assertVehicleAssignable,
  assertDriverAssignable,
  assertBookingReadyForMatching,
  assertCorporateCanBook,
  reserveCorporateCredit,
  releaseCorporateCredit
};
