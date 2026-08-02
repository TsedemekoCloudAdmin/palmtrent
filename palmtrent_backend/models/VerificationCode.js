const mongoose = require('mongoose');

const verificationCodeSchema = new mongoose.Schema({
  phone: {
    type: String,
    default: null
  },
  email: {
    type: String,
    lowercase: true,
    default: null
  },
  code: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['phone_verification', 'email_verification', 'password_reset'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: '10m' } // Auto delete after 10 minutes
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 5
  },
  used: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

verificationCodeSchema.index({ phone: 1, type: 1 });

module.exports = mongoose.model('VerificationCode', verificationCodeSchema);