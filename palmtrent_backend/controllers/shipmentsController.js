const Shipment = require('../models/Shipment');
const Booking = require('../models/Booking');
const Rating = require('../models/Rating');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { assertShipmentTransition } = require('../services/flowControlService');
const { recordAudit } = require('../services/auditService');
const { finalizeUploadedFiles } = require('../services/uploadFinalizationService');
const podService = require('../services/podService');

const canReadShipment = (shipment, user) => {
  if (user.userType === 'admin') return true;
  const userId = user._id?.toString() || user.id?.toString();
  return [shipment.shipper, shipment.transporter]
    .filter(Boolean)
    .some(party => party.toString() === userId);
};

const getReadablePODShipment = async (shipmentId, user) => {
  const shipment = await Shipment.findById(shipmentId).populate('booking');
  if (!shipment) return { shipment: null, status: 404, message: 'Shipment not found' };
  if (!canReadShipment(shipment, user)) {
    return { shipment: null, status: 403, message: 'Not authorized to access this shipment' };
  }
  if (!shipment.booking && shipment.bookingReference) {
    shipment.booking = await Booking.findOne({ bookingReference: shipment.bookingReference });
  }
  if (!shipment.booking) {
    return { shipment: null, status: 409, message: 'Proof of delivery document requires a booking-backed shipment' };
  }
  if (!shipment.deliveryDetails?.signature && !shipment.proofOfDelivery?.signature) {
    return { shipment: null, status: 409, message: 'Proof of delivery evidence has not been confirmed' };
  }
  return { shipment };
};

