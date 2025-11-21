const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Basic vehicle information
  vehicleType: {
    type: String,
    enum: [
      'truck',
      'trailer',
      'van',
      'pickup',
      'flatbed',
      'refrigerated',
      'tanker',
      'container',
      'other'
    ],
    required: true,
    default:'truck',
  },

  // Enhanced type classification
  category: {
    type: String,
    enum: ['bakkie', 'truck', 'tractor'],
    required: true
  },
  subType: String, // e.g., 'single_cab', '7ton', etc.
  
  // Trailer configuration
  hasTrailer: Boolean,
  trailerType: String,
  trailerOwned: Boolean,

  registrationNumber: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },

  make: {
    type: String,
    required: true
  },

  model: {
    type: String,
    required: true
  },

  year: {
    type: Number,
    required: true,
    min: 1980,
    max: new Date().getFullYear() + 1
  },

  color: String,

  // Capacity and dimensions
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

  // Vehicle specifications
  specifications: {
    engineType: {
      type: String,
      enum: ['petrol', 'diesel', 'electric', 'hybrid'],
      default:'diesel'
    },
    transmission: {
      type: String,
      enum: ['manual', 'automatic'],
       default: 'manual'
    },
    fuelCapacity: Number,
    mileage: Number,
    numberOfAxles: Number,
    numberOfWheels: Number
  },

  // Features and equipment
  features: {
    gps: { type: Boolean, default: false },
    refrigeration: { type: Boolean, default: false },
    liftGate: { type: Boolean, default: false },
    loadingRamp: { type: Boolean, default: false },
    airRide: { type: Boolean, default: false },
    tarpaulin: { type: Boolean, default: false },
    secureStorage: { type: Boolean, default: false }
  },
  
  // Special features array for detailed selection
  specialFeatures: [String],

  // Documents and compliance
  documents: {
    license: {
      number: String,
      expiryDate: Date,
      document: String
    },
    insurance: {
      provider: String,
      policyNumber: String,
      expiryDate: Date,
      coverage: Number,
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

  // Verification and approval
  verification: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'expired'],
      default: 'pending'
    },
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String,
    rejectionReason: String
  },

  // Operational status
  status: {
    type: String,
    enum: ['available', 'rented', 'in_use', 'maintenance', 'inactive', 'retired'],
    default: 'available'
  },

  availability: {
    isAvailable: { type: Boolean, default: true },
    availableFrom: Date,
    availableTo: Date,
    unavailableReason: String
  },

  // Current location
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      default: [0, 0]
    },
    address: String,
    lastUpdated: Date
  },

  // Maintenance tracking
  maintenance: {
    lastServiceDate: Date,
    nextServiceDate: Date,
    nextServiceMileage: Number,
    maintenanceHistory: [{
      date: Date,
      type: {
        type: String,
        enum: ['routine', 'repair', 'inspection', 'other']
      },
      description: String,
      cost: Number,
      mileage: Number,
      performedBy: String,
      documents: [String]
    }]
  },

  // Enhanced Pricing (for rentals)
  pricing: {
    dailyRate: Number,
    weeklyRate: Number,
    monthlyRate: Number,
    perKmRate: Number,
    currency: { type: String, default: 'USD' },
    deposit: Number,
    minimumRentalPeriod: {
      value: Number,
      unit: { type: String, enum: ['hours', 'days', 'weeks'], default: 'days' }
    },
    // Rental availability settings
    availableForRental: { type: Boolean, default: false },
    rentalTerms: String,
    deliveryOption: { type: Boolean, default: false },
    deliveryRadius: Number // in km
  },

  // Images
  images: [{
    url: String,
    caption: String,
    isPrimary: { type: Boolean, default: false },
    uploadedAt: { type: Date, default: Date.now }
  }],

  // Statistics
  statistics: {
    totalTrips: { type: Number, default: 0 },
    totalDistance: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    rentalRevenue: { type: Number, default: 0 }, // Separate rental earnings
    averageRating: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0 }
  },

  // Operating areas
  operatingAreas: [{
    city: String,
    region: String,
    country: { type: String, default: 'Zimbabwe' }
  }],

  // Driver assignment
  assignedDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },

  // Notes and additional info
  description: String,
  notes: String,

  // For trailers: towing requirements
  towingRequirements: {
    minimumTowingCapacity: Number,
    hitchType: String,
    electricalConnector: String
  },

  // Rental history
  rentalHistory: [{
    rental: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Rental'
    },
    startDate: Date,
    endDate: Date,
    renter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }]

}, {
  timestamps: true
});

