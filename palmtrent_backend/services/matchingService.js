// services/matchingService.js
// CRITICAL SERVICE: Implements weighted matching algorithm for transporter-booking matching
// Business Requirement: Only triggered AFTER payment confirmation

const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const { assertBookingReadyForMatching, getVehicleComplianceIssues } = require('./flowControlService');
const { recordAudit } = require('./auditService');

const ACTIVE_SHIPMENT_STATUSES = [
  'assigned',
  'en_route_pickup',
  'picked_up',
  'in_transit',
  'arrived_delivery'
];

function getBookingAvailabilityWindow(booking) {
  const pickupAt = booking.route?.pickup?.date || booking.pickupDate;
  if (!pickupAt || Number.isNaN(new Date(pickupAt).getTime())) return null;

  const start = new Date(pickupAt);
  const requestedEnd = booking.route?.delivery?.deadline || booking.deliveryDate;
  const end = requestedEnd && !Number.isNaN(new Date(requestedEnd).getTime())
    ? new Date(requestedEnd)
    : new Date(start);

  if (!requestedEnd) end.setHours(23, 59, 59, 999);
  return { start, end: end < start ? start : end };
}

function buildVehicleConflictQuery(vehicleIds, booking) {
  const query = {
    vehicle: { $in: vehicleIds },
    status: { $in: ACTIVE_SHIPMENT_STATUSES }
  };
  const window = getBookingAvailabilityWindow(booking);
  if (!window) return query;

  query.$or = [
    { 'schedule.pickupDate': { $exists: false } },
    {
      'schedule.pickupDate': { $lte: window.end },
      'schedule.deliveryDate': { $exists: false }
    },
    {
      'schedule.pickupDate': { $lte: window.end },
      'schedule.deliveryDate': { $gte: window.start }
    }
  ];
  return query;
}

async function filterAvailableVehicles(vehicles, booking) {
  const vehicleIds = vehicles.map(vehicle => vehicle._id).filter(Boolean);
  if (vehicleIds.length === 0) return [];

  const conflicts = await Shipment.find(buildVehicleConflictQuery(vehicleIds, booking))
    .select('vehicle')
    .lean();
  const unavailableIds = new Set(conflicts
    .map(shipment => shipment.vehicle?.toString())
    .filter(Boolean));

  return vehicles.filter(vehicle => !unavailableIds.has(vehicle._id.toString()));
}

async function recordTransporterOfferResponse(transporterId, response) {
  const transporter = await User.findById(transporterId).select('stats');
  if (!transporter) return null;

  const stats = transporter.stats || {};
  const acceptedOffers = Number(stats.acceptedOffers || 0) + (response === 'accepted' ? 1 : 0);
  const declinedOffers = Number(stats.declinedOffers || 0) + (response === 'declined' ? 1 : 0);
  const responseCount = acceptedOffers + declinedOffers;

  transporter.stats = {
    ...stats,
    acceptedOffers,
    declinedOffers,
    acceptanceRate: responseCount ? Math.round((acceptedOffers / responseCount) * 100) : 0
  };
  await transporter.save();
  return transporter.stats;
}

/**
 * Find eligible transporters for a booking
 * @param {Object} booking - Booking document
 * @returns {Array} - Array of eligible transporter objects
 */
