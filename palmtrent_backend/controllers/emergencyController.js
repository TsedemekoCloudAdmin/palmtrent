const Emergency = require('../models/Emergency');
const EmergencyResponder = require('../models/EmergencyResponder');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const Driver = require('../models/Driver');
const Payment = require('../models/Payment');
const Subscription = require('../models/Subscription');
const Escrow = require('../models/Escrow');
const notificationService = require('../services/notificationService');
const paymentService = require('../services/paymentService');
const emergencySettlementService = require('../services/emergencySettlementService');
const {
  DEFAULT_EMERGENCY_CONFIG,
  numberSetting,
  getEmergencyOperationalConfig,
  getEmergencyContacts,
  normalizeLocation,
  hasUsableCoordinates,
  createPaymentReference
} = require('../services/emergencyConfigService');
const {
  calculateRoadsideAssistanceCharge,
  calculateRoadsideProviderFees,
  buildRoadsideQuote
} = require('../services/roadsideQuoteService');
const { sendSMS } = require('../utils/sendSMS');
const axios = require('axios');

const ROADSIDE_TYPES = new Set(['breakdown']);
const EXTERNAL_MEDICAL_TYPES = new Set(['accident', 'medical']);
const ADMIN_ONLY_TYPES = new Set(['hijacking', 'theft', 'harassment', 'road_block', 'weather', 'other']);

async function resolveEmergencyOperationalContext(user, bookingId, shipmentId) {
  let shipment = shipmentId
    ? await Shipment.findById(shipmentId)
        .populate('transporter', 'fullName phone email userType')
        .populate('shipper', 'fullName phone email userType')
    : null;
  let booking = bookingId
    ? await Booking.findById(bookingId).populate('shipper transporter', 'fullName phone email userType')
    : null;
  let driverProfile = null;

  if (!shipment && user?.userType === 'driver') {
    driverProfile = await Driver.findOne({ user: user._id || user.id }).sort({ updatedAt: -1 });
    if (driverProfile) {
      shipment = await Shipment.findOne({
        assignedDriver: driverProfile._id,
        status: { $in: ['assigned', 'matched', 'en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery', 'incident'] }
      })
        .populate('transporter', 'fullName phone email userType')
        .populate('shipper', 'fullName phone email userType')
        .sort({ updatedAt: -1 });
    }
  }

  if (!booking && shipment?.booking) {
    booking = await Booking.findById(shipment.booking).populate('shipper transporter', 'fullName phone email userType');
  }

  if (!shipment && booking?._id) {
    shipment = await Shipment.findOne({ booking: booking._id })
      .populate('transporter', 'fullName phone email userType')
      .populate('shipper', 'fullName phone email userType')
      .sort({ updatedAt: -1 });
  }

  const transporter = booking?.transporter || shipment?.transporter || null;
  const shipper = booking?.shipper || shipment?.shipper || null;
  const driverOwner = !transporter && driverProfile?.owner
    ? await User.findById(driverProfile.owner).select('fullName phone email userType')
    : null;

  return { booking, shipment, driverProfile, transporter: transporter || driverOwner, shipper };
}

async function hasActiveRoadsideSubscription(userId) {
  const now = new Date();
  return Boolean(await Subscription.exists({
    user: userId,
    audience: 'roadside_provider',
    status: 'active',
    'payment.status': { $in: ['paid', 'not_required', 'waived'] },
    $or: [
      { currentPeriodEnd: { $exists: false } },
      { currentPeriodEnd: null },
      { currentPeriodEnd: { $gte: now } }
    ]
  }));
}

async function getSubscribedRoadsideUserIds(userIds = []) {
  const uniqueIds = [...new Set(userIds.filter(Boolean).map(String))];
  if (!uniqueIds.length) return new Set();
  const now = new Date();
  const subscriptions = await Subscription.find({
    user: { $in: uniqueIds },
    audience: 'roadside_provider',
    status: 'active',
    'payment.status': { $in: ['paid', 'not_required', 'waived'] },
    $or: [
      { currentPeriodEnd: { $exists: false } },
      { currentPeriodEnd: null },
      { currentPeriodEnd: { $gte: now } }
    ]
  }).select('user');
  return new Set(subscriptions.map(subscription => String(subscription.user)));
}

function ensureEmergencyRuntimeFields(emergency) {
  if (!Array.isArray(emergency.timeline)) emergency.timeline = [];
  if (!Array.isArray(emergency.notifications)) emergency.notifications = [];
  if (!Array.isArray(emergency.emergencyContactsNotified)) emergency.emergencyContactsNotified = [];
  if (!emergency.response || typeof emergency.response !== 'object') emergency.response = {};
  if (!Array.isArray(emergency.response.responders)) emergency.response.responders = [];
  return emergency;
}

/**
 * @desc    Trigger SOS emergency
 * @route   POST /api/v1/emergency/sos
 * @access  Private
 */
