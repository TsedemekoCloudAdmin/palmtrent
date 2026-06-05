const mongoose = require('mongoose');

const rentalSchema = new mongoose.Schema({
  rentalReference: {
    type: String,
    required: true,
    unique: true
  },

  // Item type - vehicle or trailer (centralized rental system)
  itemType: {
    type: String,
    enum: ['vehicle', 'trailer', 'tractor_unit', 'truck', 'full_rig'],
    required: true,
    default: 'vehicle'
  },

  // Parties involved
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  renter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  channel: {
    type: String,
    enum: ['online', 'walk_in', 'staff_assisted'],
    default: 'online'
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  renterSnapshot: {
    fullName: String,
    email: String,
    phone: String,
    nationalId: String,
    licenseNumber: String,
    licenseExpiry: Date,
    address: String,
    emergencyContactName: String,
    emergencyContactPhone: String,
    notes: String
  },

  // Reference to vehicle (if itemType is 'vehicle')
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },

  // Reference to trailer (if itemType is 'trailer')
  trailer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Trailer'
  },

  operation: {
    rentalMode: {
      type: String,
      enum: ['dry_rental', 'operated_rental', 'chauffeur_driven'],
      default: 'dry_rental'
    },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver'
    },
    assignedDriverUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    assignedAt: Date,
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    driverSnapshot: {
      fullName: String,
      phone: String,
      licenseNumber: String,
      licenseClass: String
    },
    notes: String
  },
  
  // Rental period
  rentalPeriod: {
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    actualReturnDate: Date,
    duration: {
      value: Number,
      unit: {
        type: String,
        enum: ['hours', 'days', 'weeks', 'months'],
        default: 'days'
      }
    }
  },
  
  // Status tracking
  status: {
    type: String,
    enum: [
      'pending',           // Awaiting approval
      'approved',          // Approved by owner
      'payment_pending',   // Awaiting payment
      'confirmed',         // Payment confirmed, ready for pickup
      'active',            // Vehicle picked up, rental in progress
      'completed',         // Vehicle returned, rental ended
      'cancelled',         // Cancelled by either party
      'disputed',          // There's a dispute
      'overdue'            // Vehicle not returned on time
    ],
    default: 'pending'
  },
  
  // Pickup and return details
  pickup: {
    location: {
      address: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: [Number]
      }
    },
    scheduledTime: Date,
    actualTime: Date,
    inspectionNotes: String,
    odometerReading: Number,
    fuelLevel: {
      type: String,
      enum: ['empty', 'quarter', 'half', 'three_quarters', 'full']
    },
    photos: [String],
    signature: String,
    completedBy: String,
    conditionChecklist: [{
      item: String,
      status: {
        type: String,
        enum: ['ok', 'issue', 'not_applicable'],
        default: 'ok'
      },
      notes: String
    }]
  },
  
  return: {
    location: {
      address: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: [Number]
      }
    },
    scheduledTime: Date,
    actualTime: Date,
    inspectionNotes: String,
    odometerReading: Number,
    fuelLevel: {
      type: String,
      enum: ['empty', 'quarter', 'half', 'three_quarters', 'full']
    },
    photos: [String],
    signature: String,
    completedBy: String,
    conditionChecklist: [{
      item: String,
      status: {
        type: String,
        enum: ['ok', 'issue', 'not_applicable'],
        default: 'ok'
      },
      notes: String
    }],
    damages: [{
      description: String,
      severity: {
        type: String,
        enum: ['minor', 'moderate', 'major']
      },
      estimatedCost: Number,
      photos: [String]
    }]
  },

  tracking: [{
    location: {
      latitude: Number,
      longitude: Number,
      address: String
    },
    speed: Number,
    heading: Number,
    batteryLevel: Number,
    source: {
      type: String,
      enum: ['gps', 'driver_app', 'pickup', 'return', 'manual'],
      default: 'manual'
    },
    note: String,
    recordedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Pricing and payment
  pricing: {
    baseRate: {
      type: Number,
      required: true
    },
    rateType: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'per_km'],
      default: 'daily'
    },
    deposit: {
      type: Number,
      required: true
    },
    additionalCharges: [{
      description: String,
      amount: Number,
      reason: String
    }],
    discounts: [{
      description: String,
      amount: Number,
      reason: String
    }],
    lateFees: {
      type: Number,
      default: 0
    },
    damageFees: {
      type: Number,
      default: 0
    },
    cleaningFees: {
      type: Number,
      default: 0
    },
    extraKmFees: {
      type: Number,
      default: 0
    },
    subtotal: Number,
    tax: Number,
    total: {
      type: Number,
      required: true
    },
    currency: {
      type: String,
      default: 'USD'
    }
  },
  
  // Payment tracking
  payment: {
    gatewayPayment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payment'
    },
    paymentReference: String,
    gateway: String,
    depositPayment: {
      status: {
        type: String,
        enum: ['pending', 'paid', 'refunded', 'forfeited'],
        default: 'pending'
      },
      method: {
        type: String,
        enum: ['ecocash', 'onemoney', 'bank_transfer', 'openapi_africa', 'clicknpay', 'cash', 'corporate']
      },
      reference: String,
      paidAt: Date,
      refundedAt: Date,
      refundAmount: Number
    },
    rentalPayment: {
      status: {
        type: String,
        enum: ['pending', 'partial', 'paid', 'overdue'],
        default: 'pending'
      },
      method: {
        type: String,
        enum: ['ecocash', 'onemoney', 'bank_transfer', 'openapi_africa', 'clicknpay', 'cash', 'corporate']
      },
      reference: String,
      paidAt: Date,
      dueDate: Date
    },
    additionalPayments: [{
      description: String,
      amount: Number,
      status: {
        type: String,
        enum: ['pending', 'paid', 'waived']
      },
      method: String,
      reference: String,
      paidAt: Date
    }],
    totalPaid: {
      type: Number,
      default: 0
    },
    balance: Number
  },

  settlement: {
    platformFeeRate: { type: Number, default: 0 },
    platformFee: { type: Number, default: 0 },
    ownerEarnings: { type: Number, default: 0 },
    renterRefund: { type: Number, default: 0 },
    depositHeld: { type: Number, default: 0 },
    depositForfeited: { type: Number, default: 0 },
    settledAt: Date,
    status: {
      type: String,
      enum: ['pending', 'held', 'settled', 'disputed'],
      default: 'pending'
    }
  },

  linkedShipment: {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: 'Shipment' },
    role: {
      type: String,
      enum: ['supporting_trailer', 'supporting_tractor', 'full_rig']
    }
  },
  
  // Insurance
  insurance: {
    included: {
      type: Boolean,
      default: false
    },
    provider: String,
    policyNumber: String,
    coverage: Number,
    premium: Number,
    deductible: Number,
    coverageType: {
      type: String,
      enum: ['basic', 'comprehensive', 'third_party']
    }
  },
  
  // Usage tracking
  usage: {
    initialOdometer: Number,
    finalOdometer: Number,
    totalDistance: Number,
    includedKm: Number,
    extraKm: Number,
    perKmCharge: Number,
    fuelPolicy: {
      type: String,
      enum: ['full_to_full', 'same_to_same', 'prepaid'],
      default: 'full_to_full'
    }
  },
  
  // Rental agreement
  agreement: {
    terms: String,
    agreedAt: Date,
    renterSignature: String,
    ownerSignature: String,
    documentUrl: String,
    specialConditions: [String]
  },
  
  // Cancellation
  cancellation: {
    cancelled: {
      type: Boolean,
      default: false
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    cancelledAt: Date,
    reason: String,
    refundAmount: Number,
    cancellationFee: Number
  },
  
  // Ratings and reviews
  rating: {
    byRenter: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      review: String,
      ratedAt: Date
    },
    byOwner: {
      rating: {
        type: Number,
        min: 1,
        max: 5
      },
      review: String,
      ratedAt: Date
    }
  },
  
  // Incidents and disputes
  incidents: [{
    type: {
      type: String,
      enum: ['accident', 'breakdown', 'theft', 'damage', 'other']
    },
    description: String,
    reportedAt: Date,
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    location: {
      address: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: [Number]
      }
    },
    photos: [String],
    policeReport: {
      filed: Boolean,
      referenceNumber: String,
      document: String
    },
    resolution: {
      status: {
        type: String,
        enum: ['pending', 'resolved', 'escalated']
      },
      description: String,
      resolvedAt: Date,
      cost: Number
    }
  }],
  
  // Communication history
  communications: [{
    from: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    to: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    message: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['message', 'request', 'reminder', 'notification']
    }
  }],
  
  // Extension tracking
  extensions: [{
    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    requestedAt: Date,
    originalEndDate: Date,
    newEndDate: Date,
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected']
    },
    additionalCost: Number,
    reason: String
  }],
  
  // Notes and metadata
  notes: String,
  internalNotes: String, // Only visible to platform admins
  
  // Status history
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    notes: String
  }]
}, {
  timestamps: true
});

