const Shipment = require('../models/Shipment');
const Booking = require('../models/Booking');
const Escrow = require('../models/Escrow');
const User = require('../models/User');
const escrowService = require('../services/escrowService');
const notificationService = require('../services/notificationService');
const whatsappController = require('./whatsappController');
const { formatRelativeTime } = require('../utils/formatDate');

exports.getDashboardStats = async (req, res) => {
  try {
    const transporterId = req.user.id;

    // Get active jobs count
    const activeJobs = await Shipment.countDocuments({
      transporter: transporterId,
      status: { $in: ['assigned', 'in_transit', 'picked_up'] }
    });

    // Get pending payment count
    const pendingPayment = await Shipment.countDocuments({
      transporter: transporterId,
      status: 'delivered',
      paymentStatus: 'pending'
    });

    // Calculate this month's earnings
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const completedShipments = await Shipment.find({
      transporter: transporterId,
      status: 'completed',
      completedAt: { $gte: startOfMonth }
    });

    const earnings = completedShipments.reduce((total, shipment) => {
      return total + (shipment.transporterEarnings || 0);
    }, 0);

    // Get total completed trips
    const totalTrips = await Shipment.countDocuments({
      transporter: transporterId,
      status: 'completed'
    });

    // Calculate average rating
    const ratingsAgg = await Shipment.aggregate([
      {
        $match: {
          transporter: req.user._id,
          rating: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 }
        }
      }
    ]);

    const ratingData = ratingsAgg[0] || { avgRating: 0, totalRatings: 0 };

    res.status(200).json({
      success: true,
      data: {
        activeJobs,
        pendingPayment,
        earnings: parseFloat(earnings.toFixed(2)),
        totalTrips,
        rating: parseFloat(ratingData.avgRating.toFixed(1)),
        totalRatings: ratingData.totalRatings
      }
    });
  } catch (error) {
    console.error('Get transporter dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

exports.getRecentActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    const recentShipments = await Shipment.find({
      transporter: req.user._id
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('origin destination status amount updatedAt')
      .lean();

    const activities = recentShipments.map(shipment => ({
      id: shipment._id,
      title: `${shipment.origin} → ${shipment.destination}`,
      status: shipment.status,
      date: formatRelativeTime(shipment.updatedAt),
      amount: `$${shipment.amount || 0}`
    }));

    res.status(200).json({
      success: true,
      data: activities
    });
  } catch (error) {
    console.error('Get recent activity error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activity'
    });
  }
};

exports.getAvailableJobs = async (req, res) => {
  try {
    const { page = 1, limit = 10, vehicleType, maxDistance, minPrice } = req.query;

    const query = {
      status: 'pending',
      transporter: { $exists: false }
    };

    if (vehicleType) {
      query.vehicleType = vehicleType;
    }

    if (minPrice) {
      query.amount = { $gte: parseFloat(minPrice) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const jobs = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('shipper', 'fullName email phone')
      .select('origin destination vehicleType amount pickupDate deliveryDate cargoDetails')
      .lean();

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: jobs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get available jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch available jobs'
    });
  }
};

// Get my accepted jobs
exports.getMyJobs = async (req, res) => {
  try {
    const transporterId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = { transporter: transporterId };
    if (status) {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const shipments = await Shipment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('shipper', 'name email phone')
      .lean();

    const total = await Shipment.countDocuments(query);

    res.status(200).json({
      success: true,
      data: shipments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get my jobs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch your jobs'
    });
  }
};

// Get job details
exports.getJobDetails = async (req, res) => {
  try {
    const { jobId } = req.params;

    // Try to find in shipments first (accepted job)
    let job = await Shipment.findById(jobId)
      .populate('shipper', 'name email phone')
      .populate('booking');

    if (!job) {
      // Try to find in bookings (available job)
      job = await Booking.findById(jobId)
        .populate('user', 'name email phone');

      if (!job) {
        return res.status(404).json({
          success: false,
          message: 'Job not found'
        });
      }

      // Format booking as job
      return res.status(200).json({
        success: true,
        data: {
          _id: job._id,
          type: 'available',
          bookingReference: job.bookingReference,
          shipper: job.user,
          origin: job.route?.pickup?.address,
          originCity: job.route?.pickup?.city,
          destination: job.route?.delivery?.address,
          destinationCity: job.route?.delivery?.city,
          distance: job.route?.distance,
          vehicleType: job.vehicles?.[0]?.vehicleType || job.vehicleType,
          cargoDetails: job.cargoDetails,
          pickupDate: job.route?.pickup?.date,
          deliveryDate: job.route?.delivery?.date,
          amount: job.pricing?.totals?.transporterTotal || job.pricing?.totals?.total,
          platformFee: job.pricing?.totals?.platformTotal,
          insurance: job.insurance,
          status: job.status,
          createdAt: job.createdAt
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        _id: job._id,
        type: 'accepted',
        ...job.toObject()
      }
    });
  } catch (error) {
    console.error('Get job details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch job details'
    });
  }
};

// Accept a job
exports.acceptJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const transporterId = req.user.id;

    const booking = await Booking.findById(jobId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (booking.status !== 'finding_transporter') {
      return res.status(400).json({
        success: false,
        message: 'This job is no longer available'
      });
    }

    // Update booking
    booking.transporter = transporterId;
    booking.status = 'transporter_assigned';
    booking.timeline = {
      ...booking.timeline,
      transporterAssignedAt: new Date()
    };
    await booking.save();

    // Create or update shipment
    let shipment = await Shipment.findOne({ bookingReference: booking.bookingReference });

    if (shipment) {
      shipment.transporter = transporterId;
      shipment.status = 'assigned';
      await shipment.save();
    } else {
      shipment = await Shipment.create({
        bookingReference: booking.bookingReference,
        booking: booking._id,
        shipper: booking.user,
        transporter: transporterId,
        status: 'assigned',
        cargoDetails: booking.cargoDetails,
        route: booking.route,
        pricing: booking.pricing,
        insurance: booking.insurance,
        schedule: {
          pickupDate: booking.route?.pickup?.date,
          deliveryDate: booking.route?.delivery?.date
        }
      });
    }

    // Update escrow with transporter
    try {
      const escrow = await Escrow.findOne({ booking: booking._id });
      if (escrow) {
        await escrowService.assignTransporter(escrow._id, transporterId);
      }
    } catch (escrowError) {
      console.error('Escrow update error:', escrowError);
    }

    // Notify shipper via push notification
    try {
      await notificationService.notifyTransporterAssigned(booking, req.user);
    } catch (notifyError) {
      console.error('Push notification error:', notifyError);
    }

    // Send WhatsApp notification to shipper
    try {
      await whatsappController.sendBookingStatusUpdate(booking, 'matched');
    } catch (whatsappError) {
      console.error('WhatsApp notification error:', whatsappError);
    }

    res.status(200).json({
      success: true,
      data: {
        shipmentId: shipment._id,
        bookingReference: booking.bookingReference,
        status: 'assigned'
      },
      message: 'Job accepted successfully'
    });
  } catch (error) {
    console.error('Accept job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept job'
    });
  }
};