exports.triggerSOS = async (req, res) => {
  try {
    const {
      emergencyType,
      location,
      description,
      bookingId,
      shipmentId,
      severity = 'high',
      photos,
      voiceNote,
      situation
    } = req.body;

    // Get user details
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const normalizedLocation = normalizeLocation(location || {});
    const userType = user.userType || 'shipper';
    const emergencyConfig = await getEmergencyOperationalConfig();
    const emergencyContacts = getEmergencyContacts(emergencyConfig);
    const operationalContext = await resolveEmergencyOperationalContext(user, bookingId, shipmentId);
    const resolvedBookingId = operationalContext.booking?._id || bookingId;
    const resolvedShipmentId = operationalContext.shipment?._id || shipmentId;

    // Create emergency record
    const emergency = await Emergency.create({
      triggeredBy: req.user.id,
      userType,
      emergencyType: emergencyType || 'other',
      severity,
      location: normalizedLocation,
      description: description || situation,
      booking: resolvedBookingId,
      shipment: resolvedShipmentId,
      contactPhone: user.phone,
      photos: photos || [],
      voiceNote,
      priority: severity === 'critical' ? 1 : (severity === 'high' ? 2 : 3)
    });
    ensureEmergencyRuntimeFields(emergency);

    // Send immediate notifications
    const notificationPromises = [];

    // 1. Notify support team
    notificationPromises.push(
      notifySupport(emergency, user, emergencyConfig)
    );

    if (ROADSIDE_TYPES.has(emergency.emergencyType)) {
      notificationPromises.push(broadcastToRoadsideResponders(emergency, user, emergencyConfig));
    }

    if (EXTERNAL_MEDICAL_TYPES.has(emergency.emergencyType)) {
      notificationPromises.push(routeToExternalEmergencyDispatch(emergency, user, emergencyConfig));
    }

    if (ADMIN_ONLY_TYPES.has(emergency.emergencyType)) {
      emergency.timeline.push({
        event: 'Routed to Palmtrent support',
        timestamp: new Date(),
        notes: 'Emergency type requires Palmtrent administrator handling.'
      });
    }

    // 2. Notify user's emergency contacts
    if (user.emergencyContacts && user.emergencyContacts.length > 0) {
      for (const contact of user.emergencyContacts) {
        notificationPromises.push(
          notifyEmergencyContact(emergency, contact).then(sent => {
            if (sent) {
              emergency.emergencyContactsNotified.push({
                name: contact.name,
                phone: contact.phone,
                relationship: contact.relationship,
                notifiedAt: new Date()
              });
            }
          })
        );
      }
    }

    // 3. Notify accountable booking parties. Driver incidents must notify the transporter/fleet owner.
    if (operationalContext.booking || operationalContext.shipment) {
      const parties = new Map();
      const addParty = (party, partyType) => {
        const id = party?._id || party;
        if (!id || String(id) === String(user._id || user.id)) return;
        parties.set(String(id), { party, partyType });
      };

      if (userType === 'shipper') {
        addParty(operationalContext.transporter, 'transporter');
      } else if (userType === 'transporter') {
        addParty(operationalContext.shipper, 'shipper');
      } else if (userType === 'driver') {
        addParty(operationalContext.transporter, 'transporter');
        addParty(operationalContext.shipper, 'shipper');
      } else {
        addParty(operationalContext.transporter, 'transporter');
        addParty(operationalContext.shipper, 'shipper');
      }

      parties.forEach(({ party, partyType }) => {
        notificationPromises.push(notifyParty(emergency, party, partyType, user));
      });

      // Also alert the accountable parties over WhatsApp where we have a number.
      const waRecipients = [...parties.values()]
        .map(({ party }) => party?.phone)
        .filter(Boolean);
      if (waRecipients.length) {
        const whatsappController = require('./whatsappController');
        notificationPromises.push(whatsappController.sendSOSAlert(emergency, waRecipients));
      }
    }

    // Execute all notifications
    await Promise.allSettled(notificationPromises);
    await emergency.save();

    res.status(201).json({
      success: true,
      message: 'SOS triggered successfully. Help is on the way.',
      data: {
        emergencyId: emergency._id,
        status: emergency.status,
        emergencyContacts,
        supportPhone: emergencyContacts.support,
        location: emergency.location,
        routing: {
          roadsideBroadcast: ROADSIDE_TYPES.has(emergency.emergencyType),
          externalDispatch: emergency.response?.externalDispatch?.status || 'not_required',
          adminVisible: true
        }
      }
    });
  } catch (error) {
    console.error('SOS trigger error:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering SOS. Please call emergency services directly.',
      emergencyContacts: getEmergencyContacts()
    });
  }
};

/**
 * @desc    Update location during emergency
 * @route   PUT /api/v1/emergency/:id/location
 * @access  Private
 */
exports.updateLocation = async (req, res) => {
  try {
    const { location } = req.body;
    const emergency = await Emergency.findById(req.params.id);

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: 'Emergency not found'
      });
    }

    // Verify ownership
    if (emergency.triggeredBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    emergency.location = {
      type: 'Point',
      coordinates: location.coordinates,
      address: location.address,
      city: location.city
    };

    await emergency.addTimelineEvent('Location updated', req.user.id);

    res.json({
      success: true,
      message: 'Location updated',
      data: emergency
    });
  } catch (error) {
    console.error('Location update error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating location'
    });
  }
};

/**
 * @desc    Cancel emergency (false alarm)
 * @route   PUT /api/v1/emergency/:id/cancel
 * @access  Private
 */
exports.cancelEmergency = async (req, res) => {
  try {
    const { reason } = req.body;
    const emergency = await Emergency.findById(req.params.id);

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: 'Emergency not found'
      });
    }

    // Verify ownership
    if (emergency.triggeredBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Can only cancel if not already resolved
    if (['resolved', 'cancelled', 'false_alarm'].includes(emergency.status)) {
      return res.status(400).json({
        success: false,
        message: 'Emergency already closed'
      });
    }

    emergency.status = reason === 'false_alarm' ? 'false_alarm' : 'cancelled';
    await emergency.addTimelineEvent(
      `Emergency cancelled: ${reason || 'User cancelled'}`,
      req.user.id
    );

    // Notify support of cancellation
    await notifySupportOfCancellation(emergency);

    res.json({
      success: true,
      message: 'Emergency cancelled',
      data: emergency
    });
  } catch (error) {
    console.error('Cancel emergency error:', error);
    res.status(500).json({
      success: false,
      message: 'Error cancelling emergency'
    });
  }
};

/**
 * @desc    Get user's emergency history
 * @route   GET /api/v1/emergency/history
 * @access  Private
 */
exports.getEmergencyHistory = async (req, res) => {
  try {
    const emergencies = await Emergency.getUserEmergencies(req.user.id);

    res.json({
      success: true,
      count: emergencies.length,
      data: emergencies
    });
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching emergency history'
    });
  }
};

exports.getEmergencyDecisions = async (req, res) => {
  try {
    const activeStatuses = ['triggered', 'acknowledged', 'responding', 'on_scene'];
    const isAdmin = req.user?.role === 'admin' || req.user?.userType === 'admin';
    const query = { status: { $in: activeStatuses } };

    if (!isAdmin) {
      const [bookings, shipments] = await Promise.all([
        Booking.find({ transporter: req.user.id }).select('_id'),
        Shipment.find({ transporter: req.user.id }).select('_id')
      ]);
      query.$or = [
        { triggeredBy: req.user.id },
        { booking: { $in: bookings.map(item => item._id) } },
        { shipment: { $in: shipments.map(item => item._id) } }
      ];
    }

    query['response.responders'] = {
      $elemMatch: {
        status: 'quote_submitted',
        'quote.total': { $gt: 0 }
      }
    };

    const emergencies = await Emergency.find(query)
      .populate('triggeredBy', 'fullName phone userType')
      .populate('booking', 'bookingReference transporter')
      .populate('shipment', 'shipmentId bookingReference transporter')
      .populate('response.responders.responder', 'businessName serviceTypes')
      .sort({ updatedAt: -1 })
      .limit(20);

    res.json({ success: true, count: emergencies.length, data: emergencies });
  } catch (error) {
    console.error('Get emergency decisions error:', error);
    res.status(500).json({ success: false, message: 'Error fetching SOS decisions' });
  }
};

/**
 * @desc    Get active emergency status
 * @route   GET /api/v1/emergency/:id
 * @access  Private
 */
exports.getEmergencyStatus = async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id)
      .populate('triggeredBy', 'fullName phone')
      .populate('response.acknowledgedBy', 'fullName')
      .populate('booking', 'bookingReference');

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: 'Emergency not found'
      });
    }

    res.json({
      success: true,
      data: emergency
    });
  } catch (error) {
    console.error('Get status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching emergency status'
    });
  }
};

/**
 * @desc    Get emergency contacts
 * @route   GET /api/v1/emergency/contacts
 * @access  Private
 */
