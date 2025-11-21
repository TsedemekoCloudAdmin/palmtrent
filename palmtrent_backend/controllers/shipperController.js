const Booking = require('../models/Booking');
const Shipment = require('../models/Shipment');
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