const Shipment = require('../models/Shipment');
const Booking = require('../models/Booking');
const Escrow = require('../models/Escrow');
const User = require('../models/User');
const Rental = require('../models/Rental');
const Vehicle = require('../models/Vehicle');
const escrowService = require('../services/escrowService');
const notificationService = require('../services/notificationService');
const whatsappController = require('./whatsappController');
const { formatRelativeTime } = require('../utils/formatDate');
const { recordAudit } = require('../services/auditService');
const tractorTrailerMatchingService = require('../services/tractorTrailerMatchingService');
const monetizationService = require('../services/monetizationService');
const { validateShipmentEvidence } = require('../services/shipmentEvidenceService');
const podService = require('../services/podService');
const matchingService = require('../services/matchingService');
const { finalizeUploadedFile } = require('../services/uploadFinalizationService');
const {
  assertBookingTransition,
  assertShipmentTransition,
  assertTransporterEligible,
  assertVehicleAssignable,
  isPaymentConfirmed
} = require('../services/flowControlService');

const ACTIVE_SHIPMENT_STATUSES = ['assigned', 'en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery'];

function parseStatusFilter(status) {
  if (!status) return [];

  const values = Array.isArray(status)
    ? status
    : String(status).split(',');

  const normalized = values
    .flatMap(value => String(value).split(','))
    .map(value => value.trim())
    .filter(Boolean);

  if (normalized.includes('active')) {
    return ACTIVE_SHIPMENT_STATUSES;
  }

  return [...new Set(normalized)];
}

function applyStatusFilter(query, status) {
  const statuses = parseStatusFilter(status);

  if (statuses.length === 1) {
    query.status = statuses[0];
  } else if (statuses.length > 1) {
    query.status = { $in: statuses };
  }

  return query;
}

