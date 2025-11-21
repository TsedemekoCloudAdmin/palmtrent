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