exports.getEmergencyContacts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('emergencyContacts');
    const emergencyConfig = await getEmergencyOperationalConfig();

    res.json({
      success: true,
      data: {
        emergencyServices: getEmergencyContacts(emergencyConfig),
        personalContacts: user?.emergencyContacts || []
      }
    });
  } catch (error) {
    console.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching emergency contacts'
    });
  }
};

/**
 * @desc    Update user's emergency contacts
 * @route   PUT /api/v1/emergency/contacts
 * @access  Private
 */
exports.updateEmergencyContacts = async (req, res) => {
  try {
    const { contacts } = req.body;

    if (!contacts || !Array.isArray(contacts)) {
      return res.status(400).json({
        success: false,
        message: 'Contacts array is required'
      });
    }

    // Validate contacts
    const validContacts = contacts.filter(c => c.name && c.phone);

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { emergencyContacts: validContacts },
      { new: true }
    ).select('emergencyContacts');

    res.json({
      success: true,
      message: 'Emergency contacts updated',
      data: user.emergencyContacts
    });
  } catch (error) {
    console.error('Update contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating emergency contacts'
    });
  }
};

// =====================
// ADMIN/SUPPORT ENDPOINTS
// =====================

/**
 * @desc    Get all active emergencies (support team)
 * @route   GET /api/v1/emergency/active
 * @access  Private/Admin
 */
exports.getActiveEmergencies = async (req, res) => {
  try {
    const emergencies = await Emergency.getActiveEmergencies();

    res.json({
      success: true,
      count: emergencies.length,
      data: emergencies
    });
  } catch (error) {
    console.error('Get active error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching active emergencies'
    });
  }
};

exports.getAdminEmergencies = async (req, res) => {
  try {
    const { status, type, limit = 100 } = req.query;
    const query = {};
    if (status && status !== 'all') {
      query.status = status === 'active'
        ? { $in: ['triggered', 'acknowledged', 'responding', 'on_scene'] }
        : status;
    }
    if (type && type !== 'all') query.emergencyType = type;

    const emergencies = await Emergency.find(query)
      .populate('triggeredBy', 'fullName phone email userType')
      .populate('booking', 'bookingReference')
      .populate('response.responders.user', 'fullName phone')
      .populate('response.responders.responder', 'businessName serviceTypes availability')
      .sort({ priority: 1, createdAt: -1 })
      .limit(Number(limit));

    res.json({ success: true, count: emergencies.length, data: emergencies });
  } catch (error) {
    console.error('Get admin emergencies error:', error);
    res.status(500).json({ success: false, message: 'Error fetching emergencies' });
  }
};

exports.getResponderProfile = async (req, res) => {
  try {
    const responder = await EmergencyResponder.findOne({ user: req.user.id });
    res.json({ success: true, data: responder });
  } catch (error) {
    console.error('Get responder profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to load responder profile' });
  }
};

exports.upsertResponderProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const payload = buildResponderPayload(req.body, user);
    const responder = await EmergencyResponder.findOneAndUpdate(
      { user: req.user.id },
      { $set: payload, $setOnInsert: { user: req.user.id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: responder, message: 'Responder profile saved' });
  } catch (error) {
    console.error('Save responder profile error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to save responder profile' });
  }
};

exports.updateResponderAvailability = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const wantsAvailable = req.body?.isAvailable === true || req.body?.status === 'available';
    if (wantsAvailable && !(await hasActiveRoadsideSubscription(req.user.id))) {
      return res.status(402).json({
        success: false,
        code: 'ROADSIDE_SUBSCRIPTION_REQUIRED',
        message: 'An active roadside provider monthly subscription is required before you can go online and receive SOS requests.'
      });
    }

    const responder = await EmergencyResponder.findOneAndUpdate(
      { user: req.user.id },
      { $set: buildResponderAvailabilityPayload(req.body, user), $setOnInsert: { user: req.user.id } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    res.json({ success: true, data: responder, message: 'Availability updated' });
  } catch (error) {
    console.error('Responder availability error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update availability' });
  }
};

exports.getResponderRequests = async (req, res) => {
  try {
    const responder = await EmergencyResponder.findOne({ user: req.user.id });
    if (!responder) return res.json({ success: true, data: [] });

    const emergencies = await Emergency.find({
      status: { $in: ['triggered', 'acknowledged', 'responding', 'on_scene'] },
      'response.responders.responder': responder._id
    })
      .populate('triggeredBy', 'fullName phone userType')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, data: emergencies });
  } catch (error) {
    console.error('Responder requests error:', error);
    res.status(500).json({ success: false, message: 'Failed to load SOS requests' });
  }
};

