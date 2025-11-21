const Shipment = require('../models/Shipment');
const Booking = require('../models/Booking');
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