exports.submitVerification = async (req, res) => {
  try {
    if (req.user.userType !== 'transporter') {
      return res.status(403).json({
        success: false,
        message: 'Only transporters can submit transporter verification'
      });
    }

    const {
      fullName,
      idNumber,
      dateOfBirth,
      address,
      city,
      province,
      licenseNumber,
      licenseExpiry,
      licenseClasses
    } = req.body;

    const documentTypeByField = {
      idFront: 'national_id_front',
      idBack: 'national_id_back',
      licenseFront: 'driver_license_front',
      licenseBack: 'driver_license_back',
      selfie: 'selfie'
    };

    const uploadedDocuments = [];
    for (const [fieldName, files] of Object.entries(req.files || {})) {
      const documentType = documentTypeByField[fieldName] || 'other';
      for (const file of files) {
        const finalized = await finalizeUploadedFile(file, 'verification');
        uploadedDocuments.push({
          type: documentType,
          url: finalized.url,
          originalName: finalized.originalName,
          uploadedAt: new Date(),
          storageKey: finalized.key,
          storageProvider: finalized.provider
        });
      }
    }

    const parsedLicenseClasses = (() => {
      if (!licenseClasses) return [];
      try {
        return Array.isArray(licenseClasses) ? licenseClasses : JSON.parse(licenseClasses);
      } catch {
        return String(licenseClasses).split(',').map(item => item.trim()).filter(Boolean);
      }
    })();

    const user = await User.findById(req.user.id);
    user.fullName = fullName || user.fullName;
    const existingVerification = user.verification?.toObject?.() || user.verification || {};

    user.verification = {
      ...existingVerification,
      status: 'pending',
      isVerified: false,
      submittedAt: new Date(),
      personalInfo: {
        idNumber,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        address,
        city,
        province
      },
      driverLicense: {
        number: licenseNumber,
        expiryDate: licenseExpiry ? new Date(licenseExpiry) : undefined,
        classes: parsedLicenseClasses
      },
      documents: [
        ...(user.verification?.documents || []),
        ...uploadedDocuments
      ]
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Verification submitted successfully',
      data: {
        status: user.verification.status,
        submittedAt: user.verification.submittedAt,
        documents: uploadedDocuments.length
      }
    });
  } catch (error) {
    console.error('Submit transporter verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit verification',
      error: error.message
    });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const transporterId = req.user.id;

    // Get active jobs count
    const activeJobs = await Shipment.countDocuments({
      transporter: transporterId,
      status: { $in: ACTIVE_SHIPMENT_STATUSES }
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
    const onTimeShipments = completedShipments.filter((shipment) => {
      const actualDelivery = shipment.schedule?.actualDeliveryTime || shipment.timeline?.deliveredAt || shipment.completedAt;
      const scheduledDelivery = shipment.schedule?.scheduledDeliveryTime || shipment.schedule?.estimatedDelivery;
      return actualDelivery && scheduledDelivery && new Date(actualDelivery) <= new Date(scheduledDelivery);
    });
    const onTimeDelivery = completedShipments.length
      ? Math.round((onTimeShipments.length / completedShipments.length) * 100)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        activeJobs,
        pendingPayment,
        earnings: parseFloat(earnings.toFixed(2)),
        totalTrips,
        rating: parseFloat(ratingData.avgRating.toFixed(1)),
        totalRatings: ratingData.totalRatings,
        onTimeDelivery
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
      status: 'finding_transporter',
      paymentStatus: { $in: ['confirmed', 'escrowed'] },
      transporter: { $exists: false },
      ...matchingService.excludeUserOwnedBookingsQuery(req.user._id)
    };

    if (vehicleType) {
      query.vehicleType = vehicleType;
    }

    if (minPrice) {
      query.totalAmount = { $gte: parseFloat(minPrice) };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const jobs = await Booking.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('shipper', 'fullName email phone')
      .select('origin destination vehicleType amount totalAmount pricing pickupDate deliveryDate cargoDetails')
      .lean();
    const normalizedJobs = jobs.map(job => ({
      ...job,
      id: job._id,
      amount: job.amount || job.totalAmount || job.pricing?.totals?.transporterTotal || job.pricing?.totals?.total || 0
    }));

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: normalizedJobs,
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
    applyStatusFilter(query, status);

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const shipments = await Shipment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('shipper', 'fullName email phone')
      .populate('assignedDriver', 'fullName phone licenseNumber licenseClass')
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

      if (matchingService.bookingBelongsToUser(job, req.user.id)) {
        return res.status(403).json({
          success: false,
          message: 'You cannot view your own booking as an available transporter job'
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

    if (job.transporter?.toString?.() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this accepted job'
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
    const { vehicleAssignments = [], linkedRentalIds = [] } = req.body || {};

    const booking = await Booking.findById(jobId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }

    if (matchingService.bookingBelongsToUser(booking, transporterId)) {
      return res.status(403).json({
        success: false,
        message: 'You cannot accept your own booking'
      });
    }

    if (booking.status !== 'finding_transporter') {
      return res.status(400).json({
        success: false,
        message: 'This job is no longer available'
      });
    }

    if (!isPaymentConfirmed(booking)) {
      return res.status(400).json({
        success: false,
        message: 'Payment must be confirmed before this job can be accepted'
      });
    }

    await assertTransporterEligible(transporterId);
    assertBookingTransition(booking.status, 'transporter_assigned');

    const requestedVehicleIds = vehicleAssignments
      .map(item => item.vehicle || item.vehicleId || item)
      .filter(Boolean);

    for (const vehicleId of requestedVehicleIds) {
      await assertVehicleAssignable(vehicleId, transporterId);
    }

    const linkedRentals = await Rental.find({
      _id: { $in: linkedRentalIds },
      renter: transporterId,
      status: { $in: ['confirmed', 'active'] }
    }).populate('trailer');

    if (linkedRentalIds.length !== linkedRentals.length) {
      throw new Error('All linked rentals must be paid and confirmed before accepting the job');
    }

    // Update booking
    booking.transporter = transporterId;
    booking.status = 'transporter_assigned';
    booking.timeline = {
      ...booking.timeline,
      transporterAssignedAt: new Date()
    };
    await booking.save();

    // Create or update shipment(s). Multiple-vehicle bookings create one shipment per vehicle.
    let shipments = await Shipment.find({ booking: booking._id });
    const earningsSplit = await calculateEarningsSplit(booking, linkedRentals);
    const selectedVehicles = requestedVehicleIds.length
      ? await Vehicle.find({ _id: { $in: requestedVehicleIds }, owner: transporterId }).select('_id assignedDriver')
      : [];
    const assignedDriverByVehicle = new Map(
      selectedVehicles
        .filter(vehicle => vehicle.assignedDriver)
        .map(vehicle => [vehicle._id.toString(), vehicle.assignedDriver])
    );
    const getAssignedDriverForVehicle = (vehicleId) => (
      vehicleId ? assignedDriverByVehicle.get(vehicleId.toString()) : undefined
    );

    if (shipments.length > 0) {
      shipments = await Promise.all(shipments.map(async (shipment, index) => {
        const assignedVehicle = requestedVehicleIds[index] || shipment.vehicle;
        assertShipmentTransition(shipment.status, 'assigned');
        shipment.transporter = transporterId;
        if (assignedVehicle) shipment.vehicle = assignedVehicle;
        shipment.assignedDriver = getAssignedDriverForVehicle(assignedVehicle) || shipment.assignedDriver;
        shipment.rentedAssets = linkedRentals.map(rental => ({
          rental: rental._id,
          asset: rental.trailer?._id,
          assetType: rental.itemType,
          role: rental.linkedShipment?.role || 'supporting_trailer',
          owner: rental.owner,
          amount: rental.pricing?.total || 0
        }));
        shipment.earningsSplit = earningsSplit;
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
        shipper: booking.user,
        transporter: transporterId,
        vehicle: requestedVehicleIds[index] || vehicleRow?.vehicle,
        assignedDriver: getAssignedDriverForVehicle(requestedVehicleIds[index] || vehicleRow?.vehicle),
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
        rentedAssets: linkedRentals.map(rental => ({
          rental: rental._id,
          asset: rental.trailer?._id,
          assetType: rental.itemType,
          role: rental.linkedShipment?.role || 'supporting_trailer',
          owner: rental.owner,
          amount: rental.pricing?.total || 0
        })),
        earningsSplit,
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

    if (requestedVehicleIds.length > 0) {
      await require('../models/Vehicle').updateMany(
        { _id: { $in: requestedVehicleIds } },
        { status: 'in_use' }
      );
    }

    if (linkedRentals.length > 0) {
      await Rental.updateMany(
        { _id: { $in: linkedRentals.map(rental => rental._id) } },
        {
          'linkedShipment.booking': booking._id,
          'linkedShipment.shipment': shipments[0]?._id
        }
      );
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

    try {
      await matchingService.recordTransporterOfferResponse(transporterId, 'accepted');
    } catch (statsError) {
      console.error('Transporter acceptance stats error:', statsError);
    }

    // Send WhatsApp notification to shipper
    try {
      await whatsappController.sendBookingStatusUpdate(booking, 'matched');
    } catch (whatsappError) {
      console.error('WhatsApp notification error:', whatsappError);
    }

    await recordAudit({
      actor: req.user,
      action: 'job.accepted',
      entityType: 'Booking',
      entityId: booking._id,
      entityRef: booking.bookingReference,
      after: {
        status: booking.status,
        transporter: transporterId,
        shipmentIds: shipments.map(shipment => shipment._id),
        vehicleIds: requestedVehicleIds,
        linkedRentalIds
      },
      req
    });

    res.status(200).json({
      success: true,
      data: {
        shipmentId: shipments[0]?._id,
        shipmentIds: shipments.map(shipment => shipment._id),
        bookingReference: booking.bookingReference,
        status: 'assigned'
      },
      message: 'Job accepted successfully'
    });
  } catch (error) {
    console.error('Accept job error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to accept job'
    });
  }
};

async function calculateEarningsSplit(booking, rentals = []) {
  const shipmentTotal = Number(booking.pricing?.totals?.total || booking.totalAmount || 0);
  const calculatedFees = booking.pricing?.totals?.platformTotal
    ? null
    : await monetizationService.calculateShipmentFees(shipmentTotal, shipmentTotal, {
      audience: booking.corporateAccount ? 'corporate' : 'all',
      paymentMethod: booking.payment?.method || 'openapi_africa'
    });
  const platformFee = Number(booking.pricing?.totals?.platformTotal || calculatedFees?.platformFee || 0);
  const baseTransporterEarnings = Number(booking.pricing?.totals?.transporterTotal || Math.max(0, shipmentTotal - platformFee));
  const rentalCosts = rentals.reduce((sum, rental) => sum + Number(rental.pricing?.total || 0), 0);
  return {
    shipmentTotal,
    platformFee,
    rentalCosts,
    trailerOwnerEarnings: rentalCosts,
    transporterEarnings: Math.max(0, baseTransporterEarnings - rentalCosts),
    driverEarnings: 0,
    currency: booking.pricing?.currency || 'USD'
  };
}

exports.getTrailerPairingOptions = async (req, res) => {
  try {
    const result = await tractorTrailerMatchingService.getTrailerPairingOptions({
      bookingId: req.params.jobId,
      transporterId: req.user.id,
      vehicleId: req.query.vehicleId,
      limit: req.query.limit || 10
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Trailer pairing options error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to get trailer options' });
  }
};

exports.requestTrailerPairing = async (req, res) => {
  try {
    await assertTransporterEligible(req.user.id);
    const rental = await tractorTrailerMatchingService.createLinkedTrailerRental({
      bookingId: req.params.jobId,
      transporterId: req.user.id,
      vehicleId: req.body.vehicleId,
      trailerId: req.body.trailerId
    });
    res.status(201).json({ success: true, data: rental, message: 'Trailer rental requested for this job' });
  } catch (error) {
    console.error('Request trailer pairing error:', error);
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to request trailer pairing' });
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

    const booking = await Booking.findOneAndUpdate({
      _id: jobId,
      'declines.transporter': { $ne: transporterId }
    }, {
      $push: {
        declines: {
          transporter: transporterId,
          reason,
          declinedAt: new Date()
        }
      }
    }, { new: true });

    if (booking) {
      await matchingService.recordTransporterOfferResponse(transporterId, 'declined');
    }

    await recordAudit({
      actor: req.user,
      action: 'job.declined',
      entityType: 'Booking',
      entityId: jobId,
      metadata: { reason },
      req
    });

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

    assertShipmentTransition(shipment.status, 'en_route_pickup');
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

    await recordAudit({
      actor: req.user,
      action: 'shipment.pickup_started',
      entityType: 'Shipment',
      entityId: shipment._id,
      entityRef: shipment.bookingReference,
      after: { status: shipment.status },
      req
    });

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

    const evidence = validateShipmentEvidence({
      photos,
      signature,
      user: req.user
    });
    if (!evidence.valid) {
      return res.status(400).json({
        success: false,
        message: evidence.errors[0],
        errors: evidence.errors
      });
    }

    assertShipmentTransition(shipment.status, 'picked_up');
    shipment.status = 'picked_up';
    shipment.timeline = {
      ...shipment.timeline,
      pickedUpAt: new Date()
    };
    shipment.pickupDetails = {
      photos: evidence.photos,
      notes,
      signature: evidence.signature,
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

    await recordAudit({
      actor: req.user,
      action: 'shipment.pickup_confirmed',
      entityType: 'Shipment',
      entityId: shipment._id,
      entityRef: shipment.bookingReference,
      after: { status: shipment.status, hasSignature: Boolean(evidence.signature), photoCount: evidence.photos.length },
      req
    });

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

    assertShipmentTransition(shipment.status, 'in_transit');
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

    await recordAudit({
      actor: req.user,
      action: 'shipment.transit_started',
      entityType: 'Shipment',
      entityId: shipment._id,
      entityRef: shipment.bookingReference,
      after: { status: shipment.status },
      req
    });

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

    const coordinates = [Number(longitude), Number(latitude)];

    shipment.tracking.push({
      location: {
        type: 'Point',
        coordinates
      },
      event: 'location_update',
      note: address,
      timestamp: new Date()
    });

    shipment.currentLocation = {
      type: 'Point',
      coordinates
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

    assertShipmentTransition(shipment.status, 'arrived_delivery');
    shipment.status = 'arrived_delivery';
    shipment.timeline = {
      ...shipment.timeline,
      arrivedDeliveryAt: new Date()
    };
    await shipment.save();

    await recordAudit({
      actor: req.user,
      action: 'shipment.arrived_delivery',
      entityType: 'Shipment',
      entityId: shipment._id,
      entityRef: shipment.bookingReference,
      after: { status: shipment.status },
      req
    });

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

    const evidence = validateShipmentEvidence({
      photos,
      signature,
      user: req.user
    });
    if (!evidence.valid) {
      return res.status(400).json({
        success: false,
        message: evidence.errors[0],
        errors: evidence.errors
      });
    }

    assertShipmentTransition(shipment.status, 'delivered');
    shipment.status = 'delivered';
    shipment.timeline = {
      ...shipment.timeline,
      deliveredAt: new Date()
    };
    shipment.deliveryDetails = {
      photos: evidence.photos,
      notes,
      signature: evidence.signature,
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

    let podDocument = null;
    try {
      if (booking) {
        podDocument = await podService.ensurePDFFromShipment(shipment, booking);
      }
    } catch (podError) {
      console.error('POD document generation error:', podError);
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

    await recordAudit({
      actor: req.user,
      action: 'shipment.delivered',
      entityType: 'Shipment',
      entityId: shipment._id,
      entityRef: shipment.bookingReference,
      after: {
        status: shipment.status,
        receiverName,
        receiverPhone,
        hasSignature: Boolean(evidence.signature),
        photoCount: evidence.photos.length
      },
      req
    });

    res.status(200).json({
      success: true,
      data: {
        status: shipment.status,
        podReference: podDocument?.podReference,
        podDocumentReady: Boolean(podDocument?.pdfUrl)
      },
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

    const normalizedPeriod = ['week', 'month', 'year', 'all'].includes(period) ? period : 'month';
    let startDate = null;
    if (normalizedPeriod !== 'all') {
      startDate = new Date();
    }

    if (normalizedPeriod === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (normalizedPeriod === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    } else if (normalizedPeriod === 'year') {
      startDate.setFullYear(startDate.getFullYear() - 1);
    }

    const completedQuery = {
      transporter: transporterId,
      status: 'completed'
    };

    if (startDate) {
      completedQuery.$or = [
        { completedAt: { $gte: startDate } },
        { 'timeline.completedAt': { $gte: startDate } }
      ];
    }

    const completedShipments = await Shipment.find(completedQuery).sort({
      completedAt: -1,
      'timeline.completedAt': -1
    });

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
          route: [s.origin, s.destination].filter(Boolean).join(' to '),
          date: s.completedAt || s.timeline?.completedAt
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

exports.getEarningStats = async (req, res) => {
  try {
    const transporterId = req.user.id;
    const delivered = await Shipment.find({
      transporter: transporterId,
      status: { $in: ['delivered', 'completed'] }
    }).lean();

    const totalEarnings = delivered.reduce((sum, s) =>
      sum + (s.transporterEarnings || s.pricing?.transporterTotal || s.pricing?.total || 0), 0
    );

    res.json({
      success: true,
      data: {
        totalEarnings,
        deliveredJobs: delivered.length,
        averagePerJob: delivered.length ? totalEarnings / delivered.length : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch earning stats', error: error.message });
  }
};

exports.getPerformance = async (req, res) => {
  try {
    const transporterId = req.user.id;
    const shipments = await Shipment.find({ transporter: transporterId }).lean();
    const completed = shipments.filter(s => ['delivered', 'completed'].includes(s.status));
    const cancelled = shipments.filter(s => s.status === 'cancelled');
    const ratings = completed.map(s => s.rating).filter(Boolean);

    res.json({
      success: true,
      data: {
        totalJobs: shipments.length,
        completedJobs: completed.length,
        cancelledJobs: cancelled.length,
        completionRate: shipments.length ? Math.round((completed.length / shipments.length) * 100) : 0,
        averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch performance', error: error.message });
  }
};