// Generate rental reference before save
rentalSchema.pre('save', function(next) {
  if (this.isNew && !this.rentalReference) {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    this.rentalReference = `RNT-${year}-${random}`;
  }
  
  // Calculate balance
  if (this.pricing && this.payment) {
    this.payment.balance = this.pricing.total - (this.payment.totalPaid || 0);
  }
  
  // Calculate total distance if odometer readings are available
  if (this.usage?.initialOdometer && this.usage?.finalOdometer) {
    this.usage.totalDistance = this.usage.finalOdometer - this.usage.initialOdometer;
    
    // Calculate extra km charges
    if (this.usage.includedKm && this.usage.totalDistance > this.usage.includedKm) {
      this.usage.extraKm = this.usage.totalDistance - this.usage.includedKm;
      if (this.usage.perKmCharge) {
        this.pricing.extraKmFees = this.usage.extraKm * this.usage.perKmCharge;
      }
    }
  }
  
  next();
});

// Indexes for better query performance
rentalSchema.index({ owner: 1, status: 1 });
rentalSchema.index({ renter: 1, status: 1 });
rentalSchema.index({ vehicle: 1 });
rentalSchema.index({ 'rentalPeriod.startDate': 1, 'rentalPeriod.endDate': 1 });
rentalSchema.index({ status: 1, 'rentalPeriod.endDate': 1 });
rentalSchema.index({ 'payment.rentalPayment.status': 1 });

