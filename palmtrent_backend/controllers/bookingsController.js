const { randomUUID } = require('crypto');
const pricingService = require('../services/pricingService');
const distanceService = require('../services/distanceService');
const PricingConfig = require('../models/PricingConfig');
const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const whatsappController = require('./whatsappController');
const { recordAudit } = require('../services/auditService');
const ecocashOpenApiService = require('../services/ecocashOpenApiService');
const {
  assertBookingTransition,
  assertBookingReadyForMatching,
  assertCorporateCanBook,
  reserveCorporateCredit,
  releaseCorporateCredit
} = require('../services/flowControlService');

// Get all bookings for current user - Merged
exports.getAllBookings = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const ownership = [{ user: req.user.id }, { shipper: req.user.id }, { transporter: req.user.id }];
    if (req.user.corporateAccount) {
      ownership.push({ corporateAccount: req.user.corporateAccount });
    }
    const query = { $or: ownership };
    
    // Filter by status if provided
    if (req.query.status) {
      query.status = req.query.status;
    }

    const bookings = await Booking.find(query)
      .populate('transporter', 'fullName phone rating')
      .populate('user', 'fullName companyName')
      .populate('shipper', 'fullName companyName')
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
    const isOwner = booking.user?._id?.toString() === req.user.id ||
      booking.shipper?.toString?.() === req.user.id ||
      booking.transporter?._id?.toString() === req.user.id ||
      (req.user.corporateAccount && booking.corporateAccount?.toString() === req.user.corporateAccount.toString()) ||
      req.user.userType === 'admin';

    if (!isOwner) {
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

// Cash payment methods where the customer pays the transporter directly and the
// platform commission must be remitted by the transporter before job assignment.
const CASH_METHODS = ['cash', 'cash_agent', 'cash_on_pickup', 'cash_on_delivery'];

const isCashBooking = (booking) => CASH_METHODS.includes(booking?.payment?.method || booking?.paymentMethod);

const commissionAmountFor = (booking) => Number(
  booking?.pricing?.feeAllocation?.platform?.amount ||
  booking?.pricing?.breakdown?.platformFee ||
  booking?.pricing?.totals?.platformTotal ||
  booking?.pricing?.breakdown?.transporterCommission ||
  0
);

// Business documents (Purchase Order, Delivery Note, Goods Received Voucher, etc.)
// attached to a booking for compliance and audit purposes.
const BUSINESS_DOCUMENT_TYPES = ['purchase_order', 'delivery_note', 'grv', 'invoice', 'other'];

const userOwnsBooking = (booking, user) => {
  const userId = String(user.id || user._id);
  return String(booking.user?._id || booking.user) === userId ||
    String(booking.shipper || '') === userId ||
    String(booking.transporter?._id || booking.transporter || '') === userId ||
    (user.corporateAccount && String(booking.corporateAccount || '') === String(user.corporateAccount)) ||
    user.userType === 'admin';
};

// Commission remittance for cash jobs. A transporter calls this to remit
// Palmtrent's commission before accepting a cash booking. Creates a dedicated
// commission Payment (separate from the customer's cash payment) and marks the
// booking's commission as pending. When that payment is confirmed the commission
// flips to 'paid' (see paymentService.finalizeConfirmedCommissionPayment).
exports.payBookingCommission = async (req, res) => {
  try {
    const Payment = require('../models/Payment');
    const { paymentMethod = 'cash_agent' } = req.body;

    if (req.user.userType !== 'transporter') {
      return res.status(403).json({ success: false, message: 'Only transporters remit commission.' });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (!isCashBooking(booking)) {
      return res.status(400).json({ success: false, message: 'Commission remittance only applies to cash bookings.' });
    }
    if (booking.commission?.status === 'paid') {
      return res.status(400).json({ success: false, message: 'Commission has already been paid for this booking.' });
    }

    const amount = commissionAmountFor(booking);
    if (!(amount > 0)) {
      return res.status(400).json({ success: false, message: 'Commission amount could not be determined for this booking.' });
    }

    const payment = await Payment.create({
      booking: booking._id,
      amount,
      currency: booking.pricing?.currency || 'USD',
      method: CASH_METHODS.includes(paymentMethod) ? paymentMethod : 'cash_agent',
      status: 'pending',
      customer: { phone: req.user.phone, email: req.user.email },
      metadata: { purpose: 'commission', transporter: String(req.user.id || req.user._id) }
    });

    booking.commission = {
      required: true,
      amount,
      status: 'pending',
      paymentReference: payment.paymentReference
    };
    await booking.save();

    res.status(201).json({
      success: true,
      message: 'Commission payment created. Complete it to have the job confirmed.',
      data: {
        paymentReference: payment.paymentReference,
        amount,
        currency: payment.currency,
        paymentMethod: payment.method
      }
    });
  } catch (error) {
    console.error('Pay commission error:', error);
    res.status(500).json({ success: false, message: error.message || 'Error creating commission payment' });
  }
};

// Expose commission status/amount so the mobile app can prompt the transporter.
exports.getBookingCommission = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).select('payment paymentMethod pricing commission');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    const required = isCashBooking(booking);
    res.json({
      success: true,
      data: {
        required,
        amount: booking.commission?.amount || commissionAmountFor(booking),
        status: booking.commission?.status || (required ? 'pending' : 'not_required'),
        paymentReference: booking.commission?.paymentReference || null
      }
    });
  } catch (error) {
    console.error('Get commission error:', error);
    res.status(500).json({ success: false, message: 'Error fetching commission status' });
  }
};

