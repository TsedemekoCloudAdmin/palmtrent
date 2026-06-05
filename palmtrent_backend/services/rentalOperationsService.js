const Rental = require('../models/Rental');
const Trailer = require('../models/Trailer');
const Vehicle = require('../models/Vehicle');
const rentalPaymentService = require('./rentalPaymentService');

async function populateAdminRental(rentalOrId) {
  const rentalId = rentalOrId?._id || rentalOrId;
  return Rental.findById(rentalId)
    .populate('owner', 'fullName email phone')
    .populate('renter', 'fullName email phone')
    .populate('trailer', 'registrationNumber assetName assetType')
    .populate({
      path: 'vehicle',
      select: 'registrationNumber make model vehicleType',
      populate: [
        { path: 'make', select: 'name' },
        { path: 'model', select: 'name' },
        { path: 'vehicleType', select: 'name category' }
      ]
    })
    .populate('operation.assignedDriver', 'fullName phone licenseNumber licenseClass')
    .populate('linkedShipment.booking', 'bookingReference status');
}

async function releaseRentalAsset(rental) {
  if (['trailer', 'tractor_unit', 'truck', 'full_rig'].includes(rental.itemType) && rental.trailer) {
    await Trailer.findByIdAndUpdate(rental.trailer, { status: 'available', currentRental: null });
    return;
  }
  if (rental.vehicle) {
    await Vehicle.findByIdAndUpdate(rental.vehicle, { status: 'available' });
  }
}

async function confirmRentalPayment(rentalId, payload = {}, actorId) {
  const rental = await Rental.findById(rentalId);
  if (!rental) {
    const error = new Error('Rental not found');
    error.statusCode = 404;
    throw error;
  }

  const paymentReference = payload.paymentReference || rental.payment?.paymentReference;
  if (paymentReference) {
    return rentalPaymentService.confirmRentalPayment(paymentReference, {
      confirmedBy: actorId,
      source: 'admin_rental_operations',
      note: payload.note
    });
  }

  return (await rentalPaymentService.recordCashRentalPayment(rental._id, {
    confirmedBy: actorId,
    source: 'admin_rental_operations',
    note: payload.note || 'Admin confirmed rental payment'
  })).rental;
}

async function cancelRental(rentalId, payload = {}, actorId) {
  const rental = await Rental.findById(rentalId);
  if (!rental) {
    const error = new Error('Rental not found');
    error.statusCode = 404;
    throw error;
  }
  if (['completed', 'cancelled'].includes(rental.status)) {
    const error = new Error('Rental is already closed');
    error.statusCode = 409;
    throw error;
  }

  rental.status = 'cancelled';
  rental.cancellation = {
    cancelled: true,
    cancelledBy: actorId,
    cancelledAt: new Date(),
    reason: payload.reason || 'Cancelled by platform administrator',
    refundAmount: Number(payload.refundAmount || 0),
    cancellationFee: Number(payload.cancellationFee || 0)
  };
  rental.statusHistory.push({
    status: 'cancelled',
    changedBy: actorId,
    notes: rental.cancellation.reason
  });
  await rental.save();
  await releaseRentalAsset(rental);
  return rental;
}

async function extendRental(rentalId, payload = {}, actorId) {
  const rental = await Rental.findById(rentalId);
  if (!rental) {
    const error = new Error('Rental not found');
    error.statusCode = 404;
    throw error;
  }
  if (!['confirmed', 'active', 'overdue'].includes(rental.status)) {
    const error = new Error('Only confirmed or active rentals can be extended');
    error.statusCode = 409;
    throw error;
  }

  const newEndDate = new Date(payload.endDate);
  if (Number.isNaN(newEndDate.getTime()) || newEndDate <= new Date(rental.rentalPeriod.endDate)) {
    const error = new Error('New end date must be after the current end date');
    error.statusCode = 400;
    throw error;
  }

  const additionalCost = Number(payload.additionalCost || 0);
  rental.extensions.push({
    requestedBy: actorId,
    requestedAt: new Date(),
    originalEndDate: rental.rentalPeriod.endDate,
    newEndDate,
    status: 'approved',
    additionalCost,
    reason: payload.reason || 'Extended by platform administrator'
  });
  rental.rentalPeriod.endDate = newEndDate;

  if (additionalCost > 0) {
    rental.pricing.additionalCharges.push({
      description: 'Rental extension',
      amount: additionalCost,
      reason: payload.reason || 'Extension approved by platform administrator'
    });
    rental.pricing.total = Number(rental.pricing.total || 0) + additionalCost;
    rental.payment.balance = Math.max(0, Number(rental.pricing.total || 0) - Number(rental.payment.totalPaid || 0));
  }

  rental.statusHistory.push({
    status: rental.status,
    changedBy: actorId,
    notes: `Rental extended to ${newEndDate.toISOString().slice(0, 10)}`
  });
  await rental.save();
  return rental;
}

async function markRentalDisputed(rentalId, payload = {}, actorId) {
  const rental = await Rental.findById(rentalId);
  if (!rental) {
    const error = new Error('Rental not found');
    error.statusCode = 404;
    throw error;
  }
  if (['cancelled', 'completed'].includes(rental.status)) {
    const error = new Error('Closed rentals cannot be marked disputed');
    error.statusCode = 409;
    throw error;
  }

  rental.status = 'disputed';
  rental.settlement = { ...(rental.settlement || {}), status: 'disputed' };
  rental.internalNotes = [rental.internalNotes, payload.reason || 'Marked disputed by administrator'].filter(Boolean).join('\n');
  rental.statusHistory.push({
    status: 'disputed',
    changedBy: actorId,
    notes: payload.reason || 'Marked disputed by administrator'
  });
  await rental.save();
  return rental;
}

async function settleRental(rentalId) {
  const rental = await Rental.findById(rentalId);
  if (!rental) {
    const error = new Error('Rental not found');
    error.statusCode = 404;
    throw error;
  }
  if (!['completed', 'disputed'].includes(rental.status)) {
    const error = new Error('Only completed or disputed rentals can be settled');
    error.statusCode = 409;
    throw error;
  }

  return rentalPaymentService.settleRental(rental);
}

module.exports = {
  populateAdminRental,
  confirmRentalPayment,
  cancelRental,
  extendRental,
  markRentalDisputed,
  settleRental
};
