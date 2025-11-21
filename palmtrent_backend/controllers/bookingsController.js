const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const { validationResult } = require('express-validator');

// Get all bookings for current user - Merged
exports.getAllBookings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { user: req.user.id };
    
    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    const bookings = await Booking.find(query)
      .populate('transporter', 'fullName phone rating')
      .populate('shipments')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      count: bookings.length,
      total,
      pages: Math.ceil(total / limit),
      currentPage: page,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching bookings',
      error: error.message
    });
  }
};

// Get booking details - Merged
exports.getBookingById = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('user', 'fullName phone email companyName')
      .populate('transporter', 'fullName phone rating avatar')
      .populate('shipments')
      .populate('vehicles.vehicle', 'type registrationNumber capacity');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check authorization
    if (booking.user._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this booking'
      });
    }

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching booking details',
      error: error.message
    });
  }
};

// Create new booking - Merged
exports.createBooking = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const bookingData = {
      ...req.body,
      user: req.user.id,
      shipper: req.user.id,
      status: 'draft'
    };

    // Calculate pricing
    const pricing = calculatePricing(bookingData);
    bookingData.pricing = pricing;

    const booking = await Booking.create(bookingData);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating booking',
      error: error.message
    });
  }
};

// Update booking (for multi-step flow) - From my code
exports.updateBooking = async (req, res) => {
  try {
    let booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this booking'
      });
    }

    // Recalculate pricing if relevant fields changed
    if (shouldRecalculatePricing(req.body)) {
      req.body.pricing = calculatePricing({
        ...booking.toObject(),
        ...req.body
      });
    }

    booking = await Booking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating booking',
      error: error.message
    });
  }
};

// Confirm payment for booking - From your code
exports.confirmPayment = async (req, res) => {
  try {
    const { paymentReference, paymentMethod } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    if (booking.status !== 'draft' && booking.status !== 'pending_payment') {
      return res.status(400).json({
        success: false,
        message: 'Booking payment already processed'
      });
    }

    // Update payment status
    booking.payment = {
      method: paymentMethod,
      reference: paymentReference,
      status: 'confirmed',
      paidAt: new Date()
    };
    booking.status = 'payment_confirmed';

    await booking.save();

    // Create shipment from booking
    const shipmentData = createShipmentFromBooking(booking);
    const shipment = await Shipment.create(shipmentData);

    // Update booking with shipment reference
    booking.shipments.push(shipment._id);
    await booking.save();

    // TODO: Trigger matching algorithm to find transporters

    res.status(200).json({
      success: true,
      message: 'Payment confirmed. Finding transporter...',
      data: {
        booking,
        shipment
      }
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming payment',
      error: error.message
    });
  }
};

// Cancel booking - From your code
exports.cancelBooking = async (req, res) => {
  try {
    const { reason } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Check if cancellation is allowed
    if (['delivered', 'completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel booking in current status'
      });
    }

    booking.status = 'cancelled';
    booking.cancellation = {
      cancelled: true,
      cancelledBy: req.user.id,
      reason: reason,
      cancelledAt: new Date()
    };

    await booking.save();

    // TODO: Process refund if applicable
    // TODO: Cancel associated shipments

    res.status(200).json({
      success: true,
      message: 'Booking cancelled successfully',
      data: booking
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling booking',
      error: error.message
    });
  }
};

// Confirm booking and create shipment - From my code
exports.confirmBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if user owns this booking
    if (booking.user.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to confirm this booking'
      });
    }

    // Validate booking is complete
    if (!isBookingComplete(booking)) {
      return res.status(400).json({
        success: false,
        message: 'Booking is not complete. Please fill all required fields.'
      });
    }

    // Update booking status
    booking.status = 'pending_payment';
    await booking.save();

    res.status(200).json({
      success: true,
      data: booking,
      message: 'Booking confirmed. Please proceed to payment.'
    });
  } catch (error) {
    console.error('Error confirming booking:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming booking',
      error: error.message
    });
  }
};

// Helper functions
function calculatePricing(bookingData) {
  let baseTransportFee = bookingData.pricing?.baseTransportFee || 400;

  // Multiple vehicles pricing
  if (bookingData.bookingType === 'multiple' && bookingData.vehicles) {
    baseTransportFee = bookingData.vehicles.length * 400;
    
    // Apply volume discount
    const discount = bookingData.vehicles.length >= 5 ? 0.15 : 
                    bookingData.vehicles.length >= 3 ? 0.10 : 0;
    baseTransportFee = baseTransportFee * (1 - discount);
  }

  // Cross-border pricing
  if (bookingData.crossBorder?.enabled) {
    baseTransportFee += 130; // $50 surcharge + $50 insurance + $30 documentation
  }

  const platformFeeRate = 0.12;
  const platformFee = baseTransportFee * platformFeeRate;
  
  let insurance = 0;
  if (bookingData.insurance?.required && bookingData.cargoDetails?.value) {
    insurance = bookingData.cargoDetails.value * 0.0045; // 0.45%
  }

  const subtotal = baseTransportFee + platformFee + insurance;
  
  return {
    baseTransportFee: Math.round(baseTransportFee),
    platformFee: Math.round(platformFee),
    platformFeeRate,
    insurance: Math.round(insurance),
    subtotal: Math.round(subtotal),
    total: Math.round(subtotal)
  };
}

function shouldRecalculatePricing(updatedFields) {
  const pricingRelatedFields = [
    'bookingType', 'vehicles', 'crossBorder', 'insurance', 'cargoDetails'
  ];
  return pricingRelatedFields.some(field => field in updatedFields);
}

function isBookingComplete(booking) {
  return booking.cargoDetails?.type &&
         booking.cargoDetails?.weight &&
         booking.route?.pickup?.address &&
         booking.route?.delivery?.address &&
         booking.route?.pickup?.date;
}

function createShipmentFromBooking(booking) {
  return {
    bookingReference: booking.bookingReference,
    shipper: booking.shipper,
    status: 'payment_confirmed',
    cargoDetails: booking.cargoDetails,
    route: booking.route,
    schedule: {
      pickupDate: booking.route.pickup.date,
      scheduledPickupTime: booking.route.pickup.date
    },
    pricing: booking.pricing,
    payment: booking.payment,
    insurance: booking.insurance,
    isCrossBorder: booking.crossBorder?.enabled || false,
    crossBorderDetails: booking.crossBorder,
    bookingType: booking.bookingType,
    multipleVehicles: booking.vehicles,
    coordination: booking.coordination
  };
}