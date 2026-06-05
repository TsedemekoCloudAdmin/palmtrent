const Rental = require('../models/Rental');
const Vehicle = require('../models/Vehicle');
const Trailer = require('../models/Trailer');
const VehicleType = require('../models/VehicleType');
const User = require('../models/User');
const rentalPaymentService = require('../services/rentalPaymentService');
const monetizationService = require('../services/monetizationService');
const { getRentalOwnerScopeId, canAccessRentalOwnerResource, canReadRental } = require('../services/resourceAccessService');
const {
  assertRentalOwnerCanList,
  getUsableRentalOwnerIds
} = require('../services/flowControlService');

const TRAILER_FLEET_ITEM_TYPES = ['trailer', 'tractor_unit', 'truck', 'full_rig'];
const VEHICLE_RENTAL_ITEM_TYPES = ['vehicle', 'small_vehicle', 'car'];
const SMALL_VEHICLE_CATEGORIES = ['car', 'suv', 'bakkie', 'van'];
const BLOCKING_RENTAL_STATUSES = ['pending', 'approved', 'payment_pending', 'confirmed', 'active', 'disputed', 'overdue'];

function isTrailerFleetItem(itemType) {
  return TRAILER_FLEET_ITEM_TYPES.includes(itemType);
}

function isVehicleRentalItem(itemType) {
  return !itemType || itemType === 'all' || VEHICLE_RENTAL_ITEM_TYPES.includes(itemType);
}

function normalizeRentalItemType(itemType) {
  return itemType === 'small_vehicle' || itemType === 'car' ? 'vehicle' : (itemType || 'vehicle');
}

function displayItemType(itemType) {
  return {
    trailer: 'Trailer',
    tractor_unit: 'Tractor unit',
    truck: 'Truck',
    full_rig: 'Full rig',
    vehicle: 'Vehicle',
    small_vehicle: 'Small vehicle'
  }[itemType] || 'Rental item';
}

