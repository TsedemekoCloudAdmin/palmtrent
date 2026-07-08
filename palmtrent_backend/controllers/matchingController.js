// controllers/matchingController.js
// API endpoints for transporter-booking matching

const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const Escrow = require('../models/Escrow');
const matchingService = require('../services/matchingService');
const escrowService = require('../services/escrowService');
const whatsappController = require('./whatsappController');
const notificationService = require('../services/notificationService');
const {
  assertBookingTransition,
  assertTransporterEligible,
  isPaymentConfirmed
} = require('../services/flowControlService');

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
    if (booking.shipper.toString() !== req.user.id && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to trigger matching for this booking'
      });
    }

    // Verify payment is confirmed
    if (!['confirmed', 'escrowed', 'released'].includes(booking.paymentStatus) && !booking.paymentConfirmedAt) {
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
    if (booking.shipper && booking.shipper.toString() !== req.user.id && req.user.userType !== 'admin') {
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
    if (booking.shipper.toString() !== req.user.id && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    // Verify payment confirmed
    if (!['confirmed', 'escrowed', 'released'].includes(booking.paymentStatus)) {
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
    if (req.user.userType !== 'transporter') {
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
    if (req.user.userType !== 'transporter') {
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

    if (matchingService.bookingBelongsToUser(booking, transporterId)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot accept your own booking'
      });
    }

    // Check if booking is available
    if (booking.status !== 'finding_transporter') {
      return res.status(400).json({
        success: false,
        message: 'This job is no longer available'
      });
    }

    // Cash jobs: the transporter must remit Palmtrent's commission before the job
    // is assigned to them. Non-cash (digital/escrow) jobs use the payment gate below.
    const CASH_METHODS = ['cash', 'cash_agent', 'cash_on_pickup', 'cash_on_delivery'];
    const isCash = CASH_METHODS.includes(booking?.payment?.method || booking?.paymentMethod);
    if (isCash) {
      if (booking.commission?.status !== 'paid') {
        return res.status(402).json({
          success: false,
          code: 'COMMISSION_REQUIRED',
          message: 'Remit Palmtrent\'s commission before accepting this cash job.',
          data: {
            amount: booking.commission?.amount ||
              Number(booking.pricing?.feeAllocation?.platform?.amount || booking.pricing?.breakdown?.platformFee || 0)
          }
        });
      }
    } else if (!isPaymentConfirmed(booking)) {
      return res.status(400).json({
        success: false,
        message: 'Payment must be confirmed before this job can be accepted'
      });
    }

    await assertTransporterEligible(transporterId);
    assertBookingTransition(booking.status, 'transporter_assigned');

    // Assign transporter to booking
    booking.transporter = transporterId;
    booking.status = 'transporter_assigned';
    booking.matchedAt = new Date();
    await booking.save();

    let shipments = await Shipment.find({ booking: booking._id });
    if (shipments.length > 0) {
      shipments = await Promise.all(shipments.map(async shipment => {
        shipment.transporter = transporterId;
        shipment.status = 'assigned';
        await shipment.save();
        return shipment;
      }));
    } else {
      const vehicleRows = booking.bookingType === 'multiple' && booking.vehicles?.length > 0
        ? booking.vehicles
        : [null];

      shipments = await Promise.all(vehicleRows.map((vehicleRow, index) => Shipment.create({
        bookingReference: booking.bookingReference,
        booking: booking._id,
        shipper: booking.shipper || booking.user,
        transporter: transporterId,
        vehicle: vehicleRow?.vehicle,
        status: 'assigned',
        cargoDetails: vehicleRow ? {
          type: booking.cargoDetails?.type || vehicleRow.vehicleType || 'cargo',
          weight: vehicleRow.weight || booking.cargoDetails?.weight || 0,
          value: booking.cargoDetails?.value,
          description: vehicleRow.description || booking.cargoDetails?.description,
          specialInstructions: booking.cargoDetails?.specialInstructions,
          photos: booking.cargoDetails?.photos
        } : booking.cargoDetails,
        route: booking.route,
        pricing: {
          total: booking.pricing?.totals?.total,
          platformFee: booking.pricing?.totals?.platformTotal,
          insurance: booking.pricing?.totals?.insuranceTotal,
          currency: booking.pricing?.currency || 'USD'
        },
        insurance: booking.insurance,
        origin: booking.origin,
        destination: booking.destination,
        amount: booking.totalAmount,
        transporterEarnings: booking.pricing?.totals?.transporterTotal,
        schedule: {
          pickupDate: booking.route?.pickup?.date,
          deliveryDate: booking.route?.delivery?.date
        },
        statusHistory: [{
          status: 'assigned',
          notes: vehicleRow ? `Vehicle slot ${index + 1} assigned` : 'Shipment assigned'
        }]
      })));
    }

    try {
      const escrow = await Escrow.findOne({ booking: booking._id });
      if (escrow) {
        await escrowService.assignTransporter(escrow._id, transporterId);
      }
    } catch (escrowError) {
      console.error('Escrow transporter assignment error:', escrowError);
    }

    try {
      await whatsappController.sendBookingStatusUpdate(booking, 'matched');
    } catch (whatsappError) {
      console.error('WhatsApp notification error:', whatsappError);
    }

    try {
      await notificationService.notifyTransporterAssigned(booking, req.user);
    } catch (notifyError) {
      console.error('Shipper match notification error:', notifyError);
    }

    try {
      await matchingService.recordTransporterOfferResponse(transporterId, 'accepted');
    } catch (statsError) {
      console.error('Transporter acceptance stats error:', statsError);
    }

    res.status(200).json({
      success: true,
      message: 'Job accepted successfully',
      data: {
        booking,
        shipmentId: shipments[0]?._id,
        shipmentIds: shipments.map(shipment => shipment._id)
      }
    });

  } catch (error) {
    console.error('Error accepting job:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error accepting job',
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
    if (req.user.userType !== 'transporter') {
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

    // Record one decline per booking/transporter offer response.
    if (!booking.declines) {
      booking.declines = [];
    }

    const alreadyDeclined = booking.declines.some(decline =>
      decline.transporter?.toString() === transporterId.toString()
    );
    if (!alreadyDeclined) {
      booking.declines.push({
        transporter: transporterId,
        reason: reason || 'Not specified',
        declinedAt: new Date()
      });

      await booking.save();
      await matchingService.recordTransporterOfferResponse(transporterId, 'declined');
    }

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
