// controllers/ratingController.js
const Rating = require('../models/Rating');
const Booking = require('../models/Booking');
const User = require('../models/User');

// Submit a rating
exports.submitRating = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const {
      overallRating,
      categories,
      review,
      tags,
      wouldUseAgain
    } = req.body;

    const userId = req.user.id;

    // Check if user can rate
    const canRateResult = await Rating.canRate(bookingId, userId);
    if (!canRateResult.canRate) {
      return res.status(400).json({
        success: false,
        message: canRateResult.reason
      });
    }

    // Get booking details
    const booking = await Booking.findById(bookingId)
      .populate('user', 'name email')
      .populate('transporter', 'name email');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Determine rater and ratee
    let rater, ratee;
    const isShipper = booking.user._id.toString() === userId;
    const isTransporter = booking.transporter?._id?.toString() === userId;

    if (isShipper) {
      rater = { user: userId, role: 'shipper' };
      ratee = { user: booking.transporter._id, role: 'transporter' };
    } else if (isTransporter) {
      rater = { user: userId, role: 'transporter' };
      ratee = { user: booking.user._id, role: 'shipper' };
    } else {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to rate this booking'
      });
    }

    // Create rating
    const rating = new Rating({
      booking: bookingId,
      rater,
      ratee,
      overallRating,
      categories,
      review: {
        text: review?.text || '',
        isPublic: review?.isPublic !== false
      },
      tags: tags || [],
      wouldUseAgain: wouldUseAgain ?? undefined,
      tripDetails: {
        distance: booking.route?.distance,
        origin: booking.route?.pickup?.city || booking.route?.pickup?.address,
        destination: booking.route?.delivery?.city || booking.route?.delivery?.address,
        cargoType: booking.cargoDetails?.type,
        completedAt: booking.timeline?.completedAt || booking.updatedAt
      }
    });

    // Calculate overall from categories if not provided
    if (!overallRating && categories) {
      rating.calculateOverall();
    }

    await rating.save();

    // Update user's average rating
    await updateUserRating(ratee.user);

    res.status(201).json({
      success: true,
      data: {
        ratingId: rating._id,
        overallRating: rating.overallRating,
        message: 'Rating submitted successfully'
      }
    });

  } catch (error) {
    console.error('Error submitting rating:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to submit rating'
    });
  }
};

// Get user's rating summary
exports.getUserRating = async (req, res) => {
  try {
    const { userId } = req.params;

    const ratingData = await Rating.getUserRating(userId);
    const distribution = await Rating.getRatingDistribution(userId);

    res.json({
      success: true,
      data: {
        ...ratingData,
        distribution
      }
    });

  } catch (error) {
    console.error('Error getting user rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user rating'
    });
  }
};

// Get user's reviews
exports.getUserReviews = async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Rating.find({
      'ratee.user': userId,
      visibility: 'visible'
    })
      .populate('rater.user', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Rating.countDocuments({
      'ratee.user': userId,
      visibility: 'visible'
    });

    res.json({
      success: true,
      data: {
        reviews,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error getting user reviews:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user reviews'
    });
  }
};

// Get rating for a specific booking
exports.getBookingRatings = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const ratings = await Rating.find({ booking: bookingId })
      .populate('rater.user', 'name')
      .populate('ratee.user', 'name');

    // Check if current user can still rate
    const canRateResult = await Rating.canRate(bookingId, req.user.id);

    res.json({
      success: true,
      data: {
        ratings,
        canRate: canRateResult.canRate,
        canRateReason: canRateResult.reason
      }
    });

  } catch (error) {
    console.error('Error getting booking ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get booking ratings'
    });
  }
};

// Respond to a rating (by the ratee)
exports.respondToRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const { responseText } = req.body;
    const userId = req.user.id;

    const rating = await Rating.findById(ratingId);

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }

    // Only ratee can respond
    if (rating.ratee.user.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the rated user can respond to this rating'
      });
    }

    // Can only respond once
    if (rating.response?.text) {
      return res.status(400).json({
        success: false,
        message: 'You have already responded to this rating'
      });
    }

    rating.response = {
      text: responseText,
      respondedAt: new Date()
    };

    await rating.save();

    res.json({
      success: true,
      data: rating,
      message: 'Response added successfully'
    });

  } catch (error) {
    console.error('Error responding to rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to rating'
    });
  }
};

// Flag a rating for review
exports.flagRating = async (req, res) => {
  try {
    const { ratingId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    const rating = await Rating.findById(ratingId);

    if (!rating) {
      return res.status(404).json({
        success: false,
        message: 'Rating not found'
      });
    }

    rating.flagged = {
      isFlagged: true,
      reason,
      flaggedAt: new Date(),
      flaggedBy: userId
    };
    rating.visibility = 'flagged';

    await rating.save();

    res.json({
      success: true,
      message: 'Rating flagged for review'
    });

  } catch (error) {
    console.error('Error flagging rating:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to flag rating'
    });
  }
};

// Check if user can rate a booking
exports.checkCanRate = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const result = await Rating.canRate(bookingId, userId);

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error checking rating eligibility:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check rating eligibility'
    });
  }
};

// Get my ratings (ratings I've received)
exports.getMyRatings = async (req, res) => {
  try {
    const userId = req.user.id;

    const ratingData = await Rating.getUserRating(userId);
    const distribution = await Rating.getRatingDistribution(userId);
    const recentReviews = await Rating.getRecentReviews(userId, 5);

    res.json({
      success: true,
      data: {
        summary: ratingData,
        distribution,
        recentReviews
      }
    });

  } catch (error) {
    console.error('Error getting my ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get ratings'
    });
  }
};

// Get ratings I've given
exports.getMyGivenRatings = async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

    const ratings = await Rating.find({ 'rater.user': userId })
      .populate('ratee.user', 'name')
      .populate('booking', 'bookingReference')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Rating.countDocuments({ 'rater.user': userId });

    res.json({
      success: true,
      data: {
        ratings,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error getting given ratings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get given ratings'
    });
  }
};

// Helper function to update user's cached rating
async function updateUserRating(userId) {
  try {
    const ratingData = await Rating.getUserRating(userId);

    await User.findByIdAndUpdate(userId, {
      'rating.average': ratingData.averageRating,
      'rating.count': ratingData.totalRatings,
      'rating.lastUpdated': new Date()
    });
  } catch (error) {
    console.error('Error updating user rating cache:', error);
  }
}

module.exports = exports;
