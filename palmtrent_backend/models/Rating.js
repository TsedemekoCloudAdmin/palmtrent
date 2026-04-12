// models/Rating.js
const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  rater: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['shipper', 'transporter'],
      required: true
    }
  },
  ratee: {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    role: {
      type: String,
      enum: ['shipper', 'transporter'],
      required: true
    }
  },
  overallRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  categories: {
    // For rating transporters (by shippers)
    communication: { type: Number, min: 1, max: 5 },
    timeliness: { type: Number, min: 1, max: 5 },
    cargoHandling: { type: Number, min: 1, max: 5 },
    professionalism: { type: Number, min: 1, max: 5 },
    vehicleCondition: { type: Number, min: 1, max: 5 },

    // For rating shippers (by transporters)
    accuracy: { type: Number, min: 1, max: 5 },      // Accuracy of cargo description
    accessibility: { type: Number, min: 1, max: 5 }, // Ease of pickup/delivery
    payment: { type: Number, min: 1, max: 5 },       // Payment promptness
    cooperation: { type: Number, min: 1, max: 5 }    // Overall cooperation
  },
  review: {
    text: {
      type: String,
      maxlength: 1000
    },
    isPublic: {
      type: Boolean,
      default: true
    }
  },
  tags: [{
    type: String,
    enum: [
      // Positive tags
      'on_time', 'professional', 'great_communication', 'careful_handling',
      'clean_vehicle', 'friendly', 'efficient', 'helpful', 'reliable',
      // Negative tags
      'late', 'poor_communication', 'damaged_cargo', 'unprofessional',
      'dirty_vehicle', 'rude', 'unreliable'
    ]
  }],
  response: {
    text: String,
    respondedAt: Date
  },
  visibility: {
    type: String,
    enum: ['visible', 'hidden', 'flagged'],
    default: 'visible'
  },
  flagged: {
    isFlagged: { type: Boolean, default: false },
    reason: String,
    flaggedAt: Date,
    flaggedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    resolved: { type: Boolean, default: false },
    resolution: String
  },
  tripDetails: {
    distance: Number,
    origin: String,
    destination: String,
    cargoType: String,
    completedAt: Date
  }
}, {
  timestamps: true
});

// Ensure one rating per rater per booking
ratingSchema.index({ booking: 1, 'rater.user': 1 }, { unique: true });

// Indexes for querying
ratingSchema.index({ 'ratee.user': 1 });
ratingSchema.index({ 'rater.user': 1 });
ratingSchema.index({ overallRating: 1 });
ratingSchema.index({ createdAt: -1 });

// Calculate average of category ratings
ratingSchema.methods.calculateOverall = function() {
  const cats = this.categories;
  let total = 0;
  let count = 0;

  if (this.rater.role === 'shipper') {
    // Shipper rating transporter
    if (cats.communication) { total += cats.communication; count++; }
    if (cats.timeliness) { total += cats.timeliness; count++; }
    if (cats.cargoHandling) { total += cats.cargoHandling; count++; }
    if (cats.professionalism) { total += cats.professionalism; count++; }
    if (cats.vehicleCondition) { total += cats.vehicleCondition; count++; }
  } else {
    // Transporter rating shipper
    if (cats.communication) { total += cats.communication; count++; }
    if (cats.accuracy) { total += cats.accuracy; count++; }
    if (cats.accessibility) { total += cats.accessibility; count++; }
    if (cats.payment) { total += cats.payment; count++; }
    if (cats.cooperation) { total += cats.cooperation; count++; }
  }

  this.overallRating = count > 0 ? Math.round((total / count) * 10) / 10 : 0;
  return this.overallRating;
};

