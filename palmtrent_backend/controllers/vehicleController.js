const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const Rental = require('../models/Rental');
const Shipment = require('../models/Shipment');
const VehicleMake = require('../models/VehicleMake');
const VehicleModel = require('../models/VehicleModel');
const VehicleType = require('../models/VehicleType');
const TrailerType = require('../models/TrailerType');
const { recordAudit } = require('../services/auditService');
const {
  assertDriverAssignable,
  assertRentalOwnerCanList,
  getRentalOwnerSubscriptionIssues,
  getUsableRentalOwnerIds,
  getVehicleComplianceIssues
} = require('../services/flowControlService');
const { finalizeUploadedFile } = require('../services/uploadFinalizationService');
const { canAccessRentalOwnerResource, getRentalOwnerScopeId } = require('../services/resourceAccessService');

const RENTAL_SUBSCRIPTION_NOTICE = 'Vehicle saved, but rental marketplace listing is disabled until you activate a paid owner subscription.';
const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;
const VEHICLE_CATEGORIES = ['car', 'suv', 'bakkie', 'truck', 'tractor', 'van'];
const VEHICLE_SUBCATEGORIES = [
  'hatchback', 'sedan', 'crossover', 'compact_suv', 'midsize_suv', 'mpv', 'minibus',
  'single_cab', 'double_cab', 'panel_van', 'delivery_van',
  '3ton', '5ton', '7ton', '10ton', '15ton', '20ton', '30ton',
  'horse_only', 'with_trailer', 'cargo_van', 'sprinter'
];
const TRAILER_CATEGORIES = ['flatbed', 'enclosed', 'specialized', 'tanker', 'refrigerated'];

const isObjectId = (value) => OBJECT_ID_PATTERN.test(String(value || ''));

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const stripEmptyOptionalObjectIds = (vehicleData) => {
  ['trailerType'].forEach((field) => {
    if (vehicleData[field] === '' || vehicleData[field] === null) {
      delete vehicleData[field];
    }
  });

  if (vehicleData.insurance?.coverage === '' || vehicleData.insurance?.coverage === null) {
    delete vehicleData.insurance.coverage;
  }
};

const normalizeSubcategory = (value = '') => {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/tonne|tonnes|tons/g, 'ton')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const aliases = {
    single_cab_bakkie: 'single_cab',
    double_cab_bakkie: 'double_cab',
    compact_car: 'hatchback',
    small_car: 'hatchback',
    family_car: 'sedan',
    saloon: 'sedan',
    suv: 'midsize_suv',
    compact_suv: 'compact_suv',
    midsize_suv: 'midsize_suv',
    people_carrier: 'mpv',
    minibus_van: 'minibus',
    panel_van: 'panel_van',
    delivery_van: 'delivery_van',
    cargo_van: 'cargo_van',
    sprinter_van: 'sprinter',
    truck_tractor: 'horse_only',
    tractor_only: 'horse_only',
    with_trailer: 'with_trailer',
    '3_ton_truck': '3ton',
    '5_ton_truck': '5ton',
    '7_ton_truck': '7ton',
    '10_ton_truck': '10ton'
  };
  return aliases[normalized] || normalized.replace('_ton', 'ton');
};

const categoryLabel = (category = 'truck') => ({
  car: 'Car',
  suv: 'SUV',
  bakkie: 'Bakkie',
  van: 'Van',
  truck: 'Truck',
  tractor: 'Truck Tractor'
}[category] || 'Truck');

const defaultLicenseClass = (category = 'truck') => ({
  car: 'code_8',
  suv: 'code_8',
  bakkie: 'code_8',
  van: 'code_8',
  truck: 'code_10',
  tractor: 'ec'
}[category] || 'code_10');

const defaultVehicleCapacity = (category = 'truck', subcategory = '') => {
  const maxBySubcategory = {
    hatchback: 0.45,
    sedan: 0.55,
    crossover: 0.65,
    compact_suv: 0.7,
    midsize_suv: 0.85,
    mpv: 0.8,
    minibus: 1.2,
    single_cab: 1,
    double_cab: 1.2,
    panel_van: 2,
    delivery_van: 3,
    cargo_van: 2,
    sprinter: 2.5,
    '3ton': 3,
    '5ton': 5,
    '7ton': 7,
    '10ton': 10,
    '15ton': 15,
    '20ton': 20,
    '30ton': 30,
    horse_only: 34,
    with_trailer: 34
  };
  const max = maxBySubcategory[subcategory] || (
    category === 'tractor' ? 34 :
      category === 'car' ? 0.5 :
        category === 'suv' ? 0.8 :
          category === 'bakkie' ? 1 : 5
  );
  return { weight: { min: 0, max, unit: 'tonnes' } };
};