exports.getBookingDocuments = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).select('user shipper transporter corporateAccount documents');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (!userOwnsBooking(booking, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to view these documents' });
    }
    res.json({ success: true, data: booking.documents || [] });
  } catch (error) {
    console.error('Error fetching booking documents:', error);
    res.status(500).json({ success: false, message: 'Error fetching documents' });
  }
};

exports.addBookingDocument = async (req, res) => {
  try {
    const { type, name, url } = req.body;
    if (!type || !url) {
      return res.status(400).json({ success: false, message: 'Document type and file URL are required.' });
    }
    const documentType = BUSINESS_DOCUMENT_TYPES.includes(type) ? type : 'other';

    const booking = await Booking.findById(req.params.id).select('user shipper transporter corporateAccount documents bookingReference');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }
    if (!userOwnsBooking(booking, req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to add documents to this booking' });
    }

    booking.documents = booking.documents || [];
    booking.documents.push({
      type: documentType,
      name: name || documentType.replace(/_/g, ' '),
      url,
      status: 'uploaded',
      uploadedAt: new Date()
    });
    await booking.save();

    await recordAudit({
      actor: req.user,
      action: 'booking.document_added',
      entityType: 'Booking',
      entityId: booking._id,
      entityRef: booking.bookingReference,
      after: { documentType },
      req
    });

    res.status(201).json({ success: true, message: 'Document attached', data: booking.documents });
  } catch (error) {
    console.error('Error adding booking document:', error);
    res.status(500).json({ success: false, message: 'Error attaching document', error: error.message });
  }
};

// Pickup schedule (date + time window) is mandatory so transporters know when to
// collect the load. The mobile client sends the time either as a separate
// `pickupTimeWindow` or embedded in `pickupDate` ("YYYY-MM-DD HH:MM").
// Returns an error message string, or null when valid.
function derivePickupTimeWindow(body) {
  const explicit = String(body?.pickupTimeWindow || '').trim();
  if (explicit) return explicit;
  const pickupDate = body?.pickupDate;
  if (typeof pickupDate === 'string') {
    const match = pickupDate.match(/\d{1,2}:\d{2}\s*(am|pm)?/i);
    if (match) return match[0].trim();
  }
  return '';
}

