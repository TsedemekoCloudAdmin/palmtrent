// models/Booking.js - UPDATED pricing structure

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  bookingReference: {
    type: String,
    required: true,
    unique: true
  },
  
  shipper: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  corporateAccount: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CorporateAccount'
  },
  
  transporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  status: {
    type: String,
    enum: [
      'draft',
      'pending_payment',
      'payment_confirmed', 
      'pending',
      'finding_transporter',
      'matched',
      'transporter_assigned',
      'confirmed',
      'en_route_pickup',
      'pickup_started',
      'picked_up',
      'in_progress',
      'in_transit',
      'arrived_delivery',
      'delivered',
      'completed',
      'disputed',
      'cancelled'
    ],
    default: 'draft'
  },

  bookingType: {
    type: String,
    enum: ['single', 'multiple', 'recurring'],
    default: 'single'
  },

  // Fields for display and filtering
  origin: {
    type: String,
    default: ''
  },
  destination: {
    type: String,
    default: ''
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  vehicleType: {
    type: String,
    default: ''
  },
  trailerType: {
    type: String,
    default: ''
  },

  // Cargo details
  cargoDetails: {
    type: {
      type: String,
      default: ''
    },
    weight: {
      type: Number,
      default: 0
    },
    value: {
      type: Number,
      default: 0
    },
    description: {
      type: String,
      default: ''
    },
    specialInstructions: {
      type: String,
      default: ''
    },
    photos: {
      type: [String],
      default: []
    }
  },

  // Route details
  route: {
    pickup: {
      address: {
        type: String,
        required: true
      },
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number],
          default: [0, 0]
        }
      },
      date: {
        type: Date,
        default: Date.now
      },
      timeWindow: {
        type: String,
        default: ''
      }
    },
    delivery: {
      address: {
        type: String,
        required: true
      },
      coordinates: {
        type: {
          type: String,
          enum: ['Point'],
          default: 'Point'
        },
        coordinates: {
          type: [Number],
          default: [0, 0]
        }
      },
      deadline: {
        type: Date
      }
    },
    distance: {
      type: Number,
      default: 0
    },
    estimatedDuration: {
      type: String,
      default: ''
    }
  },

  // Dates for filtering
  pickupDate: {
    type: Date
  },
  deliveryDate: {
    type: Date
  },

  // Multiple vehicles
  vehicles: [{
    vehicleType: {
      type: String,
      default: ''
    },
    trailerType: {
      type: String,
      default: ''
    },
    weight: {
      type: Number,
      default: 0
    },
    description: {
      type: String,
      default: ''
    },
    vehicle: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vehicle'
    }
  }],

  // Coordination
  coordination: {
    type: String,
    enum: ['any', 'same_fleet', 'coordinated'],
    default: 'any'
  },

  // UPDATED: Enhanced Pricing structure with commission
  pricing: {
    // Breakdown
    breakdown: {
      baseTransportFee: {
        type: Number,
        default: 0
      },
      specialCargoFee: {
        type: Number,
        default: 0
      },
      crossBorderFees: {
        baseSurcharge: { type: Number, default: 0 },
        documentationFee: { type: Number, default: 0 },
        insurancePremium: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
      },
      platformFee: {
        type: Number,
        default: 0
      },
      platformFeeRate: {
        type: Number,
        default: 0
      },
      transporterCommission: {
        type: Number,
        default: 0
      },
      transporterCommissionRate: {
        type: Number,
        default: 0
      },
      transporterEarnings: {
        type: Number,
        default: 0
      },
      transporterGrossEarnings: {
        type: Number,
        default: 0
      },
      insurance: {
        type: Number,
        default: 0
      },
      insuranceRate: {
        type: Number,
        default: 0
      },
      paymentMethod: {
        type: String,
        default: 'digital'
      }
    },
    
    // Totals
    totals: {
      subtotal: {
        type: Number,
        default: 0
      },
      total: {
        type: Number,
        default: 0
      },
      platformTotal: {
        type: Number,
        default: 0
      },
      transporterTotal: {
        type: Number,
        default: 0
      },
      insuranceTotal: {
        type: Number,
        default: 0
      }
    },
    
    // Fee Allocation
    feeAllocation: {
      platform: {
        amount: { type: Number, default: 0 },
        description: { type: String, default: '' },
        breakdown: {
          platformFee: { type: Number, default: 0 },
          transporterCommission: { type: Number, default: 0 }
        }
      },
      transporter: {
        amount: { type: Number, default: 0 },
        description: { type: String, default: '' },
        grossAmount: { type: Number, default: 0 },
        commission: { type: Number, default: 0 }
      },
      insurance: {
        amount: { type: Number, default: 0 },
        description: { type: String, default: '' }
      }
    },
    
    // Additional pricing data
    discountsApplied: [{
      type: {
        type: String
      },
      description: {
        type: String
      },
      rate: {
        type: Number
      },
      percentage: {
        type: String
      }
    }],
    
    surchargesApplied: [{
      type: {
        type: String
      },
      description: {
        type: String
      },
      rate: {
        type: Number
      },
      percentage: {
        type: String
      },
      amount: {
        type: Number
      }
    }],
    
    configVersion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PricingConfig'
    },
    
    calculatedAt: {
      type: Date,
      default: Date.now
    },
    
    currency: {
      type: String,
      default: 'USD'
    }
  },

  // Payment structure
  payment: {
    method: {
      type: String,
      enum: ['digital', 'openapi_africa', 'clicknpay', 'ecocash', 'onemoney', 'card', 'bank_transfer', 'cashViaAgent', 'cash_agent', 'cashOnPickup', 'cash_on_pickup', 'cashOnDelivery', 'cash_on_delivery', 'corporate'],
      default: ''
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'escrowed', 'released', 'failed', 'refunded', 'partially_refunded'],
      default: 'pending'
    },
    reference: {
      type: String,
      default: ''
    },
    paidAt: {
      type: Date
    },
    expiresAt: {
      type: Date
    }
  },
  
  // Separate payment status field for easier querying
  paymentStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'escrowed', 'released', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },

  // Payment confirmation timestamp (for payment-before-broadcasting enforcement)
  paymentConfirmedAt: {
    type: Date
  },

  escrow: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Escrow'
  },

  // Matching timestamp
  matchedAt: {
    type: Date
  },

  // Match results (from matching algorithm)
  matchResults: {
    totalEligible: {
      type: Number,
      default: 0
    },
    notifiedCount: {
      type: Number,
      default: 0
    },
    topMatches: [{
      transporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      score: {
        type: Number
      },
      distance: {
        type: Number
      },
      notifiedAt: {
        type: Date
      }
    }],
    expiresAt: {
      type: Date
    }
  },

  // Track job declines for analytics
  declines: [{
    transporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String
    },
    declinedAt: {
      type: Date
    }
  }],

  // Insurance structure
  insurance: {
    required: {
      type: Boolean,
      default: false
    },
    provider: {
      type: String,
      default: ''
    },
    coverage: {
      type: Number,
      default: 0
    },
    premium: {
      type: Number,
      default: 0
    },
    policyNumber: {
      type: String,
      default: ''
    }
  },

  // Cross-border structure
  crossBorder: {
    enabled: {
      type: Boolean,
      default: false
    },
    destinationCountry: {
      type: String,
      default: ''
    },
    destinationCountryName: {
      type: String,
      default: ''
    },
    borderPost: {
      type: String,
      default: ''
    },
    tradeAgreement: {
      type: String,
      default: ''
    },
    requiredDocuments: {
      commercialInvoice: {
        type: Boolean,
        default: false
      },
      packingList: {
        type: Boolean,
        default: false
      },
      certificateOrigin: {
        type: Boolean,
        default: false
      },
      cargoManifest: {
        type: Boolean,
        default: false
      }
    },
    documents: [{
      type: String,
      name: String,
      url: String,
      status: {
        type: String,
        enum: ['pending', 'uploaded', 'verified', 'rejected'],
        default: 'pending'
      },
      uploadedAt: Date,
      verifiedAt: Date
    }],
    pricing: mongoose.Schema.Types.Mixed
  },

  // Cancellation structure
  cancellation: {
    cancelled: {
      type: Boolean,
      default: false
    },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: {
      type: String,
      default: ''
    },
    cancelledAt: {
      type: Date
    }
  },

  // Linked shipments
  shipments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipment'
  }],

  // User reference
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Validation middleware - CRITICAL: Enforce payment-before-broadcasting
bookingSchema.pre('save', function(next) {
  // Check if status is being changed to finding_transporter or beyond
  if (this.isModified('status')) {
    const statusesRequiringPayment = [
      'finding_transporter',
      'matched',
      'transporter_assigned',
      'confirmed',
      'en_route_pickup',
      'pickup_started',
      'picked_up',
      'in_progress',
      'in_transit',
      'arrived_delivery',
      'delivered',
      'completed'
    ];

    if (statusesRequiringPayment.includes(this.status)) {
      // Verify payment is confirmed
      const isPaymentConfirmed =
        ['confirmed', 'escrowed', 'released'].includes(this.paymentStatus) ||
        this.payment?.status === 'confirmed' ||
        this.paymentConfirmedAt;

      // Exception: Cash methods can proceed if status is explicitly set (manual approval)
      const isCashMethod = ['cash_on_pickup', 'cashOnPickup', 'cash_on_delivery', 'cashOnDelivery'].includes(this.payment?.method);

      if (!isPaymentConfirmed && !isCashMethod) {
        const error = new Error(
          `Payment must be confirmed before booking status can be changed to '${this.status}'. ` +
          `Current payment status: ${this.paymentStatus || 'pending'}. ` +
          `This is a critical business requirement to ensure payment-before-broadcasting.`
        );
        error.name = 'PaymentNotConfirmedError';
        return next(error);
      }
    }
  }

  next();
});

