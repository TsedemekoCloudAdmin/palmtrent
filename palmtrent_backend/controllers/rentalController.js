const Rental = require('../models/Rental');
const Vehicle = require('../models/Vehicle');
const Trailer = require('../models/Trailer');
const User = require('../models/User');

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
    const results = { vehicles: [], trailers: [] };

    // Get available vehicles
    if (!itemType || itemType === 'vehicle') {
      const vehicleQuery = {
        'rentalSettings.availableForRental': true,
        status: 'available'
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

    // Get available trailers
    if (!itemType || itemType === 'trailer') {
      const trailerQuery = {
        'rentalSettings.availableForRental': true,
        status: 'available'
      };

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

      results.trailers = trailers.map(t => ({
        _id: t._id,
        itemType: 'trailer',
        registrationNumber: t.registrationNumber,
        trailerType: t.trailerType?.name || 'Unknown',
        capacity: t.capacity,
        features: t.features,
        images: t.images,
        owner: t.owner,
        rentalSettings: t.rentalSettings,
        operatingAreas: t.operatingAreas,
        rating: t.rating
      }));
    }

    // Combined results for mixed listing
    const combined = [...results.vehicles, ...results.trailers];

    res.status(200).json({
      success: true,
      data: itemType ? (itemType === 'vehicle' ? results.vehicles : results.trailers) : combined,
      vehicles: results.vehicles,
      trailers: results.trailers,
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

// Get rental details
exports.getRentalDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { itemType } = req.query;

    let item;
    if (itemType === 'trailer') {
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
    if (itemType === 'trailer') {
      item = await Trailer.findById(itemId);
    } else {
      item = await Vehicle.findById(itemId);
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `${itemType === 'trailer' ? 'Trailer' : 'Vehicle'} not found`
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
    const platformFee = Math.round(subtotal * 0.10 * 100) / 100; // 10% platform fee
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
    if (itemType === 'trailer') {
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
    res.status(500).json({
      success: false,
      message: 'Failed to create rental request'
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
      .populate('trailer', 'registrationNumber images rentalSettings')
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
      .populate('trailer', 'registrationNumber images')
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
    rental.statusHistory.push({
      status: 'approved',
      changedBy: req.user.id,
      notes: 'Rental approved by owner'
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
    if (rental.itemType === 'trailer') {
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

    // Update item status back to available
    if (rental.itemType === 'trailer') {
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
      .populate('trailer', 'registrationNumber images rentalSettings trailerType currentLocation')
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
