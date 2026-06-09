const Trailer = require('../models/Trailer');
const Rental = require('../models/Rental');
const TrailerType = require('../models/TrailerType');

const isObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || ''));
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Clients may send trailerType as a human label ("Flatbed") rather than an
// ObjectId. Resolve (or create) the matching TrailerType so it persists.
async function resolveTrailerTypeId(value) {
  if (!value || isObjectId(value)) return value || undefined;
  const name = String(value).trim();
  if (!name) return undefined;
  const lower = name.toLowerCase();
  const category = lower.includes('flat') ? 'flatbed'
    : lower.includes('reefer') || lower.includes('refriger') ? 'refrigerated'
      : lower.includes('tank') ? 'tanker'
        : lower.includes('enclos') || lower.includes('box') || lower.includes('curtain') ? 'enclosed'
          : 'specialized';
  const doc = await TrailerType.findOneAndUpdate(
    { name: new RegExp(`^${escapeRegex(name)}$`, 'i') },
    { $setOnInsert: { name, category } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return doc._id;
}
const {
  assertRentalOwnerCanList,
  getRentalOwnerSubscriptionIssues,
  getUsableRentalOwnerIds
} = require('../services/flowControlService');
const { canAccessRentalOwnerResource, getRentalOwnerScopeId } = require('../services/resourceAccessService');

const RENTAL_SUBSCRIPTION_NOTICE = 'Fleet asset registered, but rental marketplace listing is disabled until you activate a paid owner subscription.';

function wantsTrailerRentalListing(payload = {}) {
  return payload.rentalSettings?.availableForRental !== false;
}

function disableTrailerRentalListing(payload) {
  payload.rentalSettings = {
    ...(payload.rentalSettings || {}),
    availableForRental: false
  };
}

// @desc    Get all trailers for the current owner
// @route   GET /api/v1/trailers/my-trailers
// @access  Private
exports.getMyTrailers = async (req, res) => {
  try {
    const { status, search, assetType } = req.query;

    const ownerScopeId = getRentalOwnerScopeId(req.user);
    let query = { owner: ownerScopeId };

    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }

    if (assetType && assetType !== 'all') {
      query.assetType = assetType;
    }

    // Search by registration number or description
    if (search) {
      query.$or = [
        { registrationNumber: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const trailers = await Trailer.find(query)
      .populate('trailerType', 'name category')
      .sort({ createdAt: -1 });

    // Get stats
    const stats = {
      total: await Trailer.countDocuments({ owner: ownerScopeId }),
      trailers: await Trailer.countDocuments({ owner: ownerScopeId, assetType: 'trailer' }),
      tractorUnits: await Trailer.countDocuments({ owner: ownerScopeId, assetType: 'tractor_unit' }),
      trucks: await Trailer.countDocuments({ owner: ownerScopeId, assetType: 'truck' }),
      fullRigs: await Trailer.countDocuments({ owner: ownerScopeId, assetType: 'full_rig' }),
      available: await Trailer.countDocuments({ owner: ownerScopeId, status: 'available' }),
      rented: await Trailer.countDocuments({ owner: ownerScopeId, status: 'rented' }),
      inUse: await Trailer.countDocuments({ owner: ownerScopeId, status: 'in_use' }),
      maintenance: await Trailer.countDocuments({ owner: ownerScopeId, status: 'maintenance' })
    };
    const subscriptionIssues = await getRentalOwnerSubscriptionIssues(ownerScopeId);
    const rentalListingsBlocked = subscriptionIssues.length
      ? await Trailer.countDocuments({
          owner: ownerScopeId,
          'rentalSettings.availableForRental': true
        })
      : 0;

    res.status(200).json({
      success: true,
      count: trailers.length,
      stats,
      rentalMarketplaceNotice: rentalListingsBlocked > 0
        ? `${rentalListingsBlocked} fleet rental listing${rentalListingsBlocked === 1 ? ' is' : 's are'} hidden from the marketplace until you activate a paid owner subscription.`
        : undefined,
      data: trailers
    });
  } catch (error) {
    console.error('Error fetching trailers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trailers',
      error: error.message
    });
  }
};

// @desc    Get single trailer
// @route   GET /api/v1/trailers/:id
// @access  Private
exports.getTrailerById = async (req, res) => {
  try {
    const trailer = await Trailer.findById(req.params.id)
      .populate('trailerType', 'name category description')
      .populate('owner', 'name phone email')
      .populate({ path: 'currentRental', populate: { path: 'renter', select: 'fullName phone' } });

    if (!trailer) {
      return res.status(404).json({
        success: false,
        message: 'Trailer not found'
      });
    }

    // Get rental history
    const rentalHistory = await Rental.find({
      trailer: trailer._id,
      status: { $in: ['completed', 'cancelled'] }
    })
      .populate('renter', 'name')
      .sort({ createdAt: -1 })
      .limit(10);

    res.status(200).json({
      success: true,
      data: {
        ...trailer.toObject(),
        rentalHistory
      }
    });
  } catch (error) {
    console.error('Error fetching trailer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trailer',
      error: error.message
    });
  }
};

// @desc    Create new trailer
// @route   POST /api/v1/trailers
// @access  Private
exports.createTrailer = async (req, res) => {
  try {
    // Add owner to request body
    req.body.owner = getRentalOwnerScopeId(req.user);
    req.body.createdBy = req.user.id;

    const payload = {
      ...req.body,
      assetType: req.body.assetType || 'trailer'
    };

    // Accept a trailerType label or id and store it as a proper reference.
    if (payload.trailerType) {
      payload.trailerType = await resolveTrailerTypeId(payload.trailerType);
    }

    if (payload.assetType !== 'trailer' && !payload.assetName) {
      payload.assetName = `${payload.tractorUnit?.make || 'Fleet'} ${payload.tractorUnit?.model || 'Asset'}`.trim();
    }

    let message = 'Fleet asset registered successfully';
    if (wantsTrailerRentalListing(payload)) {
      const subscriptionIssues = await getRentalOwnerSubscriptionIssues(getRentalOwnerScopeId(req.user));
      if (subscriptionIssues.length) {
        disableTrailerRentalListing(payload);
        message = RENTAL_SUBSCRIPTION_NOTICE;
      }
    }

    const trailer = await Trailer.create(payload);

    res.status(201).json({
      success: true,
      message,
      data: trailer
    });
  } catch (error) {
    console.error('Error creating trailer:', error);

    // Handle duplicate registration number
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'A trailer with this registration number already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to register trailer',
      error: error.message
    });
  }
};

