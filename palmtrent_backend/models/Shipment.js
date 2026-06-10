const mongoose = require('mongoose');

const shipmentSchema = new mongoose.Schema({
  // From your code
  bookingReference: {
    type: String,
    required: true
  },
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
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
  vehicle: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  assignedDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver'
  },
  rentedAssets: [{
    rental: { type: mongoose.Schema.Types.ObjectId, ref: 'Rental' },
    asset: { type: mongoose.Schema.Types.ObjectId, ref: 'Trailer' },
    assetType: String,
    role: {
      type: String,
      enum: ['supporting_trailer', 'supporting_tractor', 'full_rig']
    },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    amount: Number
  }],
  earningsSplit: {
    shipmentTotal: Number,
    platformFee: Number,
    transporterEarnings: Number,
    trailerOwnerEarnings: Number,
    driverEarnings: Number,
    rentalCosts: Number,
    currency: { type: String, default: 'USD' }
  },
  status: {
    type: String,
    enum: [
      'pending_payment',
      'payment_confirmed',
      'assigned',      // ADDED: When transporter is assigned
      'matched',
      'en_route_pickup',
      'picked_up',     // ADDED: When cargo is picked up
      'in_transit',
      'arrived_delivery',
      'delivered',
      'completed',
      'cancelled',
      'incident'
    ],
    default: 'pending_payment'
  },

  // From my code with enhancements
  shipmentId: {
    type: String,
    unique: true
  },
  
  // ADDED: Fields for dashboard stats
  origin: String,          // For displaying "City A → City B"
  destination: String,     // For displaying "City A → City B"
  amount: Number,          // Total shipment amount
  transporterEarnings: Number,  // Transporter's portion of payment
  completedAt: Date,       // When shipment was completed
  
  // Enhanced cargo details
  cargoDetails: {
    type: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      required: true
    },
    value: Number,
    description: String,
    specialInstructions: String,
    photos: [String]
  },

  // Enhanced route details
  route: {
    pickup: {
      address: { type: String, required: true },
      city: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
      },
      contactPerson: String,
      contactPhone: String
    },
    delivery: {
      address: { type: String, required: true },
      city: String,
      coordinates: {
        type: { type: String, enum: ['Point'], default: 'Point' },
        coordinates: { type: [Number], default: [0, 0] }
      },
      contactPerson: String,
      contactPhone: String
    },
    distance: Number,
    estimatedDuration: String
  },

  // Enhanced tracking
  currentLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }
  },
  
  // Enhanced scheduling
  schedule: {
    pickupDate: Date,
    scheduledPickupTime: Date,
    scheduledDeliveryTime: Date,
    actualPickupTime: Date,
    actualDeliveryTime: Date,
    estimatedDelivery: Date
  },

  // Enhanced pricing
  pricing: {
    transportFee: Number,
    platformFee: Number,
    insurance: Number,
    total: Number,
    currency: { type: String, default: 'USD' }
  },

  // Enhanced payment - UPDATED with paymentStatus
  payment: {
    method: {
      type: String,
      enum: ['ecocash', 'onemoney', 'bank_transfer', 'cash_on_pickup', 'cash_on_delivery', 'corporate']
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'failed', 'refunded'],
      default: 'pending'
    },
    reference: String,
    paidAt: Date
  },
  
  // ADDED: Separate paymentStatus field for easier querying
  paymentStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'escrowed', 'released', 'failed', 'refunded', 'partially_refunded'],
    default: 'pending'
  },

  // Enhanced insurance
  insurance: {
    enabled: { type: Boolean, default: false },
    provider: String,
    policyNumber: String,
    coverage: Number,
    premium: Number
  },

  // Enhanced tracking
  tracking: [{
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: [Number]
    },
    timestamp: { type: Date, default: Date.now },
    event: String,
    note: String
  }],

  // Status history
  statusHistory: [{
    status: String,
    timestamp: { type: Date, default: Date.now },
    notes: String
  }],

  // Proof of delivery
  pickupDetails: {
    photos: [String],
    notes: String,
    signature: String,
    confirmedAt: Date
  },
  deliveryDetails: {
    photos: [String],
    notes: String,
    signature: String,
    receiverName: String,
    receiverPhone: String,
    confirmedAt: Date
  },
  proofOfDelivery: {
    photos: [String],
    signature: String,
    receivedBy: String,
    receivedAt: Date,
    notes: String
  },

  // UPDATED: Ratings - simplified for easier querying
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  review: String,
  ratedAt: Date,
  
  // Detailed ratings (keeping your original structure too)
  ratings: {
    shipperRating: {
      rating: { type: Number, min: 1, max: 5 },
      review: String,
      ratedAt: Date
    },
    transporterRating: {
      rating: { type: Number, min: 1, max: 5 },
      review: String,
      ratedAt: Date
    }
  },

  // Cross-border
  isCrossBorder: {
    type: Boolean,
    default: false
  },
  crossBorderDetails: {
    destinationCountry: String,
    borderPost: String,
    requiredDocuments: {
      commercialInvoice: Boolean,
      packingList: Boolean,
      certificateOrigin: Boolean,
      cargoManifest: Boolean
    }
  },

  // Booking type
  bookingType: {
    type: String,
    enum: ['single', 'multiple', 'recurring'],
    default: 'single'
  },

  // Multiple vehicles
  multipleVehicles: [{
    vehicleType: String,
    weight: Number,
    description: String
  }],

  // Coordination
  coordination: {
    type: String,
    enum: ['any', 'same_fleet', 'coordinated'],
    default: 'any'
  },

  // Set when this shipment is part of a batched multi-drop courier run.
  deliveryBatch: {
    type: String,
    index: true
  }
}, {
  timestamps: true
});

