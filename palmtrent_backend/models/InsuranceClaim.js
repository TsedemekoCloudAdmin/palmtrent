// models/InsuranceClaim.js
const mongoose = require('mongoose');

const insuranceClaimSchema = new mongoose.Schema({
  claimReference: {
    type: String,
    unique: true,
    default: () => {
      const timestamp = Date.now().toString(36);
      const random = Math.random().toString(36).substring(2, 6).toUpperCase();
      return `CLM-${timestamp}-${random}`;
    }
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  policy: {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'InsuranceProvider'
    },
    providerCode: String,
    providerName: String,
    productCode: String,
    productName: String,
    coverageType: String,
    coveragePercentage: Number,
    premium: Number,
    excess: Number
  },
  claimant: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    name: String,
    email: String,
    phone: String,
    role: {
      type: String,
      enum: ['shipper', 'transporter'],
      required: true
    }
  },
  respondent: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    name: String,
    email: String,
    phone: String,
    role: {
      type: String,
      enum: ['shipper', 'transporter']
    }
  },
  incident: {
    type: {
      type: String,
      enum: ['damage', 'loss', 'theft', 'delay', 'partial_loss', 'contamination', 'other'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    dateOccurred: {
      type: Date,
      required: true
    },
    locationDescription: String,
    location: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number]
    },
    discoveredAt: Date,
    reportedToPolice: Boolean,
    policeReportNumber: String
  },
  cargo: {
    description: String,
    declaredValue: Number,
    claimedValue: Number,
    itemsAffected: [{
      name: String,
      quantity: Number,
      unitValue: Number,
      totalValue: Number,
      condition: String
    }]
  },
  documents: [{
    type: {
      type: String,
      enum: ['photo_damage', 'photo_cargo', 'delivery_receipt', 'police_report', 'invoice', 'waybill', 'other']
    },
    name: String,
    url: String,
    storageKey: String,
    storageProvider: String,
    uploadedAt: { type: Date, default: Date.now },
    verified: { type: Boolean, default: false }
  }],
  status: {
    type: String,
    enum: ['draft', 'submitted', 'under_review', 'additional_info_required', 'approved', 'partially_approved', 'rejected', 'paid', 'closed', 'withdrawn'],
    default: 'draft'
  },
  statusHistory: [{
    status: String,
    changedAt: { type: Date, default: Date.now },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }],
  assessment: {
    assessor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assessedAt: Date,
    findings: String,
    recommendedAmount: Number,
    deductions: [{
      reason: String,
      amount: Number
    }],
    totalDeductions: Number
  },
  settlement: {
    approvedAmount: Number,
    excessDeducted: Number,
    netPayment: Number,
    paymentMethod: String,
    paymentReference: String,
    paidAt: Date,
    paidBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  rejection: {
    reason: String,
    rejectedAt: Date,
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    appealDeadline: Date
  },
  appeal: {
    filed: { type: Boolean, default: false },
    filedAt: Date,
    reason: String,
    additionalDocuments: [{
      name: String,
      url: String,
      uploadedAt: Date
    }],
    status: {
      type: String,
      enum: ['pending', 'under_review', 'approved', 'rejected']
    },
    resolution: String,
    resolvedAt: Date
  },
  communication: [{
    from: {
      type: String,
      enum: ['claimant', 'respondent', 'provider', 'platform']
    },
    message: String,
    attachments: [{
      name: String,
      url: String
    }],
    sentAt: { type: Date, default: Date.now },
    readAt: Date
  }],
  timeline: {
    incidentDate: Date,
    reportedWithin24Hours: Boolean,
    submittedAt: Date,
    acknowledgedAt: Date,
    reviewStartedAt: Date,
    additionalInfoRequestedAt: Date,
    additionalInfoReceivedAt: Date,
    assessmentCompletedAt: Date,
    decisionMadeAt: Date,
    paymentProcessedAt: Date,
    closedAt: Date
  },
  sla: {
    acknowledgementDue: Date,
    decisionDue: Date,
    paymentDue: Date,
    acknowledgementMet: Boolean,
    decisionMet: Boolean,
    paymentMet: Boolean
  },
  metadata: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

// Generate claim reference before save
insuranceClaimSchema.pre('save', function(next) {
  if (this.isNew && !this.claimReference) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.claimReference = `CLM-${timestamp}-${random}`;
  }
  next();
});