async function findEligibleTransporters(booking) {
  try {
    // Extract booking requirements
    const requiredVehicleType = booking.vehicleType || booking.vehicles?.[0]?.vehicleType;
    const pickupCoordinates = booking.route?.pickup?.coordinates?.coordinates || [0, 0];

    // Build base query for transporters
    const transporterQuery = {
      userType: 'transporter',
      status: 'active',
      isActive: { $ne: false },
      $or: [
        { isVerified: true },
        { 'verification.isVerified': true },
        { 'verification.status': { $in: ['approved', 'verified'] } }
      ]
    };

    // Find all verified transporters
    const transporters = await User.find(transporterQuery)
      .select('fullName phone email rating stats lastActive profile location userType')
      .lean();

    // Filter transporters with eligible vehicles
    const eligibleTransporters = [];

    for (const transporter of transporters) {
      // Check if transporter has been active recently (within 7 days)
      const lastActive = transporter.lastActive ? new Date(transporter.lastActive) : new Date();
      const daysSinceActive = (Date.now() - lastActive) / (1000 * 60 * 60 * 24);
      if (daysSinceActive > 7) {
        continue; // Skip inactive transporters
      }

      // Check rating threshold (minimum 4.0 stars, or 0 if no ratings yet)
      const rating = transporter.rating?.average || transporter.rating || 0;
      if (rating > 0 && rating < 4.0) {
        continue; // Skip low-rated transporters
      }

      // Find transporter's vehicles matching the required type
      const vehicleQuery = {
        owner: transporter._id,
        status: 'available',
        'insurance.expiryDate': { $gte: new Date() } // Valid insurance
      };

      const vehicles = await Vehicle.find(vehicleQuery)
        .populate('vehicleType', 'name code')
        .lean();

      const matchingVehicles = vehicles.filter(vehicle => {
        if (getVehicleComplianceIssues(vehicle).length > 0) return false;
        if (!requiredVehicleType) return true;
        const vehicleType = vehicle.vehicleType;
        const candidates = [
          vehicleType?._id?.toString(),
          vehicleType?.name,
          vehicleType?.code,
          vehicle.type
        ].filter(Boolean).map(value => value.toString().toLowerCase().replace(/[_\-\s]/g, ''));
        const required = requiredVehicleType.toString().toLowerCase().replace(/[_\-\s]/g, '');
        return candidates.includes(required);
      });

      if (matchingVehicles.length === 0) {
        continue; // No eligible vehicles
      }

      const availableVehicles = await filterAvailableVehicles(matchingVehicles, booking);
      if (availableVehicles.length === 0) {
        continue;
      }

      // Calculate distance from pickup location (proximity check)
      const transporterLocation = transporter.location?.coordinates || [0, 0];
      const distance = calculateDistance(
        pickupCoordinates[1], pickupCoordinates[0],
        transporterLocation[1], transporterLocation[0]
      );

      // Prefer transporters within 50km, but include up to 200km
      if (distance > 200) {
        continue; // Too far away
      }

      // Transporter is eligible
      eligibleTransporters.push({
        transporter,
        vehicles: availableVehicles,
        distance,
        acceptanceRate: transporter.stats?.acceptanceRate || 0,
        avgResponseTime: transporter.stats?.avgResponseTime || 0,
        completedJobs: transporter.stats?.completedJobs || 0
      });
    }

    console.log(`Found ${eligibleTransporters.length} eligible transporters for booking ${booking.bookingReference}`);
    return eligibleTransporters;

  } catch (error) {
    console.error('Error finding eligible transporters:', error);
    throw error;
  }
}

/**
 * Calculate match score using weighted algorithm
 * Scoring: proximity (30%), rating (25%), acceptance rate (20%), completion reliability (15%), response time (10%)
 *
 * @param {Object} transporterData - Transporter data with stats
 * @param {Object} booking - Booking document
 * @returns {Number} - Match score (0-100)
 */
function calculateMatchScore(transporterData, booking) {
  const { transporter, distance, acceptanceRate, avgResponseTime } = transporterData;

  // 1. Proximity Score (30%) - Closer is better
  // Score: 100 at 0km, 50 at 50km, 0 at 200km
  const maxDistance = 200;
  const proximityScore = Math.max(0, 100 - (distance / maxDistance * 100));
  const proximityWeighted = (proximityScore * 0.30);

  // 2. Rating Score (25%) - Higher rating is better
  // Score: 0-100 based on 0-5 star rating
  const rating = transporter.rating?.average || transporter.rating || 0;
  const ratingScore = (rating / 5) * 100;
  const ratingWeighted = (ratingScore * 0.25);

  // 3. Acceptance Rate Score (20%) - Higher is better
  // Score: Direct percentage (0-100)
  const acceptanceScore = acceptanceRate || 0;
  const acceptanceWeighted = (acceptanceScore * 0.20);

  // 4. Completion Reliability Score (15%)
  const completedJobs = transporter.stats?.completedJobs || 0;
  const totalJobs = transporter.stats?.totalJobs || 1;
  const completionRate = (completedJobs / totalJobs) * 100;
  const reliabilityWeighted = (completionRate * 0.15);

  // 5. Response Time Score (10%) - Faster is better
  // Score: 100 for <5min, 50 for <15min, 25 for <30min, 0 for >30min
  let responseScore = 0;
  if (avgResponseTime < 5) responseScore = 100;
  else if (avgResponseTime < 15) responseScore = 50;
  else if (avgResponseTime < 30) responseScore = 25;
  else responseScore = 0;
  const responseWeighted = (responseScore * 0.10);

  // Total weighted score
  const totalScore = proximityWeighted + ratingWeighted + acceptanceWeighted +
                     reliabilityWeighted + responseWeighted;

  return Math.round(totalScore * 100) / 100; // Round to 2 decimal places
}