function normalizeZimbabwePhone(phone = '') {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('263') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+263${digits.slice(1)}`;
  if (!digits.startsWith('0') && digits.length === 9) return `+263${digits}`;
  if (String(phone).trim().startsWith('+263') && digits.length === 12) return `+${digits}`;
  return String(phone || '').trim();
}

function getOwnerScope(user) {
  return getRentalOwnerScopeId(user);
}

function buildRenterSnapshot(customer = {}) {
  return {
    fullName: customer.fullName || customer.name,
    email: customer.email ? String(customer.email).trim().toLowerCase() : undefined,
    phone: customer.phone ? normalizeZimbabwePhone(customer.phone) : undefined,
    nationalId: customer.nationalId,
    licenseNumber: customer.licenseNumber,
    licenseExpiry: customer.licenseExpiry,
    address: customer.address,
    emergencyContactName: customer.emergencyContactName,
    emergencyContactPhone: customer.emergencyContactPhone ? normalizeZimbabwePhone(customer.emergencyContactPhone) : undefined,
    notes: customer.notes
  };
}

async function findOrCreateWalkInRenter(customer = {}) {
  const snapshot = buildRenterSnapshot(customer);
  if (!snapshot.fullName || !snapshot.phone) {
    const error = new Error('Walk-in customer full name and phone are required');
    error.statusCode = 400;
    throw error;
  }

  const query = [];
  if (snapshot.email) query.push({ email: snapshot.email });
  if (snapshot.phone) query.push({ phone: snapshot.phone });

  const existing = query.length ? await User.findOne({ $or: query }) : null;
  if (existing) return { renter: existing, snapshot };

  const email = snapshot.email || `${snapshot.phone.replace(/\D/g, '')}@walkin.palmtrent.local`;
  const password = `Palmtrent${Math.random().toString(36).slice(2, 8)}!`;
  const renter = await User.create({
    fullName: snapshot.fullName,
    email,
    phone: snapshot.phone,
    password,
    userType: 'shipper',
    roles: ['shipper'],
    isPhoneVerified: true,
    profileCompleted: true,
    nationalId: snapshot.nationalId
  });

  return { renter, snapshot: { ...snapshot, email } };
}

function buildInspectionPayload(body = {}, fallbackNotes) {
  return {
    odometerReading: body.odometerReading !== undefined ? Number(body.odometerReading) : undefined,
    fuelLevel: body.fuelLevel,
    photos: Array.isArray(body.photos) ? body.photos : [],
    signature: body.signature,
    inspectionNotes: body.notes || body.inspectionNotes || fallbackNotes,
    conditionChecklist: Array.isArray(body.conditionChecklist) ? body.conditionChecklist : []
  };
}

function applyAdditionalReturnCharges(rental, body = {}) {
  const damageFees = Number(body.damageFees || 0);
  const cleaningFees = Number(body.cleaningFees || 0);
  const lateFees = Number(body.lateFees || 0);
  const extraKmFees = Number(body.extraKmFees || 0);
  rental.pricing.damageFees = damageFees;
  rental.pricing.cleaningFees = cleaningFees;
  rental.pricing.lateFees = lateFees;
  rental.pricing.extraKmFees = extraKmFees;

  const originalBase = Number(rental.pricing.subtotal || 0)
    + Number(rental.pricing.deposit || 0)
    + Number(rental.pricing.platformFee || 0);
  const additional = damageFees + cleaningFees + lateFees + extraKmFees;
  rental.pricing.total = Number((originalBase + additional).toFixed(2));
  return additional;
}

function parseDateRange(startDate, endDate) {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) {
    const error = new Error('Please provide a valid rental start and end date');
    error.statusCode = 400;
    throw error;
  }
  return { start, end };
}

function calculateRentalDuration(start, end, rateType = 'daily') {
  const diffMs = Math.max(0, end - start);
  const days = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  if (rateType === 'weekly') return { days, numberOfUnits: Math.ceil(days / 7), unit: 'weeks' };
  if (rateType === 'monthly') return { days, numberOfUnits: Math.ceil(days / 30), unit: 'months' };
  return { days, numberOfUnits: days, unit: 'days' };
}

async function calculateRentalQuote(item, { start, end, rateType = 'daily' } = {}) {
  const rentalSettings = item.rentalSettings || {};
  const dateRange = start && end ? { start, end } : {
    start: new Date(),
    end: new Date(Date.now() + 24 * 60 * 60 * 1000)
  };
  const duration = calculateRentalDuration(dateRange.start, dateRange.end, rateType);
  let effectiveRateType = rateType;
  let rateAmount = rentalSettings.dailyRate || 0;

  if (rateType === 'weekly' && rentalSettings.weeklyRate) {
    rateAmount = rentalSettings.weeklyRate;
  } else if (rateType === 'monthly' && rentalSettings.monthlyRate) {
    rateAmount = rentalSettings.monthlyRate;
  } else {
    effectiveRateType = 'daily';
  }

  const subtotal = rateAmount * duration.numberOfUnits;
  const deposit = rentalSettings.deposit || 0;
  const feePreview = await monetizationService.calculateRentalSettlement({
    pricing: { total: subtotal + deposit, deposit },
    payment: { rentalPayment: { method: 'openapi_africa' } }
  });
  const platformFee = feePreview.platformFee || 0;

  return {
    rateType: effectiveRateType,
    rateAmount,
    duration: {
      value: duration.numberOfUnits,
      unit: duration.unit,
      days: duration.days
    },
    subtotal,
    deposit,
    platformFee,
    total: subtotal + deposit + platformFee,
    currency: 'USD'
  };
}

async function getOverlappingRentalItemIds({ vehicleIds = [], trailerIds = [], start, end }) {
  if (!start || !end) return { vehicles: new Set(), trailers: new Set() };

  const overlapQuery = {
    status: { $in: BLOCKING_RENTAL_STATUSES },
    'rentalPeriod.startDate': { $lt: end },
    'rentalPeriod.endDate': { $gt: start }
  };

  const [vehicles, trailers] = await Promise.all([
    vehicleIds.length
      ? Rental.distinct('vehicle', { ...overlapQuery, vehicle: { $in: vehicleIds } })
      : [],
    trailerIds.length
      ? Rental.distinct('trailer', { ...overlapQuery, trailer: { $in: trailerIds } })
      : []
  ]);

  return {
    vehicles: new Set(vehicles.map(String)),
    trailers: new Set(trailers.map(String))
  };
}

function assertRentalAccess(rental, user) {
  const userId = (user.id || user._id).toString();
  return rental.owner?.toString?.() === userId ||
    rental.renter?.toString?.() === userId ||
    rental.owner?._id?.toString?.() === userId ||
    rental.renter?._id?.toString?.() === userId ||
    user.userType === 'admin';
}

function formatRentalTracking(rental) {
  const asset = rental.trailer || rental.vehicle;
  const latest = rental.tracking?.[rental.tracking.length - 1];
  const assetLocation = asset?.currentLocation;
  const pickupCoordinates = rental.pickup?.location?.coordinates?.coordinates;
  const returnCoordinates = rental.return?.location?.coordinates?.coordinates;
  const latestLocation = latest?.location || assetLocation || (
    Array.isArray(pickupCoordinates) && pickupCoordinates.length === 2
      ? {
          latitude: pickupCoordinates[1],
          longitude: pickupCoordinates[0],
          address: rental.pickup?.location?.address
        }
      : null
  );

  const start = rental.pickup?.location?.address || asset?.rentalSettings?.pickupLocations?.[0]?.address || 'Pickup location';
  const end = rental.return?.location?.address || 'Return location';
  const totalWindow = rental.rentalPeriod?.endDate && rental.rentalPeriod?.startDate
    ? new Date(rental.rentalPeriod.endDate) - new Date(rental.rentalPeriod.startDate)
    : 0;
  const elapsed = rental.rentalPeriod?.startDate ? Date.now() - new Date(rental.rentalPeriod.startDate) : 0;
  const progress = totalWindow > 0
    ? Math.max(0, Math.min(100, Math.round((elapsed / totalWindow) * 100)))
    : (rental.status === 'completed' ? 100 : rental.status === 'active' ? 50 : 0);

  return {
    rentalId: rental._id,
    rentalReference: rental.rentalReference,
    status: rental.status,
    itemType: rental.itemType,
    asset: asset ? {
      id: asset._id,
      name: asset.assetName || asset.registrationNumber,
      registrationNumber: asset.registrationNumber,
      assetType: asset.assetType
    } : null,
    currentLocation: latestLocation,
    lastUpdate: latest?.timestamp || assetLocation?.updatedAt || rental.updatedAt,
    batteryLevel: latest?.batteryLevel ?? assetLocation?.batteryLevel ?? null,
    speed: latest?.speed ?? assetLocation?.speed ?? null,
    heading: latest?.heading ?? assetLocation?.heading ?? null,
    estimatedReturn: rental.rentalPeriod?.endDate,
    route: {
      from: start,
      to: end,
      progress
    },
    owner: rental.owner,
    renter: rental.renter,
    history: (rental.tracking || []).slice(-10).reverse()
  };
}

// Get available rentals (vehicles and trailers)
exports.getAvailableRentals = async (req, res) => {
  try {
    const {
      itemType,
      city,
      minPrice,
      maxPrice,
      startDate,
      endDate,
      rateType = 'daily',
      page = 1,
      limit = 20
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const results = { vehicles: [], fleetAssets: [], trailers: [] };
    const eligibleRentalOwnerIds = await getUsableRentalOwnerIds();
    const dateRange = startDate || endDate ? parseDateRange(startDate, endDate) : null;
    const requestedItemType = itemType && itemType !== 'all' ? itemType : undefined;
    const requestedLimit = parseInt(limit);
    const shouldLoadVehicles = isVehicleRentalItem(itemType);
    const shouldLoadFleet = !requestedItemType || isTrailerFleetItem(requestedItemType);

    // Get available vehicles
    if (shouldLoadVehicles) {
      const vehicleQuery = {
        'rentalSettings.availableForRental': true,
        status: 'available',
        owner: { $in: eligibleRentalOwnerIds }
      };

      if (requestedItemType === 'small_vehicle' || requestedItemType === 'car') {
        const smallVehicleTypeIds = await VehicleType.find({
          category: { $in: SMALL_VEHICLE_CATEGORIES },
          isActive: true
        }).distinct('_id');
        vehicleQuery.vehicleType = { $in: smallVehicleTypeIds };
      }

      if (city) {
        vehicleQuery['operatingAreas.city'] = new RegExp(city, 'i');
      }

      if (minPrice || maxPrice) {
        vehicleQuery['rentalSettings.dailyRate'] = {};
        if (minPrice) vehicleQuery['rentalSettings.dailyRate'].$gte = parseFloat(minPrice);
        if (maxPrice) vehicleQuery['rentalSettings.dailyRate'].$lte = parseFloat(maxPrice);
      }

      const vehicles = await Vehicle.find(vehicleQuery)
        .populate('owner', 'fullName rating')
        .populate('make', 'name')
        .populate('model', 'name')
        .populate('vehicleType', 'name icon category')
        .skip(requestedItemType === 'vehicle' || requestedItemType === 'small_vehicle' ? skip : 0)
        .limit(requestedItemType === 'vehicle' || requestedItemType === 'small_vehicle' ? requestedLimit : 20)
        .lean();

      const overlaps = await getOverlappingRentalItemIds({
        vehicleIds: vehicles.map(v => v._id),
        start: dateRange?.start,
        end: dateRange?.end
      });

      const availableVehicles = vehicles.filter(v => !overlaps.vehicles.has(String(v._id)));

      results.vehicles = await Promise.all(availableVehicles.map(async (v) => ({
        _id: v._id,
        itemType: SMALL_VEHICLE_CATEGORIES.includes(v.vehicleType?.category) ? 'small_vehicle' : 'vehicle',
        assetType: SMALL_VEHICLE_CATEGORIES.includes(v.vehicleType?.category) ? 'small_vehicle' : 'vehicle',
        registrationNumber: v.registrationNumber,
        make: v.make?.name || 'Unknown',
        model: v.model?.name || 'Unknown',
        year: v.year,
        vehicleType: v.vehicleType?.name || 'Unknown',
        capacity: v.capacity,
        features: v.features,
        images: v.images,
        owner: v.owner,
        rentalSettings: v.rentalSettings,
        operatingAreas: v.operatingAreas,
        rating: v.rating,
        quote: await calculateRentalQuote(v, {
          start: dateRange?.start,
          end: dateRange?.end,
          rateType
        })
      })));
    }

    // Get available trailer-owner fleet assets
    if (shouldLoadFleet) {
      const trailerQuery = {
        'rentalSettings.availableForRental': true,
        status: 'available',
        owner: { $in: eligibleRentalOwnerIds }
      };

      if (requestedItemType) {
        trailerQuery.assetType = requestedItemType;
      }

      if (city) {
        trailerQuery['operatingAreas.city'] = new RegExp(city, 'i');
      }

      if (minPrice || maxPrice) {
        trailerQuery['rentalSettings.dailyRate'] = {};
        if (minPrice) trailerQuery['rentalSettings.dailyRate'].$gte = parseFloat(minPrice);
        if (maxPrice) trailerQuery['rentalSettings.dailyRate'].$lte = parseFloat(maxPrice);
      }

      const trailers = await Trailer.find(trailerQuery)
        .populate('owner', 'fullName rating')
        .populate('trailerType', 'name icon')
        .skip(requestedItemType === 'trailer' ? skip : 0)
        .limit(requestedItemType === 'trailer' ? requestedLimit : 20)
        .lean();

      const overlaps = await getOverlappingRentalItemIds({
        trailerIds: trailers.map(t => t._id),
        start: dateRange?.start,
        end: dateRange?.end
      });

      const availableTrailers = trailers.filter(t => !overlaps.trailers.has(String(t._id)));

      results.fleetAssets = await Promise.all(availableTrailers.map(async (t) => ({
        _id: t._id,
        itemType: t.assetType || 'trailer',
        assetType: t.assetType || 'trailer',
        assetName: t.assetName,
        registrationNumber: t.registrationNumber,
        trailerType: t.trailerType?.name || 'Unknown',
        tractorUnit: t.tractorUnit,
        combination: t.combination,
        capacity: t.capacity,
        features: t.features,
        images: t.images,
        owner: t.owner,
        rentalSettings: t.rentalSettings,
        operatingAreas: t.operatingAreas,
        rating: t.rating,
        quote: await calculateRentalQuote(t, {
          start: dateRange?.start,
          end: dateRange?.end,
          rateType
        })
      })));
      results.trailers = results.fleetAssets.filter(item => item.assetType === 'trailer');
    }

    // Combined results for mixed listing
    const sortByPrice = (a, b) => {
      const aPrice = Number(a.quote?.total ?? a.rentalSettings?.dailyRate ?? 0);
      const bPrice = Number(b.quote?.total ?? b.rentalSettings?.dailyRate ?? 0);
      return aPrice - bPrice;
    };
    results.vehicles = results.vehicles.sort(sortByPrice);
    results.fleetAssets = results.fleetAssets.sort(sortByPrice);
    const combined = [...results.vehicles, ...results.fleetAssets].sort(sortByPrice);
    const data = requestedItemType
      ? (isVehicleRentalItem(requestedItemType) ? results.vehicles : results.fleetAssets)
      : combined;

    res.status(200).json({
      success: true,
      data,
      vehicles: results.vehicles,
      trailers: results.trailers,
      fleetAssets: results.fleetAssets,
      pagination: {
        page: parseInt(page),
        limit: requestedLimit,
        total: combined.length
      }
    });
  } catch (error) {
    console.error('Get available rentals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available rentals'
    });
  }
};

exports.initiateRentalPayment = async (req, res) => {
  try {
    const rental = await Rental.findById(req.params.id).populate('renter');
    if (!rental) {
      return res.status(404).json({ success: false, message: 'Rental not found' });
    }
    const isRenter = rental.renter._id.toString() === req.user.id;
    const isRentalOwner = canAccessRentalOwnerResource(req.user, rental.owner);
    if (!isRenter && !isRentalOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to pay for this rental' });
    }

    const result = await rentalPaymentService.createRentalPayment(rental._id, {
      userId: rental.renter._id,
      email: rental.renterSnapshot?.email || rental.renter.email || req.user.email,
      phone: rental.renterSnapshot?.phone || rental.renter.phone || req.user.phone
    });

    res.status(200).json({
      success: true,
      data: {
        rental: result.rental,
        paymentReference: result.payment.paymentReference,
        redirectUrl: result.order.redirectUrl,
        gatewayReference: result.order.gatewayReference
      }
    });
  } catch (error) {
    console.error('Initiate rental payment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to initiate rental payment' });
  }
};

exports.confirmRentalPayment = async (req, res) => {
  try {
    const { paymentReference } = req.body;
    const rental = await rentalPaymentService.confirmRentalPayment(paymentReference, {
      source: 'manual_confirmation',
      confirmedBy: req.user.id
    });
    res.json({ success: true, data: rental, message: 'Rental payment confirmed' });
  } catch (error) {
    console.error('Confirm rental payment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to confirm rental payment' });
  }
};

exports.checkRentalPaymentStatus = async (req, res) => {
  try {
    const rental = await Rental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ success: false, message: 'Rental not found' });
    }
    if (![rental.owner.toString(), rental.renter.toString()].includes(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view this rental payment' });
    }
    if (!rental.payment?.paymentReference) {
      return res.status(400).json({ success: false, message: 'Rental payment has not been initiated yet' });
    }
    const result = await rentalPaymentService.refreshRentalPaymentStatus(rental.payment?.paymentReference);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Check rental payment status error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to check rental payment' });
  }
};

// Get rental details
exports.getRentalDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemType } = req.query;

    let item;
    if (isTrailerFleetItem(itemType)) {
      item = await Trailer.findById(id)
        .populate('owner', 'fullName email phone rating')
        .populate('trailerType', 'name icon description');
    } else {
      item = await Vehicle.findById(id)
        .populate('owner', 'fullName email phone rating')
        .populate('make', 'name')
        .populate('model', 'name')
        .populate('vehicleType', 'name icon description');
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }

    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    console.error('Get rental details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rental details'
    });
  }
};

// Create rental request
exports.createRentalRequest = async (req, res) => {
  try {
    const {
      itemType,
      itemId,
      startDate,
      endDate,
      pickupLocation,
      returnLocation,
      rateType = 'daily'
    } = req.body;

    const renterId = req.user.id;
    const normalizedItemType = normalizeRentalItemType(itemType);
    const dateRange = parseDateRange(startDate, endDate);

    // Get the item
    let item;
    if (isTrailerFleetItem(normalizedItemType)) {
      item = await Trailer.findById(itemId);
    } else {
      item = await Vehicle.findById(itemId);
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `${displayItemType(itemType)} not found`
      });
    }

    if (item.owner?.toString() === renterId) {
      return res.status(400).json({
        success: false,
        message: 'You cannot rent your own listing'
      });
    }

    if (!item.rentalSettings?.availableForRental) {
      return res.status(400).json({
        success: false,
        message: 'This item is not available for rental'
      });
    }

    if (item.status !== 'available') {
      return res.status(400).json({
        success: false,
        message: 'This item is currently unavailable'
      });
    }

    await assertRentalOwnerCanList(item.owner);

    const overlaps = await getOverlappingRentalItemIds({
      vehicleIds: isTrailerFleetItem(normalizedItemType) ? [] : [item._id],
      trailerIds: isTrailerFleetItem(normalizedItemType) ? [item._id] : [],
      start: dateRange.start,
      end: dateRange.end
    });
    const isBooked = isTrailerFleetItem(normalizedItemType)
      ? overlaps.trailers.has(String(item._id))
      : overlaps.vehicles.has(String(item._id));
    if (isBooked) {
      return res.status(409).json({
        success: false,
        message: 'This item is already booked for the selected dates'
      });
    }

    const quote = await calculateRentalQuote(item, {
      start: dateRange.start,
      end: dateRange.end,
      rateType
    });

    // Create rental
    const rentalData = {
      itemType: normalizedItemType,
      owner: item.owner,
      renter: renterId,
      channel: 'online',
      createdBy: req.user.id,
      rentalPeriod: {
        startDate: dateRange.start,
        endDate: dateRange.end,
        duration: {
          value: quote.duration.value,
          unit: quote.duration.unit
        }
      },
      pickup: {
        location: {
          address: pickupLocation?.address || item.rentalSettings.pickupLocations?.[0]?.address
        },
        scheduledTime: dateRange.start
      },
      return: {
        location: {
          address: returnLocation?.address || pickupLocation?.address
        },
        scheduledTime: dateRange.end
      },
      pricing: {
        baseRate: quote.rateAmount,
        rateType: quote.rateType,
        deposit: quote.deposit,
        subtotal: quote.subtotal,
        total: quote.total,
        currency: quote.currency
      },
      status: 'pending'
    };

    // Set either vehicle or trailer reference
    if (isTrailerFleetItem(normalizedItemType)) {
      rentalData.trailer = itemId;
    } else {
      rentalData.vehicle = itemId;
    }

    const rental = await Rental.create(rentalData);

    res.status(201).json({
      success: true,
      data: rental,
      message: 'Rental request submitted successfully'
    });
  } catch (error) {
    console.error('Create rental request error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to create rental request'
    });
  }
};

exports.createWalkInRental = async (req, res) => {
  try {
    const {
      itemType,
      itemId,
      startDate,
      endDate,
      pickupLocation,
      returnLocation,
      rateType = 'daily',
      customer = {},
      paymentMethod = 'cash',
      notes
    } = req.body;

    const ownerId = getOwnerScope(req.user);
    if (!canAccessRentalOwnerResource(req.user, ownerId)) {
      return res.status(403).json({ success: false, message: 'You cannot create rentals for this owner account.' });
    }

    const normalizedItemType = normalizeRentalItemType(itemType);
    const dateRange = parseDateRange(startDate, endDate);
    const { renter, snapshot } = await findOrCreateWalkInRenter(customer);

    let item;
    if (isTrailerFleetItem(normalizedItemType)) {
      item = await Trailer.findOne({ _id: itemId, owner: ownerId });
    } else {
      item = await Vehicle.findOne({ _id: itemId, owner: ownerId });
    }

    if (!item) {
      return res.status(404).json({ success: false, message: `${displayItemType(itemType)} not found for this rental account` });
    }

    if (!item.rentalSettings?.availableForRental) {
      return res.status(400).json({ success: false, message: 'This item is not enabled for rentals' });
    }

    if (item.status !== 'available') {
      return res.status(400).json({ success: false, message: 'This item is currently unavailable' });
    }

    const overlaps = await getOverlappingRentalItemIds({
      vehicleIds: isTrailerFleetItem(normalizedItemType) ? [] : [item._id],
      trailerIds: isTrailerFleetItem(normalizedItemType) ? [item._id] : [],
      start: dateRange.start,
      end: dateRange.end
    });
    const isBooked = isTrailerFleetItem(normalizedItemType)
      ? overlaps.trailers.has(String(item._id))
      : overlaps.vehicles.has(String(item._id));
    if (isBooked) {
      return res.status(409).json({ success: false, message: 'This item is already booked for the selected dates' });
    }

    const quote = await calculateRentalQuote(item, {
      start: dateRange.start,
      end: dateRange.end,
      rateType
    });
    const cashPaid = paymentMethod === 'cash';
    const rentalData = {
      itemType: normalizedItemType,
      owner: ownerId,
      renter: renter._id,
      channel: 'walk_in',
      createdBy: req.user.id,
      renterSnapshot: snapshot,
      rentalPeriod: {
        startDate: dateRange.start,
        endDate: dateRange.end,
        duration: {
          value: quote.duration.value,
          unit: quote.duration.unit
        }
      },
      pickup: {
        location: { address: pickupLocation?.address || item.rentalSettings.pickupLocations?.[0]?.address },
        scheduledTime: dateRange.start
      },
      return: {
        location: { address: returnLocation?.address || pickupLocation?.address || item.rentalSettings.pickupLocations?.[0]?.address },
        scheduledTime: dateRange.end
      },
      pricing: {
        baseRate: quote.rateAmount,
        rateType: quote.rateType,
        deposit: quote.deposit,
        subtotal: quote.subtotal,
        total: quote.total,
        currency: quote.currency
      },
      payment: {
        depositPayment: {
          status: cashPaid ? 'paid' : 'pending',
          method: cashPaid ? 'cash' : undefined,
          paidAt: cashPaid ? new Date() : undefined
        },
        rentalPayment: {
          status: cashPaid ? 'paid' : 'pending',
          method: cashPaid ? 'cash' : undefined,
          paidAt: cashPaid ? new Date() : undefined
        },
        totalPaid: cashPaid ? quote.total : 0
      },
      status: cashPaid ? 'confirmed' : 'approved',
      notes,
      agreement: {
        agreedAt: new Date(),
        specialConditions: customer.specialConditions ? [customer.specialConditions] : []
      },
      settlement: cashPaid
        ? { ...await rentalPaymentService.calculateSettlement({ pricing: { total: quote.total, deposit: quote.deposit }, payment: { rentalPayment: { method: 'cash' } } }), status: 'held' }
        : undefined,
      statusHistory: [{
        status: cashPaid ? 'confirmed' : 'approved',
        changedBy: req.user.id,
        notes: cashPaid ? 'Walk-in rental created and cash payment recorded' : 'Walk-in rental created; awaiting payment'
      }]
    };

    if (isTrailerFleetItem(normalizedItemType)) rentalData.trailer = itemId;
    else rentalData.vehicle = itemId;

    const rental = await Rental.create(rentalData);

    res.status(201).json({
      success: true,
      data: rental,
      message: cashPaid ? 'Walk-in rental created and ready for handover' : 'Walk-in rental created and awaiting payment'
    });
  } catch (error) {
    console.error('Create walk-in rental error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create walk-in rental'
    });
  }
};

// Get my rentals (as renter)
exports.getMyRentals = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { renter: req.user.id };
    if (status) {
      query.status = status;
    }

    const rentals = await Rental.find(query)
      .populate({
        path: 'vehicle',
        select: 'registrationNumber images rentalSettings make model vehicleType',
        populate: [
          { path: 'make', select: 'name' },
          { path: 'model', select: 'name' },
          { path: 'vehicleType', select: 'name category icon' }
        ]
      })
      .populate('trailer', 'registrationNumber assetType assetName tractorUnit combination images rentalSettings')
      .populate('owner', 'fullName phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Rental.countDocuments(query);

    res.status(200).json({
      success: true,
      data: rentals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get my rentals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your rentals'
    });
  }
};

// Get my rental listings (as owner)
exports.getMyListings = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const query = { owner: getOwnerScope(req.user) };
    if (status) {
      query.status = status;
    }

    const rentals = await Rental.find(query)
      .populate({
        path: 'vehicle',
        select: 'registrationNumber images make model vehicleType rentalSettings',
        populate: [
          { path: 'make', select: 'name' },
          { path: 'model', select: 'name' },
          { path: 'vehicleType', select: 'name category icon' }
        ]
      })
      .populate('trailer', 'registrationNumber assetType assetName tractorUnit combination images')
      .populate('renter', 'fullName phone rating')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Rental.countDocuments(query);

    res.status(200).json({
      success: true,
      data: rentals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get my listings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your listings'
    });
  }
};

// Approve rental request (owner)
exports.approveRental = async (req, res) => {
  try {
    const { id } = req.params;

    const rental = await Rental.findOne({
      _id: id,
      owner: getOwnerScope(req.user),
      status: 'pending'
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: 'Rental request not found'
      });
    }

    rental.status = 'approved';
    rental.payment.rentalPayment.status = 'pending';
    rental.payment.depositPayment.status = 'pending';
    rental.statusHistory.push({
      status: 'approved',
      changedBy: req.user.id,
      notes: 'Rental approved by owner; awaiting payment'
    });
    await rental.save();

    res.status(200).json({
      success: true,
      data: rental,
      message: 'Rental request approved'
    });
  } catch (error) {
    console.error('Approve rental error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve rental'
    });
  }
};

// Reject rental request (owner)
exports.rejectRental = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const rental = await Rental.findOne({
      _id: id,
      owner: getOwnerScope(req.user),
      status: 'pending'
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: 'Rental request not found'
      });
    }

    rental.status = 'cancelled';
    rental.cancellation = {
      cancelled: true,
      cancelledBy: req.user.id,
      cancelledAt: new Date(),
      reason
    };
    rental.statusHistory.push({
      status: 'cancelled',
      changedBy: req.user.id,
      notes: `Rejected by owner: ${reason}`
    });
    await rental.save();

    res.status(200).json({
      success: true,
      message: 'Rental request rejected'
    });
  } catch (error) {
    console.error('Reject rental error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject rental'
    });
  }
};

// Confirm pickup (start rental)
exports.confirmPickup = async (req, res) => {
  try {
    const { id } = req.params;
    const inspection = buildInspectionPayload(req.body, 'Pickup confirmed, rental started');

    const rental = await Rental.findOne({
      _id: id,
      $or: [{ owner: getOwnerScope(req.user) }, { renter: req.user.id }],
      status: 'confirmed'
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: 'Rental not found or not ready for pickup'
      });
    }

    rental.status = 'active';
    rental.pickup.actualTime = new Date();
    rental.pickup.odometerReading = inspection.odometerReading;
    rental.pickup.fuelLevel = inspection.fuelLevel;
    rental.pickup.photos = inspection.photos;
    rental.pickup.signature = inspection.signature;
    rental.pickup.inspectionNotes = inspection.inspectionNotes;
    rental.pickup.conditionChecklist = inspection.conditionChecklist;
    rental.pickup.completedBy = req.user.id;
    rental.agreement = {
      ...(rental.agreement || {}),
      agreedAt: rental.agreement?.agreedAt || new Date(),
      renterSignature: rental.agreement?.renterSignature || req.body.renterSignature || inspection.signature,
      ownerSignature: rental.agreement?.ownerSignature || req.body.ownerSignature
    };

    if (inspection.odometerReading) {
      rental.usage = rental.usage || {};
      rental.usage.initialOdometer = inspection.odometerReading;
    }

    rental.statusHistory.push({
      status: 'active',
      changedBy: req.user.id,
      notes: inspection.inspectionNotes || 'Pickup confirmed, rental started'
    });

    await rental.save();

    // Update item status
    if (isTrailerFleetItem(rental.itemType)) {
      await Trailer.findByIdAndUpdate(rental.trailer, {
        status: 'rented',
        currentRental: rental._id
      });
    } else {
      await Vehicle.findByIdAndUpdate(rental.vehicle, {
        status: 'in_use'
      });
    }

    res.status(200).json({
      success: true,
      data: rental,
      message: 'Pickup confirmed, rental is now active'
    });
  } catch (error) {
    console.error('Confirm pickup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm pickup'
    });
  }
};

// Confirm return (end rental)
exports.confirmReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const inspection = buildInspectionPayload(req.body, 'Return confirmed, rental completed');
    const damages = Array.isArray(req.body.damages) ? req.body.damages : [];

    const rental = await Rental.findOne({
      _id: id,
      $or: [{ owner: getOwnerScope(req.user) }, { renter: req.user.id }],
      status: 'active'
    });

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: 'Active rental not found'
      });
    }

    rental.status = 'completed';
    rental.return.actualTime = new Date();
    rental.return.odometerReading = inspection.odometerReading;
    rental.return.fuelLevel = inspection.fuelLevel;
    rental.return.photos = inspection.photos;
    rental.return.signature = inspection.signature;
    rental.return.inspectionNotes = inspection.inspectionNotes;
    rental.return.conditionChecklist = inspection.conditionChecklist;
    rental.return.damages = damages;
    rental.return.completedBy = req.user.id;
    rental.rentalPeriod.actualReturnDate = new Date();
    const additionalCharges = applyAdditionalReturnCharges(rental, req.body);

    if (inspection.odometerReading && rental.usage?.initialOdometer) {
      rental.usage.finalOdometer = inspection.odometerReading;
      rental.usage.totalDistance = inspection.odometerReading - rental.usage.initialOdometer;
    }

    rental.statusHistory.push({
      status: 'completed',
      changedBy: req.user.id,
      notes: additionalCharges > 0
        ? `Return confirmed with USD ${additionalCharges.toFixed(2)} additional charges`
        : (inspection.inspectionNotes || 'Return confirmed, rental completed')
    });

    await rental.save();
    await rentalPaymentService.settleRental(rental);

    // Update item status back to available
    if (isTrailerFleetItem(rental.itemType)) {
      await Trailer.findByIdAndUpdate(rental.trailer, {
        status: 'available',
        currentRental: null
      });
    } else {
      await Vehicle.findByIdAndUpdate(rental.vehicle, {
        status: 'available'
      });
    }

    res.status(200).json({
      success: true,
      data: rental,
      message: 'Return confirmed, rental completed'
    });
  } catch (error) {
    console.error('Confirm return error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm return'
    });
  }
};

// Get active rentals (for trailer owners or renters)
exports.getActiveRentals = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;

    let query;
    if (userType === 'trailer_owner') {
      // For trailer owners, get active rentals of their trailers
      query = {
        owner: userId,
        status: { $in: ['active', 'confirmed', 'approved', 'pending'] }
      };
    } else {
      // For renters, get their active rentals
      query = {
        renter: userId,
        status: { $in: ['active', 'confirmed', 'approved', 'pending'] }
      };
    }

    const rentals = await Rental.find(query)
      .populate('vehicle', 'registrationNumber images rentalSettings')
      .populate('trailer', 'registrationNumber assetType assetName tractorUnit combination images rentalSettings trailerType currentLocation')
      .populate('owner', 'fullName phone rating')
      .populate('renter', 'fullName phone rating')
      .sort({ 'rentalPeriod.startDate': -1 });

    // Transform for tracking screen
    const transformedRentals = rentals.map(rental => ({
      _id: rental._id,
      rentalReference: `RTL-${rental._id.toString().slice(-8).toUpperCase()}`,
      status: rental.status,
      itemType: rental.itemType,
      trailer: rental.trailer,
      vehicle: rental.vehicle,
      owner: rental.owner,
      renter: rental.renter,
      pickupLocation: rental.pickup?.location?.address,
      returnLocation: rental.return?.location?.address,
      startDate: rental.rentalPeriod?.startDate,
      endDate: rental.rentalPeriod?.endDate,
      totalPrice: rental.pricing?.total,
      createdAt: rental.createdAt
    }));

    res.status(200).json({
      success: true,
      data: transformedRentals
    });
  } catch (error) {
    console.error('Get active rentals error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active rentals'
    });
  }
};

// Get rental by ID
exports.getRentalById = async (req, res) => {
  try {
    const { id } = req.params;

    const rental = await Rental.findById(id)
      .populate('vehicle')
      .populate('trailer')
      .populate('owner', 'fullName email phone rating')
      .populate('renter', 'fullName email phone rating');

    if (!rental) {
      return res.status(404).json({
        success: false,
        message: 'Rental not found'
      });
    }

    if (!canReadRental(req.user, rental) && !canAccessRentalOwnerResource(req.user, rental.owner)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this rental'
      });
    }

    res.status(200).json({
      success: true,
      data: rental
    });
  } catch (error) {
    console.error('Get rental by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch rental'
    });
  }
};

exports.getRentalTracking = async (req, res) => {
  try {
    const rental = await Rental.findById(req.params.id)
      .populate('vehicle', 'registrationNumber images currentLocation rentalSettings')
      .populate('trailer', 'registrationNumber assetType assetName tractorUnit combination images rentalSettings trailerType currentLocation')
      .populate('owner', 'fullName phone rating')
      .populate('renter', 'fullName phone rating');

    if (!rental) {
      return res.status(404).json({ success: false, message: 'Rental not found' });
    }

    if (!assertRentalAccess(rental, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to track this rental' });
    }

    res.json({
      success: true,
      data: formatRentalTracking(rental)
    });
  } catch (error) {
    console.error('Get rental tracking error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch rental tracking' });
  }
};

exports.updateRentalLocation = async (req, res) => {
  try {
    const { latitude, longitude, address, speed, heading, batteryLevel, note, source = 'driver_app' } = req.body;
    if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
      return res.status(400).json({ success: false, message: 'Latitude and longitude are required' });
    }

    const rental = await Rental.findById(req.params.id);
    if (!rental) {
      return res.status(404).json({ success: false, message: 'Rental not found' });
    }

    if (!assertRentalAccess(rental, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this rental location' });
    }

    const entry = {
      location: {
        latitude: Number(latitude),
        longitude: Number(longitude),
        address: address || `${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`
      },
      speed: speed !== undefined ? Number(speed) : undefined,
      heading: heading !== undefined ? Number(heading) : undefined,
      batteryLevel: batteryLevel !== undefined ? Number(batteryLevel) : undefined,
      source,
      note,
      recordedBy: req.user._id,
      timestamp: new Date()
    };

    rental.tracking.push(entry);
    await rental.save();

    if (isTrailerFleetItem(rental.itemType) && rental.trailer) {
      await Trailer.findByIdAndUpdate(rental.trailer, {
        currentLocation: {
          ...entry.location,
          speed: entry.speed,
          heading: entry.heading,
          batteryLevel: entry.batteryLevel,
          source,
          updatedAt: entry.timestamp
        }
      });
    }

    const updatedRental = await Rental.findById(req.params.id)
      .populate('vehicle', 'registrationNumber images currentLocation rentalSettings')
      .populate('trailer', 'registrationNumber assetType assetName tractorUnit combination images rentalSettings trailerType currentLocation')
      .populate('owner', 'fullName phone rating')
      .populate('renter', 'fullName phone rating');

    res.json({
      success: true,
      data: formatRentalTracking(updatedRental)
    });
  } catch (error) {
    console.error('Update rental location error:', error);
    res.status(500).json({ success: false, message: 'Failed to update rental location' });
  }
};
