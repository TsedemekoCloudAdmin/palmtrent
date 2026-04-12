const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: [true, 'Full name is required'],
    trim: true,
    maxlength: [100, 'Full name cannot exceed 100 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    required: [true, 'Phone number is required'],
    unique: true,
    match: [/^\+263[0-9]{9}$/, 'Please enter a valid Zimbabwean phone number (+263 format)']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false
  },
  userType: {
    type: String,
    required: true,
    enum: ['shipper', 'transporter', 'trailer_owner', 'corporate', 'admin']
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  profileCompleted: {
    type: Boolean,
    default: false
  },
  companyName: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String
  },
  avatar: String,
  dateOfBirth: Date,
  governmentId: String,
  rating: {
    average: {
      type: Number,
      default: 0,
      min: 0,
      max: 5
    },
    count: {
      type: Number,
      default: 0
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  lastLogin: Date,
  preferences: {
    notifications: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: true },
      push: { type: Boolean, default: true }
    },
    language: {
      type: String,
      default: 'en'
    }
  },
  
  // ADDED: Link to corporate account if user is corporate type
  corporateAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateAccount'
  },

  // Push notification tokens
  fcmToken: {
    type: String,
    default: null
  },
  expoPushToken: {
    type: String,
    default: null
  },
  deviceInfo: {
    platform: String,
    brand: String,
    model: String,
    osVersion: String,
    lastUpdated: Date
  },

  // Payout preferences for transporters/trailer owners
  payoutPreferences: {
    method: {
      type: String,
      enum: ['ecocash', 'onemoney', 'bank_transfer']
    },
    accountNumber: String,
    accountName: String,
    bankName: String,
    updatedAt: Date
  },

  // Emergency contacts
  emergencyContacts: [{
    name: String,
    phone: String,
    relationship: String
  }]
}, {
  timestamps: true
});

// Index for better query performance
//userSchema.index({ email: 1 });
//userSchema.index({ phone: 1 });
userSchema.index({ userType: 1 });
userSchema.index({ status: 1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

module.exports = mongoose.model('User', userSchema);