// Get all active shipments for user
exports.getActiveShipments = async (req, res) => {
  try {
    const user = req.user;
    
    let query = {};
    
    // Different logic based on user type
    if (user.userType === 'shipper' || user.userType === 'corporate') {
      query = { 
        shipper: user._id, 
        status: { $in: ['assigned', 'matched', 'en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery'] } 
      };
    } else if (user.userType === 'transporter') {
      query = { 
        transporter: user._id, 
        status: { $in: ['assigned', 'matched', 'en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery'] } 
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

    const query = req.user.userType === 'transporter'
      ? { transporter: req.user.id }
      : { shipper: req.user.id };
    
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
      .select('shipper status route currentLocation schedule pricing tracking');

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

    const oldStatus = shipment.status;
    assertShipmentTransition(oldStatus, status);
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

exports.uploadProofOfDelivery = async (req, res) => {
  try {
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    if (!shipment.transporter || shipment.transporter.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to upload proof for this shipment' });
    }

    const finalizedFiles = await finalizeUploadedFiles(req.files || [], 'pod');
    const uploadedFiles = finalizedFiles.map(file => file.url);
    shipment.proofOfDelivery = {
      ...shipment.proofOfDelivery,
      photos: [...(shipment.proofOfDelivery?.photos || []), ...uploadedFiles],
      signature: req.body.signature || shipment.proofOfDelivery?.signature,
      receivedBy: req.body.receivedBy || req.body.receiverName || shipment.proofOfDelivery?.receivedBy,
      receivedAt: req.body.receivedAt ? new Date(req.body.receivedAt) : shipment.proofOfDelivery?.receivedAt,
      notes: req.body.notes || shipment.proofOfDelivery?.notes
    };

    await shipment.save();

    await recordAudit({
      actor: req.user,
      action: 'shipment.pod_uploaded',
      entityType: 'Shipment',
      entityId: shipment._id,
      entityRef: shipment.bookingReference,
      after: {
        photoCount: uploadedFiles.length,
        hasSignature: Boolean(req.body.signature),
        receivedBy: req.body.receivedBy || req.body.receiverName
      },
      metadata: { notes: req.body.notes },
      req
    });
    res.json({ success: true, message: 'Proof of delivery uploaded', data: shipment.proofOfDelivery });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to upload proof of delivery', error: error.message });
  }
};

exports.getProofOfDeliveryDocument = async (req, res) => {
  try {
    const result = await getReadablePODShipment(req.params.id, req.user);
    if (!result.shipment) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    const pod = await podService.ensurePDFFromShipment(result.shipment, result.shipment.booking);
    const download = await podService.getDownloadData(pod);

    res.json({
      success: true,
      data: download
    });
  } catch (error) {
    console.error('POD document error:', error);
    res.status(500).json({ success: false, message: 'Failed to prepare proof of delivery document' });
  }
};

exports.emailProofOfDeliveryDocument = async (req, res) => {
  try {
    const email = String(req.body.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid recipient email is required' });
    }

    const result = await getReadablePODShipment(req.params.id, req.user);
    if (!result.shipment) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    const pod = await podService.ensurePDFFromShipment(result.shipment, result.shipment.booking);
    const delivery = await podService.emailPOD(pod._id, email);

    res.json({
      success: true,
      message: delivery.message,
      data: {
        podReference: pod.podReference,
        email
      }
    });
  } catch (error) {
    console.error('POD email error:', error);
    res.status(500).json({ success: false, message: 'Failed to email proof of delivery document' });
  }
};

exports.rateShipment = async (req, res) => {
  try {
    const { rating, review, comment } = req.body;
    const shipment = await Shipment.findById(req.params.id);
    if (!shipment) {
      return res.status(404).json({ success: false, message: 'Shipment not found' });
    }

    const userId = req.user.id;
    const isShipper = shipment.shipper?.toString() === userId;
    const isTransporter = shipment.transporter?.toString() === userId;
    if (!isShipper && !isTransporter) {
      return res.status(403).json({ success: false, message: 'Not authorized to rate this shipment' });
    }

    const ratee = isShipper ? shipment.transporter : shipment.shipper;
    if (!ratee) {
      return res.status(400).json({ success: false, message: 'No counterparty available to rate' });
    }

    const ratingDoc = await Rating.create({
      booking: shipment.booking,
      rater: { user: userId, role: isShipper ? 'shipper' : 'transporter' },
      ratee: { user: ratee, role: isShipper ? 'transporter' : 'shipper' },
      overallRating: Number(rating),
      review: { text: review || comment || '' },
      tripDetails: {
        distance: shipment.route?.distance,
        origin: shipment.route?.pickup?.address || shipment.origin,
        destination: shipment.route?.delivery?.address || shipment.destination,
        cargoType: shipment.cargoDetails?.type,
        completedAt: shipment.completedAt || shipment.timeline?.deliveredAt
      }
    });

    shipment.rating = Number(rating);
    await shipment.save();

    await recordAudit({
      actor: req.user,
      action: 'shipment.rated',
      entityType: 'Shipment',
      entityId: shipment._id,
      entityRef: shipment.bookingReference,
      after: {
        rating: Number(rating),
        ratee: ratee.toString()
      },
      req
    });

    res.status(201).json({ success: true, message: 'Rating submitted', data: ratingDoc });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit rating', error: error.message });
  }
};

exports.getShipmentAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const startDate = new Date();
    if (period === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
    else startDate.setMonth(startDate.getMonth() - 1);

    const match = {
      createdAt: { $gte: startDate },
      ...(req.user.userType === 'transporter' ? { transporter: req.user._id } : { shipper: req.user._id })
    };

    const shipments = await Shipment.find(match).lean();
    const completed = shipments.filter(s => ['completed', 'delivered'].includes(s.status));
    const totalAmount = shipments.reduce((sum, s) => sum + (s.amount || s.pricing?.total || 0), 0);

    res.json({
      success: true,
      data: {
        period,
        totalShipments: shipments.length,
        activeShipments: shipments.filter(s => !['completed', 'cancelled'].includes(s.status)).length,
        completedShipments: completed.length,
        completionRate: shipments.length ? Math.round((completed.length / shipments.length) * 100) : 0,
        totalAmount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch shipment analytics', error: error.message });
  }
};
