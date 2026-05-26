const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const Rating = require('../models/Rating');
const { formatRelativeTime } = require('../utils/formatDate');

exports.getDashboardStats = async (req, res) => {
  try {
    const shipperId = req.user.id || req.user._id;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const activeStatuses = [
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
      'arrived_delivery'
    ];
    const completedStatuses = ['delivered', 'completed'];

    const baseMatch = { shipper: shipperId };
    const amountExpression = {
      $ifNull: [
        '$totalAmount',
        { $ifNull: ['$pricing.totals.total', { $ifNull: ['$pricing.total', 0] }] }
      ]
    };

    const [
      activeBookings,
      activeShipments,
      pendingPayment,
      completedBookings,
      completedShipments,
      spendAgg,
      currentMonthAgg,
      previousMonthAgg,
      activeMonthCount,
      activePreviousMonthCount,
      completedMonthCount,
      completedPreviousMonthCount,
      ratingData
    ] = await Promise.all([
      Booking.countDocuments({ ...baseMatch, status: { $in: activeStatuses } }),
      Shipment.countDocuments({ shipper: shipperId, status: { $in: ['assigned', 'matched', 'en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery'] } }),
      Booking.countDocuments({ ...baseMatch, paymentStatus: 'pending', status: { $in: ['draft', 'pending_payment', 'payment_confirmed', 'confirmed'] } }),
      Booking.countDocuments({ ...baseMatch, status: { $in: completedStatuses } }),
      Shipment.countDocuments({ shipper: shipperId, status: { $in: completedStatuses } }),
      Booking.aggregate([
        { $match: { shipper: req.user._id, status: { $nin: ['cancelled'] } } },
        { $group: { _id: null, total: { $sum: amountExpression } } }
      ]),
      Booking.aggregate([
        { $match: { shipper: req.user._id, status: { $nin: ['cancelled'] }, createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: amountExpression }, count: { $sum: 1 } } }
      ]),
      Booking.aggregate([
        { $match: { shipper: req.user._id, status: { $nin: ['cancelled'] }, createdAt: { $gte: previousMonthStart, $lt: startOfMonth } } },
        { $group: { _id: null, total: { $sum: amountExpression }, count: { $sum: 1 } } }
      ]),
      Booking.countDocuments({ ...baseMatch, status: { $in: activeStatuses }, createdAt: { $gte: startOfMonth } }),
      Booking.countDocuments({ ...baseMatch, status: { $in: activeStatuses }, createdAt: { $gte: previousMonthStart, $lt: startOfMonth } }),
      Booking.countDocuments({ ...baseMatch, status: { $in: completedStatuses }, updatedAt: { $gte: startOfMonth } }),
      Booking.countDocuments({ ...baseMatch, status: { $in: completedStatuses }, updatedAt: { $gte: previousMonthStart, $lt: startOfMonth } }),
      Rating.getUserRating(shipperId)
    ]);

    const totalSpent = spendAgg[0]?.total || 0;
    const currentSpend = currentMonthAgg[0]?.total || 0;
    const previousSpend = previousMonthAgg[0]?.total || 0;

    const calculateGrowth = (current, previous) => {
      if (!previous && !current) return 0;
      if (!previous) return 100;
      return Math.round(((current - previous) / previous) * 100);
    };

    res.status(200).json({
      success: true,
      data: {
        activeJobs: activeBookings + activeShipments,
        activeShipments: activeBookings + activeShipments,
        pendingPayment,
        spending: parseFloat(currentSpend.toFixed(2)),
        totalSpent: parseFloat(totalSpent.toFixed(2)),
        completed: completedBookings + completedShipments,
        totalShipments: completedBookings + completedShipments,
        avgRating: ratingData.averageRating || 0,
        ratingCount: ratingData.totalRatings || 0,
        growth: {
          shipments: calculateGrowth(activeMonthCount, activePreviousMonthCount),
          completed: calculateGrowth(completedMonthCount, completedPreviousMonthCount),
          spending: calculateGrowth(currentSpend, previousSpend)
        }
      }
    });
  } catch (error) {
    console.error('Get shipper dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

exports.getRecentActivity =   async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    // Get recent bookings
    const recentBookings = await Booking.find({
      shipper: req.user._id
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('origin destination status totalAmount updatedAt')
      .lean();

    const activities = recentBookings.map(booking => ({
      id: booking._id,
      title: `${booking.origin} → ${booking.destination}`,
      status: booking.status,
      date: formatRelativeTime(booking.updatedAt),
      amount: `$${booking.totalAmount || 0}`
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

exports.getActiveShipments = async (req, res) => {
  try {
    const shipments = await Shipment.find({
      shipper: req.user._id,
      status: { $in: ['assigned', 'matched', 'en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery'] }
    })
      .populate('transporter', 'fullName phone rating')
      .populate('vehicle', 'registrationNumber vehicleType')
      .sort({ updatedAt: -1 });

    res.json({ success: true, count: shipments.length, data: shipments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch active shipments', error: error.message });
  }
};

exports.getFavoriteTransporters = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('favoriteTransporters', 'fullName phone rating verification');
    res.json({ success: true, data: user.favoriteTransporters || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch favorites', error: error.message });
  }
};

exports.addFavoriteTransporter = async (req, res) => {
  try {
    const { transporterId } = req.body;
    const transporter = await User.findOne({ _id: transporterId, userType: 'transporter' });
    if (!transporter) {
      return res.status(404).json({ success: false, message: 'Transporter not found' });
    }

    await User.findByIdAndUpdate(req.user.id, {
      $addToSet: { favoriteTransporters: transporterId }
    });

    res.json({ success: true, message: 'Transporter added to favorites' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add favorite', error: error.message });
  }
};

exports.removeFavoriteTransporter = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { favoriteTransporters: req.params.transporterId }
    });

    res.json({ success: true, message: 'Transporter removed from favorites' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to remove favorite', error: error.message });
  }
};
