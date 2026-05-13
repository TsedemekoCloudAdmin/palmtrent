const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
const User = require('../models/User');
const { formatRelativeTime } = require('../utils/formatDate');

exports.getDashboardStats = async (req, res) => {
  try {
    const shipperId = req.user.id;

    // Get active bookings/shipments count
    const activeBookings = await Booking.countDocuments({
      shipper: shipperId,
      status: { $in: ['confirmed', 'in_progress'] }
    });

    const activeShipments = await Shipment.countDocuments({
      shipper: shipperId,
      status: { $in: ['assigned', 'in_transit', 'picked_up'] }
    });

    const activeJobs = activeBookings + activeShipments;

    // Get pending payment count
    const pendingPayment = await Booking.countDocuments({
      shipper: shipperId,
      status: 'confirmed',
      paymentStatus: 'pending'
    });

    // Calculate this month's spending
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const thisMonthBookings = await Booking.find({
      shipper: shipperId,
      status: { $in: ['confirmed', 'completed'] },
      createdAt: { $gte: startOfMonth }
    });

    const spending = thisMonthBookings.reduce((total, booking) => {
      return total + (booking.totalAmount || 0);
    }, 0);

    // Get total completed shipments
    const totalShipments = await Shipment.countDocuments({
      shipper: shipperId,
      status: 'completed'
    });

    res.status(200).json({
      success: true,
      data: {
        activeJobs,
        pendingPayment,
        spending: parseFloat(spending.toFixed(2)),
        totalShipments
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