function getPickupScheduleError(body) {
  if (!body?.pickupDate) return 'Pickup date is required';
  if (Number.isNaN(new Date(body.pickupDate).getTime())) return 'Pickup date is invalid';
  if (!derivePickupTimeWindow(body)) return 'Pickup time window is required';
  return null;
}

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

    const scheduleError = getPickupScheduleError(req.body);
    if (scheduleError) {
      return res.status(400).json({ success: false, message: scheduleError });
    }

    // Reject bookings where pickup and delivery are the same location.
    const pickupAddr = String(req.body.pickupLocation || '').trim().toLowerCase();
    const deliveryAddr = String(req.body.deliveryLocation || '').trim().toLowerCase();
    if (pickupAddr && deliveryAddr && pickupAddr === deliveryAddr) {
      return res.status(400).json({
        success: false,
        message: 'Pickup and delivery locations cannot be the same. Please enter different addresses.'
      });
    }

    console.log("Creating booking with data:");
    console.log(JSON.stringify(req.body, null, 2));

    // Transform frontend data to match backend schema
    const routeCoordinates = await resolveRouteCoordinates(req.body);
    const transformedData = transformFrontendToBackend(req.body, req.user, routeCoordinates);

    console.log("Transformed booking data:");
    console.log(JSON.stringify(transformedData, null, 2));

    const bookingAmount = transformedData.totalAmount || transformedData.pricing?.totals?.total || 0;
    const corporateAccount = await assertCorporateCanBook(req.user, bookingAmount);
    if (corporateAccount && !transformedData.corporateAccount) {
      transformedData.corporateAccount = corporateAccount._id;
    }

    const booking = await Booking.create(transformedData);

    if (corporateAccount && transformedData.payment?.method === 'corporate') {
      await reserveCorporateCredit(corporateAccount._id, bookingAmount);
    }

    await recordAudit({
      actor: req.user,
      action: 'booking.created',
      entityType: 'Booking',
      entityId: booking._id,
      entityRef: booking.bookingReference,
      after: { status: booking.status, paymentStatus: booking.paymentStatus, totalAmount: booking.totalAmount },
      req
    });

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

// Normalize a client-supplied coordinate pair ({latitude, longitude} or [lng, lat])
// into a GeoJSON Point, or null when absent/invalid.
function toGeoPoint(value) {
  if (!value) return null;
  let longitude;
  let latitude;
  if (Array.isArray(value) && value.length === 2) {
    [longitude, latitude] = value.map(Number);
  } else if (typeof value === 'object') {
    longitude = Number(value.longitude ?? value.lng ?? value.lon);
    latitude = Number(value.latitude ?? value.lat);
  }
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (longitude === 0 && latitude === 0) return null;
  return { type: 'Point', coordinates: [longitude, latitude] };
}

// Resolve precise coordinates for the pickup and delivery addresses. Prefers
// coordinates captured by the client (address autocomplete / GPS); falls back to
// geocoding the address string so bookings are never stored at [0,0] silently.
async function resolveRouteCoordinates(frontendData) {
  const mapboxService = require('../services/mapboxService');

  const resolveOne = async (clientCoordinates, address) => {
    const fromClient = toGeoPoint(clientCoordinates);
    if (fromClient) return fromClient;
    if (!address) return null;
    try {
      const result = await mapboxService.geocode(address);
      if (result.success && result.data?.coordinates) {
        return toGeoPoint(result.data.coordinates);
      }
    } catch (error) {
      console.error(`Geocoding failed for address "${address}":`, error.message);
    }
    return null;
  };

  const [pickup, delivery] = await Promise.all([
    resolveOne(frontendData.pickupCoordinates, frontendData.pickupLocation),
    resolveOne(frontendData.deliveryCoordinates, frontendData.deliveryLocation)
  ]);

  if (!pickup) console.warn(`Booking pickup address could not be resolved to coordinates: "${frontendData.pickupLocation}"`);
  if (!delivery) console.warn(`Booking delivery address could not be resolved to coordinates: "${frontendData.deliveryLocation}"`);

  return {
    pickup: pickup || { type: 'Point', coordinates: [0, 0] },
    delivery: delivery || { type: 'Point', coordinates: [0, 0] }
  };
}

