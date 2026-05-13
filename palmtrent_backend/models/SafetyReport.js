const mongoose = require('mongoose');

const safetyReportSchema = new mongoose.Schema({
  reporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  },
  shipment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipment'
  },
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  type: {
    type: String,
    enum: ['pre_trip_checklist', 'incident', 'fatigue', 'speed_alert', 'safety_observation'],
    required: true
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'acknowledged', 'resolved', 'dismissed'],
    default: 'open'
  },
  checklist: [{
    key: String,
    label: String,
    passed: Boolean,
    notes: String
  }],
  description: String,
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] },
    address: String
  },
  speed: Number,
  fatigue: {
    hoursDriving: Number,
    lastRestAt: Date,
    restRequired: Boolean
  },
  attachments: [String],
  resolution: {
    notes: String,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date
  }
}, {
  timestamps: true
});

safetyReportSchema.index({ reporter: 1, createdAt: -1 });
safetyReportSchema.index({ shipment: 1, type: 1 });
safetyReportSchema.index({ status: 1, severity: 1 });

module.exports = mongoose.model('SafetyReport', safetyReportSchema);
