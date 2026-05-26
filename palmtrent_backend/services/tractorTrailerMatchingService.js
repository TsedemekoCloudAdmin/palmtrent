const Booking = require('../models/Booking');
const Rental = require('../models/Rental');
const Trailer = require('../models/Trailer');
const Vehicle = require('../models/Vehicle');
const monetizationService = require('./monetizationService');

function needsTrailer(booking) {
  const requested = [
    booking.vehicleType,
    booking.cargoDetails?.type,
    ...(booking.vehicles || []).map(item => item.vehicleType)
  ].filter(Boolean).join(' ').toLowerCase();
  return /trailer|flatbed|container|tanker|lowbed|refrigerated|reefer/.test(requested);
}

function isTractorOnly(vehicle) {
  const text = [
    vehicle.vehicleType?.name,
    vehicle.category,
    vehicle.description,
    vehicle.trailerOwned === false ? 'no trailer' : '',
    vehicle.hasTrailer === false ? 'tractor' : ''
  ].filter(Boolean).join(' ').toLowerCase();
  return /tractor|horse|prime mover|truck tractor/.test(text) || (vehicle.hasTrailer === false && vehicle.trailerOwned === false);
}

function compatibleTrailerQuery(booking, vehicle) {
  const query = {
    assetType: 'trailer',
    status: 'available',
    'rentalSettings.availableForRental': true
  };

  const city = booking.route?.pickup?.city || booking.origin;
  if (city) query['operatingAreas.city'] = new RegExp(city, 'i');

  const weight = booking.cargoDetails?.weight || Math.max(...(booking.vehicles || []).map(item => item.weight || 0), 0);
  if (weight) query['capacity.weight.value'] = { $gte: Number(weight) };

  const couplingType = vehicle.specifications?.couplingType || vehicle.trailerCouplingType;
  if (couplingType) query['specifications.couplingType'] = couplingType;

  return query;
}

async function getTrailerPairingOptions({ bookingId, transporterId, vehicleId, limit = 10 }) {
  const [booking, vehicle] = await Promise.all([
    Booking.findById(bookingId),
    Vehicle.findOne({ _id: vehicleId, owner: transporterId }).populate('vehicleType')
  ]);

  if (!booking) throw new Error('Booking not found');
  if (!vehicle) throw new Error('Vehicle not found');

  const trailerRequired = needsTrailer(booking);
  const tractorOnly = isTractorOnly(vehicle);

  if (!trailerRequired || !tractorOnly) {
    return { trailerRequired, tractorOnly, options: [] };
  }

  const trailers = await Trailer.find(compatibleTrailerQuery(booking, vehicle))
    .populate('owner', 'fullName phone rating')
    .populate('trailerType', 'name category')
    .limit(Number(limit))
    .sort({ 'rentalSettings.dailyRate': 1, 'rating.average': -1 });

  return {
    trailerRequired,
    tractorOnly,
    options: trailers.map(trailer => ({
      trailer,
      estimatedRentalCost: trailer.rentalSettings?.dailyRate || 0,
      compatibility: {
        coupling: 'compatible_or_not_required',
        capacity: trailer.capacity?.weight?.value || 0
      }
    }))
  };
}

async function createLinkedTrailerRental({ bookingId, transporterId, vehicleId, trailerId }) {
  const [booking, vehicle, trailer] = await Promise.all([
    Booking.findById(bookingId),
    Vehicle.findOne({ _id: vehicleId, owner: transporterId }),
    Trailer.findById(trailerId)
  ]);

  if (!booking) throw new Error('Booking not found');
  if (!vehicle) throw new Error('Vehicle not found');
  if (!trailer) throw new Error('Trailer not found');
  if (trailer.status !== 'available' || !trailer.rentalSettings?.availableForRental) {
    throw new Error('Trailer is not available for rental');
  }

  const options = await getTrailerPairingOptions({ bookingId, transporterId, vehicleId, limit: 50 });
  if (!options.options.some(option => option.trailer._id.toString() === trailerId.toString())) {
    throw new Error('Trailer is not compatible with this tractor/job pairing');
  }

  const start = booking.route?.pickup?.date ? new Date(booking.route.pickup.date) : new Date();
  const end = booking.route?.delivery?.date ? new Date(booking.route.delivery.date) : new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const days = Math.max(1, Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24)));
  const baseRate = trailer.rentalSettings.dailyRate || 0;
  const deposit = trailer.rentalSettings.deposit || 0;
  const subtotal = baseRate * days;
  const settlementPreview = await monetizationService.calculateRentalSettlement({
    pricing: { total: subtotal + deposit, deposit },
    payment: { rentalPayment: { method: 'openapi_africa' } }
  });
  const platformFee = settlementPreview.platformFee;

  return Rental.create({
    itemType: 'trailer',
    owner: trailer.owner,
    renter: transporterId,
    trailer: trailer._id,
    rentalPeriod: {
      startDate: start,
      endDate: end,
      duration: { value: days, unit: 'days' }
    },
    pickup: {
      location: { address: booking.route?.pickup?.address },
      scheduledTime: start
    },
    return: {
      location: { address: booking.route?.delivery?.address || booking.route?.pickup?.address },
      scheduledTime: end
    },
    pricing: {
      baseRate,
      rateType: 'daily',
      deposit,
      subtotal,
      total: subtotal + deposit + platformFee,
      currency: booking.pricing?.currency || 'USD'
    },
    status: 'pending',
    linkedShipment: {
      booking: booking._id,
      role: 'supporting_trailer'
    },
    notes: `Trailer pairing request for booking ${booking.bookingReference}`
  });
}

module.exports = {
  getTrailerPairingOptions,
  createLinkedTrailerRental,
  needsTrailer,
  isTractorOnly
};