// NEW: Transform frontend data to backend schema structure
function transformFrontendToBackend(frontendData, user, routeCoordinates = null) {
  const userId = user.id || user._id;
  const {
    cargoType, weight, weightUnit, cargoValue, specialInstructions, images,
    pickupLocation, deliveryLocation, pickupDate, pickupTimeWindow, deliveryDate,
    routeInfo, vehicleRecommendation, isCrossBorder,
    paymentMethod, pricing, insurance, bookingType, vehicles = []
  } = frontendData;
  const insuranceSelection = typeof insurance === 'object' && insurance !== null
    ? insurance
    : { required: !!insurance };
  const insurancePremium = Number(
    insuranceSelection.premium ??
    pricing?.breakdown?.insurance ??
    pricing?.insurance ??
    0
  );
  const insuranceCoverage = Number(
    insuranceSelection.coverage ??
    insuranceSelection.coverageAmount ??
    cargoValue ??
    0
  );

  // Generate booking reference
  const generateBookingReference = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `PT-${timestamp}-${random}`;
  };

  return {
    // Core required fields
    bookingReference: generateBookingReference(),
    user: userId,
    shipper: userId,
    corporateAccount: user.corporateAccount,
    status: 'pending_payment', // CRITICAL: Payment required before broadcasting to transporters
    bookingType: bookingType || 'single',
    
    // Route structure that backend expects
    route: {
      pickup: {
        address: pickupLocation || '',
        date: pickupDate ? new Date(pickupDate) : new Date(),
        timeWindow: derivePickupTimeWindow(frontendData),
        coordinates: routeCoordinates?.pickup || { type: 'Point', coordinates: [0, 0] }
      },
      delivery: {
        address: deliveryLocation || '',
        deadline: deliveryDate ? new Date(deliveryDate) : undefined,
        coordinates: routeCoordinates?.delivery || { type: 'Point', coordinates: [0, 0] }
      },
      distance: routeInfo?.distance || 0,
      estimatedDuration: routeInfo?.duration || ''
    },
    
    // Cargo details structure
    cargoDetails: {
      type: cargoType || '',
      weight: weight ? parseFloat(weight) || null : null,
      weightUnit: weightUnit || 'kg',
      value: parseFloat(cargoValue) || 0,
      description: cargoType || '',
      specialInstructions: specialInstructions || '',
      photos: images || []
    },
    
    // Insurance structure
    insurance: {
      required: Boolean(insuranceSelection.required || insuranceSelection.selected || insurancePremium > 0),
      provider: insuranceSelection.providerName || insuranceSelection.provider || insuranceSelection.providerCode || '',
      premium: insurancePremium,
      coverage: insuranceCoverage,
      policyNumber: insuranceSelection.productCode || ''
    },
    
    // Cross-border structure
    crossBorder: {
      enabled: !!isCrossBorder
    },
    
    // Payment structure
    payment: {
      method: paymentMethod || 'digital',
      status: 'pending'
    },
    
    // UPDATED: Enhanced pricing structure with commission support
    pricing: pricing || {
      breakdown: {
        baseTransportFee: 0,
        specialCargoFee: 0,
        crossBorderFees: {
          baseSurcharge: 0,
          documentationFee: 0,
          insurancePremium: 0,
          total: 0
        },
        platformFee: 0,
        platformFeeRate: 0,
        transporterCommission: 0,
        transporterCommissionRate: 0,
        transporterEarnings: 0,
        transporterGrossEarnings: 0,
        insurance: 0,
        insuranceRate: 0,
        paymentMethod: paymentMethod || 'digital'
      },
      totals: {
        subtotal: 0,
        total: 0,
        platformTotal: 0,
        transporterTotal: 0,
        insuranceTotal: 0
      },
      feeAllocation: {
        platform: {
          amount: 0,
          description: '',
          breakdown: {
            platformFee: 0,
            transporterCommission: 0
          }
        },
        transporter: {
          amount: 0,
          description: '',
          grossAmount: 0,
          commission: 0
        },
        insurance: {
          amount: 0,
          description: ''
        }
      },
      discountsApplied: [],
      surchargesApplied: [],
      currency: 'USD'
    },
    
    // Vehicle data
    vehicleType: vehicleRecommendation?.vehicleType || vehicles?.[0]?.vehicleType || '',
    trailerType: vehicleRecommendation?.trailerType || vehicles?.[0]?.trailerType || '',
    vehicles: Array.isArray(vehicles) ? vehicles.map(vehicle => ({
      vehicleType: vehicle.vehicleType || vehicle.type || '',
      trailerType: vehicle.trailerType || '',
      weight: Number(vehicle.weight || weight || 0),
      description: vehicle.description || cargoType || '',
      vehicle: vehicle.vehicle
    })) : [],
    
    // Additional fields for easier querying — store the full address so
    // "Ruwa, Mashonaland East" is preserved rather than truncated to "Ruwa".
    origin: pickupLocation?.trim() || '',
    destination: deliveryLocation?.trim() || '',
    totalAmount: pricing?.totals?.total || 0,
    pickupDate: pickupDate ? new Date(pickupDate) : new Date()
  };
}

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
      req.body.pricing = await pricingService.calculatePricing({
        ...booking.toObject(),
        ...req.body
      });
    }

    if (req.body.status) {
      assertBookingTransition(booking.status, req.body.status);
    }

    const before = {
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      totalAmount: booking.totalAmount
    };

    booking = await Booking.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    await recordAudit({
      actor: req.user,
      action: 'booking.updated',
      entityType: 'Booking',
      entityId: booking._id,
      entityRef: booking.bookingReference,
      before,
      after: { status: booking.status, paymentStatus: booking.paymentStatus, totalAmount: booking.totalAmount },
      req
    });

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
    console.log("=============== Confirm Paayment ==============")
