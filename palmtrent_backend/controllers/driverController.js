const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');
const Subscription = require('../models/Subscription');
const { canAccessRentalOwnerResource, getRentalOwnerScopeId } = require('../services/resourceAccessService');

const publicDriverFields = 'fullName phone email address licenseClass experience specialization employmentType status availability marketplace rating performance currentLocation updatedAt user';

function canAccessDriver(driver, user) {
  const userId = String(user._id || user.id);
  return canAccessRentalOwnerResource(user, driver.owner) || String(driver.user || '') === userId || user.userType === 'admin';
}

async function activeDriverSubscriptionUserIds(userIds) {
  if (!userIds.length) return new Set();
  const now = new Date();
  const ids = await Subscription.find({
    user: { $in: userIds },
    audience: 'driver',
    status: 'active',
    'payment.status': { $in: ['paid', 'not_required', 'waived'] },
    $or: [
      { currentPeriodEnd: { $exists: false } },
      { currentPeriodEnd: null },
      { currentPeriodEnd: { $gte: now } }
    ]
  }).distinct('user');
  return new Set(ids.map(String));
}

// Get all drivers for a transporter
exports.getDrivers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { owner: getRentalOwnerScopeId(req.user) };
    if (status) query.status = status;

    const drivers = await Driver.find(query)
      .populate('assignedVehicle', 'registrationNumber make model')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Driver.countDocuments(query);

    res.status(200).json({
      success: true,
      data: drivers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get drivers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drivers'
    });
  }
};

// Search independent drivers who are looking for work
exports.searchMarketplaceDrivers = async (req, res) => {
  try {
    const { city, specialization, licenseClass, availableOnly = 'true', page = 1, limit = 20 } = req.query;
    const query = {
      profileType: 'marketplace',
      'marketplace.visible': true,
      'marketplace.lookingForWork': true,
      status: { $ne: 'suspended' }
    };

    if (availableOnly !== 'false') {
      query.status = 'available';
      query['availability.isAvailable'] = true;
    }
    if (specialization) query.specialization = specialization;
    if (licenseClass) query.licenseClass = new RegExp(`^${licenseClass}$`, 'i');
    if (city) {
      query.$or = [
        { 'address.city': new RegExp(city, 'i') },
        { 'marketplace.preferredLocations': new RegExp(city, 'i') },
        { 'currentLocation.address': new RegExp(city, 'i') }
      ];
    }

    const drivers = await Driver.find(query)
      .select(publicDriverFields)
      .populate('user', 'fullName email phone verification rating')
      .sort({ 'rating.average': -1, updatedAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    const activeSubscriberIds = await activeDriverSubscriptionUserIds(
      drivers.map(driver => driver.user?._id || driver.user).filter(Boolean)
    );
    const data = drivers.filter(driver => activeSubscriberIds.has(String(driver.user?._id || driver.user)));

    res.status(200).json({
      success: true,
      data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: data.length
      }
    });
  } catch (error) {
    console.error('Search marketplace drivers error:', error);
    res.status(500).json({ success: false, message: 'Failed to search drivers' });
  }
};

exports.getMyDriverProfile = async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id });
    res.status(200).json({ success: true, data: driver });
  } catch (error) {
    console.error('Get my driver profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to load driver profile' });
  }
};

exports.updateMyDriverProfile = async (req, res) => {
  try {
    const allowed = [
      'fullName', 'phone', 'email', 'dateOfBirth', 'address', 'licenseNumber',
      'licenseClass', 'licenseExpiry', 'licenseIssuingAuthority', 'experience',
      'specialization', 'employmentType', 'documents', 'emergencyContact',
      'bankDetails', 'marketplace', 'currentLocation'
    ];
    const updates = {};
    allowed.forEach(field => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });
    updates.owner = req.user._id;
    updates.user = req.user._id;
    updates.profileType = 'marketplace';

    const driver = await Driver.findOneAndUpdate(
      { user: req.user._id },
      { $set: updates },
      { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, data: driver, message: 'Driver profile saved' });
  } catch (error) {
    console.error('Update my driver profile error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to save driver profile' });
  }
};

