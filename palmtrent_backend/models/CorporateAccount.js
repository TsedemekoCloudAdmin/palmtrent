const mongoose = require('mongoose');

const corporateAccountSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  companyName: {
    type: String,
    required: true
  },
  registrationNumber: String,
  taxId: String,
  companyType: {
    type: String,
    enum: ['sole_proprietor', 'private_limited', 'public_limited', 'partnership', 'other']
  },
  industry: String,
  yearEstablished: Number,
  numberOfEmployees: String,
  billingAddress: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  contactPerson: {
    name: String,
    position: String,
    email: String,
    phone: String
  },
  billingContact: {
    name: String,
    email: String,
    phone: String
  },
  paymentTerms: {
    type: String,
    enum: ['net_7', 'net_15', 'net_30', 'immediate'],
    default: 'net_15'
  },
  creditLimit: {
    type: Number,
    default: 0
  },
  currentBalance: {
    type: Number,
    default: 0
  },
  discountRate: {
    type: Number,
    default: 0
  },
  preferredPaymentMethod: {
    type: String,
    enum: ['bank_transfer', 'corporate_credit', 'monthly_invoice'],
    default: 'monthly_invoice'
  },
  plan: {
    type: String,
    enum: ['standard', 'premium', 'enterprise'],
    default: 'standard'
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'suspended', 'inactive'],
    default: 'pending'
  },
  verification: {
    documents: [{
      type: String, // URL to document
      documentType: String,
      originalName: String,
      storageKey: String,
      storageProvider: String,
      uploadedAt: Date,
      verified: { type: Boolean, default: false }
    }],
    verifiedAt: Date,
    verifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  settings: {
    autoApproveBookings: { type: Boolean, default: false },
    maxBookingValue: { type: Number, default: 10000 },
    allowedUsers: [{
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      role: { type: String, enum: ['admin', 'manager', 'viewer'] },
      permissions: [{
        type: String,
        enum: ['create_bookings', 'view_all_bookings', 'manage_team', 'view_reports']
      }]
    }]
  },
  apiAccess: {
    keyHash: String,
    keyPrefix: String,
    keyLastFour: String,
    generatedAt: Date,
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('CorporateAccount', corporateAccountSchema);
