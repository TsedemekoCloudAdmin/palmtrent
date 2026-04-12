const mongoose = require('mongoose');

const paymentOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['digital', 'cash', 'bank_transfer', 'mobile_money', 'credit'],
    required: true
  },
  provider: {
    type: String,
    enum: ['ecocash', 'onemoney', 'bank', 'cash_agent', 'paynow', 'visa', 'mastercard']
  },
  description: String,
  feeStructure: {
    type: {
      type: String,
      enum: ['percentage', 'fixed', 'hybrid']
    },
    percentage: Number,
    fixedAmount: Number,
    minFee: Number,
    maxFee: Number
  },
  processingTime: String,
  requiresAgent: {
    type: Boolean,
    default: false
  },
  agentInstructions: String,
  isActive: {
    type: Boolean,
    default: true
  },
  supportedCurrencies: [String],
  minAmount: Number,
  maxAmount: Number,
  referenceFormat: String,
  verificationRequired: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('PaymentOption', paymentOptionSchema);