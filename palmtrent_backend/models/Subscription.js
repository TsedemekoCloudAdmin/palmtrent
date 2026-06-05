const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  corporateAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateAccount'
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plan',
    required: true
  },
  audience: {
    type: String,
    enum: ['transporter', 'trailer_owner', 'rental_owner', 'driver', 'roadside_provider', 'corporate', 'shipper'],
    required: true
  },
  status: {
    type: String,
    enum: ['trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired'],
    default: 'trialing',
    index: true
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual'],
    default: 'monthly'
  },
  amount: {
    type: Number,
    default: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  currentPeriodStart: Date,
  currentPeriodEnd: Date,
  trialEndsAt: Date,
  cancelledAt: Date,
  suspendedAt: Date,
  nextBillingAt: Date,
  payment: {
    lastPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    status: {
      type: String,
      enum: ['not_required', 'pending', 'paid', 'failed', 'waived'],
      default: 'pending'
    },
    method: String,
    reference: String
  },
  seats: {
    included: { type: Number, default: 1 },
    used: { type: Number, default: 1 },
    extraSeatPrice: { type: Number, default: 0 }
  },
  usage: {
    vehicles: { type: Number, default: 0 },
    drivers: { type: Number, default: 0 },
    fleetAssets: { type: Number, default: 0 },
    bookingsThisPeriod: { type: Number, default: 0 }
  },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ corporateAccount: 1, status: 1 });
subscriptionSchema.index({ nextBillingAt: 1, status: 1 });

module.exports = mongoose.model('Subscription', subscriptionSchema);