console.log(booking)
    console.log("=============== Confirm Paayment ==============")
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

    // Use payment service to confirm payment
    const paymentService = require('../services/paymentService');
    await paymentService.confirmPayment(paymentReference, {
      gateway: paymentService.getGatewayForMethod(paymentMethod || 'digital')
    });

    assertBookingTransition(booking.status, 'payment_confirmed');

    // CRITICAL: Update booking status to payment_confirmed and set timestamp
    booking.paymentStatus = 'confirmed';
    booking.payment.status = 'confirmed';
    booking.paymentConfirmedAt = new Date();
    booking.status = 'payment_confirmed';
    await booking.save();

    await recordAudit({
      actor: req.user,
      action: 'booking.payment_confirmed',
      entityType: 'Booking',
      entityId: booking._id,
      entityRef: booking.bookingReference,
      after: { status: booking.status, paymentStatus: booking.paymentStatus, paymentReference },
      req
    });

    // CRITICAL: Trigger matching service to find and notify transporters
    const matchingService = require('../services/matchingService');
    let matchingResult = null;
    try {
      await assertBookingReadyForMatching(booking);
      matchingResult = await matchingService.findAndNotifyTransporters(booking._id, 10);
      console.log(`Matching triggered for booking ${booking.bookingReference}:`, matchingResult);
    } catch (matchingError) {
      console.error('Error triggering matching:', matchingError);
      // Payment is confirmed but matching failed - booking stays in payment_confirmed status
      // Admin can manually trigger matching later
    }

    // Get updated booking with populated fields
    const updatedBooking = await Booking.findById(req.params.id)
      .populate('user', 'fullName phone email')
      .populate('transporter', 'fullName phone rating');

    // Send WhatsApp notification to shipper confirming payment
    try {
      await whatsappController.sendBookingStatusUpdate(updatedBooking, 'payment_confirmed');
    } catch (whatsappError) {
      console.error('WhatsApp notification error:', whatsappError);
    }

    // Build response with matching results
    const responseData = {
      booking: updatedBooking
    };

    if (matchingResult && matchingResult.success) {
      responseData.matching = {
        success: true,
        notifiedCount: matchingResult.notifiedCount,
        eligibleCount: matchingResult.eligibleCount,
        message: `Notified ${matchingResult.notifiedCount} top transporters`
      };
    }

    res.status(200).json({
      success: true,
      message: matchingResult && matchingResult.success
        ? `Payment confirmed! Notified ${matchingResult.notifiedCount} transporters for your booking.`
        : 'Payment confirmed. Finding transporters for your booking...',
      data: responseData
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

// NEW: Create booking with payment
exports.createBookingWithPayment = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const scheduleError = getPickupScheduleError(req.body);
    if (scheduleError) {
      return res.status(400).json({ success: false, message: scheduleError });
    }

    console.log("Creating booking with payment:", req.body);

    // Transform frontend data
    const routeCoordinates = await resolveRouteCoordinates(req.body);
    const transformedData = transformFrontendToBackend(req.body, req.user, routeCoordinates);

    // Create booking
    const bookingAmount = transformedData.totalAmount || transformedData.pricing?.totals?.total || req.body.amount || 0;
    const corporateAccount = await assertCorporateCanBook(req.user, bookingAmount);
    if (corporateAccount && !transformedData.corporateAccount) {
      transformedData.corporateAccount = corporateAccount._id;
    }

    const booking = await Booking.create(transformedData);

    if (corporateAccount && transformedData.payment?.method === 'corporate') {
      await reserveCorporateCredit(corporateAccount._id, bookingAmount);
    }

    // Create payment if payment method is provided
    let payment = null;
    if (req.body.paymentMethod && req.body.amount) {
      const paymentService = require('../services/paymentService');
      payment = await paymentService.createPayment(
        booking._id,
        req.body.amount,
        req.body.paymentMethod,
        req.body.customer || {}
      );

      if (req.body.paymentMethod === 'cash_agent') {
        const agentCode = generateAgentCode();
        const ecocashSourceReference = randomUUID();
        const ecocashSourceMobileNumber = normalizeEcocashPhone(req.body.customer?.phone || req.user?.phone);
        payment.metadata = {
          ...(payment.metadata || {}),
          agentCode,
          agentCodeGeneratedAt: new Date(),
          ecocashLookup: {
            sourceReference: ecocashSourceReference,
            sourceMobileNumber: ecocashSourceMobileNumber,
            mode: process.env.ECOCASH_OPENAPI_MODE || process.env.ECOCASH_MODE || 'sandbox'
          }
        };
        await payment.save();
      }
    }

    const response = {
      success: true,
      message: 'Booking created successfully',
      data: {
        booking,
        payment: payment ? {
          paymentId: payment._id,
          paymentReference: payment.paymentReference,
          status: payment.status,
          amount: payment.amount,
          currency: payment.currency,
          expiresAt: payment.expiresAt,
          agentPayment: payment.paymentMethod === 'cash_agent'
            ? await buildAgentPaymentDetails(payment)
            : null
        } : null
      }
    };

    await recordAudit({
      actor: req.user,
      action: 'booking.created_with_payment',
      entityType: 'Booking',
      entityId: booking._id,
      entityRef: booking.bookingReference,
      after: { status: booking.status, paymentStatus: booking.paymentStatus, totalAmount: booking.totalAmount },
      metadata: { paymentCreated: Boolean(payment) },
      req
    });

    res.status(201).json(response);
  } catch (error) {
    console.error('Error creating booking with payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating booking',
      error: error.message
    });
  }
};

