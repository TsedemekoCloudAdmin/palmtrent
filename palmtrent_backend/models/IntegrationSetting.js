const mongoose = require('mongoose');

const integrationSettingSchema = new mongoose.Schema({
  provider: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  label: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    enum: ['payments', 'maps', 'messaging', 'notifications', 'storage', 'security', 'email'],
    required: true
  },
  enabled: {
    type: Boolean,
    default: false
  },
  settings: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    default: {}
  },
  encryptedSecrets: {
    type: Map,
    of: String,
    default: {}
  },
  secretFields: {
    type: [String],
    default: []
  },
  status: {
    type: String,
    enum: ['not_configured', 'configured', 'needs_attention', 'disabled'],
    default: 'not_configured'
  },
  lastTestedAt: Date,
  lastTestStatus: {
    type: String,
    enum: ['passed', 'failed', 'not_tested'],
    default: 'not_tested'
  },
  lastTestMessage: String,
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

integrationSettingSchema.index({ category: 1, provider: 1 });

module.exports = mongoose.model('IntegrationSetting', integrationSettingSchema);
