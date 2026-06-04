const mongoose = require('mongoose');

const vehicleTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true
  },
  category: {
    type: String,
    enum: ['bakkie', 'truck', 'tractor', 'van'],
    required: true
  },
  subcategory: {
    type: String,
    enum: [
      // Bakkie subcategories
      'single_cab', 'double_cab', 'panel_van', 'delivery_van',
      // Truck subcategories
      '3ton', '5ton', '7ton', '10ton', '15ton', '20ton', '30ton',
      // Tractor subcategories
      'horse_only', 'with_trailer',
      // Van subcategories
      'cargo_van', 'sprinter'
    ]
  },
  description: String,
  capacity: {
    weight: {
      min: Number,
      max: Number,
      unit: {
        type: String,
        enum: ['kg', 'tonnes'],
        default: 'tonnes'
      }
    },
    volume: {
      min: Number,
      max: Number,
      unit: {
        type: String,
        enum: ['cubic_meters', 'liters'],
        default: 'cubic_meters'
      }
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
  // Whether this vehicle type typically comes with or requires a trailer
  trailerConfiguration: {
    hasIntegratedTrailer: {
      type: Boolean,
      default: false
    },
    canAttachTrailer: {
      type: Boolean,
      default: false
    },
    requiresTrailer: {
      type: Boolean,
      default: false
    },
    compatibleTrailerTypes: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrailerType'
    }]
  },
  // What cargo types this vehicle is suitable for
  suitableCargoCategories: [{
    type: String,
    enum: ['general', 'bulk', 'liquid', 'refrigerated', 'hazardous', 'live']
  }],
  suitableForCargoTypes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CargoType'
  }],
  // Special capabilities
  specialCapabilities: [{
    type: String,
    enum: [
      'refrigerated', 'heated', 'livestock', 'tanker', 'tipper',
      'flatbed', 'curtain_side', 'container', 'car_carrier',
      'crane_equipped', 'tail_lift', 'dangerous_goods', 'timber', 'logging'
    ]
  }],
  // Requirements to operate
  requirements: {
    licenseClass: {
      type: String,
      enum: ['code_8', 'code_10', 'code_14', 'ec', 'ec1'],
      required: true
    },
    specialPermits: [String],
    minExperienceYears: Number
  },
  // Pricing factors
  pricing: {
    baseRatePerKm: Number,
    minimumCharge: Number,
    fuelEfficiency: Number, // km per liter
    averageFuelCostPerKm: Number
  },
  // Display
  icon: String,
  image: String,
  displayOrder: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
vehicleTypeSchema.index({ category: 1, isActive: 1 });
vehicleTypeSchema.index({ 'capacity.weight.max': 1 });

module.exports = mongoose.model('VehicleType', vehicleTypeSchema);