exports.updateMyAvailability = async (req, res) => {
  try {
    const {
      isAvailable = true,
      status,
      availableFrom,
      availableTo,
      lookingForWork,
      visible,
      preferredLocations,
      preferredWorkTypes,
      expectedRate
    } = req.body;
    const update = {
      owner: getRentalOwnerScopeId(req.user),
      user: req.user._id,
      profileType: 'marketplace',
      status: status || (isAvailable ? 'available' : 'inactive'),
      availability: { isAvailable: Boolean(isAvailable), availableFrom, availableTo },
      'marketplace.lastAvailabilityUpdate': new Date()
    };
    if (lookingForWork !== undefined) update['marketplace.lookingForWork'] = Boolean(lookingForWork);
    if (visible !== undefined) update['marketplace.visible'] = Boolean(visible);
    if (preferredLocations !== undefined) update['marketplace.preferredLocations'] = preferredLocations;
    if (preferredWorkTypes !== undefined) update['marketplace.preferredWorkTypes'] = preferredWorkTypes;
    if (expectedRate !== undefined) update['marketplace.expectedRate'] = expectedRate;

    const driver = await Driver.findOneAndUpdate(
      { user: req.user._id },
      { $set: update, $setOnInsert: { fullName: req.user.fullName, phone: req.user.phone, email: req.user.email } },
      { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.status(200).json({ success: true, data: driver, message: 'Availability updated' });
  } catch (error) {
    console.error('Update my availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to update availability' });
  }
};

// Get single driver
exports.getDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id)
      .populate('assignedVehicle');

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check ownership
    if (!canAccessDriver(driver, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: driver
    });
  } catch (error) {
    console.error('Get driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch driver'
    });
  }
};

// Create new driver
exports.createDriver = async (req, res) => {
  try {
    const requiredFields = ['fullName', 'phone', 'licenseNumber', 'licenseClass', 'licenseExpiry'];
    const missing = requiredFields.filter(field => !req.body[field]);
    if (missing.length) {
      return res.status(400).json({
        success: false,
        message: `Missing required driver fields: ${missing.join(', ')}`
      });
    }

    const driverData = {
      ...req.body,
      owner: getRentalOwnerScopeId(req.user),
      profileType: 'managed'
    };

    const driver = new Driver(driverData);
    await driver.save();

    res.status(201).json({
      success: true,
      data: driver,
      message: 'Driver added successfully'
    });
  } catch (error) {
    console.error('Create driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create driver'
    });
  }
};

// Update driver
exports.updateDriver = async (req, res) => {
  try {
    let driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check ownership
    if (!canAccessDriver(driver, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    driver = await Driver.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: driver,
      message: 'Driver updated successfully'
    });
  } catch (error) {
    console.error('Update driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update driver'
    });
  }
};

// Delete driver
exports.deleteDriver = async (req, res) => {
  try {
    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check ownership
    if (!canAccessDriver(driver, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Check if driver is assigned to a vehicle
    if (driver.assignedVehicle) {
      // Remove driver assignment from vehicle
      await Vehicle.findByIdAndUpdate(driver.assignedVehicle, {
        $unset: { assignedDriver: 1 }
      });
    }

    await Driver.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Driver deleted successfully'
    });
  } catch (error) {
    console.error('Delete driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete driver'
    });
  }
};

// Update driver status
exports.updateDriverStatus = async (req, res) => {
  try {
    const { status, availableFrom, availableTo } = req.body;

    const driver = await Driver.findById(req.params.id);

    if (!driver) {
      return res.status(404).json({
        success: false,
        message: 'Driver not found'
      });
    }

    // Check ownership
    if (!canAccessDriver(driver, req.user)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    driver.status = status;
    driver.availability.isAvailable = status === 'available';
    
    if (availableFrom) driver.availability.availableFrom = availableFrom;
    if (availableTo) driver.availability.availableTo = availableTo;

    await driver.save();

    res.status(200).json({
      success: true,
      data: driver,
      message: 'Driver status updated successfully'
    });
  } catch (error) {
    console.error('Update driver status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update driver status'
    });
  }
};
