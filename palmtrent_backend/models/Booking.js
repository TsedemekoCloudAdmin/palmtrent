const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  // From your code
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
  transporter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // Enhanced status from both
  status: {
    type: String,
    enum: [
      'draft',
      'pending_payment',
      'payment_confirmed', 
      'pending',          // ADDED: For available jobs
      'finding_transporter',
      'matched',
      'confirmed',
      'in_progress',
      'completed',
      'cancelled'
    ],
    default: 'draft'
  },

  // Booking type from both
  bookingType: {
    type: String,
    enum: ['single', 'multiple', 'recurring'],
    default: 'single'
  },

  // ADDED: Fields for display
  origin: String,
  destination: String,
  totalAmount: Number,   // For shipper spending calculations
  vehicleType: String,   // For filtering available jobs

  // Enhanced cargo details
  cargoDetails: {
    type: String,
    weight: Number,
    value: Number,
    description: String,
    specialInstructions: String,
    photos: [String]
  },

  // Enhanced route details
  route: {
    pickup: {
      address: { type: String, required: true },
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: [Number]
      },
      date: Date,
      timeWindow: String
    },
    delivery: {
      address: { type: String, required: true },
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: [Number]
      },
      deadline: Date
    },
    distance: Number,
    estimatedDuration: String
  },

  // ADDED: Dates for filtering
  pickupDate: Date,
  deliveryDate: Date,

  // Multiple vehicles
  vehicles: [{
    vehicleType: String,
    weight: Number,
    description: String,
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

  // Enhanced pricing
  pricing: {
    baseTransportFee: Number,
    platformFee: Number,
    platformFeeRate: Number,
    insurance: Number,
    subtotal: Number,
    total: Number,
    currency: { type: String, default: 'USD' }
  },

  // Enhanced payment
  payment: {
    method: {
      type: String,
      enum: ['ecocash', 'onemoney', 'bank_transfer', 'cash_agent', 'cash_on_pickup', 'cash_on_delivery', 'corporate']
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed', 'refunded'],
      default: 'pending'
    },
    reference: String,
    paidAt: Date,
    expiresAt: Date
  },
  
  // ADDED: Separate field for easier querying
  paymentStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'failed', 'refunded'],
    default: 'pending'
  },

  // Enhanced insurance
  insurance: {
    required: Boolean,
    provider: String,
    coverage: Number,
    premium: Number,
    policyNumber: String
  },

  // Cross-border
  crossBorder: {
    enabled: { type: Boolean, default: false },
    destinationCountry: String,
    requiredDocuments: {
      commercialInvoice: Boolean,
      packingList: Boolean,
      certificateOrigin: Boolean,
      cargoManifest: Boolean
    }
  },

  // Cancellation
  cancellation: {
    cancelled: { type: Boolean, default: false },
    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reason: String,
    cancelledAt: Date
  },

  // Linked shipments
  shipments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shipment'
  }],

  // User reference (from my code)
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true
});

// Generate booking reference before save
bookingSchema.pre('save', function(next) {
  if (this.isNew && !this.bookingReference) {
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    this.bookingReference = `PT-${year}-${random}`;
  }
  
  // ADDED: Auto-populate origin and destination
  if (this.route) {
    if (this.route.pickup?.address && !this.origin) {
      // Extract city from address or use full address
      this.origin = this.route.pickup.address.split(',')[0];
    }
    if (this.route.delivery?.address && !this.destination) {
      this.destination = this.route.delivery.address.split(',')[0];
    }
  }
  
  // ADDED: Auto-populate dates
  if (this.route?.pickup?.date) {
    this.pickupDate = this.route.pickup.date;
  }
  if (this.route?.delivery?.deadline) {
    this.deliveryDate = this.route.delivery.deadline;
  }
  
  // ADDED: Auto-populate totalAmount
  if (this.pricing?.total) {
    this.totalAmount = this.pricing.total;
  }
  
  // ADDED: Auto-populate vehicleType from vehicles array
  if (this.vehicles?.length > 0 && !this.vehicleType) {
    this.vehicleType = this.vehicles[0].vehicleType;
  }
  
  // ADDED: Sync payment status
  if (this.payment?.status) {
    this.paymentStatus = this.payment.status;
  }
  
  next();
});

// Indexes
bookingSchema.index({ shipper: 1, status: 1 });
bookingSchema.index({ transporter: 1, status: 1 });
bookingSchema.index({ status: 1, transporter: 1 }); // ADDED: For available jobs query
bookingSchema.index({ user: 1, status: 1 });
bookingSchema.index({ createdAt: -1 });
bookingSchema.index({ updatedAt: -1 });
bookingSchema.index({ vehicleType: 1, status: 1 }); // ADDED: For filtering
bookingSchema.index({ shipper: 1, createdAt: -1 }); // ADDED: For recent activity

module.exports = mongoose.model('Booking', bookingSchema);