const resolveVehicleReferences = async (vehicleData) => {
  stripEmptyOptionalObjectIds(vehicleData);

  const requestedCategory = VEHICLE_CATEGORIES.includes(vehicleData.category)
    ? vehicleData.category
    : 'truck';
  const requestedSubcategory = normalizeSubcategory(vehicleData.vehicleTypeCode || vehicleData.subType);
  const safeSubcategory = VEHICLE_SUBCATEGORIES.includes(requestedSubcategory)
    ? requestedSubcategory
    : undefined;

  if (!isObjectId(vehicleData.vehicleType)) {
    const typeName = vehicleData.vehicleTypeName || vehicleData.subType || categoryLabel(requestedCategory);
    const typeQuery = [
      { name: new RegExp(`^${escapeRegex(typeName)}$`, 'i') }
    ];
    if (safeSubcategory) {
      typeQuery.push({ category: requestedCategory, subcategory: safeSubcategory });
    }

    let vehicleType = await VehicleType.findOne({ $or: typeQuery });
    if (!vehicleType) {
      vehicleType = await VehicleType.findOne({ category: requestedCategory, isActive: true }).sort({ displayOrder: 1, name: 1 });
    }
    if (!vehicleType) {
      vehicleType = await VehicleType.create({
        name: typeName,
        category: requestedCategory,
        subcategory: safeSubcategory,
        description: `${typeName} reference created from vehicle registration`,
        capacity: defaultVehicleCapacity(requestedCategory, safeSubcategory),
        trailerConfiguration: {
          canAttachTrailer: requestedCategory === 'tractor' || requestedCategory === 'bakkie',
          requiresTrailer: false,
          hasIntegratedTrailer: false
        },
        requirements: { licenseClass: defaultLicenseClass(requestedCategory) },
        displayOrder: 999,
        isActive: true
      });
    }
    vehicleData.vehicleType = vehicleType._id;
  }

  if (!isObjectId(vehicleData.make)) {
    const makeName = vehicleData.makeName || vehicleData.make || 'Other';
    const make = await VehicleMake.findOneAndUpdate(
      { name: new RegExp(`^${escapeRegex(makeName)}$`, 'i') },
      { $setOnInsert: { name: makeName, country: '', isPopular: false } },
      { upsert: true, new: true }
    );
    vehicleData.make = make._id;
  }

  if (!isObjectId(vehicleData.model)) {
    const modelName = vehicleData.modelName || vehicleData.model || 'Unspecified Model';
    const model = await VehicleModel.findOneAndUpdate(
      { make: vehicleData.make, name: new RegExp(`^${escapeRegex(modelName)}$`, 'i') },
      {
        $setOnInsert: {
          make: vehicleData.make,
          name: modelName,
          compatibleVehicleTypes: [vehicleData.vehicleType]
        }
      },
      { upsert: true, new: true }
    );
    vehicleData.model = model._id;
  }

  if (vehicleData.trailerType && !isObjectId(vehicleData.trailerType)) {
    const trailerName = vehicleData.trailerTypeName || vehicleData.trailerType;
    const trailerCategory = TRAILER_CATEGORIES.includes(vehicleData.trailerCategory)
      ? vehicleData.trailerCategory
      : 'flatbed';
    const trailerType = await TrailerType.findOneAndUpdate(
      { name: new RegExp(`^${escapeRegex(trailerName)}$`, 'i') },
      {
        $setOnInsert: {
          name: trailerName,
          category: trailerCategory,
          description: `${trailerName} reference created from vehicle registration`,
          capacityRange: { min: 0, max: 34, unit: 'tonnes' }
        }
      },
      { upsert: true, new: true }
    );
    vehicleData.trailerType = trailerType._id;
  }
};

function wantsVehicleRentalListing(payload = {}) {
  return payload.rentalSettings?.availableForRental === true || payload.pricing?.availableForRental === true;
}

function disableVehicleRentalListing(payload) {
  payload.rentalSettings = {
    ...(payload.rentalSettings || {}),
    availableForRental: false
  };
  payload.pricing = {
    ...(payload.pricing || {}),
    availableForRental: false
  };
}