// @desc    Update trailer
// @route   PUT /api/v1/trailers/:id
// @access  Private
exports.updateTrailer = async (req, res) => {
  try {
    let trailer = await Trailer.findById(req.params.id);

    if (!trailer) {
      return res.status(404).json({
        success: false,
        message: 'Trailer not found'
      });
    }

    // Make sure user is trailer owner
    if (!canAccessRentalOwnerResource(req.user, trailer.owner)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this trailer'
      });
    }

    // Add updatedBy
    const payload = {
      ...req.body,
      updatedBy: req.user.id
    };

    if (payload.trailerType) {
      payload.trailerType = await resolveTrailerTypeId(payload.trailerType);
    }

    if (payload.rentalSettings?.availableForRental === true) {
      await assertRentalOwnerCanList(getRentalOwnerScopeId(req.user));
    }

    trailer = await Trailer.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    }).populate('trailerType', 'name category');

    res.status(200).json({
      success: true,
      message: 'Trailer updated successfully',
      data: trailer
    });
  } catch (error) {
    console.error('Error updating trailer:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to update trailer',
      error: error.message
    });
  }
};

// @desc    Delete trailer
// @route   DELETE /api/v1/trailers/:id
// @access  Private
exports.deleteTrailer = async (req, res) => {
  try {
    const trailer = await Trailer.findById(req.params.id);

    if (!trailer) {
      return res.status(404).json({
        success: false,
        message: 'Trailer not found'
      });
    }

    // Make sure user is trailer owner
    if (!canAccessRentalOwnerResource(req.user, trailer.owner)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this trailer'
      });
    }

    // Check if trailer has active rentals
    if (trailer.status === 'rented') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete trailer that is currently rented'
      });
    }

    await trailer.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Trailer deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting trailer:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete trailer',
      error: error.message
    });
  }
};