// Indexes for better query performance
vehicleSchema.index({ owner: 1, status: 1 });
vehicleSchema.index({ vehicleType: 1, status: 1 });
vehicleSchema.index({ registrationNumber: 1 });
vehicleSchema.index({ 'verification.status': 1 });
vehicleSchema.index({ 'availability.isAvailable': 1 });
vehicleSchema.index({ 'pricing.availableForRental': 1, status: 1 }); // For rental queries
vehicleSchema.index({ currentLocation: '2dsphere' });
vehicleSchema.index({ 'documents.insurance.expiryDate': 1 });
vehicleSchema.index({ 'documents.license.expiryDate': 1 });

// Virtual for checking if documents are expiring soon
vehicleSchema.virtual('isDocumentExpiringSoon').get(function() {
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const licenseExpiring = this.documents?.license?.expiryDate &&
                          new Date(this.documents.license.expiryDate) <= thirtyDaysFromNow;
  const insuranceExpiring = this.documents?.insurance?.expiryDate &&
                            new Date(this.documents.insurance.expiryDate) <= thirtyDaysFromNow;
  const roadworthyExpiring = this.documents?.roadworthyCertificate?.expiryDate &&
                             new Date(this.documents.roadworthyCertificate.expiryDate) <= thirtyDaysFromNow;

  return licenseExpiring || insuranceExpiring || roadworthyExpiring;
});

// Method to check if vehicle is available for rental
vehicleSchema.methods.isAvailableForRental = function(startDate, endDate) {
  if (!this.pricing.availableForRental) {
    return false;
  }

  if (this.status !== 'available' || !this.availability.isAvailable) {
    return false;
  }

  // Check if verification is approved
  if (this.verification.status !== 'approved') {
    return false;
  }

  // Check if documents are not expired
  const now = new Date();
  if (this.documents?.license?.expiryDate && new Date(this.documents.license.expiryDate) <= now) {
    return false;
  }
  if (this.documents?.insurance?.expiryDate && new Date(this.documents.insurance.expiryDate) <= now) {
    return false;
  }

  return true;
};

// Method to update statistics
vehicleSchema.methods.updateStatistics = async function(tripData) {
  this.statistics.totalTrips += 1;
  this.statistics.totalDistance += tripData.distance || 0;
  this.statistics.totalRevenue += tripData.revenue || 0;

  if (tripData.rating) {
    const totalRating = (this.statistics.averageRating * this.statistics.ratingCount) + tripData.rating;
    this.statistics.ratingCount += 1;
    this.statistics.averageRating = totalRating / this.statistics.ratingCount;
  }

  await this.save();
};

// Method to update rental statistics
vehicleSchema.methods.updateRentalStatistics = async function(rentalData) {
  this.statistics.rentalRevenue += rentalData.revenue || 0;
  await this.save();
};

// Pre-save middleware to set primary image
vehicleSchema.pre('save', function(next) {
  if (this.images && this.images.length > 0) {
    // If no primary image is set, make the first one primary
    const hasPrimary = this.images.some(img => img.isPrimary);
    if (!hasPrimary) {
      this.images[0].isPrimary = true;
    }
  }
  next();
});

module.exports = mongoose.model('Vehicle', vehicleSchema);