exports.respondToEmergency = async (req, res) => {
  try {
    const { action, notes } = req.body;
    const responder = await EmergencyResponder.findOne({ user: req.user.id });
    const emergency = await Emergency.findById(req.params.id);
    if (!responder || !emergency) {
      return res.status(404).json({ success: false, message: 'Responder or emergency not found' });
    }

    const responseItem = emergency.response.responders.find(item =>
      String(item.responder || '') === String(responder._id)
    );
    if (!responseItem) {
      return res.status(403).json({ success: false, message: 'This SOS was not assigned to you' });
    }

    if (action === 'quote' || action === 'submit_quote') {
      if (!(await hasActiveRoadsideSubscription(req.user.id))) {
        return res.status(402).json({
          success: false,
          code: 'ROADSIDE_SUBSCRIPTION_REQUIRED',
          message: 'Your roadside provider subscription must be active before quoting SOS work.'
        });
      }

      if (['accepted', 'on_scene', 'completed'].includes(responseItem.status)) {
        return res.status(409).json({
          success: false,
          message: 'This SOS has already moved past quoting.'
        });
      }

      const emergencyConfig = await getEmergencyOperationalConfig();
      const { quote } = await buildRoadsideQuote(emergency, responder, req.body.quote || req.body, emergencyConfig);
      responseItem.status = 'quote_submitted';
      responseItem.quote = quote;
      responseItem.notes = notes || quote.notes;
      emergency.status = emergency.status === 'triggered' ? 'acknowledged' : emergency.status;
      emergency.timeline.push({
        event: 'Roadside quote submitted',
        actor: req.user.id,
        notes: `${responder.businessName || 'Responder'} quoted USD ${Number(quote.total || 0).toFixed(2)} before accepting dispatch.`
      });

      await notifyRoadsideQuoteDecisionMakers(emergency, responder, quote);
    } else if (action === 'accept') {
      if (!(await hasActiveRoadsideSubscription(req.user.id))) {
        return res.status(402).json({
          success: false,
          code: 'ROADSIDE_SUBSCRIPTION_REQUIRED',
          message: 'Your roadside provider subscription must be active before accepting SOS work.'
        });
      }

      if (responseItem.status !== 'quote_accepted') {
        return res.status(409).json({
          success: false,
          code: 'QUOTE_ACCEPTANCE_REQUIRED',
          message: 'Submit a quote first. The transporter/requester must accept the quote before you can accept this SOS.'
        });
      }

      responseItem.status = 'accepted';
      responseItem.acceptedAt = new Date();
      responseItem.notes = notes;
      emergency.status = 'responding';
      responder.availability.status = 'busy';
      responder.availability.isAvailable = false;
      responder.stats.requestsAccepted += 1;
      emergency.timeline.push({ event: 'Roadside responder accepted SOS', actor: req.user.id, notes });
      await notificationService.notify(emergency.triggeredBy, 'emergency_alert', 'Help accepted', `${responder.businessName || 'A responder'} accepted your SOS request and is on the way. Approved fee: USD ${Number(emergency.billing?.amount || 0).toFixed(2)}.`, {
        emergencyId: emergency._id.toString(),
        responderId: responder._id.toString(),
        paymentStatus: emergency.billing?.paymentStatus,
        amount: emergency.billing?.amount
      });
      await notifyAccountableTransporterOfRoadsideAcceptance(emergency, responder);
    } else if (action === 'decline') {
      responseItem.status = 'declined';
      responseItem.declinedAt = new Date();
      responseItem.notes = notes;
      emergency.timeline.push({ event: 'Roadside responder declined SOS', actor: req.user.id, notes });
    } else if (action === 'on_scene') {
      responseItem.status = 'on_scene';
      responseItem.arrivedAt = new Date();
      emergency.status = 'on_scene';
      emergency.timeline.push({ event: 'Roadside responder arrived on scene', actor: req.user.id, notes });
    } else if (action === 'complete') {
      if (!['accepted', 'on_scene'].includes(responseItem.status)) {
        return res.status(409).json({
          success: false,
          message: 'Responder must accept and arrive before completing assistance.'
        });
      }
      await emergencySettlementService.settleCompletedRoadsideAssistance(emergency, responseItem, responder, req.user.id);
      responseItem.status = 'completed';
      responder.availability.status = 'available';
      responder.availability.isAvailable = true;
      responder.stats.requestsCompleted += 1;
      emergency.status = 'resolved';
      emergency.response.resolvedAt = new Date();
      emergency.response.resolvedBy = req.user.id;
      emergency.response.resolutionNotes = notes || 'Roadside assistance completed by provider';
      emergency.timeline.push({ event: 'Roadside responder completed assistance', actor: req.user.id, notes });
      await notificationService.notify(emergency.triggeredBy, 'emergency_alert', 'SOS assistance completed', `${responder.businessName || 'Roadside provider'} marked your SOS assistance complete.`, {
        emergencyId: emergency._id.toString(),
        responderId: responder._id.toString(),
        settlementStatus: emergency.billing?.settlementStatus
      });
    } else {
      return res.status(400).json({ success: false, message: 'Unsupported response action' });
    }

    await responder.save();
    await emergency.save();
    res.json({ success: true, data: emergency, message: 'SOS response updated' });
  } catch (error) {
    console.error('Respond to emergency error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to update SOS response' });
  }
};

exports.acceptRoadsideQuote = async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) {
      return res.status(404).json({ success: false, message: 'SOS request not found' });
    }

    const responderId = req.params.responderId;
    const responseItem = emergency.response.responders.find(item =>
      String(item.responder || '') === String(responderId) || String(item.user || '') === String(responderId)
    );
    if (!responseItem || responseItem.status !== 'quote_submitted' || !responseItem.quote?.total) {
      return res.status(404).json({ success: false, message: 'No pending quote was found for this responder.' });
    }

    const authority = await resolveEmergencyPaymentAuthority(emergency, req.user);
    if (!authority.allowed) {
      return res.status(403).json({ success: false, message: 'Only the SOS requester, assigned transporter, or an administrator can accept this quote.' });
    }

    const amount = Number(responseItem.quote.total || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Quote amount is invalid.' });
    }

    const fees = await calculateRoadsideProviderFees(amount, 'digital');
    responseItem.status = 'quote_accepted';
    responseItem.quote.acceptedAt = new Date();
    responseItem.quote.acceptedBy = req.user.id;
    emergency.billing = {
      ...(emergency.billing || {}),
      payer: req.user.id,
      paymentStatus: 'pending',
      amount,
      currency: responseItem.quote.currency || 'USD',
      platformFee: fees.platformFee,
      providerEarnings: fees.providerEarnings,
      pricingSource: 'provider_quote',
      notes: responseItem.quote.notes || 'Roadside assistance quote accepted before provider dispatch.'
    };
    emergency.timeline.push({
      event: 'Roadside quote accepted',
      actor: req.user.id,
      notes: `Quote ${responseItem.quote.quoteReference || ''} accepted for USD ${amount.toFixed(2)}.`
    });

    await emergency.save();
    await notifyRoadsideQuoteAccepted(emergency, responseItem, authority.populated);

    res.json({
      success: true,
      message: 'Quote accepted. The roadside provider can now accept dispatch.',
      data: emergency
    });
  } catch (error) {
    console.error('Accept roadside quote error:', error);
    res.status(500).json({ success: false, message: 'Failed to accept roadside quote' });
  }
};

exports.rejectRoadsideQuote = async (req, res) => {
  try {
    const { reason } = req.body;
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) {
      return res.status(404).json({ success: false, message: 'SOS request not found' });
    }

    const responseItem = emergency.response.responders.find(item =>
      String(item.responder || '') === String(req.params.responderId) || String(item.user || '') === String(req.params.responderId)
    );
    if (!responseItem || responseItem.status !== 'quote_submitted') {
      return res.status(404).json({ success: false, message: 'No pending quote was found for this responder.' });
    }

    const authority = await resolveEmergencyPaymentAuthority(emergency, req.user);
    if (!authority.allowed) {
      return res.status(403).json({ success: false, message: 'Only the SOS requester, assigned transporter, or an administrator can reject this quote.' });
    }

    responseItem.status = 'quote_rejected';
    responseItem.quote.rejectedAt = new Date();
    responseItem.quote.rejectedBy = req.user.id;
    responseItem.notes = reason || responseItem.notes;
    emergency.timeline.push({
      event: 'Roadside quote rejected',
      actor: req.user.id,
      notes: reason || 'Quote rejected.'
    });

    await emergency.save();
    await notifyRoadsideQuoteRejected(emergency, responseItem, reason);

    res.json({ success: true, message: 'Quote rejected.', data: emergency });
  } catch (error) {
    console.error('Reject roadside quote error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject roadside quote' });
  }
};

