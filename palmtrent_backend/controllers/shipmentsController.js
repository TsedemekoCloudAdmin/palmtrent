const Shipment = require('../models/Shipment');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Get all active shipments for user
exports.getActiveShipments = async (req, res) => {
  try {
    const user = req.user;
    
    let query = {};
    
    // Different logic based on user type
    if (user.userType === 'shipper') {
      query = { 
        shipper: user._id, 
        status: { $in: ['payment_confirmed', 'matched', 'in_transit'] } 
      };
    } else if (user.userType === 'transporter') {
      query = { 
        transporter: user._id, 
        status: { $in: ['matched', 'in_transit'] } 
      };
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type for shipments'
      });
    }

    const shipments = await Shipment.find(query)
      .populate('shipper', 'fullName phone rating companyName')
      .populate('transporter', 'fullName phone rating')
      .populate('vehicle', 'type registrationNumber capacity')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: shipments.length,
      data: shipments
    });
  } catch (error) {
    console.error('Error fetching active shipments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching shipments',
      error: error.message
    });
  }
};

// Get all shipments (with pagination) - From your code
exports.getAllShipments = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { shipper: req.user.id };
    
    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    const shipments = await Shipment.find(query)
      .populate('transporter', 'fullName phone rating')
      .populate('vehicle', 'type registrationNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Shipment.countDocuments(query);

    res.status(200).json({
      success: true,
      count: shipments.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      data: shipments
    });
  } catch (error) {
    console.error('Error fetching shipments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching shipments',
      error: error.message
    });
  }
};

// Get single shipment details - Merged
exports.getShipmentById = async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id)
      .populate('shipper', 'fullName phone email companyName')
      .populate('transporter', 'fullName phone rating avatar')
      .populate('vehicle', 'type registrationNumber capacity');

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    // Check authorization
    if (shipment.shipper._id.toString() !== req.user.id && 
        (!shipment.transporter || shipment.transporter._id.toString() !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this shipment'
      });
    }

    res.status(200).json({
      success: true,
      data: shipment
    });
  } catch (error) {
    console.error('Error fetching shipment:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching shipment details',
      error: error.message
    });
  }
};

// Track shipment (real-time location and status) - From your code
exports.trackShipment = async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id)
      .populate('transporter', 'fullName phone avatar')
      .populate('vehicle', 'type registrationNumber')
      .select('status route currentLocation schedule pricing tracking');

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    // Check authorization
    if (shipment.shipper.toString() !== req.user.id && 
        (!shipment.transporter || shipment.transporter._id.toString() !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to track this shipment'
      });
    }

    // Calculate progress based on status and tracking
    let progress = 0;
    switch (shipment.status) {
      case 'payment_confirmed':
        progress = 10;
        break;
      case 'matched':
        progress = 30;
        break;
      case 'in_transit':
        progress = 60;
        break;
      case 'delivered':
        progress = 90;
        break;
      case 'completed':
        progress = 100;
        break;
      default:
        progress = 0;
    }

    res.status(200).json({
      success: true,
      data: {
        id: shipment._id,
        shipmentId: shipment.shipmentId,
        status: shipment.status,
        progress,
        route: shipment.route,
        currentLocation: shipment.currentLocation,
        schedule: shipment.schedule,
        pricing: shipment.pricing,
        transporter: shipment.transporter,
        vehicle: shipment.vehicle,
        tracking: shipment.tracking
      }
    });
  } catch (error) {
    console.error('Error tracking shipment:', error);
    res.status(500).json({
      success: false,
      message: 'Error tracking shipment',
      error: error.message
    });
  }
};

// Update shipment location (for transporters) - From your code
exports.updateLocation = async (req, res) => {
  try {
    const { latitude, longitude, note } = req.body;

    const shipment = await Shipment.findById(req.params.id);

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    // Check if user is the assigned transporter
    if (!shipment.transporter || shipment.transporter.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this shipment'
      });
    }

    // Update current location
    shipment.currentLocation = {
      type: 'Point',
      coordinates: [longitude, latitude]
    };

    // Add to tracking history
    shipment.tracking.push({
      location: {
        type: 'Point',
        coordinates: [longitude, latitude]
      },
      timestamp: new Date(),
      event: 'location_updated',
      note: note || 'Location updated'
    });

    await shipment.save();

    res.status(200).json({
      success: true,
      message: 'Location updated successfully',
      data: {
        currentLocation: shipment.currentLocation,
        timestamp: new Date()
      }
    });
  } catch (error) {
    console.error('Error updating location:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating location',
      error: error.message
    });
  }
};

// Update shipment status - From your code
exports.updateStatus = async (req, res) => {
  try {
    const { status, notes } = req.body;
    
    const shipment = await Shipment.findById(req.params.id);

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    // Authorization check
    if (!shipment.transporter || shipment.transporter.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this shipment'
      });
    }

    // Validate status transition
    const validTransitions = {
      'matched': ['in_transit', 'cancelled'],
      'in_transit': ['delivered', 'incident'],
      'delivered': ['completed']
    };

    if (!validTransitions[shipment.status]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from ${shipment.status} to ${status}`
      });
    }

    const oldStatus = shipment.status;
    shipment.status = status;
    
    // Update specific timestamps based on status
    if (status === 'in_transit') {
      shipment.schedule.actualPickupTime = new Date();
    } else if (status === 'delivered') {
      shipment.schedule.actualDeliveryTime = new Date();
    }

    // Add status history
    shipment.statusHistory.push({
      status,
      timestamp: new Date(),
      notes: notes || `Status changed from ${oldStatus} to ${status}`
    });

    await shipment.save();

    res.status(200).json({
      success: true,
      message: 'Status updated successfully',
      data: shipment
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating shipment status',
      error: error.message
    });
  }
};

// Create new shipment from booking - From my code
exports.createShipment = async (req, res) => {
  try {
    const user = req.user;
    const shipmentData = req.body;

    // Add shipper to shipment data
    shipmentData.shipper = user._id;

    const shipment = await Shipment.create(shipmentData);

    res.status(201).json({
      success: true,
      data: shipment
    });
  } catch (error) {
    console.error('Error creating shipment:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating shipment',
      error: error.message
    });
  }
};