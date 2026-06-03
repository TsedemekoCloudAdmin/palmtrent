// models/Payment.js
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  rental: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rental'
  },
  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  paymentReference: {
    type: String,
    required: true,
    unique: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentMethod: {
    type: String,
    enum: ['digital', 'ecocash', 'onemoney', 'card', 'bank_transfer', 'openapi_africa', 'clicknpay', 'cash_agent', 'cash_on_pickup', 'cash_on_delivery', 'corporate'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'initiated', 'processing', 'confirmed', 'failed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  gateway: {
    type: String,
    enum: ['paynow', 'openapi_africa', 'cash', 'none'],
    default: 'none'
  },
  gatewayReference: String,
  pollUrl: String,
  customer: {
    email: String,
    phone: String
  },
  metadata: mongoose.Schema.Types.Mixed,
  initiatedAt: Date,
  confirmedAt: Date,
  failedAt: Date,
  expiresAt: Date
}, {
  timestamps: true
});

// Generate payment reference before save
paymentSchema.pre('save', function(next) {
  if (this.isNew && !this.paymentReference) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    this.paymentReference = `PAY-${timestamp}-${random}`;
  }
  next();
});

// Indexes
paymentSchema.index({ booking: 1 });
paymentSchema.index({ subscription: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ createdAt: -1 });
paymentSchema.index({ expiresAt: 1 });

module.exports = mongoose.model('Payment', paymentSchema);