exports.createEmergencyPayment = async (req, res) => {
  try {
    const { paymentMethod = 'clicknpay', paymentSource = 'separate_payment', customer = {} } = req.body;
    const emergency = await Emergency.findById(req.params.id);
    if (!emergency) {
      return res.status(404).json({ success: false, message: 'SOS request not found' });
    }

    const isAdmin = req.user?.role === 'admin' || req.user?.userType === 'admin';
    const isRequester = String(emergency.triggeredBy) === String(req.user.id);
    const authority = await resolveEmergencyPaymentAuthority(emergency, req.user);
    if (!isRequester && !isAdmin && !authority.isTransporter && paymentSource !== 'freight_allocation') {
      return res.status(403).json({ success: false, message: 'Only the SOS requester, assigned transporter, or an administrator can pay for this SOS request.' });
    }

    const amount = Number(emergency.billing?.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'This SOS request does not have an approved assistance quote yet.'
      });
    }

    if (paymentSource === 'freight_allocation') {
      if (!emergency.booking) {
        return res.status(400).json({ success: false, message: 'Freight allocation requires an SOS linked to a booking.' });
      }

      const [booking, escrow] = await Promise.all([
        Booking.findById(emergency.booking).select('bookingReference transporter paymentStatus payment roadsideAssistanceAllocations'),
        Escrow.findOne({ booking: emergency.booking, status: { $in: ['held', 'pending_release'] } })
      ]);

      if (!booking) {
        return res.status(404).json({ success: false, message: 'Linked booking not found.' });
      }

      if (!isAdmin && String(booking.transporter || '') !== String(req.user.id)) {
        return res.status(403).json({ success: false, message: 'Only the assigned transporter can allocate freight money to roadside assistance.' });
      }

      if (!escrow) {
        return res.status(409).json({ success: false, message: 'Freight money is not currently held in escrow for this booking.' });
      }

      if (Number(escrow.transporterPayout || 0) < amount) {
        return res.status(409).json({
          success: false,
          message: `Insufficient transporter freight allocation. Available: USD ${Number(escrow.transporterPayout || 0).toFixed(2)}.`
        });
      }

      const payment = await Payment.create({
        emergency: emergency._id,
        booking: booking._id,
        paymentReference: createPaymentReference('SOS-FRT'),
        amount,
        currency: emergency.billing.currency || escrow.currency || 'USD',
        paymentMethod: 'freight_allocation',
        gateway: 'none',
        status: 'pending',
        customer: {
          email: customer.email,
          phone: customer.phone
        },
        metadata: {
          type: 'emergency_assistance',
          paymentSource: 'freight_allocation',
          bookingReference: booking.bookingReference,
          escrowReference: escrow.escrowReference,
          emergencyType: emergency.emergencyType,
          platformFee: emergency.billing.platformFee,
          providerEarnings: emergency.billing.providerEarnings
        }
      });

      const allocation = {
        emergency: emergency._id,
        payment: payment._id,
        escrow: escrow._id,
        amount,
        providerEarnings: Number(emergency.billing.providerEarnings || 0),
        platformFee: Number(emergency.billing.platformFee || 0),
        allocatedBy: req.user.id,
        allocatedAt: new Date()
      };

      escrow.transporterPayout = Number(Math.max(0, Number(escrow.transporterPayout || 0) - amount).toFixed(2));
      escrow.roadsideAssistanceAllocations = escrow.roadsideAssistanceAllocations || [];
      escrow.roadsideAssistanceAllocations.push(allocation);
      escrow.metadata = {
        ...(escrow.metadata || {}),
        roadsideAssistanceAllocatedTotal: Number(
          ((escrow.metadata?.roadsideAssistanceAllocatedTotal || 0) + amount).toFixed(2)
        )
      };
      await escrow.save();

      booking.roadsideAssistanceAllocations = booking.roadsideAssistanceAllocations || [];
      booking.roadsideAssistanceAllocations.push(allocation);
      await booking.save();

      emergency.billing = {
        ...(emergency.billing || {}),
        payment: payment._id,
        paymentReference: payment.paymentReference,
        paymentStatus: 'pending',
        paymentSource: 'freight_allocation',
        freightAllocation: {
          booking: booking._id,
          escrow: escrow._id,
          allocatedBy: req.user.id,
          allocatedAt: allocation.allocatedAt,
          amount
        }
      };
      emergency.timeline.push({
        event: 'Roadside assistance allocated from freight money',
        actor: req.user.id,
        notes: `USD ${amount.toFixed(2)} allocated from booking ${booking.bookingReference}.`
      });
      await emergency.save();

      await paymentService.confirmPayment(payment.paymentReference, {
        gatewayReference: escrow.escrowReference,
        metadata: {
          paymentSource: 'freight_allocation',
          allocatedBy: req.user.id,
          allocatedAt: allocation.allocatedAt
        }
      });

      const refreshedEmergency = await Emergency.findById(emergency._id);
      return res.json({
        success: true,
        message: 'Roadside assistance paid from freight allocation.',
        data: {
          paymentRequired: false,
          paymentReference: payment.paymentReference,
          amount: payment.amount,
          currency: payment.currency,
          paymentStatus: 'confirmed',
          emergency: refreshedEmergency
        }
      });
    }

    if (emergency.billing?.paymentStatus === 'paid') {
      return res.json({
        success: true,
        message: 'This SOS assistance payment is already confirmed.',
        data: {
          paymentRequired: false,
          paymentReference: emergency.billing.paymentReference,
          emergency
        }
      });
    }

    let payment = emergency.billing?.paymentReference
      ? await Payment.findOne({
          emergency: emergency._id,
          paymentReference: emergency.billing.paymentReference,
          status: { $in: ['pending', 'initiated', 'processing'] }
        })
      : null;

    if (!payment) {
      payment = await Payment.create({
        emergency: emergency._id,
        paymentReference: createPaymentReference(),
        amount,
        currency: emergency.billing.currency || 'USD',
        paymentMethod,
        gateway: paymentService.getGatewayForMethod(paymentMethod),
        status: 'pending',
        customer: {
          email: customer.email,
          phone: customer.phone
        },
        metadata: {
          type: 'emergency_assistance',
          paymentSource: 'separate_payment',
          emergencyType: emergency.emergencyType,
          platformFee: emergency.billing.platformFee,
          providerEarnings: emergency.billing.providerEarnings
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });
    }

    emergency.billing = {
      ...(emergency.billing || {}),
      payment: payment._id,
      paymentReference: payment.paymentReference,
      paymentStatus: ['initiated', 'processing'].includes(payment.status) ? payment.status : 'pending',
      paymentSource: 'separate_payment'
    };
    await emergency.save();

    res.json({
      success: true,
      message: 'SOS assistance payment created.',
      data: {
        paymentReference: payment.paymentReference,
        amount: payment.amount,
        currency: payment.currency,
        paymentStatus: payment.status,
        emergency
      }
    });
  } catch (error) {
    console.error('Create emergency payment error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create SOS assistance payment' });
  }
};

exports.getAdminResponders = async (req, res) => {
  try {
    const { status, verification } = req.query;
    const query = {};
    if (status && status !== 'all') query['availability.status'] = status;
    if (verification && verification !== 'all') query['verification.status'] = verification;
    const responders = await EmergencyResponder.find(query)
      .populate('user', 'fullName email phone status')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, data: responders });
  } catch (error) {
    console.error('Get responders error:', error);
    res.status(500).json({ success: false, message: 'Failed to load responders' });
  }
};