function syncVehicleRentalFields(payload) {
  if (payload.pricing) {
    payload.rentalSettings = {
      ...(payload.rentalSettings || {}),
      availableForRental: payload.pricing.availableForRental ?? payload.rentalSettings?.availableForRental,
      dailyRate: payload.pricing.dailyRate ?? payload.rentalSettings?.dailyRate,
      weeklyRate: payload.pricing.weeklyRate ?? payload.rentalSettings?.weeklyRate,
      monthlyRate: payload.pricing.monthlyRate ?? payload.rentalSettings?.monthlyRate,
      deposit: payload.pricing.deposit ?? payload.rentalSettings?.deposit,
      minimumRentalPeriod: payload.pricing.minimumRentalPeriod ?? payload.rentalSettings?.minimumRentalPeriod
    };
  }

  if (payload.rentalSettings) {
    payload.pricing = {
      ...(payload.pricing || {}),
      availableForRental: payload.rentalSettings.availableForRental ?? payload.pricing?.availableForRental,
      dailyRate: payload.rentalSettings.dailyRate ?? payload.pricing?.dailyRate,
      weeklyRate: payload.rentalSettings.weeklyRate ?? payload.pricing?.weeklyRate,
      monthlyRate: payload.rentalSettings.monthlyRate ?? payload.pricing?.monthlyRate,
      deposit: payload.rentalSettings.deposit ?? payload.pricing?.deposit,
      minimumRentalPeriod: payload.rentalSettings.minimumRentalPeriod ?? payload.pricing?.minimumRentalPeriod
    };
  }
}

const vehicleReferencePopulate = [
  { path: 'make', select: 'name country' },
  { path: 'model', select: 'name yearStart yearEnd' },
  { path: 'vehicleType', select: 'name code category subcategory capacity' },
  { path: 'trailerType', select: 'name code category capacityRange' }
];

function vehicleDisplayObject(vehicle) {
  const object = vehicle?.toObject ? vehicle.toObject() : vehicle;
  if (!object) return object;

  return {
    ...object,
    makeName: object.make?.name || object.makeName || object.make,
    modelName: object.model?.name || object.modelName || object.model,
    vehicleTypeName: object.vehicleType?.name || object.vehicleTypeName || object.vehicleType,
    trailerTypeName: object.trailerType?.name || object.trailerTypeName || object.trailerType
  };
}

// Get all vehicles for a transporter
exports.getVehicles = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, availableForRental } = req.query;
    
    const ownerScopeId = getRentalOwnerScopeId(req.user);
    const query = { owner: ownerScopeId };
    
    if (status) query.status = status;
    if (type) query.vehicleType = type;
    if (availableForRental !== undefined) {
      query['pricing.availableForRental'] = availableForRental === 'true';
    }

    const vehicles = await Vehicle.find(query)
      .populate(vehicleReferencePopulate)
      .populate('assignedDriver', 'fullName phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vehicle.countDocuments(query);
    const subscriptionIssues = await getRentalOwnerSubscriptionIssues(ownerScopeId);
    const rentalListingsBlocked = subscriptionIssues.length
      ? await Vehicle.countDocuments({
          owner: ownerScopeId,
          $or: [
            { 'pricing.availableForRental': true },
            { 'rentalSettings.availableForRental': true }
          ]
        })
      : 0;

    res.status(200).json({
      success: true,
      data: vehicles.map(vehicleDisplayObject),
      rentalMarketplaceNotice: rentalListingsBlocked > 0
        ? `${rentalListingsBlocked} vehicle rental listing${rentalListingsBlocked === 1 ? ' is' : 's are'} hidden from the marketplace until you activate a paid owner subscription.`
        : undefined,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicles'
    });
  }
};

// Get single vehicle
exports.getVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id)
      .populate(vehicleReferencePopulate)
      .populate('assignedDriver')
      .populate('rentalHistory.rental')
      .populate('rentalHistory.renter', 'fullName phone');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check ownership
    if (!canAccessRentalOwnerResource(req.user, vehicle.owner)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: vehicleDisplayObject(vehicle)
    });
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle'
    });
  }
};

