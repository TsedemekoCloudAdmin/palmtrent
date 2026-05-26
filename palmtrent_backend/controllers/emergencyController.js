const Emergency = require('../models/Emergency');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const notificationService = require('../services/notificationService');
const { sendSMS } = require('../utils/sendSMS');

// Emergency contact numbers (configurable)
const EMERGENCY_CONTACTS = {
  police: '+263 995',
  ambulance: '+263 994',
  fire: '+263 993',
  support: process.env.SUPPORT_PHONE || '+263 77 123 4567'
};

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
      voiceNote
    } = req.body;

    // Validate required fields
    if (!location || !location.coordinates) {
      return res.status(400).json({
        success: false,
        message: 'Location coordinates are required'
      });
    }

    // Get user details
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Determine user type
    const userType = user.userType === 'transporter' ? 'transporter' : 'shipper';

    // Create emergency record
    const emergency = await Emergency.create({
      triggeredBy: req.user.id,
      userType,
      emergencyType: emergencyType || 'other',
      severity,
      location: {
        type: 'Point',
        coordinates: location.coordinates, // [lng, lat]
        address: location.address,
        city: location.city,
        country: location.country || 'Zimbabwe'
      },
      description,
      booking: bookingId,
      shipment: shipmentId,
      contactPhone: user.phone,
      photos: photos || [],
      voiceNote,
      priority: severity === 'critical' ? 1 : (severity === 'high' ? 2 : 3)
    });

    // Send immediate notifications
    const notificationPromises = [];

    // 1. Notify support team
    notificationPromises.push(
      notifySupport(emergency, user)
    );

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

    // 3. If there's a booking, notify the other party
    if (bookingId) {
      const booking = await Booking.findById(bookingId).populate('shipper transporter');
      if (booking) {
        const otherParty = userType === 'shipper' ? booking.transporter : booking.shipper;
        if (otherParty) {
          notificationPromises.push(
            notifyParty(emergency, otherParty, userType === 'shipper' ? 'transporter' : 'shipper')
          );
        }
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
        emergencyContacts: EMERGENCY_CONTACTS,
        supportPhone: EMERGENCY_CONTACTS.support,
        location: emergency.location
      }
    });
  } catch (error) {
    console.error('SOS trigger error:', error);
    res.status(500).json({
      success: false,
      message: 'Error triggering SOS. Please call emergency services directly.',
      emergencyContacts: EMERGENCY_CONTACTS
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

    res.json({
      success: true,
      data: {
        emergencyServices: EMERGENCY_CONTACTS,
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

async function notifySupport(emergency, user) {
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

    if (process.env.SUPPORT_PHONE) {
      const supportSmsSent = await sendSMS(
        process.env.SUPPORT_PHONE,
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

async function notifyParty(emergency, party, partyType) {
  try {
    await notificationService.notifyEmergency(party._id, {
      emergencyId: emergency._id.toString(),
      type: emergency.emergencyType,
      location: emergency.location,
      bookingId: emergency.booking?.toString()
    });
    recordEmergencyNotification(emergency, {
      recipient: party._id,
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