exports.verifyResponder = async (req, res) => {
  try {
    const { status, notes } = req.body;
    const responder = await EmergencyResponder.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          'verification.status': status,
          'verification.notes': notes,
          'verification.verifiedAt': ['approved', 'rejected'].includes(status) ? new Date() : undefined,
          'verification.verifiedBy': req.user.id
        }
      },
      { new: true, runValidators: true }
    );
    if (!responder) return res.status(404).json({ success: false, message: 'Responder not found' });
    res.json({ success: true, data: responder, message: 'Responder verification updated' });
  } catch (error) {
    console.error('Verify responder error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify responder' });
  }
};

/**
 * @desc    Acknowledge emergency (support team)
 * @route   PUT /api/v1/emergency/:id/acknowledge
 * @access  Private/Admin
 */
exports.acknowledgeEmergency = async (req, res) => {
  try {
    const emergency = await Emergency.findById(req.params.id);

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: 'Emergency not found'
      });
    }

    await emergency.acknowledge(req.user.id);

    // Notify user that help is acknowledged
    await notifyUserOfAcknowledgement(emergency);

    res.json({
      success: true,
      message: 'Emergency acknowledged',
      data: emergency
    });
  } catch (error) {
    console.error('Acknowledge error:', error);
    res.status(500).json({
      success: false,
      message: 'Error acknowledging emergency'
    });
  }
};

/**
 * @desc    Dispatch responder (support team)
 * @route   PUT /api/v1/emergency/:id/dispatch
 * @access  Private/Admin
 */
exports.dispatchResponder = async (req, res) => {
  try {
    const { responderType, notes } = req.body;
    const emergency = await Emergency.findById(req.params.id);

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: 'Emergency not found'
      });
    }

    await emergency.dispatchResponder(responderType, req.user.id);

    // Notify user
    await notifyUserOfDispatch(emergency, responderType);

    res.json({
      success: true,
      message: `${responderType} dispatched`,
      data: emergency
    });
  } catch (error) {
    console.error('Dispatch error:', error);
    res.status(500).json({
      success: false,
      message: 'Error dispatching responder'
    });
  }
};

/**
 * @desc    Resolve emergency (support team)
 * @route   PUT /api/v1/emergency/:id/resolve
 * @access  Private/Admin
 */
exports.resolveEmergency = async (req, res) => {
  try {
    const { notes } = req.body;
    const emergency = await Emergency.findById(req.params.id);

    if (!emergency) {
      return res.status(404).json({
        success: false,
        message: 'Emergency not found'
      });
    }

    await emergency.resolve(req.user.id, notes);

    res.json({
      success: true,
      message: 'Emergency resolved',
      data: emergency
    });
  } catch (error) {
    console.error('Resolve error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resolving emergency'
    });
  }
};

// =====================
// HELPER FUNCTIONS
// =====================

async function notifySupport(emergency, user, config = {}) {
  try {
    const location = formatEmergencyLocation(emergency);
    const notificationResults = await notificationService.notifyRole(
      'admin',
      'emergency_alert',
      `SOS: ${emergency.emergencyType}`,
      `${user.fullName || 'A Palmtrent user'} triggered an SOS at ${location}.`,
      getEmergencyNotificationData(emergency, user)
    );
    const adminNotificationSent = notificationResults.some(result => result.status === 'fulfilled');
    recordEmergencyNotification(emergency, {
      recipientType: 'support_team',
      channel: 'push',
      status: adminNotificationSent ? 'sent' : 'failed'
    });

    if (config.supportPhone) {
      const supportSmsSent = await sendSMS(
        config.supportPhone,
        `Palmtrent SOS: ${user.fullName || 'User'} reported ${emergency.emergencyType} at ${location}.`
      );
      recordEmergencyNotification(emergency, {
        recipientType: 'support_team',
        channel: 'sms',
        status: supportSmsSent ? 'sent' : 'failed'
      });
    }

    return adminNotificationSent;
  } catch (error) {
    console.error('Support notification error:', error);
    recordEmergencyNotification(emergency, {
      recipientType: 'support_team',
      channel: 'push',
      status: 'failed'
    });
    return false;
  }
}

async function broadcastToRoadsideResponders(emergency, user, config = {}) {
  try {
    if (!hasUsableCoordinates(emergency.location)) {
      emergency.timeline.push({
        event: 'Roadside broadcast skipped',
        timestamp: new Date(),
        notes: 'No usable location was provided.'
      });
      return false;
    }

    const requiredServices = emergency.emergencyType === 'breakdown'
      ? ['tow_truck', 'mechanic', 'battery', 'fuel', 'tyre']
      : ['tow_truck', 'accident_recovery'];

    const responders = await EmergencyResponder.find({
      serviceTypes: { $in: requiredServices },
      'availability.isAvailable': true,
      'availability.status': 'available',
      'verification.status': 'approved',
      location: {
        $near: {
          $geometry: emergency.location,
          $maxDistance: numberSetting(config.responderRadiusMeters, DEFAULT_EMERGENCY_CONFIG.responderRadiusMeters)
        }
      }
    })
      .populate('user', 'fullName phone expoPushToken fcmToken')
      .limit(numberSetting(config.responderBroadcastLimit, DEFAULT_EMERGENCY_CONFIG.responderBroadcastLimit));

    const subscribedUserIds = await getSubscribedRoadsideUserIds(
      responders.map(responder => responder.user?._id || responder.user)
    );
    const eligibleResponders = responders.filter(responder =>
      subscribedUserIds.has(String(responder.user?._id || responder.user))
    );

    if (!eligibleResponders.length && responders.length) {
      emergency.timeline.push({
        event: 'Roadside broadcast skipped',
        timestamp: new Date(),
        notes: 'Nearby roadside providers were found, but none have an active roadside subscription.'
      });
      return false;
    }

    eligibleResponders.forEach((responder) => {
      emergency.response.responders.push({
        type: responder.serviceTypes.includes('tow_truck') ? 'tow_truck' : 'mechanic',
        responder: responder._id,
        user: responder.user?._id || responder.user,
        dispatchedAt: new Date(),
        status: 'notified',
        notes: 'Automatically broadcast to nearby available roadside provider.'
      });
      responder.stats.requestsReceived += 1;
    });

    await Promise.allSettled(eligibleResponders.map((responder) => responder.save()));
    await Promise.allSettled(eligibleResponders.map((responder) => notificationService.notify(
      responder.user?._id || responder.user,
      'emergency_alert',
      'Nearby SOS request',
      `${user.fullName || 'A Palmtrent user'} needs ${emergency.emergencyType} assistance near ${formatEmergencyLocation(emergency)}.`,
      { emergencyId: emergency._id.toString(), emergencyType: emergency.emergencyType, location: emergency.location }
    )));

    emergency.timeline.push({
      event: 'Roadside SOS broadcast',
      timestamp: new Date(),
      notes: `${responders.length} nearby responder(s) notified.`
    });
    if (responders.length > 0) emergency.status = 'responding';
    return true;
  } catch (error) {
    console.error('Roadside broadcast error:', error);
    emergency.timeline.push({
      event: 'Roadside broadcast failed',
      timestamp: new Date(),
      notes: error.message
    });
    return false;
  }
}

