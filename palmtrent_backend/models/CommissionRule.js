const mongoose = require('mongoose');

const commissionRuleSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true
  },
  target: {
    type: String,
    enum: ['shipment', 'rental', 'subscription', 'roadside_assistance'],
    required: true,
    index: true
  },
  audience: {
    type: String,
    enum: ['shipper', 'transporter', 'trailer_owner', 'rental_owner', 'driver', 'roadside_provider', 'corporate', 'all'],
    default: 'all',
    index: true
  },
  paymentMethod: {
    type: String,
    default: 'all',
    index: true
  },
  accountTier: {
    type: String,
    default: 'all'
  },
  priority: {
    type: Number,
    default: 100
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  platformFeeRate: {
    type: Number,
    default: 0
  },
  transporterCommissionRate: {
    type: Number,
    default: 0
  },
  rentalCommissionRate: {
    type: Number,
    default: 0
  },
  minimumFee: {
    type: Number,
    default: 0
  },
  maximumFee: Number,
  effectiveFrom: Date,
  effectiveTo: Date,
  notes: String,
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

commissionRuleSchema.index({ target: 1, audience: 1, paymentMethod: 1, enabled: 1, priority: 1 });

module.exports = mongoose.model('CommissionRule', commissionRuleSchema);