// Update status history on status change
insuranceClaimSchema.pre('save', function(next) {
  if (this.isModified('status')) {
    this.statusHistory.push({
      status: this.status,
      changedAt: new Date()
    });
  }
  next();
});

// Check if claim was reported within 24 hours
insuranceClaimSchema.methods.checkReportingTimeline = function() {
  if (this.incident.dateOccurred && this.createdAt) {
    const hoursDiff = (this.createdAt - this.incident.dateOccurred) / (1000 * 60 * 60);
    this.timeline.reportedWithin24Hours = hoursDiff <= 24;
  }
  return this.timeline.reportedWithin24Hours;
};

// Calculate net settlement
insuranceClaimSchema.methods.calculateSettlement = function() {
  if (this.assessment.recommendedAmount) {
    const grossAmount = this.assessment.recommendedAmount;
    const excess = this.policy.excess || 0;
    const deductions = this.assessment.totalDeductions || 0;

    this.settlement.approvedAmount = grossAmount;
    this.settlement.excessDeducted = excess;
    this.settlement.netPayment = Math.max(0, grossAmount - excess - deductions);

    return this.settlement.netPayment;
  }
  return 0;
};

// Set SLA deadlines
insuranceClaimSchema.methods.setSLADeadlines = function() {
  const now = new Date();

  // Acknowledgement within 24 hours
  this.sla.acknowledgementDue = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  // Decision within 14 days (based on provider)
  const decisionDays = this.policy.claimProcessingDays || 14;
  this.sla.decisionDue = new Date(now.getTime() + decisionDays * 24 * 60 * 60 * 1000);

  // Payment within 7 days of approval
  this.sla.paymentDue = new Date(this.sla.decisionDue.getTime() + 7 * 24 * 60 * 60 * 1000);
};

// Static: Get claims by status
insuranceClaimSchema.statics.getByStatus = function(status) {
  return this.find({ status })
    .populate('booking')
    .populate('claimant.user', 'name email phone')
    .sort({ createdAt: -1 });
};

// Static: Get claims requiring action
insuranceClaimSchema.statics.getRequiringAction = function() {
  const now = new Date();
  return this.find({
    $or: [
      { status: 'submitted', 'sla.acknowledgementDue': { $lt: now } },
      { status: 'under_review', 'sla.decisionDue': { $lt: now } },
      { status: 'approved', 'sla.paymentDue': { $lt: now } }
    ]
  });
};

// Static: Get claim statistics
insuranceClaimSchema.statics.getStatistics = async function(dateFrom, dateTo) {
  const match = {};
  if (dateFrom || dateTo) {
    match.createdAt = {};
    if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
    if (dateTo) match.createdAt.$lte = new Date(dateTo);
  }

  const stats = await this.aggregate([
    { $match: match },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalClaimedValue: { $sum: '$cargo.claimedValue' },
        totalApprovedAmount: { $sum: '$settlement.approvedAmount' },
        totalPaidAmount: { $sum: '$settlement.netPayment' }
      }
    }
  ]);

  return stats;
};

// Indexes
insuranceClaimSchema.index({ booking: 1 });
insuranceClaimSchema.index({ 'claimant.user': 1 });
insuranceClaimSchema.index({ 'respondent.user': 1 });
insuranceClaimSchema.index({ status: 1 });
insuranceClaimSchema.index({ 'policy.providerId': 1 });
insuranceClaimSchema.index({ createdAt: -1 });
insuranceClaimSchema.index({ 'incident.location': '2dsphere' });

module.exports = mongoose.model('InsuranceClaim', insuranceClaimSchema);
