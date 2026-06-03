const Rental = require('../models/Rental');
const Vehicle = require('../models/Vehicle');
const Trailer = require('../models/Trailer');
const User = require('../models/User');
const rentalPaymentService = require('../services/rentalPaymentService');
const monetizationService = require('../services/monetizationService');
const {
  assertRentalOwnerCanList,
  getUsableRentalOwnerIds
} = require('../services/flowControlService');

const TRAILER_FLEET_ITEM_TYPES = ['trailer', 'tractor_unit', 'truck', 'full_rig'];

function isTrailerFleetItem(itemType) {
  return TRAILER_FLEET_ITEM_TYPES.includes(itemType);
}

function displayItemType(itemType) {
  return {
    trailer: 'Trailer',
    tractor_unit: 'Tractor unit',
    truck: 'Truck',
    full_rig: 'Full rig',
    vehicle: 'Vehicle'
  }[itemType] || 'Rental item';
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
      page = 1,
      limit = 20
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const results = { vehicles: [], fleetAssets: [], trailers: [] };
    const eligibleRentalOwnerIds = await getUsableRentalOwnerIds();

    // Get available vehicles
    if (!itemType || itemType === 'vehicle') {
      const vehicleQuery = {
        'rentalSettings.availableForRental': true,
        status: 'available',
        owner: { $in: eligibleRentalOwnerIds }
      };

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
        .populate('vehicleType', 'name icon')
        .skip(itemType === 'vehicle' ? skip : 0)
        .limit(itemType === 'vehicle' ? parseInt(limit) : 10)
        .lean();

      results.vehicles = vehicles.map(v => ({
        _id: v._id,
        itemType: 'vehicle',
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
        rating: v.rating
      }));
    }

    // Get available trailer-owner fleet assets
    if (!itemType || isTrailerFleetItem(itemType)) {
      const trailerQuery = {
        'rentalSettings.availableForRental': true,
        status: 'available',
        owner: { $in: eligibleRentalOwnerIds }
      };

      if (itemType && itemType !== 'all') {
        trailerQuery.assetType = itemType;
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
        .skip(itemType === 'trailer' ? skip : 0)
        .limit(itemType === 'trailer' ? parseInt(limit) : 10)
        .lean();

      results.fleetAssets = trailers.map(t => ({
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
        rating: t.rating
      }));
      results.trailers = results.fleetAssets.filter(item => item.assetType === 'trailer');
    }

    // Combined results for mixed listing
    const combined = [...results.vehicles, ...results.fleetAssets];

    res.status(200).json({
      success: true,
      data: itemType ? (itemType === 'vehicle' ? results.vehicles : results.fleetAssets) : combined,
      vehicles: results.vehicles,
      trailers: results.trailers,
      fleetAssets: results.fleetAssets,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
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
    if (rental.renter._id.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the renter can pay for this rental' });
    }

    const result = await rentalPaymentService.createRentalPayment(rental._id, {
      userId: req.user.id,
      email: req.user.email,
      phone: req.user.phone
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

    // Get the item
    let item;
    if (isTrailerFleetItem(itemType)) {
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

    // Calculate pricing
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let rateAmount, numberOfUnits;
    if (rateType === 'weekly' && item.rentalSettings.weeklyRate) {
      rateAmount = item.rentalSettings.weeklyRate;
      numberOfUnits = Math.ceil(diffDays / 7);
    } else if (rateType === 'monthly' && item.rentalSettings.monthlyRate) {
      rateAmount = item.rentalSettings.monthlyRate;
      numberOfUnits = Math.ceil(diffDays / 30);
    } else {
      rateAmount = item.rentalSettings.dailyRate || 0;
      numberOfUnits = diffDays;
    }

    const subtotal = rateAmount * numberOfUnits;
    const deposit = item.rentalSettings.deposit || 0;
    const rentalFeePreview = await monetizationService.calculateRentalSettlement({
      pricing: { total: subtotal + deposit, deposit },
      payment: { rentalPayment: { method: 'openapi_africa' } }
    });
    const platformFee = rentalFeePreview.platformFee;
    const total = subtotal + deposit + platformFee;

    // Create rental
    const rentalData = {
      itemType,
      owner: item.owner,
      renter: renterId,
      rentalPeriod: {
        startDate: start,
        endDate: end,
        duration: {
          value: numberOfUnits,
          unit: rateType === 'weekly' ? 'weeks' : rateType === 'monthly' ? 'months' : 'days'
        }
      },
      pickup: {
        location: {
          address: pickupLocation?.address || item.rentalSettings.pickupLocations?.[0]?.address
        },
        scheduledTime: start
      },
      return: {
        location: {
          address: returnLocation?.address || pickupLocation?.address
        },
        scheduledTime: end
      },
      pricing: {
        baseRate: rateAmount,
        rateType,
        deposit,
        subtotal,
        total,
        currency: 'USD'
      },
      status: 'pending'
    };

    // Set either vehicle or trailer reference
    if (isTrailerFleetItem(itemType)) {
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
      .populate('vehicle', 'registrationNumber images rentalSettings')
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

    const query = { owner: req.user.id };
    if (status) {
      query.status = status;
    }

    const rentals = await Rental.find(query)
      .populate('vehicle', 'registrationNumber images')
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
      owner: req.user.id,
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
      owner: req.user.id,
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
    const { odometerReading, fuelLevel, photos, notes } = req.body;

    const rental = await Rental.findOne({
      _id: id,
      $or: [{ owner: req.user.id }, { renter: req.user.id }],
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
    rental.pickup.odometerReading = odometerReading;
    rental.pickup.fuelLevel = fuelLevel;
    rental.pickup.photos = photos || [];
    rental.pickup.inspectionNotes = notes;
    rental.pickup.completedBy = req.user.id;

    if (odometerReading) {
      rental.usage = rental.usage || {};
      rental.usage.initialOdometer = odometerReading;
    }

    rental.statusHistory.push({
      status: 'active',
      changedBy: req.user.id,
      notes: 'Pickup confirmed, rental started'
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
    const { odometerReading, fuelLevel, photos, notes, damages } = req.body;

    const rental = await Rental.findOne({
      _id: id,
      $or: [{ owner: req.user.id }, { renter: req.user.id }],
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
    rental.return.odometerReading = odometerReading;
    rental.return.fuelLevel = fuelLevel;
    rental.return.photos = photos || [];
    rental.return.inspectionNotes = notes;
    rental.return.damages = damages || [];
    rental.return.completedBy = req.user.id;
    rental.rentalPeriod.actualReturnDate = new Date();

    if (odometerReading && rental.usage?.initialOdometer) {
      rental.usage.finalOdometer = odometerReading;
      rental.usage.totalDistance = odometerReading - rental.usage.initialOdometer;
    }

    rental.statusHistory.push({
      status: 'completed',
      changedBy: req.user.id,
      notes: 'Return confirmed, rental completed'
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

    // Check if user is owner or renter
    if (rental.owner._id.toString() !== req.user.id &&
        rental.renter._id.toString() !== req.user.id) {
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
