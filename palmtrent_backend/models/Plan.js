const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  audience: {
    type: String,
    enum: ['transporter', 'trailer_owner', 'corporate', 'shipper'],
    required: true,
    index: true
  },
  description: String,
  billingCycle: {
    type: String,
    enum: ['monthly', 'quarterly', 'annual'],
    default: 'monthly'
  },
  price: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD'
  },
  trialDays: {
    type: Number,
    default: 0,
    min: 0
  },
  features: [String],
  limits: {
    vehicles: { type: Number, default: 1 },
    drivers: { type: Number, default: 1 },
    monthlyBookings: { type: Number, default: 25 },
    fleetAssets: { type: Number, default: 1 },
    corporateSeats: { type: Number, default: 1 },
    apiAccess: { type: Boolean, default: false },
    priorityMatching: { type: Boolean, default: false }
  },
  commissionAdjustments: {
    shipmentCommissionDiscount: { type: Number, default: 0 },
    rentalCommissionDiscount: { type: Number, default: 0 }
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  sortOrder: {
    type: Number,
    default: 100
  },
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

planSchema.index({ audience: 1, active: 1, sortOrder: 1 });

module.exports = mongoose.model('Plan', planSchema);