async function routeToExternalEmergencyDispatch(emergency, user, config = null) {
  const dispatch = {
    provider: 'emergencyDispatch',
    requestedAt: new Date(),
    status: 'not_configured'
  };

  try {
    const dispatchConfig = config || await getEmergencyOperationalConfig();
    if (!dispatchConfig.baseUrl || !dispatchConfig.apiKey) {
      emergency.response.externalDispatch = dispatch;
      emergency.timeline.push({
        event: 'External emergency dispatch not configured',
        timestamp: new Date(),
        notes: 'Configure the emergencyDispatch integration API key and base URL.'
      });
      return false;
    }

    const response = await axios.post(dispatchConfig.baseUrl, {
      emergencyId: emergency._id.toString(),
      type: emergency.emergencyType,
      severity: emergency.severity,
      mobileNumber: user.phone,
      personName: user.fullName,
      situation: emergency.description || emergency.emergencyType,
      location: emergency.location,
      callbackUrl: dispatchConfig.callbackUrl
    }, {
      timeout: numberSetting(dispatchConfig.dispatchTimeoutMs, DEFAULT_EMERGENCY_CONFIG.dispatchTimeoutMs),
      headers: {
        Authorization: `Bearer ${dispatchConfig.apiKey}`,
        'X-API-KEY': dispatchConfig.apiKey,
        'Content-Type': 'application/json'
      }
    });

    emergency.response.externalDispatch = {
      ...dispatch,
      status: 'sent',
      reference: response.data?.reference || response.data?.id,
      response: response.data
    };
    emergency.timeline.push({
      event: 'External emergency dispatch sent',
      timestamp: new Date(),
      notes: emergency.response.externalDispatch.reference
    });
    return true;
  } catch (error) {
    emergency.response.externalDispatch = {
      ...dispatch,
      status: 'failed',
      error: error.response?.data?.message || error.message,
      response: error.response?.data
    };
    emergency.timeline.push({
      event: 'External emergency dispatch failed',
      timestamp: new Date(),
      notes: emergency.response.externalDispatch.error
    });
    return false;
  }
}

function buildResponderPayload(body, user) {
  const location = normalizeLocation(body.location || {});
  return {
    businessName: body.businessName || user?.companyName || user?.fullName,
    serviceTypes: Array.isArray(body.serviceTypes) ? body.serviceTypes : ['tow_truck'],
    phone: body.phone || user?.phone,
    alternatePhone: body.alternatePhone,
    vehicleDescription: body.vehicleDescription,
    registrationNumber: body.registrationNumber,
    serviceRadiusKm: Number(body.serviceRadiusKm || 30),
    location: {
      ...location,
      updatedAt: new Date()
    }
  };
}

function buildResponderAvailabilityPayload(body, user) {
  const payload = {
    phone: body.phone || user?.phone,
    'availability.isAvailable': Boolean(body.isAvailable),
    'availability.status': body.isAvailable ? 'available' : (body.status || 'offline'),
    'availability.availableUntil': body.availableUntil,
    'availability.lastUpdatedAt': new Date()
  };
  if (body.location) {
    payload.location = { ...normalizeLocation(body.location), updatedAt: new Date() };
  }
  return payload;
}

async function notifyEmergencyContact(emergency, contact) {
  try {
    const sent = await sendSMS(
      contact.phone,
      `Palmtrent SOS: ${contact.name || 'Emergency contact'}, an emergency was triggered at ${formatEmergencyLocation(emergency)}.`
    );
    recordEmergencyNotification(emergency, {
      recipientType: 'emergency_contact',
      channel: 'sms',
      status: sent ? 'sent' : 'failed'
    });

    return sent;
  } catch (error) {
    console.error('Emergency contact notification error:', error);
    recordEmergencyNotification(emergency, {
      recipientType: 'emergency_contact',
      channel: 'sms',
      status: 'failed'
    });
    return false;
  }
}

async function notifyParty(emergency, party, partyType, triggeredByUser = null) {
  try {
    const triggeredByDriver = triggeredByUser?.userType === 'driver';
    await notificationService.notifyEmergency(party._id || party, {
      emergencyId: emergency._id.toString(),
      type: emergency.emergencyType,
      location: emergency.location,
      bookingId: emergency.booking?.toString(),
      shipmentId: emergency.shipment?.toString(),
      triggeredBy: triggeredByUser?._id?.toString() || triggeredByUser?.id?.toString(),
      triggeredByName: triggeredByUser?.fullName,
      triggeredByUserType: triggeredByUser?.userType,
      paymentDecisionRequired: triggeredByDriver && ROADSIDE_TYPES.has(emergency.emergencyType)
    });
    recordEmergencyNotification(emergency, {
      recipient: party._id || party,
      recipientType: partyType,
      channel: 'push',
      status: 'sent'
    });
    return true;
  } catch (error) {
    console.error('Party notification error:', error);
    recordEmergencyNotification(emergency, {
      recipient: party._id,
      recipientType: partyType,
      channel: 'push',
      status: 'failed'
    });
    return false;
  }
}

async function resolveEmergencyPaymentAuthority(emergency, user) {
  const isAdmin = user?.role === 'admin' || user?.userType === 'admin';
  const isRequester = String(emergency.triggeredBy || '') === String(user.id || user._id);
  const populated = await Emergency.findById(emergency._id)
    .populate({
      path: 'booking',
      select: 'bookingReference transporter shipper',
      populate: [
        { path: 'transporter', select: 'fullName phone email userType' },
        { path: 'shipper', select: 'fullName phone email userType' }
      ]
    })
    .populate({
      path: 'shipment',
      select: 'shipmentId bookingReference transporter shipper',
      populate: [
        { path: 'transporter', select: 'fullName phone email userType' },
        { path: 'shipper', select: 'fullName phone email userType' }
      ]
    })
    .populate('triggeredBy', 'fullName phone email userType');

  const transporter = populated?.booking?.transporter || populated?.shipment?.transporter;
  const isTransporter = Boolean(transporter && String(transporter._id || transporter) === String(user.id || user._id));

  return {
    allowed: isAdmin || isRequester || isTransporter,
    isAdmin,
    isRequester,
    isTransporter,
    transporter,
    populated
  };
}

