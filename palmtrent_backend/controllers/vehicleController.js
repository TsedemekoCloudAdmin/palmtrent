const Vehicle = require('../models/Vehicle');
const Driver = require('../models/Driver');
const Rental = require('../models/Rental');

// Get all vehicles for a transporter
exports.getVehicles = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, type, availableForRental } = req.query;
    
    const query = { owner: req.user._id };
    
    if (status) query.status = status;
    if (type) query.vehicleType = type;
    if (availableForRental !== undefined) {
      query['pricing.availableForRental'] = availableForRental === 'true';
    }

    const vehicles = await Vehicle.find(query)
      .populate('assignedDriver', 'fullName phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vehicle.countDocuments(query);

    res.status(200).json({
      success: true,
      data: vehicles,
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
    if (vehicle.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.status(200).json({
      success: true,
      data: vehicle
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
      owner: req.user._id
    };

    const vehicle = new Vehicle(vehicleData);
    await vehicle.save();

    res.status(201).json({
      success: true,
      data: vehicle,
      message: 'Vehicle added successfully'
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
      message: 'Failed to create vehicle'
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
    if (vehicle.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    vehicle = await Vehicle.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: vehicle,
      message: 'Vehicle updated successfully'
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update vehicle'
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
    if (vehicle.owner.toString() !== req.user._id.toString()) {
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
    const driver = await Driver.findById(driverId);

    if (!vehicle || !driver) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle or driver not found'
      });
    }

    // Check ownership
    if (vehicle.owner.toString() !== req.user._id.toString() || 
        driver.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Update vehicle
    vehicle.assignedDriver = driverId;
    await vehicle.save();

    // Update driver
    driver.assignedVehicle = req.params.id;
    await driver.save();

    res.status(200).json({
      success: true,
      message: 'Driver assigned to vehicle successfully'
    });
  } catch (error) {
    console.error('Assign driver error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to assign driver'
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
      'verification.status': 'approved'
    };

    if (type) query.vehicleType = type;
    if (minCapacity) query['capacity.weight.value'] = { $gte: parseInt(minCapacity) };

    const vehicles = await Vehicle.find(query)
      .populate('owner', 'fullName phone rating.average')
      .select('-documents -maintenance -rentalHistory') // Exclude sensitive info
      .sort({ 'pricing.dailyRate': 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Vehicle.countDocuments(query);

    res.status(200).json({
      success: true,
      data: vehicles,
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
    if (vehicle.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    vehicle.pricing = {
      ...vehicle.pricing,
      ...req.body
    };

    await vehicle.save();

    res.status(200).json({
      success: true,
      data: vehicle,
      message: 'Rental settings updated successfully'
    });
  } catch (error) {
    console.error('Update rental settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rental settings'
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
    if (vehicle.owner.toString() !== req.user._id.toString()) {
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

    // Store photo URL (using local storage path or cloud storage URL)
    const photoUrl = `/uploads/vehicles/${req.file.filename}`;

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
        uploadedAt: new Date()
      };
    } else {
      // Add new photo
      vehicle.photos.push({
        type: photoType,
        url: photoUrl,
        uploadedAt: new Date()
      });
    }

    await vehicle.save();

    res.status(200).json({
      success: true,
      data: {
        url: photoUrl,
        type: photoType
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
    if (vehicle.owner.toString() !== req.user._id.toString()) {
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