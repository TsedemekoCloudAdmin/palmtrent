const mongoose = require('mongoose');

const emergencyResponderSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  businessName: {
    type: String,
    trim: true
  },
  serviceTypes: [{
    type: String,
    enum: ['tow_truck', 'mechanic', 'battery', 'fuel', 'tyre', 'lockout', 'accident_recovery']
  }],
  phone: String,
  alternatePhone: String,
  vehicleDescription: String,
  registrationNumber: String,
  serviceRadiusKm: {
    type: Number,
    default: 30,
    min: 1,
    max: 300
  },
  availability: {
    isAvailable: { type: Boolean, default: false, index: true },
    status: {
      type: String,
      enum: ['available', 'busy', 'offline', 'suspended'],
      default: 'offline',
      index: true
    },
    availableUntil: Date,
    lastUpdatedAt: Date
  },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
    address: String,
    updatedAt: Date
  },
  verification: {
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    notes: String,
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  stats: {
    requestsReceived: { type: Number, default: 0 },
    requestsAccepted: { type: Number, default: 0 },
    requestsCompleted: { type: Number, default: 0 }
  }
}, { timestamps: true });

emergencyResponderSchema.index({ location: '2dsphere' });
emergencyResponderSchema.index({ serviceTypes: 1, 'availability.status': 1, 'availability.isAvailable': 1 });

module.exports = mongoose.model('EmergencyResponder', emergencyResponderSchema);
