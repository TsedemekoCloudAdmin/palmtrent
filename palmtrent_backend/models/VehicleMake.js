const mongoose = require('mongoose');

const vehicleMakeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  country: String,
  isPopular: {
    type: Boolean,
    default: false
  },
  logo: String,
  models: [{
    name: String,
    years: [Number],
    variants: [String]
  }],
  vehicleTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleType'
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('VehicleMake', vehicleMakeSchema);