const mongoose = require('mongoose');

const trailerTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  description: String,
  category: {
    type: String,
    enum: ['flatbed', 'enclosed', 'specialized', 'tanker', 'refrigerated'],
    required: true
  },
  capacityRange: {
    min: Number,
    max: Number,
    unit: {
      type: String,
      enum: ['kg', 'tonnes', 'liters', 'cubic_meters'],
      default: 'tonnes'
    }
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      default: 'meters'
    }
  },
  suitableForCargoTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CargoType'
  }],
  specialFeatures: [String],
  requirements: {
    minTowingCapacity: Number,
    licenseClass: String,
    specialPermits: [String]
  },
  baseImage: String,
  baseRentalRate: Number
}, {
  timestamps: true
});

module.exports = mongoose.model('TrailerType', trailerTypeSchema);