// models/Escrow.js
const mongoose = require('mongoose');

const escrowSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  payment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    required: true
  },
  escrowReference: {
    type: String,
    unique: true,
    default: () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 8).toUpperCase();
      return `ESC-${timestamp}-${random}`;
    }
  },
  amount: {
    type: Number,
    required: true
  },
  platformFee: {
    type: Number,
    required: true
  },
  transporterPayout: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  status: {
    type: String,
    enum: ['held', 'pending_release', 'released', 'disputed', 'refunded', 'partially_refunded'],
    default: 'held'
  },
  releaseConditions: {
    deliveryConfirmed: {
      type: Boolean,
      default: false
    },
    gracePeriodExpired: {
      type: Boolean,
      default: false
    },
    noActiveDispute: {
      type: Boolean,
      default: true
    }
  },
  commissionRate: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['digital', 'ecocash', 'onemoney', 'card', 'bank_transfer', 'openapi_africa', 'clicknpay', 'cash_agent', 'cash_on_pickup', 'cash_on_delivery', 'corporate'],
    required: true
  },
  heldAt: {
    type: Date,
    default: Date.now
  },
  gracePeriodEndsAt: Date,
  releaseScheduledAt: Date,
  releasedAt: Date,
  refundedAt: Date,
  disputeRaisedAt: Date,
  dispute: {
    reason: String,
    raisedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    description: String,
    status: {
      type: String,
      enum: ['pending', 'under_review', 'resolved_shipper', 'resolved_transporter', 'resolved_split'],
      default: 'pending'
    },
    resolution: String,
    resolvedAt: Date
  },
  refund: {
    amount: Number,
    reason: String,
    processedAt: Date,
    processedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  transporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  shipper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  payoutDetails: {
    method: {
      type: String,
      enum: ['ecocash', 'onemoney', 'bank_transfer']
    },
    accountNumber: String,
    reference: String,
    processedAt: Date
  },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Generate escrow reference before save
escrowSchema.pre('save', function(next) {
  if (this.isNew && !this.escrowReference) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.escrowReference = `ESC-${timestamp}-${random}`;
  }
  next();
});

// Calculate grace period end (24 hours after delivery confirmation)
escrowSchema.methods.setGracePeriod = function() {
  if (this.releaseConditions.deliveryConfirmed && !this.gracePeriodEndsAt) {
    this.gracePeriodEndsAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    this.releaseScheduledAt = this.gracePeriodEndsAt;
  }
};

// Check if escrow can be released
escrowSchema.methods.canRelease = function() {
  return (
    this.status === 'held' &&
    this.releaseConditions.deliveryConfirmed &&
    this.releaseConditions.gracePeriodExpired &&
    this.releaseConditions.noActiveDispute
  );
};

// Hold dispute
escrowSchema.methods.raiseDispute = function(userId, reason, description) {
  this.status = 'disputed';
  this.releaseConditions.noActiveDispute = false;
  this.disputeRaisedAt = new Date();
  this.dispute = {
    reason,
    raisedBy: userId,
    description,
    status: 'pending'
  };
};

// Static method to find escrows ready for release
escrowSchema.statics.findReadyForRelease = function() {
  return this.find({
    status: { $in: ['held', 'pending_release'] },
    'releaseConditions.deliveryConfirmed': true,
    'releaseConditions.noActiveDispute': true,
    gracePeriodEndsAt: { $lte: new Date() }
  });
};

// Indexes
escrowSchema.index({ booking: 1 });
escrowSchema.index({ payment: 1 });
escrowSchema.index({ booking: 1, payment: 1 }, { unique: true });
escrowSchema.index({ status: 1 });
escrowSchema.index({ transporter: 1 });
escrowSchema.index({ shipper: 1 });
escrowSchema.index({ gracePeriodEndsAt: 1 });
escrowSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Escrow', escrowSchema);