// Pre-save middleware for auto-population
bookingSchema.pre('save', function(next) {
  // Generate booking reference for new bookings
  if (this.isNew && !this.bookingReference) {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    this.bookingReference = `PT-${year}-${random}`;
  }
  
  // Auto-populate origin and destination
  if (this.route) {
    if (this.route.pickup?.address && !this.origin) {
      this.origin = this.route.pickup.address.split(',')[0].trim();
    }
    if (this.route.delivery?.address && !this.destination) {
      this.destination = this.route.delivery.address.split(',')[0].trim();
    }
  }
  
  // Auto-populate dates
  if (this.route?.pickup?.date && !this.pickupDate) {
    this.pickupDate = this.route.pickup.date;
  }
  if (this.route?.delivery?.deadline && !this.deliveryDate) {
    this.deliveryDate = this.route.delivery.deadline;
  }
  
  // UPDATED: Auto-populate totalAmount from new pricing structure
  if (this.pricing?.totals?.total) {
    this.totalAmount = this.pricing.totals.total;
  } else if (this.pricing?.total) {
    // Fallback for old structure
    this.totalAmount = this.pricing.total;
  }
  
  // Auto-populate vehicleType from vehicles array
  if (this.vehicles?.length > 0 && !this.vehicleType) {
    this.vehicleType = this.vehicles[0].vehicleType;
  }
  
  // Sync payment status and set paymentConfirmedAt timestamp
  if (this.payment?.status && (this.isModified('payment.status') || !this.paymentStatus)) {
    this.paymentStatus = this.payment.status;

    // Auto-set paymentConfirmedAt when payment is confirmed
    if (this.payment.status === 'confirmed' && !this.paymentConfirmedAt) {
      this.paymentConfirmedAt = new Date();
    }
  }

  // Also set paymentConfirmedAt if paymentStatus is directly modified to confirmed
  if (this.isModified('paymentStatus') && this.paymentStatus === 'confirmed' && !this.paymentConfirmedAt) {
    this.paymentConfirmedAt = new Date();
  }

  next();
});

// Indexes for better query performance
bookingSchema.index({ shipper: 1, status: 1 });
bookingSchema.index({ transporter: 1, status: 1 });
bookingSchema.index({ status: 1, transporter: 1 });
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ corporateAccount: 1, status: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ updatedAt: -1 });
bookingSchema.index({ vehicleType: 1, status: 1 });
bookingSchema.index({ shipper: 1, createdAt: -1 });
bookingSchema.index({ paymentStatus: 1 });
// Payment-related indexes for enforcement and auto-cancellation
bookingSchema.index({ paymentConfirmedAt: 1 });
bookingSchema.index({ 'payment.expiresAt': 1, status: 1 });
bookingSchema.index({ status: 1, paymentStatus: 1, createdAt: 1 }); // For finding unpaid bookings

module.exports = mongoose.model('Booking', bookingSchema);