function generateAgentCode() {
  const numbers = Math.floor(100000 + Math.random() * 900000);
  return `PT${numbers}`;
}

function normalizeEcocashPhone(value) {
  return ecocashOpenApiService.normalizeMsisdn
    ? ecocashOpenApiService.normalizeMsisdn(value)
    : String(value || '').replace(/[^\d]/g, '').replace(/^0/, '263');
}

async function buildAgentPaymentDetails(payment) {
  const agentCode = payment.metadata?.agentCode;
  const ecocashSourceReference = payment.metadata?.ecocashLookup?.sourceReference;
  const expiresAt = payment.expiresAt || new Date(Date.now() + 2 * 60 * 60 * 1000);
  const ecocashConfig = await ecocashOpenApiService.getConfig();

  return {
    paymentId: payment._id,
    paymentReference: payment.paymentReference,
    agentCode,
    ecocashSourceReference,
    amount: payment.amount,
    currency: payment.currency || 'USD',
    expiresAt,
    instructions: {
      title: 'Pay at EcoCash Agent',
      steps: [
        'Visit any EcoCash Agent near you',
        `Quote reference: ${agentCode}`,
        ...(ecocashSourceReference ? [`If the agent asks for the EcoCash source reference, use: ${ecocashSourceReference}`] : []),
        `Pay USD $${Number(payment.amount || 0).toFixed(2)}`,
        'Keep your receipt',
        'Payment will be confirmed automatically'
      ],
      merchantCode: ecocashConfig.merchantCode || 'PALMTRENT',
      supportPhone: process.env.SUPPORT_PHONE || '+263 77 123 4567',
      validUntil: expiresAt.toISOString ? expiresAt.toISOString() : expiresAt,
      note: 'Please ensure you quote the exact reference number to the agent'
    }
  };
}
// Cancel booking — accessible by the booking owner (shipper/corporate) at any
// pre-delivery status, and by the assigned transporter before pickup starts.
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

    const requesterId = String(req.user.id || req.user._id);
    const isOwner = [
      String(booking.user || ''),
      String(booking.shipper || '')
    ].includes(requesterId);
    const isAdmin = req.user.userType === 'admin';

    // Transporters can cancel before they have physically started pickup.
    const transporterCancellableStatuses = [
      'transporter_assigned', 'confirmed', 'matched'
    ];
    const isAssignedTransporter =
      req.user.userType === 'transporter' &&
      String(booking.transporter || '') === requesterId &&
      transporterCancellableStatuses.includes(booking.status);

    if (!isOwner && !isAdmin && !isAssignedTransporter) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to cancel this booking'
      });
    }

    // Owners can cancel up to (but not including) delivered/completed; transporters
    // can only cancel before en-route to pickup.
    if (['delivered', 'completed', 'cancelled'].includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel a booking that is already delivered, completed, or cancelled'
      });
    }

    if (isAssignedTransporter && !transporterCancellableStatuses.includes(booking.status)) {
      return res.status(400).json({
        success: false,
        message: 'You can only cancel a job before you have started en-route to pickup'
      });
    }

    assertBookingTransition(booking.status, 'cancelled');

    booking.status = 'cancelled';
    booking.cancellation = {
      cancelled: true,
      cancelledBy: req.user.id,
      cancelledByRole: req.user.userType,
      reason: reason || 'No reason provided',
      cancelledAt: new Date()
    };

    // If a transporter cancels, free the booking up for re-matching.
    if (isAssignedTransporter) {
      booking.transporter = undefined;
      // Don't re-open for finding — just cancel cleanly. The shipper can rebook.
    }

    await booking.save();

    await Shipment.updateMany(
      { booking: booking._id, status: { $nin: ['delivered', 'completed', 'cancelled'] } },
      { status: 'cancelled', 'timeline.cancelledAt': new Date() }
    );

    if (booking.corporateAccount) {
      await releaseCorporateCredit(
        booking.corporateAccount,
        booking.totalAmount || booking.pricing?.totals?.total || 0
      );
    }

    // Notify the other party about the cancellation.
    try {
      const notificationService = require('../services/notificationService');
      if (isAssignedTransporter) {
        // Notify the shipper that the transporter cancelled.
        const recipientId = booking.user || booking.shipper;
        if (recipientId) {
          await notificationService.notify(
            recipientId,
            'system_message',
            'Job Cancelled by Transporter',
            `Booking ${booking.bookingReference} has been cancelled by the assigned transporter. ${reason ? `Reason: ${reason}` : ''}`,
            { bookingId: booking._id.toString(), bookingReference: booking.bookingReference }
          );
        }
      } else {
        // Notify the transporter (if assigned) that the shipper cancelled.
        if (booking.transporter) {
          await notificationService.notify(
            booking.transporter,
            'system_message',
            'Booking Cancelled',
            `Booking ${booking.bookingReference} has been cancelled by the shipper. ${reason ? `Reason: ${reason}` : ''}`,
            { bookingId: booking._id.toString(), bookingReference: booking.bookingReference }
          );
        }
      }
    } catch (notifyErr) {
      console.error('Cancel notification error:', notifyErr);
    }

    await recordAudit({
      actor: req.user,
      action: 'booking.cancelled',
      entityType: 'Booking',
      entityId: booking._id,
      entityRef: booking.bookingReference,
      after: { status: booking.status, reason, cancelledByRole: req.user.userType },
      req
    });

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

    assertBookingTransition(booking.status, 'pending_payment');

    // Update booking status
    booking.status = 'pending_payment';
    await booking.save();

    await recordAudit({
      actor: req.user,
      action: 'booking.confirmed',
      entityType: 'Booking',
      entityId: booking._id,
      entityRef: booking.bookingReference,
      after: { status: booking.status },
      req
    });

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
exports.calculatePricing = async (req, res) => {
  try {
    const bookingData = await normalizePricingRequest(req.body);

    if (!bookingData.route?.distance) {
      return res.status(400).json({
        success: false,
        message: 'Pickup and delivery locations are required for pricing calculation'
      });
    }

    // Calculate pricing using the service
    const pricing = await pricingService.calculatePricing(bookingData);
    
    res.status(200).json({
      success: true,
      data: {
        ...pricing,
        route: {
          distance: bookingData.route.distance,
          estimatedDuration: bookingData.route.estimatedDuration,
          source: bookingData.route.source,
          distanceText: bookingData.route.distanceText
        }
      }
    });
    
  } catch (error) {
    console.error('Error calculating pricing:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating pricing',
      error: error.message
    });
  }
};