// Static: Get user's average rating
ratingSchema.statics.getUserRating = async function(userId) {
  const result = await this.aggregate([
    { $match: { 'ratee.user': new mongoose.Types.ObjectId(userId), visibility: 'visible' } },
    {
      $group: {
        _id: null,
        averageRating: { $avg: '$overallRating' },
        totalRatings: { $sum: 1 },
        avgCommunication: { $avg: '$categories.communication' },
        avgTimeliness: { $avg: '$categories.timeliness' },
        avgCargoHandling: { $avg: '$categories.cargoHandling' },
        avgProfessionalism: { $avg: '$categories.professionalism' },
        avgVehicleCondition: { $avg: '$categories.vehicleCondition' },
        avgAccuracy: { $avg: '$categories.accuracy' },
        avgAccessibility: { $avg: '$categories.accessibility' },
        avgPayment: { $avg: '$categories.payment' },
        avgCooperation: { $avg: '$categories.cooperation' }
      }
    }
  ]);

  if (result.length === 0) {
    return {
      averageRating: 0,
      totalRatings: 0,
      categories: {}
    };
  }

  const data = result[0];
  return {
    averageRating: Math.round(data.averageRating * 10) / 10,
    totalRatings: data.totalRatings,
    categories: {
      communication: data.avgCommunication ? Math.round(data.avgCommunication * 10) / 10 : null,
      timeliness: data.avgTimeliness ? Math.round(data.avgTimeliness * 10) / 10 : null,
      cargoHandling: data.avgCargoHandling ? Math.round(data.avgCargoHandling * 10) / 10 : null,
      professionalism: data.avgProfessionalism ? Math.round(data.avgProfessionalism * 10) / 10 : null,
      vehicleCondition: data.avgVehicleCondition ? Math.round(data.avgVehicleCondition * 10) / 10 : null,
      accuracy: data.avgAccuracy ? Math.round(data.avgAccuracy * 10) / 10 : null,
      accessibility: data.avgAccessibility ? Math.round(data.avgAccessibility * 10) / 10 : null,
      payment: data.avgPayment ? Math.round(data.avgPayment * 10) / 10 : null,
      cooperation: data.avgCooperation ? Math.round(data.avgCooperation * 10) / 10 : null
    }
  };
};

// Static: Get rating distribution for a user
ratingSchema.statics.getRatingDistribution = async function(userId) {
  const result = await this.aggregate([
    { $match: { 'ratee.user': new mongoose.Types.ObjectId(userId), visibility: 'visible' } },
    {
      $group: {
        _id: { $floor: '$overallRating' },
        count: { $sum: 1 }
      }
    },
    { $sort: { _id: -1 } }
  ]);

  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  result.forEach(r => {
    if (r._id >= 1 && r._id <= 5) {
      distribution[r._id] = r.count;
    }
  });

  return distribution;
};

// Static: Check if user can rate for a booking
ratingSchema.statics.canRate = async function(bookingId, userId) {
  // Check if rating already exists
  const existing = await this.findOne({
    booking: bookingId,
    'rater.user': userId
  });

  if (existing) {
    return { canRate: false, reason: 'Already rated this booking' };
  }

  // Check if within rating window (48 hours after delivery)
  const Booking = require('./Booking');
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    return { canRate: false, reason: 'Booking not found' };
  }

  if (booking.status !== 'completed') {
    return { canRate: false, reason: 'Booking not completed yet' };
  }

  const completedAt = booking.timeline?.completedAt || booking.updatedAt;
  const hoursSinceCompletion = (Date.now() - new Date(completedAt)) / (1000 * 60 * 60);

  if (hoursSinceCompletion > 48) {
    return { canRate: false, reason: 'Rating window has expired (48 hours)' };
  }

  return { canRate: true };
};

// Static: Get recent reviews for a user
ratingSchema.statics.getRecentReviews = function(userId, limit = 10) {
  return this.find({
    'ratee.user': userId,
    visibility: 'visible',
    'review.text': { $exists: true, $ne: '' }
  })
    .populate('rater.user', 'name')
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('overallRating review tags createdAt tripDetails');
};

module.exports = mongoose.model('Rating', ratingSchema);
