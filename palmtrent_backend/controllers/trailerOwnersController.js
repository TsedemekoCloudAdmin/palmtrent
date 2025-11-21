const Vehicle = require('../models/Vehicle');
const Rental = require('../models/Rental');
const { formatRelativeTime } = require('../utils/formatDate');

exports.getDashboardStats = async (req, res) => {
  try {
    const ownerId = req.user.id;

    // Get all trailers owned by user
    const trailers = await Vehicle.find({ owner: ownerId, type: 'trailer' });
    const totalTrailers = trailers.length;

    // Count trailers by status
    const available = trailers.filter(t => t.status === 'available').length;
    const rented = trailers.filter(t => t.status === 'rented').length;
    const maintenance = trailers.filter(t => t.status === 'maintenance').length;

    // Calculate this month's earnings (if Rental model exists)
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    let monthlyEarnings = 0;
    let pendingPayouts = 0;

    // If you have a Rental model, uncomment this:
    /*
    const rentals = await Rental.find({
      owner: ownerId,
      startDate: { $gte: startOfMonth }
    });

    monthlyEarnings = rentals.reduce((total, rental) => {
      if (rental.paymentStatus === 'paid') {
        return total + (rental.amount || 0);
      }
      return total;
    }, 0);

    pendingPayouts = rentals.reduce((total, rental) => {
      if (rental.paymentStatus === 'pending') {
        return total + (rental.amount || 0);
      }
      return total;
    }, 0);
    */

    // Calculate utilization rate
    const utilizationRate = totalTrailers > 0 
      ? ((rented / totalTrailers) * 100).toFixed(0) 
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalTrailers,
        available,
        rented,
        maintenance,
        monthlyEarnings: parseFloat(monthlyEarnings.toFixed(2)),
        pendingPayouts: parseFloat(pendingPayouts.toFixed(2)),
        utilizationRate: `${utilizationRate}%`
      }
    });
  } catch (error) {
    console.error('Get trailer owner dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
};

exports.getRecentActivity = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;

    // Get recent trailer status changes
    const recentTrailers = await Vehicle.find({
      owner: req.user._id,
      type: 'trailer'
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('registrationNumber model status updatedAt')
      .lean();

    const activities = recentTrailers.map(trailer => {
      let status = 'Available';
      if (trailer.status === 'rented') status = 'Rental Active';
      if (trailer.status === 'maintenance') status = 'In Maintenance';

      return {
        id: trailer._id,
        title: `${trailer.model} ${trailer.registrationNumber}`,
        status,
        date: formatRelativeTime(trailer.updatedAt),
        amount: '$0' // You can add rental amount if available
      };
    });

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

exports.getTrailers = async (req, res) => {
  try {
    const trailers = await Vehicle.find({
      owner: req.user._id,
      type: 'trailer'
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: trailers
    });
  } catch (error) {
    console.error('Get trailers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trailers'
    });
  }
};