// Reject/decline a job
exports.rejectJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { reason } = req.body;
    const transporterId = req.user.id;

    // Just log the rejection - job stays available for others
    console.log(`Transporter ${transporterId} rejected job ${jobId}: ${reason}`);

    res.status(200).json({
      success: true,
      message: 'Job declined'
    });
  } catch (error) {
    console.error('Reject job error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to decline job'
    });
  }
};

// Start pickup - transporter is on the way
exports.startPickup = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const transporterId = req.user.id;

    const shipment = await Shipment.findOne({
      _id: shipmentId,
      transporter: transporterId
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    if (shipment.status !== 'assigned') {
      return res.status(400).json({
        success: false,
        message: 'Cannot start pickup from current status'
      });
    }

    shipment.status = 'en_route_pickup';
    shipment.timeline = {
      ...shipment.timeline,
      enRoutePickupAt: new Date()
    };
    await shipment.save();

    // Update booking
    await Booking.findOneAndUpdate(
      { bookingReference: shipment.bookingReference },
      {
        status: 'en_route_pickup',
        'timeline.enRoutePickupAt': new Date()
      }
    );

    res.status(200).json({
      success: true,
      data: { status: shipment.status },
      message: 'Pickup started'
    });
  } catch (error) {
    console.error('Start pickup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start pickup'
    });
  }
};

// Confirm pickup - cargo loaded
exports.confirmPickup = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { photos, notes, signature } = req.body;
    const transporterId = req.user.id;

    const shipment = await Shipment.findOne({
      _id: shipmentId,
      transporter: transporterId
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    shipment.status = 'picked_up';
    shipment.timeline = {
      ...shipment.timeline,
      pickedUpAt: new Date()
    };
    shipment.pickupDetails = {
      photos: photos || [],
      notes,
      signature,
      confirmedAt: new Date()
    };
    await shipment.save();

    // Update booking
    const booking = await Booking.findOneAndUpdate(
      { bookingReference: shipment.bookingReference },
      {
        status: 'picked_up',
        'timeline.pickedUpAt': new Date()
      },
      { new: true }
    );

    // Send WhatsApp notification to shipper
    try {
      if (booking) {
        await whatsappController.sendBookingStatusUpdate(booking, 'picked_up');
      }
    } catch (whatsappError) {
      console.error('WhatsApp notification error:', whatsappError);
    }

    res.status(200).json({
      success: true,
      data: { status: shipment.status },
      message: 'Pickup confirmed'
    });
  } catch (error) {
    console.error('Confirm pickup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm pickup'
    });
  }
};

