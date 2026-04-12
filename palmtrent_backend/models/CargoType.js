const mongoose = require('mongoose');

const cargoTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    enum: ['general', 'bulk', 'liquid', 'refrigerated', 'hazardous', 'live'],
    required: true
  },
  description: String,
  specialRequirements: [String],
  packagingTypes: [String],
  insuranceCategory: {
    type: String,
    enum: ['general', 'dangerous_goods', 'livestock', 'agriculture', 'hazardous'],
    default: 'general'
  },
  recommendedVehicleTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleType'
  }],
  recommendedTrailerTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrailerType'
  }],
  handlingInstructions: String,
  temperatureRequirements: {
    min: Number,
    max: Number,
    unit: {
      type: String,
      default: 'celsius'
    }
  },
  moistureSensitivity: {
    type: String,
    enum: ['none', 'low', 'medium', 'high']
  },
  isFragile: Boolean,
  requiresSpecialDocumentation: Boolean,
  baseInsuranceRate: Number
}, {
  timestamps: true
});

module.exports = mongoose.model('CargoType', cargoTypeSchema);