// Create new vehicle
exports.createVehicle = async (req, res) => {
  try {
    const vehicleData = {
      ...req.body,
      owner: getRentalOwnerScopeId(req.user)
    };
    await resolveVehicleReferences(vehicleData);
    syncVehicleRentalFields(vehicleData);

    let message = 'Vehicle added successfully';
    if (wantsVehicleRentalListing(vehicleData)) {
      const subscriptionIssues = await getRentalOwnerSubscriptionIssues(getRentalOwnerScopeId(req.user));
      if (subscriptionIssues.length) {
        disableVehicleRentalListing(vehicleData);
        message = RENTAL_SUBSCRIPTION_NOTICE;
      }
    }

    const vehicle = new Vehicle(vehicleData);
    await vehicle.save();
    const populatedVehicle = await Vehicle.findById(vehicle._id).populate(vehicleReferencePopulate);

    res.status(201).json({
      success: true,
      data: vehicleDisplayObject(populatedVehicle),
      message
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle with this registration number already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create vehicle'
    });
  }
};

// Update vehicle
exports.updateVehicle = async (req, res) => {
  try {
    let vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check ownership
    if (!canAccessRentalOwnerResource(req.user, vehicle.owner)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (req.body.status && ['available', 'inactive', 'maintenance'].includes(req.body.status)) {
      const activeShipment = await Shipment.findOne({
        vehicle: vehicle._id,
        status: { $in: ['assigned', 'en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery'] }
      }).select('_id bookingReference status');

      if (activeShipment) {
        return res.status(400).json({
          success: false,
          message: `Vehicle is assigned to active shipment ${activeShipment.bookingReference}`
        });
      }
    }

    const before = { status: vehicle.status, assignedDriver: vehicle.assignedDriver };
    const payload = { ...req.body };
    await resolveVehicleReferences(payload);
    syncVehicleRentalFields(payload);

    if (wantsVehicleRentalListing(payload)) {
      await assertRentalOwnerCanList(getRentalOwnerScopeId(req.user));
    }

    vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      payload,
      { new: true, runValidators: true }
    ).populate(vehicleReferencePopulate);

    await recordAudit({
      actor: req.user,
      action: req.path.endsWith('/status') ? 'vehicle.status_updated' : 'vehicle.updated',
      entityType: 'Vehicle',
      entityId: vehicle._id,
      entityRef: vehicle.registrationNumber,
      before,
      after: { status: vehicle.status, assignedDriver: vehicle.assignedDriver },
      req
    });

    res.status(200).json({
      success: true,
      data: vehicleDisplayObject(vehicle),
      message: 'Vehicle updated successfully'
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to update vehicle'
    });
  }
};

// Delete vehicle
exports.deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check ownership
    if (!canAccessRentalOwnerResource(req.user, vehicle.owner)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if vehicle has active rentals
    const activeRental = await Rental.findOne({
      vehicle: req.params.id,
      status: { $in: ['active', 'confirmed', 'payment_pending'] }
    });

    if (activeRental) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete vehicle with active rentals'
      });
    }

    await Vehicle.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Vehicle deleted successfully'
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete vehicle'
    });
  }
};

// Assign driver to vehicle
exports.assignDriver = async (req, res) => {
  try {
    const { driverId } = req.body;

    const vehicle = await Vehicle.findById(req.params.id);
    const driver = driverId ? await Driver.findById(driverId) : null;

    if (!vehicle || (driverId && !driver)) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle or driver not found'
      });
    }

    // Check ownership
    const driverBelongsToAccount = driver ? canAccessRentalOwnerResource(req.user, driver.owner) : true;
    const driverIsAvailableMarketplace = driver
      ? driver.profileType === 'marketplace' &&
        driver.status === 'available' &&
        driver.availability?.isAvailable !== false &&
        !driver.assignedVehicle
      : true;

    if (!canAccessRentalOwnerResource(req.user, vehicle.owner) ||
        (driver && !driverBelongsToAccount && !driverIsAvailableMarketplace)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const vehicleIssues = getVehicleComplianceIssues(vehicle).filter(issue => issue !== 'Vehicle is not available');
    if (vehicleIssues.length) {
      return res.status(400).json({
        success: false,
        message: `Vehicle is not compliant: ${vehicleIssues.join('; ')}`
      });
    }

    if (driverId && driverBelongsToAccount) {
      await assertDriverAssignable(driverId, getRentalOwnerScopeId(req.user));
    } else if (driverId && driver) {
      if (driver.assignedVehicle) throw new Error('Driver cannot be assigned: Driver is already assigned to a vehicle');
      if (driver.status !== 'available' || driver.availability?.isAvailable === false) {
        throw new Error('Driver cannot be assigned: Driver is not available');
      }
    }

    const existingDriverId = vehicle.assignedDriver;
    if (existingDriverId && existingDriverId.toString() !== driverId?.toString()) {
      await Driver.findByIdAndUpdate(existingDriverId, {
        $unset: { assignedVehicle: 1 },
        'availability.isAvailable': true
      });
    }

    vehicle.assignedDriver = driverId || undefined;
    await vehicle.save();
    await Shipment.updateMany(
      {
        vehicle: vehicle._id,
        status: { $in: ['assigned', 'en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery'] }
      },
      driverId ? { assignedDriver: driverId } : { $unset: { assignedDriver: 1 } }
    );

    if (driver) {
      driver.assignedVehicle = req.params.id;
      driver.availability = {
        ...driver.availability,
        isAvailable: false
      };
      await driver.save();
    }

    await recordAudit({
      actor: req.user,
      action: driverId ? 'vehicle.driver_assigned' : 'vehicle.driver_unassigned',
      entityType: 'Vehicle',
      entityId: vehicle._id,
      entityRef: vehicle.registrationNumber,
      before: { assignedDriver: existingDriverId },
      after: { assignedDriver: driverId || null },
      req
    });

    res.status(200).json({
      success: true,
      message: 'Driver assigned to vehicle successfully'
    });
  } catch (error) {
    console.error('Assign driver error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to assign driver'
    });
  }
};