// Start transit
exports.startTransit = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const transporterId = req.user.id;

    const shipment = await Shipment.findOne({
      _id: shipmentId,
      transporter: transporterId
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    shipment.status = 'in_transit';
    shipment.timeline = {
      ...shipment.timeline,
      inTransitAt: new Date()
    };
    await shipment.save();

    // Update booking
    await Booking.findOneAndUpdate(
      { bookingReference: shipment.bookingReference },
      {
        status: 'in_transit',
        'timeline.inTransitAt': new Date()
      }
    );

    res.status(200).json({
      success: true,
      data: { status: shipment.status },
      message: 'Transit started'
    });
  } catch (error) {
    console.error('Start transit error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start transit'
    });
  }
};

// Update location during transit
exports.updateLocation = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { latitude, longitude, address } = req.body;
    const transporterId = req.user.id;

    const shipment = await Shipment.findOne({
      _id: shipmentId,
      transporter: transporterId
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    // Add location to tracking history
    if (!shipment.tracking) {
      shipment.tracking = { locations: [] };
    }

    shipment.tracking.locations.push({
      latitude,
      longitude,
      address,
      timestamp: new Date()
    });

    shipment.tracking.currentLocation = {
      latitude,
      longitude,
      address,
      updatedAt: new Date()
    };

    await shipment.save();

    res.status(200).json({
      success: true,
      message: 'Location updated'
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update location'
    });
  }
};

// Arrive at delivery location
exports.arriveAtDelivery = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const transporterId = req.user.id;

    const shipment = await Shipment.findOne({
      _id: shipmentId,
      transporter: transporterId
    });

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    shipment.status = 'arrived_delivery';
    shipment.timeline = {
      ...shipment.timeline,
      arrivedDeliveryAt: new Date()
    };
    await shipment.save();

    res.status(200).json({
      success: true,
      data: { status: shipment.status },
      message: 'Arrived at delivery location'
    });
  } catch (error) {
    console.error('Arrive at delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update status'
    });
  }
};

// Confirm delivery
exports.confirmDelivery = async (req, res) => {
  try {
    const { shipmentId } = req.params;
    const { photos, notes, signature, receiverName, receiverPhone } = req.body;
    const transporterId = req.user.id;

    const shipment = await Shipment.findOne({
      _id: shipmentId,
      transporter: transporterId
    }).populate('booking');

    if (!shipment) {
      return res.status(404).json({
        success: false,
        message: 'Shipment not found'
      });
    }

    shipment.status = 'delivered';
    shipment.timeline = {
      ...shipment.timeline,
      deliveredAt: new Date()
    };
    shipment.deliveryDetails = {
      photos: photos || [],
      notes,
      signature,
      receiverName,
      receiverPhone,
      confirmedAt: new Date()
    };
    await shipment.save();

    // Update booking
    const booking = await Booking.findOneAndUpdate(
      { bookingReference: shipment.bookingReference },
      {
        status: 'delivered',
        'timeline.deliveredAt': new Date()
      },
      { new: true }
    );

    // Start escrow grace period
    if (booking) {
      try {
        await escrowService.confirmDelivery(booking._id);
      } catch (escrowError) {
        console.error('Escrow delivery confirmation error:', escrowError);
      }
    }

    // Notify shipper via push notification
    try {
      await notificationService.notifyDeliveryCompleted(booking);
    } catch (notifyError) {
      console.error('Push notification error:', notifyError);
    }

    // Send WhatsApp notification to shipper
    try {
      if (booking) {
        await whatsappController.sendBookingStatusUpdate(booking, 'delivered');
      }
    } catch (whatsappError) {
      console.error('WhatsApp notification error:', whatsappError);
    }

    res.status(200).json({
      success: true,
      data: { status: shipment.status },
      message: 'Delivery confirmed successfully'
    });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to confirm delivery'
    });
  }
};

// Get transporter earnings
exports.getEarnings = async (req, res) => {
  try {
    const transporterId = req.user.id;
    const { period = 'month' } = req.query;

    let startDate = new Date();
    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (period === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }

    const completedShipments = await Shipment.find({
      transporter: transporterId,
      status: 'completed',
      'timeline.completedAt': { $gte: startDate }
    }).sort({ 'timeline.completedAt': -1 });

    const totalEarnings = completedShipments.reduce((sum, s) =>
      sum + (s.transporterEarnings || s.pricing?.totals?.transporterTotal || 0), 0
    );

    const pendingEarnings = await Shipment.aggregate([
      {
        $match: {
          transporter: req.user._id,
          status: 'delivered',
          'timeline.deliveredAt': { $exists: true }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$transporterEarnings', '$pricing.totals.transporterTotal'] } }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        pendingEarnings: pendingEarnings[0]?.total || 0,
        completedTrips: completedShipments.length,
        recentEarnings: completedShipments.slice(0, 10).map(s => ({
          id: s._id,
          reference: s.bookingReference,
          amount: s.transporterEarnings || s.pricing?.totals?.transporterTotal || 0,
          date: s.timeline?.completedAt
        }))
      }
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings'
    });
  }
};