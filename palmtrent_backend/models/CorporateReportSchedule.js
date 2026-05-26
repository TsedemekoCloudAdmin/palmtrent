const mongoose = require('mongoose');

const corporateReportScheduleSchema = new mongoose.Schema({
  corporateAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateAccount',
    required: true,
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reportType: {
    type: String,
    enum: ['bookings', 'spending', 'team', 'routes', 'invoices', 'analytics'],
    required: true
  },
  reportName: {
    type: String,
    required: true,
    trim: true
  },
  frequency: {
    type: String,
    enum: ['weekly', 'monthly'],
    default: 'monthly'
  },
  format: {
    type: String,
    enum: ['csv'],
    default: 'csv'
  },
  recipients: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  status: {
    type: String,
    enum: ['active', 'paused'],
    default: 'active'
  },
  nextRunAt: Date,
  lastRunAt: Date,
  lastError: String
}, {
  timestamps: true
});

corporateReportScheduleSchema.index(
  { corporateAccount: 1, reportType: 1, frequency: 1 },
  { unique: true }
);
corporateReportScheduleSchema.index({ status: 1, nextRunAt: 1 });

module.exports = mongoose.model('CorporateReportSchedule', corporateReportScheduleSchema);
