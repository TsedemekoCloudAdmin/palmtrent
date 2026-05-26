const mongoose = require('mongoose');

const adminPreferenceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
    index: true
  },
  platformSettings: {
    platformCommissionRate: { type: Number, default: 15 },
    minimumBookingAmount: { type: Number, default: 50 },
    autoCancelTimeoutHours: { type: Number, default: 24 }
  },
  notifications: {
    email: { type: Boolean, default: true },
    sms: { type: Boolean, default: true },
    whatsapp: { type: Boolean, default: true }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('AdminPreference', adminPreferenceSchema);