// Admin endpoint to update pricing configuration
exports.updatePricingConfig = async (req, res) => {
  try {
    const PricingConfig = require('../models/PricingConfig');
    
    // Only admins should access this
    if (req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update pricing configuration'
      });
    }
    
    const updates = req.body;
    updates.lastUpdated = new Date();
    updates.updatedBy = req.user.id;
    
    let config = await PricingConfig.findOne({ active: true });
    
    if (!config) {
      config = await PricingConfig.create({
        ...updates,
        configName: 'default',
        active: true
      });
    } else {
      Object.assign(config, updates);
      await config.save();
    }
    
    res.status(200).json({
      success: true,
      message: 'Pricing configuration updated successfully',
      data: config
    });
    
  } catch (error) {
    console.error('Error updating pricing config:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating pricing configuration',
      error: error.message
    });
  }
};

// Get current pricing configuration (for admin dashboard)
exports.getPricingConfig = async (req, res) => {
  try {
    const PricingConfig = require('../models/PricingConfig');
    
    const config = await PricingConfig.findOne({ active: true });
    
    if (!config) {
      return res.status(404).json({
        success: false,
        message: 'No active pricing configuration found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: config
    });
    
  } catch (error) {
    console.error('Error fetching pricing config:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pricing configuration',
      error: error.message
    });
  }
};