// Get available vehicles for rental
exports.getAvailableForRental = async (req, res) => {
  try {
    const { page = 1, limit = 10, type, location, minCapacity } = req.query;
    
    const query = {
      'pricing.availableForRental': true,
      status: 'available',
      'availability.isAvailable': true,
      'verification.status': 'approved',
      owner: { $in: await getUsableRentalOwnerIds() }
    };

    if (type) query.vehicleType = type;
    if (minCapacity) query['capacity.weight.value'] = { $gte: parseInt(minCapacity) };

    const vehicles = await Vehicle.find(query)
      .populate(vehicleReferencePopulate)
      .populate('owner', 'fullName phone rating.average')
      .select('-documents -maintenance -rentalHistory') // Exclude sensitive info
      .sort({ 'pricing.dailyRate': 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vehicle.countDocuments(query);

    res.status(200).json({
      success: true,
      data: vehicles.map(vehicleDisplayObject),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get available vehicles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available vehicles'
    });
  }
};

// Update vehicle rental settings
exports.updateRentalSettings = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check ownership
    if (!canAccessRentalOwnerResource(req.user, vehicle.owner)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    vehicle.pricing = {
      ...vehicle.pricing,
      ...req.body
    };
    vehicle.rentalSettings = {
      ...vehicle.rentalSettings,
      ...req.body
    };

    if (req.body.availableForRental === true) {
      await assertRentalOwnerCanList(getRentalOwnerScopeId(req.user));
    }

    await vehicle.save();

    res.status(200).json({
      success: true,
      data: vehicle,
      message: 'Rental settings updated successfully'
    });
  } catch (error) {
    console.error('Update rental settings error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to update rental settings'
    });
  }
};

exports.recommend = async (req, res) => {
  try {
    const { cargoType, weight, cargoValue } = req.body;
    
    // Get system-wide vehicle availability data
    const vehicleStats = await Vehicle.aggregate([
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          available: {
            $sum: {
              $cond: [{ $eq: ['$status', 'available'] }, 1, 0]
            }
          },
          averageRating: { $avg: '$rating' },
          averageResponseTime: { $avg: '$averageResponseTime' }
        }
      }
    ]);

    // Simple recommendation logic - can be enhanced with ML
    const weightNum = parseFloat(weight) || 0;
    let recommendedVehicle;

    if (weightNum <= 2000) {
      recommendedVehicle = {
        vehicleType: 'bakkie',
        displayName: 'Bakkie (1-2 tonnes)',
        capacity: '1-2 tonnes',
        features: ['Quick deployment', 'Urban friendly'],
        suitability: 'Perfect for your cargo',
        reason: 'Based on weight and cargo type'
      };
    } else if (weightNum <= 3000) {
      recommendedVehicle = {
        vehicleType: '3ton',
        displayName: '3-Tonne Truck',
        capacity: '3 tonnes',
        features: ['Tarpaulin cover', 'Standard truck'],
        suitability: 'Ideal for your cargo',
        reason: 'Optimal for weight and distance'
      };
    } else if (weightNum <= 5000) {
      recommendedVehicle = {
        vehicleType: '5ton',
        displayName: '5-Tonne Truck',
        capacity: '5 tonnes',
        features: ['Tarpaulin cover', 'Heavy duty'],
        suitability: 'Recommended for your cargo',
        reason: 'Best match based on system data'
      };
    } else if (weightNum <= 7000) {
      recommendedVehicle = {
        vehicleType: '7ton',
        displayName: '7-Tonne Truck with Tarpaulin',
        capacity: '7 tonnes',
        features: ['Full tarpaulin cover', 'Heavy duty', 'Weather protection'],
        suitability: 'Excellent for your cargo',
        reason: 'Matches cargo type and provides protection'
      };
    } else {
      recommendedVehicle = {
        vehicleType: '10ton',
        displayName: '10-Tonne Truck',
        capacity: '10 tonnes',
        features: ['Heavy duty', 'Large capacity'],
        suitability: 'Required for your cargo',
        reason: 'Only option for this weight class'
      };
    }

    // Add system statistics to recommendation
    const vehicleStat = vehicleStats.find(stat => stat._id === recommendedVehicle.vehicleType);
    if (vehicleStat) {
      recommendedVehicle.systemStats = {
        available: vehicleStat.available,
        total: vehicleStat.total,
        availabilityRate: (vehicleStat.available / vehicleStat.total * 100).toFixed(1),
        averageResponseTime: vehicleStat.averageResponseTime || '2.3 hours'
      };
    }

    res.json({
      success: true,
      data: recommendedVehicle
    });
  } catch (error) {
    console.error('Vehicle recommendation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating vehicle recommendation'
    });
  }
};

