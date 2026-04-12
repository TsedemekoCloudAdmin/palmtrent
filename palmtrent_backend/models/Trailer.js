const mongoose = require('mongoose');

const trailerSchema = new mongoose.Schema({
  // Basic Information
  registrationNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },

  // Trailer Type (database-driven)
  trailerType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrailerType',
    required: true
  },

  // Specifications
  year: {
    type: Number,
    min: 1980,
    max: new Date().getFullYear() + 1
  },

  // Capacity and Dimensions
  capacity: {
    weight: {
      value: { type: Number, required: true },
      unit: { type: String, default: 'kg' }
    },
    volume: {
      value: Number,
      unit: { type: String, default: 'm3' }
    },
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: { type: String, default: 'meters' }
    }
  },

  // Technical Specifications
  specifications: {
    numberOfAxles: Number,
    numberOfWheels: Number,
    couplingType: {
      type: String,
      enum: ['fifth_wheel', 'pintle', 'gooseneck', 'bumper_pull'],
      default: 'fifth_wheel'
    },
    brakeType: {
      type: String,
      enum: ['air', 'electric', 'hydraulic', 'surge'],
      default: 'air'
    },
    floorType: {
      type: String,
      enum: ['wood', 'aluminum', 'steel', 'composite']
    },
    sideWalls: {
      type: String,
      enum: ['open', 'enclosed', 'curtain', 'drop_side']
    }
  },

  // Features
  features: {
    refrigeration: { type: Boolean, default: false },
    liftGate: { type: Boolean, default: false },
    loadingRamp: { type: Boolean, default: false },
    tarpaulin: { type: Boolean, default: false },
    sideLoader: { type: Boolean, default: false },
    gps: { type: Boolean, default: false },
    lighting: { type: Boolean, default: true },
    tieDowns: { type: Boolean, default: true }
  },

  // Insurance Information
  insurance: {
    provider: String,
    policyNumber: String,
    expiryDate: Date,
    coverage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InsuranceOption'
    },
    premium: Number,
    document: String
  },

  // Documents
  documents: {
    registration: {
      number: String,
      expiryDate: Date,
      document: String
    },
    roadworthyCertificate: {
      number: String,
      expiryDate: Date,
      document: String
    },
    permits: [{
      type: String,
      number: String,
      expiryDate: Date,
      document: String
    }]
  },

  // Status
  status: {
    type: String,
    enum: ['available', 'rented', 'in_use', 'maintenance', 'inactive'],
    default: 'available'
  },

  // Current Assignment
  currentRental: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Rental'
  },

  // Owner Information
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Rental Settings
  rentalSettings: {
    availableForRental: { type: Boolean, default: true },
    dailyRate: { type: Number, default: 0 },
    weeklyRate: { type: Number, default: 0 },
    monthlyRate: { type: Number, default: 0 },
    deposit: { type: Number, default: 0 },
    minimumRentalPeriod: {
      value: { type: Number, default: 1 },
      unit: { type: String, enum: ['hours', 'days', 'weeks'], default: 'days' }
    },
    maximumRentalPeriod: {
      value: Number,
      unit: { type: String, enum: ['days', 'weeks', 'months'] }
    },
    deliveryAvailable: { type: Boolean, default: false },
    deliveryFee: Number,
    pickupLocations: [{
      address: String,
      city: String,
      coordinates: {
        latitude: Number,
        longitude: Number
      }
    }]
  },

  // Operating Areas
  operatingAreas: [{
    city: String,
    region: String,
    country: { type: String, default: 'Zimbabwe' }
  }],

  // Images
  images: [{
    url: String,
    caption: String,
    isPrimary: { type: Boolean, default: false }
  }],

  // Description
  description: String,

  // Rating
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },

  // Audit Trail
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

// Indexes
trailerSchema.index({ registrationNumber: 1 });
trailerSchema.index({ owner: 1 });
trailerSchema.index({ trailerType: 1 });
trailerSchema.index({ status: 1 });
trailerSchema.index({ 'rentalSettings.availableForRental': 1 });
trailerSchema.index({ 'operatingAreas.city': 1 });

module.exports = mongoose.model('Trailer', trailerSchema);