async function normalizePricingRequest(payload) {
  if (payload.route?.distance) {
    return payload;
  }

  const pickupAddress = payload.pickup?.address ||
    [payload.pickup?.city, payload.pickupAddress, payload.pickupCity].filter(Boolean).join(', ') ||
    payload.pickupLocation;
  const deliveryAddress = payload.delivery?.address ||
    [payload.delivery?.city, payload.deliveryAddress, payload.deliveryCity].filter(Boolean).join(', ') ||
    payload.deliveryLocation;

  if (!pickupAddress || !deliveryAddress) {
    return payload;
  }

  const distance = await distanceService.calculateDistance(
    {
      address: pickupAddress,
      lat: payload.pickup?.lat || payload.pickup?.latitude,
      lng: payload.pickup?.lng || payload.pickup?.longitude
    },
    {
      address: deliveryAddress,
      lat: payload.delivery?.lat || payload.delivery?.latitude,
      lng: payload.delivery?.lng || payload.delivery?.longitude
    }
  );

  return {
    ...payload,
    route: {
      ...(payload.route || {}),
      pickup: {
        ...(payload.route?.pickup || {}),
        address: pickupAddress
      },
      delivery: {
        ...(payload.route?.delivery || {}),
        address: deliveryAddress
      },
      distance: distance.distance,
      estimatedDuration: distance.duration,
      source: distance.source,
      distanceText: distance.distanceText
    },
    cargoDetails: {
      ...(payload.cargoDetails || {}),
      type: payload.cargoDetails?.type || payload.cargo?.type || payload.cargoType || '',
      weight: Number(payload.cargoDetails?.weight || payload.cargo?.weight || payload.weight || 0),
      value: Number(payload.cargoDetails?.value || payload.cargoValue || payload.insuranceValue || 0),
      specialInstructions: payload.cargoDetails?.specialInstructions || payload.cargoDescription || ''
    },
    vehicles: payload.vehicles?.length
      ? payload.vehicles
      : [{
          vehicleType: payload.vehicleType || payload.vehicleRecommendation?.vehicleType || '',
          trailerType: payload.trailerType || payload.vehicleRecommendation?.trailerType || '',
          weight: Number(payload.cargo?.weight || payload.weight || 0)
        }],
    insurance: typeof payload.insurance === 'boolean'
      ? { required: payload.insurance, coverage: Number(payload.insuranceValue || 0) }
      : payload.insurance,
    paymentMethod: payload.paymentMethod || 'digital'
  };
}

exports.getBookingStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const startDate = new Date();
    if (period === 'week') startDate.setDate(startDate.getDate() - 7);
    else if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
    else startDate.setMonth(startDate.getMonth() - 1);

    const ownership = [{ user: req.user.id }, { shipper: req.user.id }, { transporter: req.user.id }];
    if (req.user.corporateAccount) ownership.push({ corporateAccount: req.user.corporateAccount });

    const bookings = await Booking.find({
      $or: ownership,
      createdAt: { $gte: startDate }
    }).lean();

    const totalAmount = bookings.reduce((sum, booking) =>
      sum + (booking.totalAmount || booking.pricing?.totals?.total || booking.pricing?.total || 0), 0
    );
    const statusBreakdown = bookings.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        period,
        totalBookings: bookings.length,
        activeBookings: bookings.filter(b => !['completed', 'cancelled'].includes(b.status)).length,
        completedBookings: bookings.filter(b => ['completed', 'delivered'].includes(b.status)).length,
        totalAmount,
        statusBreakdown
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch booking stats', error: error.message });
  }
};

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
