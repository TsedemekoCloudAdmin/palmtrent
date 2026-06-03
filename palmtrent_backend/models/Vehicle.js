const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  // Basic Information
  registrationNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  
  // Database-driven selections
  make: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleMake',
    required: true
  },
  model: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleModel',
    required: true
  },
  vehicleType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'VehicleType',
    required: true
  },
  
  // Vehicle Details
  year: {
    type: Number,
    required: true,
    min: 1980,
    max: new Date().getFullYear() + 1
  },
  color: String,
  vin: String,
  
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
  
  // Specifications
  specifications: {
    engineType: {
      type: String,
      enum: ['petrol', 'diesel', 'electric', 'hybrid'],
      default: 'diesel'
    },
    transmission: {
      type: String,
      enum: ['manual', 'automatic', 'semi-automatic'],
      default: 'manual'
    },
    engineCapacity: String,
    fuelCapacity: Number,
    mileage: Number,
    numberOfAxles: Number,
    numberOfWheels: Number
  },
  
  // Trailer Information
  hasTrailer: Boolean,
  trailerOwned: Boolean,
  trailerType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TrailerType'
  },
  trailerRegistration: String,
  
  // Insurance Information
  insurance: {
    provider: String,
    policyNumber: String,
    expiryDate: Date,
    coverage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InsuranceOption'
    },
    category: {
      type: String,
      enum: ['general', 'dangerous_goods', 'livestock', 'agriculture']
    },
    premium: Number,
    document: String
  },
  
  // Features
  features: {
    gps: { type: Boolean, default: false },
    refrigeration: { type: Boolean, default: false },
    liftGate: { type: Boolean, default: false },
    loadingRamp: { type: Boolean, default: false },
    airRide: { type: Boolean, default: false },
    tarpaulin: { type: Boolean, default: false },
    secureStorage: { type: Boolean, default: false }
  },
  
  // Special features for database-driven selection
  specialFeatures: [{
    type: String,
    ref: 'VehicleType.features'
  }],
  
  // Payment Reference for Cash Agent
  paymentReferences: [{
    method: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentOption'
    },
    reference: String,
    amount: Number,
    date: Date,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed'],
      default: 'pending'
    }
  }],
  
  // Operating Areas
  operatingAreas: [{
    city: String,
    region: String,
    country: { type: String, default: 'Zimbabwe' }
  }],
  
  // Documents
  documents: {
    license: {
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

  verification: {
    status: {
      type: String,
      enum: ['not_started', 'pending', 'approved', 'rejected'],
      default: 'pending'
    },
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    authorityChecks: [{
      documentType: String,
      authority: String,
      method: {
        type: String,
        enum: ['portal', 'phone', 'email', 'in_person', 'api', 'other'],
        default: 'portal'
      },
      referenceNumber: String,
      result: {
        type: String,
        enum: ['passed', 'failed', 'inconclusive'],
        default: 'inconclusive'
      },
      checkedAt: Date,
      checkedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      expiryDate: Date,
      notes: String
    }],
    notes: String
  },
  
  // Status
  status: {
    type: String,
    enum: ['available', 'in_use', 'maintenance', 'inactive'],
    default: 'available'
  },
  
  // Owner Information
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  ownerType: {
    type: String,
    enum: ['individual', 'company'],
    default: 'individual'
  },

  // Assigned Driver
  assignedDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },

  // Rental History
  rentalHistory: [{
    rental: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rental'
    },
    renter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['completed', 'cancelled', 'active'],
      default: 'active'
    }
  }],
  
  // Rental Information
  rentalSettings: {
    availableForRental: { type: Boolean, default: false },
    dailyRate: Number,
    weeklyRate: Number,
    monthlyRate: Number,
    deposit: Number,
    minimumRentalPeriod: {
      value: Number,
      unit: { type: String, enum: ['hours', 'days', 'weeks'], default: 'days' }
    }
  },

  pricing: {
    availableForRental: { type: Boolean, default: false },
    dailyRate: Number,
    weeklyRate: Number,
    monthlyRate: Number,
    deposit: Number,
    minimumRentalPeriod: {
      value: Number,
      unit: { type: String, enum: ['hours', 'days', 'weeks'], default: 'days' }
    }
  },
  
  // Images
  images: [{
    url: String,
    caption: String,
    isPrimary: { type: Boolean, default: false }
  }],

  photos: [{
    type: String,
    url: String,
    storageKey: String,
    storageProvider: String,
    uploadedAt: Date
  }],
  
  // Description
  description: String,
  
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
vehicleSchema.index({ owner: 1 });
vehicleSchema.index({ vehicleType: 1 });
vehicleSchema.index({ status: 1 });
vehicleSchema.index({ 'insurance.expiryDate': 1 });

module.exports = mongoose.model('Vehicle', vehicleSchema);