exports.types = async (req, res) => {
  try {
    const vehicleTypes = [
      { value: 'bakkie', label: 'Bakkie (1-2 tonnes)', capacity: '1-2 tonnes' },
      { value: '3ton', label: '3-Tonne Truck', capacity: '3 tonnes' },
      { value: '5ton', label: '5-Tonne Truck', capacity: '5 tonnes' },
      { value: '7ton', label: '7-Tonne Truck', capacity: '7 tonnes' },
      { value: '10ton', label: '10-Tonne Truck', capacity: '10 tonnes' },
      { value: 'trailer', label: 'Truck Tractor with Trailer', capacity: '20+ tonnes' }
    ];

    res.json({
      success: true,
      data: vehicleTypes
    });
  } catch (error) {
    console.error('Get vehicle types error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vehicle types'
    });
  }
};

// Upload vehicle photo
exports.uploadVehiclePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { photoType } = req.body;

    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check ownership
    if (!canAccessRentalOwnerResource(req.user, vehicle.owner)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No photo uploaded'
      });
    }

    const finalized = await finalizeUploadedFile(req.file, 'vehicles');
    const photoUrl = finalized.url;

    // Initialize photos array if not exists
    if (!vehicle.photos) {
      vehicle.photos = [];
    }

    // Check if photo type already exists
    const existingPhotoIndex = vehicle.photos.findIndex(p => p.type === photoType);

    if (existingPhotoIndex >= 0) {
      // Update existing photo
      vehicle.photos[existingPhotoIndex] = {
        type: photoType,
        url: photoUrl,
        uploadedAt: new Date(),
        storageKey: finalized.key,
        storageProvider: finalized.provider
      };
    } else {
      // Add new photo
      vehicle.photos.push({
        type: photoType,
        url: photoUrl,
        uploadedAt: new Date(),
        storageKey: finalized.key,
        storageProvider: finalized.provider
      });
    }

    await vehicle.save();

    res.status(200).json({
      success: true,
      data: {
        url: photoUrl,
        type: photoType,
        storage: {
          key: finalized.key,
          provider: finalized.provider
        }
      },
      message: 'Photo uploaded successfully'
    });
  } catch (error) {
    console.error('Upload vehicle photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload photo'
    });
  }
};

// Get vehicle photos
exports.getVehiclePhotos = async (req, res) => {
  try {
    const vehicle = await Vehicle.findById(req.params.id).select('photos');

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle.photos || []
    });
  } catch (error) {
    console.error('Get vehicle photos error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch vehicle photos'
    });
  }
};

// Delete vehicle photo
exports.deleteVehiclePhoto = async (req, res) => {
  try {
    const { id, photoType } = req.params;

    const vehicle = await Vehicle.findById(id);
    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Check ownership
    if (!canAccessRentalOwnerResource(req.user, vehicle.owner)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Remove photo from array
    vehicle.photos = (vehicle.photos || []).filter(p => p.type !== photoType);
    await vehicle.save();

    res.status(200).json({
      success: true,
      message: 'Photo deleted successfully'
    });
  } catch (error) {
    console.error('Delete vehicle photo error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete photo'
    });
  }
};
