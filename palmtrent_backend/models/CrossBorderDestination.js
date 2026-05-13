const mongoose = require('mongoose');

const crossBorderDestinationSchema = new mongoose.Schema({
  // Country Information
  countryCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    maxLength: 3
  },
  countryName: {
    type: String,
    required: true
  },
  flag: {
    type: String // Emoji flag or URL to flag image
  },

  // Border Crossing Information
  borderPosts: [{
    name: {
      type: String,
      required: true
    },
    location: {
      latitude: Number,
      longitude: Number
    },
    operatingHours: {
      type: String,
      default: '24/7'
    },
    is24Hours: {
      type: Boolean,
      default: true
    },
    bestCrossingTimes: {
      type: String,
      default: '6AM - 10AM'
    },
    averageWaitTime: {
      min: { type: Number, default: 2 }, // hours
      max: { type: Number, default: 4 }  // hours
    },
    currentStatus: {
      type: String,
      enum: ['open', 'congested', 'limited', 'closed'],
      default: 'open'
    },
    facilities: [{
      type: String,
      enum: ['customs', 'immigration', 'health_check', 'weighbridge', 'rest_area', 'fuel_station', 'parking']
    }]
  }],

  // Distance from Zimbabwe (approximate)
  distanceFromOrigin: {
    value: Number,
    unit: { type: String, default: 'km' }
  },

  // Required Documents
  requiredDocuments: [{
    name: String,
    description: String,
    required: { type: Boolean, default: true },
    uploadRequired: { type: Boolean, default: false }
  }],

  // Driver Requirements
  driverRequirements: [{
    requirement: String,
    mandatory: { type: Boolean, default: true }
  }],

  // Pricing Configuration
  pricing: {
    crossBorderSurcharge: { type: Number, default: 50 },
    yellowCardInsurance: { type: Number, default: 50 },
    documentationHandling: { type: Number, default: 30 },
    customsClearanceFee: { type: Number, default: 0 },
    transitPermitFee: { type: Number, default: 0 }
  },

  // Transit Information
  transitInfo: {
    averageTransitDays: Number,
    customsProcedure: String,
    specialRestrictions: [String]
  },

  // Regional Trade Agreement
  tradeAgreement: {
    type: String,
    enum: ['SADC', 'COMESA', 'EAC', 'other'],
    default: 'SADC'
  },

  // Currency
  currency: {
    code: String,
    name: String
  },

  // Popularity/Frequency
  isPopular: {
    type: Boolean,
    default: false
  },
  popularityScore: {
    type: Number,
    default: 0
  },

  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes
crossBorderDestinationSchema.index({ isActive: 1 });
crossBorderDestinationSchema.index({ isPopular: -1, popularityScore: -1 });

module.exports = mongoose.model('CrossBorderDestination', crossBorderDestinationSchema);
