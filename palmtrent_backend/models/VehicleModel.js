const mongoose = require('mongoose');

const vehicleModelSchema = new mongoose.Schema({
  make: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleMake',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  yearRange: {
    start: Number,
    end: Number
  },
  variants: [String],
  specifications: {
    engineCapacity: String,
    fuelType: {
      type: String,
      enum: ['petrol', 'diesel', 'electric', 'hybrid']
    },
    transmission: {
      type: String,
      enum: ['manual', 'automatic', 'semi-automatic']
    }
  },
  compatibleVehicleTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleType'
  }]
}, {
  timestamps: true
});

// Compound index for unique model per make
vehicleModelSchema.index({ make: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('VehicleModel', vehicleModelSchema);