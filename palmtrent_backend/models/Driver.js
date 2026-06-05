const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  profileType: {
    type: String,
    enum: ['managed', 'marketplace'],
    default: 'managed',
    index: true
  },
  marketplace: {
    visible: { type: Boolean, default: false, index: true },
    lookingForWork: { type: Boolean, default: false, index: true },
    preferredWorkTypes: [{
      type: String,
      enum: ['local', 'cross_border', 'long_distance', 'hazardous', 'refrigerated', 'heavy_haulage', 'small_vehicle', 'chauffeur']
    }],
    preferredLocations: [String],
    expectedRate: {
      amount: Number,
      currency: { type: String, default: 'USD' },
      period: { type: String, enum: ['daily', 'weekly', 'monthly', 'trip'], default: 'daily' }
    },
    availableImmediately: { type: Boolean, default: true },
    headline: String,
    bio: String,
    lastAvailabilityUpdate: Date
  },
  
  // Personal Information
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true
  },
  email: String,
  dateOfBirth: Date,
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  
  // License Information
  licenseNumber: {
    type: String
  },
  licenseClass: {
    type: String
  },
  licenseExpiry: {
    type: Date
  },
  licenseIssuingAuthority: String,
  
  // Professional Information
  experience: {
    type: Number, // years
    default: 0
  },
  specialization: [{
    type: String,
    enum: ['local', 'cross_border', 'long_distance', 'hazardous', 'refrigerated', 'heavy_haulage', 'small_vehicle', 'chauffeur']
  }],
  
  // Employment Details
  employmentType: {
    type: String,
    enum: ['full_time', 'part_time', 'contract', 'freelance'],
    default: 'full_time'
  },
  hireDate: Date,
  salary: {
    amount: Number,
    currency: { type: String, default: 'USD' },
    period: { type: String, enum: ['hourly', 'daily', 'weekly', 'monthly'] }
  },
  
  // Status and Availability
  status: {
    type: String,
    enum: ['available', 'on_duty', 'on_leave', 'suspended', 'inactive'],
    default: 'available'
  },
  availability: {
    isAvailable: { type: Boolean, default: true },
    availableFrom: Date,
    availableTo: Date
  },
  
  // Documents
  documents: {
    licenseFront: String,
    licenseBack: String,
    idDocument: String,
    medicalCertificate: String,
    trainingCertificates: [String],
    otherDocuments: [String]
  },
  
  // Ratings and Performance
  rating: {
    average: { type: Number, default: 0, min: 0, max: 5 },
    count: { type: Number, default: 0 }
  },
  performance: {
    totalTrips: { type: Number, default: 0 },
    onTimeDelivery: { type: Number, default: 0 }, // percentage
    safeDriving: { type: Number, default: 0 }, // percentage
    customerSatisfaction: { type: Number, default: 0 } // percentage
  },
  
  // Emergency Contact
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String,
    email: String
  },
  
  // Bank Details (for payments)
  bankDetails: {
    bankName: String,
    accountNumber: String,
    accountName: String,
    branchCode: String
  },
  
  // Vehicle Assignment
  assignedVehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  
  // Current Location
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
  
  // Notes
  notes: String

}, {
  timestamps: true
});

// Indexes
driverSchema.index({ owner: 1, status: 1 });
driverSchema.index({ profileType: 1, status: 1, 'availability.isAvailable': 1 });
driverSchema.index({ 'marketplace.visible': 1, 'marketplace.lookingForWork': 1 });
driverSchema.index({ licenseNumber: 1 });
driverSchema.index({ status: 1 });
driverSchema.index({ currentLocation: '2dsphere' });

// Virtual for checking if license is expiring soon
driverSchema.virtual('isLicenseExpiringSoon').get(function() {
  if (!this.licenseExpiry) return false;
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  return this.licenseExpiry <= thirtyDaysFromNow;
});

// Method to update performance metrics
driverSchema.methods.updatePerformance = async function(tripData) {
  this.performance.totalTrips += 1;
  
  if (tripData.onTime) {
    const currentOnTime = this.performance.onTimeDelivery * (this.performance.totalTrips - 1);
    this.performance.onTimeDelivery = (currentOnTime + 100) / this.performance.totalTrips;
  }
  
  if (tripData.safeDriving) {
    const currentSafe = this.performance.safeDriving * (this.performance.totalTrips - 1);
    this.performance.safeDriving = (currentSafe + 100) / this.performance.totalTrips;
  }
  
  if (tripData.customerRating) {
    const currentSatisfaction = this.performance.customerSatisfaction * (this.performance.totalTrips - 1);
    this.performance.customerSatisfaction = (currentSatisfaction + (tripData.customerRating * 20)) / this.performance.totalTrips;
  }
  
  await this.save();
};

module.exports = mongoose.model('Driver', driverSchema);