// Generate IDs before save
shipmentSchema.pre('save', function(next) {
  if (this.isNew) {
    // Generate shipment ID
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.shipmentId = `TRK-${timestamp}-${random}`;
    
    // Generate booking reference if not provided
    if (!this.bookingReference) {
      const year = new Date().getFullYear();
      const refRandom = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
      this.bookingReference = `PT-${year}-${refRandom}`;
    }
  }
  
  // ADDED: Auto-populate origin and destination from route
  if (this.route) {
    if (this.route.pickup?.city) {
      this.origin = this.route.pickup.city;
    }
    if (this.route.delivery?.city) {
      this.destination = this.route.delivery.city;
    }
  }
  
  // ADDED: Auto-populate amount from pricing
  if (this.pricing?.total) {
    this.amount = this.pricing.total;
  }
  
  // ADDED: Sync payment status
  if (this.payment?.status) {
    this.paymentStatus = this.payment.status;
  }
  
  // ADDED: Set completedAt when status changes to completed
  if (this.status === 'completed' && !this.completedAt) {
    this.completedAt = new Date();
  }
  
  next();
});

// Indexes for better query performance
shipmentSchema.index({ shipper: 1, status: 1 });
shipmentSchema.index({ booking: 1 });
shipmentSchema.index({ transporter: 1, status: 1 });
shipmentSchema.index({ assignedDriver: 1, status: 1 });
shipmentSchema.index({ transporter: 1, status: 1, paymentStatus: 1 });  // ADDED for dashboard queries
shipmentSchema.index({ transporter: 1, rating: 1 });  // ADDED for rating aggregation
//shipmentSchema.index({ bookingReference: 1 });
shipmentSchema.index({ 'route.pickup.coordinates': '2dsphere' });
shipmentSchema.index({ 'route.delivery.coordinates': '2dsphere' });
shipmentSchema.index({ currentLocation: '2dsphere' });
shipmentSchema.index({ completedAt: 1 });  // ADDED for date-based queries
shipmentSchema.index({ createdAt: -1 });   // ADDED for recent activity
shipmentSchema.index({ updatedAt: -1 });   // ADDED for recent activity

module.exports = mongoose.model('Shipment', shipmentSchema);
