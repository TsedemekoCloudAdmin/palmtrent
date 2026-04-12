const mongoose = require('mongoose');

const insuranceOptionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    enum: ['general', 'dangerous_goods', 'livestock', 'agriculture', 'hazardous'],
    required: true
  },
  description: String,
  coverageTypes: [{
    type: String,
    enum: ['theft', 'damage', 'accident', 'liability', 'transit', 'weather']
  }],
  baseRate: {
    type: Number,
    required: true
  },
  rateType: {
    type: String,
    enum: ['percentage', 'fixed', 'per_kg', 'per_km'],
    default: 'percentage'
  },
  calculation: {
    baseValue: Number,
    minPremium: Number,
    maxPremium: Number,
    perKgRate: Number,
    perKmRate: Number
  },
  applicableCargoTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CargoType'
  }],
  applicableVehicleTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleType'
  }],
  documentRequirements: [String],
  claimProcess: String,
  exclusions: [String],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('InsuranceOption', insuranceOptionSchema);