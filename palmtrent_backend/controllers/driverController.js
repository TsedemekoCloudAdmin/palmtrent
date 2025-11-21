const Driver = require('../models/Driver');
const Vehicle = require('../models/Vehicle');

// Get all drivers for a transporter
exports.getDrivers = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { owner: req.user._id };
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
    if (driver.owner.toString() !== req.user._id.toString()) {
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
    const driverData = {
      ...req.body,
      owner: req.user._id
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
    if (driver.owner.toString() !== req.user._id.toString()) {
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
    if (driver.owner.toString() !== req.user._id.toString()) {
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
    if (driver.owner.toString() !== req.user._id.toString()) {
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