/**
 * Rank transporters by match score
 * @param {Array} transporters - Array of eligible transporter objects
 * @param {Object} booking - Booking document
 * @returns {Array} - Ranked transporters with scores
 */
function rankTransporters(transporters, booking) {
  const rankedTransporters = transporters.map(transporterData => {
    const score = calculateMatchScore(transporterData, booking);
    return {
      ...transporterData,
      matchScore: score
    };
  });

  // Sort by score (highest first)
  rankedTransporters.sort((a, b) => b.matchScore - a.matchScore);

  return rankedTransporters;
}

/**
 * Find and notify top matching transporters
 * @param {String} bookingId - Booking ID
 * @param {Number} count - Number of top transporters to notify (default 10)
 * @returns {Object} - Notification results
 */
async function findAndNotifyTransporters(bookingId, count = 10) {
  try {
    // Fetch booking
    const booking = await Booking.findById(bookingId)
      .populate('user', 'fullName phone email')
      .populate('shipper', 'fullName phone email companyName');

    if (!booking) {
      throw new Error('Booking not found');
    }

    // CRITICAL: Verify payment is confirmed before matching
    await assertBookingReadyForMatching(booking);

    // Find eligible transporters
    const eligibleTransporters = await findEligibleTransporters(booking);

    if (eligibleTransporters.length === 0) {
      console.log('No eligible transporters found for booking:', bookingId);
      return {
        success: false,
        message: 'No transporters available matching your requirements',
        eligibleCount: 0,
        notifiedCount: 0
      };
    }

    // Rank transporters by match score
    const rankedTransporters = rankTransporters(eligibleTransporters, booking);

    // Select top N transporters
    const topTransporters = rankedTransporters.slice(0, count);

    console.log(`Top ${topTransporters.length} transporters for booking ${booking.bookingReference}:`);
    topTransporters.forEach((t, index) => {
      console.log(`${index + 1}. ${t.transporter.fullName} - Score: ${t.matchScore}, Distance: ${t.distance}km`);
    });

    // Notify top transporters via WhatsApp and push notifications
    const whatsappController = require('../controllers/whatsappController');
    const notificationService = require('./notificationService');

    // Collect transporter IDs for WhatsApp notification
    const transporterIds = topTransporters.map(t => t.transporter._id);

    // Send WhatsApp job alerts to eligible transporters
    try {
      await whatsappController.sendNewJobNotification(booking, transporterIds);
      console.log(`WhatsApp notifications sent to ${transporterIds.length} transporters`);
    } catch (whatsappError) {
      console.error('Error sending WhatsApp notifications:', whatsappError);
      // Continue even if WhatsApp fails
    }

    // Send in-app notifications and push when device tokens are available.
    try {
      for (const transporterData of topTransporters) {
        await notificationService.notify(
          transporterData.transporter._id,
          'new_job',
          'New Job Available!',
          `${booking.route.pickup.address} to ${booking.route.delivery.address}`,
          { bookingId: booking._id.toString(), type: 'new_job' }
        );
      }
    } catch (pushError) {
      console.error('Error sending push notifications:', pushError);
    }

    // Store match results in booking for reference
    booking.matchResults = {
      totalEligible: eligibleTransporters.length,
      notifiedCount: topTransporters.length,
      topMatches: topTransporters.map(t => ({
        transporter: t.transporter._id,
        score: t.matchScore,
        distance: t.distance,
        notifiedAt: new Date()
      })),
      expiresAt: new Date(Date.now() + 30 * 60 * 1000) // 30 minutes from now
    };

    // Update booking status
    booking.status = 'finding_transporter';
    await booking.save();

    await recordAudit({
      action: 'booking.broadcasted',
      entityType: 'Booking',
      entityId: booking._id,
      entityRef: booking.bookingReference,
      after: {
        status: booking.status,
        eligibleCount: eligibleTransporters.length,
        notifiedCount: topTransporters.length
      }
    });

    return {
      success: true,
      message: `Notified top ${topTransporters.length} transporters`,
      eligibleCount: eligibleTransporters.length,
      notifiedCount: topTransporters.length,
      topMatches: topTransporters.map(t => ({
        transporterId: t.transporter._id,
        name: t.transporter.fullName,
        rating: t.transporter.rating,
        matchScore: t.matchScore,
        distance: t.distance
      }))
    };

  } catch (error) {
    console.error('Error in findAndNotifyTransporters:', error);
    throw error;
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {Number} lat1 - Latitude of point 1
 * @param {Number} lon1 - Longitude of point 1
 * @param {Number} lat2 - Latitude of point 2
 * @param {Number} lon2 - Longitude of point 2
 * @returns {Number} - Distance in kilometers
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees) {
  return degrees * (Math.PI / 180);
}

/**
 * Get available jobs for a transporter (for PendingJobsScreen)
 * @param {String} transporterId - Transporter user ID
 * @returns {Array} - Available jobs with match scores
 */
async function getAvailableJobsForTransporter(transporterId) {
  try {
    // Find transporter
    const transporter = await User.findById(transporterId);
    if (!transporter || transporter.userType !== 'transporter') {
      throw new Error('Transporter not found');
    }

    // Find bookings in 'finding_transporter' status
    const availableBookings = await Booking.find({
      status: 'finding_transporter',
      paymentStatus: { $in: ['confirmed', 'escrowed'] }
    })
    .populate('shipper', 'fullName phone rating companyName')
    .sort({ createdAt: -1 })
    .limit(50);

    // Calculate match scores for each booking
    const jobsWithScores = [];

    for (const booking of availableBookings) {
      // Get transporter's vehicles matching booking requirements
      const requiredVehicleType = booking.vehicleType || booking.vehicles?.[0]?.vehicleType;
      const vehicles = await Vehicle.find({
        owner: transporterId,
        status: 'available'
      }).populate('vehicleType', 'name code').lean();

      const matchingVehicles = vehicles.filter(vehicle => {
        if (getVehicleComplianceIssues(vehicle).length > 0) return false;
        if (!requiredVehicleType) return true;
        const vehicleType = vehicle.vehicleType;
        const candidates = [
          vehicleType?._id?.toString(),
          vehicleType?.name,
          vehicleType?.code,
          vehicle.type
        ].filter(Boolean).map(value => value.toString().toLowerCase().replace(/[_\-\s]/g, ''));
        const required = requiredVehicleType.toString().toLowerCase().replace(/[_\-\s]/g, '');
        return candidates.includes(required);
      });

      if (matchingVehicles.length === 0) {
        continue; // Skip if no matching vehicles
      }

      const availableVehicles = await filterAvailableVehicles(matchingVehicles, booking);
      if (availableVehicles.length === 0) {
        continue;
      }

      // Calculate match score
      const pickupCoordinates = booking.route?.pickup?.coordinates?.coordinates || [0, 0];
      const transporterLocation = transporter.location?.coordinates || [0, 0];
      const distance = calculateDistance(
        pickupCoordinates[1], pickupCoordinates[0],
        transporterLocation[1], transporterLocation[0]
      );

      const transporterData = {
        transporter: transporter.toObject(),
        vehicles: availableVehicles,
        distance,
        acceptanceRate: transporter.stats?.acceptanceRate || 0,
        avgResponseTime: transporter.stats?.avgResponseTime || 0
      };

      const matchScore = calculateMatchScore(transporterData, booking);

      jobsWithScores.push({
        booking: booking.toObject(),
        matchScore,
        distance,
        estimatedEarnings: booking.pricing?.feeAllocation?.transporter?.amount || 0
      });
    }

    // Sort by match score (highest first)
    jobsWithScores.sort((a, b) => b.matchScore - a.matchScore);

    return jobsWithScores;

  } catch (error) {
    console.error('Error getting available jobs for transporter:', error);
    throw error;
  }
}

module.exports = {
  findEligibleTransporters,
  calculateMatchScore,
  rankTransporters,
  findAndNotifyTransporters,
  getAvailableJobsForTransporter,
  calculateDistance,
  filterAvailableVehicles,
  getBookingAvailabilityWindow,
  buildVehicleConflictQuery,
  recordTransporterOfferResponse
};
