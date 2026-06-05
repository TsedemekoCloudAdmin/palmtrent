const mongoose = require('mongoose');

const emergencySchema = new mongoose.Schema({
  // Who triggered the emergency
  triggeredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userType: {
    type: String,
    enum: ['shipper', 'transporter', 'driver', 'trailer_owner', 'rental_owner', 'roadside_provider', 'corporate'],
    required: true
  },
  // Related booking/shipment
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  shipment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipment'
  },
  // Emergency details
  emergencyType: {
    type: String,
    enum: [
      'accident',
      'breakdown',
      'hijacking',
      'medical',
      'fire',
      'theft',
      'harassment',
      'road_block',
      'weather',
      'other'
    ],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'high'
  },
  // Location when triggered
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    address: String,
    city: String,
    country: String
  },
  // Description
  description: String,
  voiceNote: String, // URL to voice recording
  photos: [String], // URLs to photos
  // Contact info at time of emergency
  contactPhone: String,
  alternatePhone: String,
  billing: {
    payer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    paymentReference: String,
    paymentStatus: {
      type: String,
      enum: ['not_required', 'pending', 'initiated', 'processing', 'paid', 'failed', 'waived'],
      default: 'pending'
    },
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'USD'
    },
    platformFee: {
      type: Number,
      default: 0
    },
    providerEarnings: {
      type: Number,
      default: 0
    },
    pricingSource: {
      type: String,
      enum: ['default', 'admin_override', 'provider_quote'],
      default: 'default'
    },
    paymentSource: {
      type: String,
      enum: ['separate_payment', 'freight_allocation'],
      default: 'separate_payment'
    },
    freightAllocation: {
      booking: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking'
      },
      escrow: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Escrow'
      },
      allocatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      allocatedAt: Date,
      amount: Number
    },
    paidAt: Date,
    settlementStatus: {
      type: String,
      enum: ['pending', 'payout_pending', 'settled', 'disputed'],
      default: 'pending'
    },
    settledAt: Date,
    notes: String
  },
  // Status tracking
  status: {
    type: String,
    enum: [
      'triggered',      // Just triggered
      'acknowledged',   // Support team acknowledged
      'responding',     // Help is on the way
      'on_scene',       // Help has arrived
      'resolved',       // Emergency resolved
      'false_alarm',    // Was a false alarm
      'cancelled'       // User cancelled
    ],
    default: 'triggered'
  },
  // Response tracking
  response: {
    acknowledgedAt: Date,
    acknowledgedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    responders: [{
      type: {
        type: String,
        enum: ['police', 'ambulance', 'fire', 'tow_truck', 'mechanic', 'support_team', 'other']
      },
      responder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'EmergencyResponder'
      },
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      dispatchedAt: Date,
      arrivedAt: Date,
      acceptedAt: Date,
      declinedAt: Date,
      status: {
        type: String,
        enum: ['notified', 'quote_submitted', 'quote_accepted', 'quote_rejected', 'accepted', 'declined', 'on_scene', 'completed'],
        default: 'notified'
      },
      quote: {
        quoteReference: String,
        serviceType: {
          type: String,
          enum: ['tow_truck', 'mechanic', 'battery', 'fuel', 'tyre', 'lockout', 'accident_recovery', 'other']
        },
        pricingMode: {
          type: String,
          enum: ['base', 'custom'],
          default: 'base'
        },
        destination: {
          address: String,
          coordinates: {
            type: [Number]
          }
        },
        distanceKm: {
          type: Number,
          default: 0
        },
        baseFee: {
          type: Number,
          default: 0
        },
        distanceFee: {
          type: Number,
          default: 0
        },
        calloutFee: {
          type: Number,
          default: 0
        },
        labourFee: {
          type: Number,
          default: 0
        },
        partsEstimate: {
          type: Number,
          default: 0
        },
        towingFee: {
          type: Number,
          default: 0
        },
        total: {
          type: Number,
          default: 0
        },
        currency: {
          type: String,
          default: 'USD'
        },
        notes: String,
        submittedAt: Date,
        acceptedAt: Date,
        acceptedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        rejectedAt: Date,
        rejectedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        }
      },
      notes: String
    }],
    externalDispatch: {
      provider: String,
      requestedAt: Date,
      status: {
        type: String,
        enum: ['not_configured', 'sent', 'failed', 'not_required'],
        default: 'not_required'
      },
      reference: String,
      response: mongoose.Schema.Types.Mixed,
      error: String
    },
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolutionNotes: String
  },
  // Notifications sent
  notifications: [{
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    recipientType: String,
    channel: {
      type: String,
      enum: ['sms', 'push', 'email', 'whatsapp', 'call']
    },
    sentAt: Date,
    status: {
      type: String,
      enum: ['pending', 'sent', 'delivered', 'failed']
    }
  }],
  // Emergency contacts notified
  emergencyContactsNotified: [{
    name: String,
    phone: String,
    relationship: String,
    notifiedAt: Date
  }],
  // Timeline of events
  timeline: [{
    event: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }],
  // Priority for support queue
  priority: {
    type: Number,
    default: 1 // 1 = highest
  },
  // Auto-escalation
  escalation: {
    level: {
      type: Number,
      default: 0
    },
    escalatedAt: Date,
    escalationReason: String
  }
}, {
  timestamps: true
});