async function notifyRoadsideQuoteDecisionMakers(emergency, responder, quote) {
  const populated = await Emergency.findById(emergency._id)
    .populate({
      path: 'booking',
      select: 'bookingReference transporter',
      populate: { path: 'transporter', select: 'fullName phone email userType' }
    })
    .populate({
      path: 'shipment',
      select: 'shipmentId bookingReference transporter',
      populate: { path: 'transporter', select: 'fullName phone email userType' }
    })
    .populate('triggeredBy', 'fullName phone userType');

  const recipients = new Map();
  const addRecipient = (recipient, type) => {
    const id = recipient?._id || recipient;
    if (!id) return;
    recipients.set(String(id), { recipient, type });
  };

  addRecipient(populated.triggeredBy, 'requester');
  addRecipient(populated.booking?.transporter || populated.shipment?.transporter, 'transporter');

  await Promise.allSettled([...recipients.values()].map(({ recipient, type }) =>
    notificationService.notify(
      recipient._id || recipient,
      'emergency_alert',
      'Roadside quote needs approval',
      `${responder.businessName || 'A roadside provider'} quoted USD ${Number(quote.total || 0).toFixed(2)} for ${quote.serviceType || 'roadside assistance'}. Approve the quote before dispatch.`,
      {
        emergencyId: populated._id.toString(),
        responderId: responder._id.toString(),
        quoteReference: quote.quoteReference,
        quoteStatus: 'quote_submitted',
        amount: quote.total,
        currency: quote.currency || 'USD',
        paymentDecisionRequired: true,
        recipientType: type
      }
    ).then(() => recordEmergencyNotification(emergency, {
      recipient: recipient._id || recipient,
      recipientType: type,
      channel: 'push',
      status: 'sent'
    }))
  ));
}

async function notifyRoadsideQuoteAccepted(emergency, responseItem, populatedEmergency = null) {
  const responder = responseItem.responder
    ? await EmergencyResponder.findById(responseItem.responder).populate('user', 'fullName phone')
    : null;
  if (responseItem.user) {
    await notificationService.notify(
      responseItem.user,
      'emergency_alert',
      'Roadside quote accepted',
      `Your quote for USD ${Number(responseItem.quote?.total || 0).toFixed(2)} was accepted. You can now accept the SOS dispatch.`,
      {
        emergencyId: emergency._id.toString(),
        responderId: String(responseItem.responder || ''),
        quoteStatus: 'quote_accepted',
        amount: responseItem.quote?.total
      }
    );
  }

  const triggeredBy = populatedEmergency?.triggeredBy || emergency.triggeredBy;
  await notificationService.notify(
    triggeredBy._id || triggeredBy,
    'emergency_alert',
    'Roadside quote approved',
    `${responder?.businessName || 'The roadside provider'} quote was approved. Payment can now be completed and the provider can accept dispatch.`,
    {
      emergencyId: emergency._id.toString(),
      responderId: String(responseItem.responder || ''),
      paymentStatus: emergency.billing?.paymentStatus,
      amount: emergency.billing?.amount
    }
  );
}

async function notifyRoadsideQuoteRejected(emergency, responseItem, reason = '') {
  if (!responseItem.user) return;
  await notificationService.notify(
    responseItem.user,
    'emergency_alert',
    'Roadside quote rejected',
    reason || 'Your roadside quote was rejected. You may submit a revised quote if the request is still active.',
    {
      emergencyId: emergency._id.toString(),
      responderId: String(responseItem.responder || ''),
      quoteStatus: 'quote_rejected'
    }
  );
}

async function notifyAccountableTransporterOfRoadsideAcceptance(emergency, responder) {
  try {
    const populated = await Emergency.findById(emergency._id)
      .populate({
        path: 'booking',
        select: 'bookingReference transporter',
        populate: { path: 'transporter', select: 'fullName phone email userType' }
      })
      .populate({
        path: 'shipment',
        select: 'shipmentId bookingReference transporter',
        populate: { path: 'transporter', select: 'fullName phone email userType' }
      })
      .populate('triggeredBy', 'fullName phone userType');

    const transporter = populated?.booking?.transporter || populated?.shipment?.transporter;
    if (!transporter || String(transporter._id || transporter) === String(populated.triggeredBy?._id || populated.triggeredBy)) {
      return false;
    }

    const amount = Number(populated.billing?.amount || 0);
    await notificationService.notify(
      transporter._id || transporter,
      'emergency_alert',
      'Driver SOS assistance accepted',
      `${populated.triggeredBy?.fullName || 'Your driver'} has roadside help accepted by ${responder.businessName || 'a provider'}. Assistance fee: USD ${amount.toFixed(2)}. You can pay separately or use freight allocation where escrow is available.`,
      {
        emergencyId: populated._id.toString(),
        bookingId: populated.booking?._id?.toString(),
        shipmentId: populated.shipment?._id?.toString(),
        paymentStatus: populated.billing?.paymentStatus,
        paymentSourceOptions: ['separate_payment', 'freight_allocation'],
        amount
      }
    );

    recordEmergencyNotification(emergency, {
      recipient: transporter._id || transporter,
      recipientType: 'transporter',
      channel: 'push',
      status: 'sent'
    });
    return true;
  } catch (error) {
    console.error('Transporter roadside acceptance notification error:', error);
    recordEmergencyNotification(emergency, {
      recipientType: 'transporter',
      channel: 'push',
      status: 'failed'
    });
    return false;
  }
}

async function notifySupportOfCancellation(emergency) {
  return notificationService.notifyRole(
    'admin',
    'emergency_alert',
    'SOS Cancelled',
    `Emergency ${emergency._id} was cancelled by the user.`,
    { emergencyId: emergency._id.toString(), status: emergency.status }
  );
}

async function notifyUserOfAcknowledgement(emergency) {
  return notificationService.notify(
    emergency.triggeredBy,
    'emergency_alert',
    'SOS Acknowledged',
    'Support has acknowledged your emergency. Help is being coordinated.',
    { emergencyId: emergency._id.toString(), status: emergency.status }
  );
}

async function notifyUserOfDispatch(emergency, responderType) {
  return notificationService.notify(
    emergency.triggeredBy,
    'emergency_alert',
    'Responder Dispatched',
    `${responderType} has been dispatched to your location.`,
    { emergencyId: emergency._id.toString(), status: emergency.status, responderType }
  );
}

function formatEmergencyLocation(emergency) {
  if (emergency.location?.address) return emergency.location.address;
  if (Array.isArray(emergency.location?.coordinates)) {
    return emergency.location.coordinates.join(', ');
  }
  return 'the last reported location';
}

function getEmergencyNotificationData(emergency, user) {
  return {
    emergencyId: emergency._id.toString(),
    emergencyType: emergency.emergencyType,
    severity: emergency.severity,
    bookingId: emergency.booking?.toString(),
    shipmentId: emergency.shipment?.toString(),
    triggeredBy: user._id?.toString() || user.id?.toString(),
    contactPhone: emergency.contactPhone,
    location: emergency.location
  };
}

function recordEmergencyNotification(emergency, notification) {
  emergency.notifications.push({
    ...notification,
    sentAt: new Date()
  });
}
