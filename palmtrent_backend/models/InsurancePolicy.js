const mongoose = require('mongoose');

const insurancePolicySchema = new mongoose.Schema({
  policyNumber: {
    type: String,
    unique: true,
    default: () => `POL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsuranceProvider'
  },
  holder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'issued', 'active', 'expired', 'cancelled', 'renewed'],
    default: 'draft'
  },
  coverageType: String,
  cargoValue: Number,
  coverageAmount: Number,
  premium: Number,
  excess: Number,
  effectiveFrom: Date,
  expiresAt: Date,
  documentUrl: String,
  renewalOf: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'InsurancePolicy'
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  issuedAt: Date
}, {
  timestamps: true
});

insurancePolicySchema.index({ booking: 1 });
insurancePolicySchema.index({ holder: 1, status: 1 });
insurancePolicySchema.index({ expiresAt: 1 });

module.exports = mongoose.model('InsurancePolicy', insurancePolicySchema);
