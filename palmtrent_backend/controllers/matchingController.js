// controllers/matchingController.js
// API endpoints for transporter-booking matching

const Booking = require('../models/Booking');
const matchingService = require('../services/matchingService');

/**
 * Manually trigger transporter matching for a booking
 * POST /api/v1/bookings/:id/find-transporters
 */
exports.findTransporters = async (req, res) => {
  try {
    const bookingId = req.params.id;

    // Fetch booking
    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Authorization check - only shipper or admin can trigger matching
    if (booking.shipper.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to trigger matching for this booking'
      });
    }

    // Verify payment is confirmed
    if (booking.paymentStatus !== 'confirmed' && !booking.paymentConfirmedAt) {
      return res.status(400).json({
        success: false,
        message: 'Payment must be confirmed before finding transporters',
        currentPaymentStatus: booking.paymentStatus
      });
    }

    // Trigger matching
    const count = parseInt(req.body.count) || 10; // Number of transporters to notify
    const result = await matchingService.findAndNotifyTransporters(bookingId, count);

    res.status(200).json({
      success: result.success,
      message: result.message,
      data: {
        bookingReference: booking.bookingReference,
        eligibleCount: result.eligibleCount,
        notifiedCount: result.notifiedCount,
        topMatches: result.topMatches
      }
    });

  } catch (error) {
    console.error('Error finding transporters:', error);
    res.status(500).json({
      success: false,
      message: 'Error finding transporters',
      error: error.message
    });
  }
};

/**
 * Get match results for a booking
 * GET /api/v1/bookings/:id/matches
 */
exports.getMatches = async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId)
      .populate('matchResults.topMatches.transporter', 'fullName phone rating avatar')
      .select('bookingReference status matchResults');

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Authorization check
    if (booking.shipper && booking.shipper.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view matches for this booking'
      });
    }

    if (!booking.matchResults || !booking.matchResults.topMatches) {
      return res.status(404).json({
        success: false,
        message: 'No match results found for this booking'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        bookingReference: booking.bookingReference,
        status: booking.status,
        matchResults: booking.matchResults
      }
    });

  } catch (error) {
    console.error('Error getting match results:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving match results',
      error: error.message
    });
  }
};

/**
 * Broadcast booking to top matching transporters
 * POST /api/v1/bookings/:id/broadcast
 */
exports.broadcastToTransporters = async (req, res) => {
  try {
    const bookingId = req.params.id;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Authorization check
    if (booking.shipper.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Verify payment confirmed
    if (booking.paymentStatus !== 'confirmed') {
      return res.status(400).json({
        success: false,
        message: 'Payment must be confirmed before broadcasting'
      });
    }

    // Check if already finding transporters
    if (booking.status === 'finding_transporter' || booking.status === 'matched') {
      return res.status(400).json({
        success: false,
        message: 'Booking already broadcasted to transporters'
      });
    }

    // Broadcast to transporters
    const count = parseInt(req.body.count) || 10;
    const result = await matchingService.findAndNotifyTransporters(bookingId, count);

    res.status(200).json({
      success: true,
      message: `Broadcasted to ${result.notifiedCount} transporters`,
      data: result
    });

  } catch (error) {
    console.error('Error broadcasting to transporters:', error);
    res.status(500).json({
      success: false,
      message: 'Error broadcasting booking',
      error: error.message
    });
  }
};

/**
 * Get available jobs for a transporter (for PendingJobsScreen)
 * GET /api/v1/jobs/available
 */
exports.getAvailableJobs = async (req, res) => {
  try {
    const transporterId = req.user.id;

    // Verify user is a transporter
    if (req.user.role !== 'transporter') {
      return res.status(403).json({
        success: false,
        message: 'Only transporters can view available jobs'
      });
    }

    // Get available jobs with match scores
    const jobs = await matchingService.getAvailableJobsForTransporter(transporterId);

    // Apply filters if provided
    let filteredJobs = jobs;

    if (req.query.vehicleType) {
      filteredJobs = filteredJobs.filter(job =>
        job.booking.vehicleType === req.query.vehicleType
      );
    }

    if (req.query.minEarnings) {
      const minEarnings = parseFloat(req.query.minEarnings);
      filteredJobs = filteredJobs.filter(job =>
        job.estimatedEarnings >= minEarnings
      );
    }

    if (req.query.maxDistance) {
      const maxDistance = parseFloat(req.query.maxDistance);
      filteredJobs = filteredJobs.filter(job =>
        job.distance <= maxDistance
      );
    }

    // Sort by query parameter
    const sortBy = req.query.sortBy || 'matchScore'; // matchScore, earnings, distance, date

    if (sortBy === 'earnings') {
      filteredJobs.sort((a, b) => b.estimatedEarnings - a.estimatedEarnings);
    } else if (sortBy === 'distance') {
      filteredJobs.sort((a, b) => a.distance - b.distance);
    } else if (sortBy === 'date') {
      filteredJobs.sort((a, b) => new Date(b.booking.createdAt) - new Date(a.booking.createdAt));
    }
    // Default is matchScore (already sorted by service)

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;

    const paginatedJobs = filteredJobs.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      count: paginatedJobs.length,
      total: filteredJobs.length,
      page,
      pages: Math.ceil(filteredJobs.length / limit),
      data: paginatedJobs
    });

  } catch (error) {
    console.error('Error getting available jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving available jobs',
      error: error.message
    });
  }
};

/**
 * Accept a job (transporter accepts booking)
 * POST /api/v1/jobs/:id/accept
 */
exports.acceptJob = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const transporterId = req.user.id;

    // Verify user is a transporter
    if (req.user.role !== 'transporter') {
      return res.status(403).json({
        success: false,
        message: 'Only transporters can accept jobs'
      });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Check if booking is available
    if (booking.status !== 'finding_transporter') {
      return res.status(400).json({
        success: false,
        message: 'This job is no longer available'
      });
    }

    // Assign transporter to booking
    booking.transporter = transporterId;
    booking.status = 'matched';
    booking.matchedAt = new Date();
    await booking.save();

    // TODO: Send notification to shipper about match
    // const notificationService = require('../services/notificationService');
    // await notificationService.sendTransporterMatched(booking.shipper, transporterId, booking);

    res.status(200).json({
      success: true,
      message: 'Job accepted successfully',
      data: {
        booking: booking
      }
    });

  } catch (error) {
    console.error('Error accepting job:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting job',
      error: error.message
    });
  }
};

/**
 * Decline a job
 * POST /api/v1/jobs/:id/decline
 */
exports.declineJob = async (req, res) => {
  try {
    const bookingId = req.params.id;
    const transporterId = req.user.id;
    const { reason } = req.body;

    // Verify user is a transporter
    if (req.user.role !== 'transporter') {
      return res.status(403).json({
        success: false,
        message: 'Only transporters can decline jobs'
      });
    }

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Record decline (for stats and future matching improvements)
    if (!booking.declines) {
      booking.declines = [];
    }

    booking.declines.push({
      transporter: transporterId,
      reason: reason || 'Not specified',
      declinedAt: new Date()
    });

    await booking.save();

    // TODO: Update transporter stats (track decline for acceptance rate)

    res.status(200).json({
      success: true,
      message: 'Job declined'
    });

  } catch (error) {
    console.error('Error declining job:', error);
    res.status(500).json({
      success: false,
      message: 'Error declining job',
      error: error.message
    });
  }
};

// Functions are exported via exports.functionName above