// Geospatial index for location queries
emergencySchema.index({ location: '2dsphere' });
emergencySchema.index({ status: 1, createdAt: -1 });
emergencySchema.index({ triggeredBy: 1, createdAt: -1 });
emergencySchema.index({ priority: 1, status: 1 });
emergencySchema.index({ emergencyType: 1, status: 1, createdAt: -1 });

// Pre-save: Add to timeline
emergencySchema.pre('save', function(next) {
  if (this.isNew) {
    this.timeline.push({
      event: 'Emergency triggered',
      timestamp: new Date(),
      actor: this.triggeredBy
    });
  }
  next();
});

// Method: Add timeline event
emergencySchema.methods.addTimelineEvent = function(event, actor, notes) {
  this.timeline.push({
    event,
    timestamp: new Date(),
    actor,
    notes
  });
  return this.save();
};

// Method: Acknowledge emergency
emergencySchema.methods.acknowledge = async function(userId) {
  this.status = 'acknowledged';
  this.response.acknowledgedAt = new Date();
  this.response.acknowledgedBy = userId;
  this.timeline.push({
    event: 'Emergency acknowledged by support team',
    timestamp: new Date(),
    actor: userId
  });
  return this.save();
};

// Method: Dispatch responder
emergencySchema.methods.dispatchResponder = function(type, userId, responder = null, notes = '') {
  this.status = 'responding';
  this.response.responders.push({
    type,
    responder: responder?._id,
    user: responder?.user,
    dispatchedAt: new Date(),
    status: 'notified',
    notes
  });
  this.timeline.push({
    event: `${type} dispatched`,
    timestamp: new Date(),
    actor: userId
  });
  return this.save();
};

// Method: Resolve emergency
emergencySchema.methods.resolve = function(userId, notes) {
  this.status = 'resolved';
  this.response.resolvedAt = new Date();
  this.response.resolvedBy = userId;
  this.response.resolutionNotes = notes;
  this.timeline.push({
    event: 'Emergency resolved',
    timestamp: new Date(),
    actor: userId,
    notes
  });
  return this.save();
};

// Static: Get active emergencies
emergencySchema.statics.getActiveEmergencies = function() {
  return this.find({
    status: { $in: ['triggered', 'acknowledged', 'responding', 'on_scene'] }
  })
    .populate('triggeredBy', 'fullName phone')
    .populate('booking', 'bookingReference')
    .populate('response.responders.user', 'fullName phone')
    .populate('response.responders.responder', 'businessName serviceTypes availability')
    .sort({ priority: 1, createdAt: 1 });
};

// Static: Get user's emergency history
emergencySchema.statics.getUserEmergencies = function(userId) {
  return this.find({ triggeredBy: userId })
    .sort({ createdAt: -1 })
    .limit(10);
};

module.exports = mongoose.model('Emergency', emergencySchema);