// @desc    Update trailer status
// @route   PATCH /api/v1/trailers/:id/status
// @access  Private
exports.updateTrailerStatus = async (req, res) => {
  try {
    const { status } = req.body;

    const validStatuses = ['available', 'rented', 'in_use', 'maintenance', 'inactive'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    let trailer = await Trailer.findById(req.params.id);

    if (!trailer) {
      return res.status(404).json({
        success: false,
        message: 'Trailer not found'
      });
    }

    // Make sure user is trailer owner
    if (!canAccessRentalOwnerResource(req.user, trailer.owner)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this trailer'
      });
    }

    // Cannot change status to available if currently rented
    if (status === 'available' && trailer.currentRental) {
      return res.status(400).json({
        success: false,
        message: 'Cannot set to available while rental is active'
      });
    }

    trailer.status = status;
    trailer.updatedBy = req.user.id;
    await trailer.save();

    res.status(200).json({
      success: true,
      message: `Trailer status updated to ${status}`,
      data: trailer
    });
  } catch (error) {
    console.error('Error updating trailer status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update trailer status',
      error: error.message
    });
  }
};

// @desc    Update rental settings
// @route   PATCH /api/v1/trailers/:id/rental-settings
// @access  Private
exports.updateRentalSettings = async (req, res) => {
  try {
    let trailer = await Trailer.findById(req.params.id);

    if (!trailer) {
      return res.status(404).json({
        success: false,
        message: 'Trailer not found'
      });
    }

    // Make sure user is trailer owner
    if (!canAccessRentalOwnerResource(req.user, trailer.owner)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this trailer'
      });
    }

    if (req.body.availableForRental === true) {
      await assertRentalOwnerCanList(getRentalOwnerScopeId(req.user));
    }

    trailer.rentalSettings = {
      ...trailer.rentalSettings,
      ...req.body
    };
    trailer.updatedBy = req.user.id;
    await trailer.save();

    res.status(200).json({
      success: true,
      message: 'Rental settings updated successfully',
      data: trailer
    });
  } catch (error) {
    console.error('Error updating rental settings:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      code: error.code,
      message: error.message || 'Failed to update rental settings',
      error: error.message
    });
  }
};

// @desc    Get trailer rentals
// @route   GET /api/v1/trailers/:id/rentals
// @access  Private
exports.getTrailerRentals = async (req, res) => {
  try {
    const trailer = await Trailer.findById(req.params.id);

    if (!trailer) {
      return res.status(404).json({
        success: false,
        message: 'Trailer not found'
      });
    }

    // Make sure user is trailer owner
    if (!canAccessRentalOwnerResource(req.user, trailer.owner)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this trailer\'s rentals'
      });
    }

    const { status } = req.query;
    let query = { trailer: trailer._id, itemType: 'trailer' };

    if (status) {
      query.status = status;
    }

    const rentals = await Rental.find(query)
      .populate('renter', 'name phone email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: rentals.length,
      data: rentals
    });
  } catch (error) {
    console.error('Error fetching trailer rentals:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trailer rentals',
      error: error.message
    });
  }
};

// @desc    Get available trailers for rental (public)
// @route   GET /api/v1/trailers/available
// @access  Public
exports.getAvailableTrailers = async (req, res) => {
  try {
    const {
      trailerType,
      assetType,
      city,
      minCapacity,
      maxCapacity,
      features,
      maxDailyRate
    } = req.query;

    let query = {
      status: 'available',
      'rentalSettings.availableForRental': true,
      owner: { $in: await getUsableRentalOwnerIds() }
    };

    if (trailerType) {
      query.trailerType = trailerType;
    }

    if (assetType && assetType !== 'all') {
      query.assetType = assetType;
    }

    if (city) {
      query['operatingAreas.city'] = { $regex: city, $options: 'i' };
    }

    if (minCapacity) {
      query['capacity.weight.value'] = { $gte: Number(minCapacity) };
    }

    if (maxCapacity) {
      query['capacity.weight.value'] = {
        ...query['capacity.weight.value'],
        $lte: Number(maxCapacity)
      };
    }

    if (maxDailyRate) {
      query['rentalSettings.dailyRate'] = { $lte: Number(maxDailyRate) };
    }

    // Handle features filter
    if (features) {
      const featureList = features.split(',');
      featureList.forEach(feature => {
        query[`features.${feature.trim()}`] = true;
      });
    }

    const trailers = await Trailer.find(query)
      .populate('trailerType', 'name category')
      .populate('owner', 'name rating')
      .sort({ 'rating.average': -1 });

    res.status(200).json({
      success: true,
      count: trailers.length,
      data: trailers
    });
  } catch (error) {
    console.error('Error fetching available trailers:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available trailers',
      error: error.message
    });
  }
};