// Method to calculate late fees
rentalSchema.methods.calculateLateFees = function() {
  if (this.return.actualTime && this.rentalPeriod.endDate) {
    const scheduledEnd = new Date(this.rentalPeriod.endDate);
    const actualEnd = new Date(this.return.actualTime);
    
    if (actualEnd > scheduledEnd) {
      const daysLate = Math.ceil((actualEnd - scheduledEnd) / (1000 * 60 * 60 * 24));
      const dailyRate = this.pricing.baseRate;
      const lateFeeRate = 1.5; // 150% of daily rate
      
      this.pricing.lateFees = daysLate * dailyRate * lateFeeRate;
      this.pricing.total += this.pricing.lateFees;
    }
  }
};

// Method to check if rental is overdue
rentalSchema.methods.isOverdue = function() {
  if (this.status === 'active' && this.rentalPeriod.endDate) {
    return new Date() > new Date(this.rentalPeriod.endDate);
  }
  return false;
};

// Method to calculate total earnings for owner
rentalSchema.methods.calculateOwnerEarnings = function(platformFeeRate = this.settlement?.platformFeeRate || 0) {
  const totalRevenue = this.pricing.total;
  const platformFee = totalRevenue * platformFeeRate;
  return totalRevenue - platformFee;
};

// Virtual for rental duration in days
rentalSchema.virtual('durationInDays').get(function() {
  if (this.rentalPeriod.startDate && this.rentalPeriod.endDate) {
    const start = new Date(this.rentalPeriod.startDate);
    const end = new Date(this.rentalPeriod.endDate);
    return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  }
  return 0;
});

module.exports = mongoose.model('Rental', rentalSchema);
