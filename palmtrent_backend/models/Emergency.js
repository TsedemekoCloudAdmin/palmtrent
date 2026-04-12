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
    enum: ['shipper', 'transporter', 'driver'],
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
        enum: ['police', 'ambulance', 'fire', 'tow_truck', 'support_team', 'other']
      },
      dispatchedAt: Date,
      arrivedAt: Date,
      notes: String
    }],
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
emergencySchema.methods.dispatchResponder = function(type, userId) {
  this.status = 'responding';
  this.response.responders.push({
    type,
    dispatchedAt: new Date()
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
    .sort({ priority: 1, createdAt: 1 });
};

// Static: Get user's emergency history
emergencySchema.statics.getUserEmergencies = function(userId) {
  return this.find({ triggeredBy: userId })
    .sort({ createdAt: -1 })
    .limit(10);
};

module.exports = mongoose.model('Emergency', emergencySchema);
