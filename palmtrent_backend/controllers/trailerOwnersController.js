const Trailer = require('../models/Trailer');
const Rental = require('../models/Rental');
const { formatRelativeTime } = require('../utils/formatDate');

exports.getDashboardStats = async (req, res) => {
  try {
    const ownerId = req.user.id;

    const assets = await Trailer.find({ owner: ownerId });
    const totalAssets = assets.length;

    const available = assets.filter(t => t.status === 'available').length;
    const rented = assets.filter(t => t.status === 'rented').length;
    const maintenance = assets.filter(t => t.status === 'maintenance').length;
    const trailers = assets.filter(t => (t.assetType || 'trailer') === 'trailer').length;
    const tractorUnits = assets.filter(t => t.assetType === 'tractor_unit').length;
    const trucks = assets.filter(t => t.assetType === 'truck').length;
    const fullRigs = assets.filter(t => t.assetType === 'full_rig').length;

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
    const utilizationRate = totalAssets > 0
      ? ((rented / totalAssets) * 100).toFixed(0)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        totalAssets,
        totalTrailers: trailers,
        trailers,
        tractorUnits,
        trucks,
        fullRigs,
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

    const recentAssets = await Trailer.find({ owner: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .select('registrationNumber assetType assetName tractorUnit status updatedAt')
      .lean();

    const activities = recentAssets.map(asset => {
      let status = 'Available';
      if (asset.status === 'rented') status = 'Rental Active';
      if (asset.status === 'maintenance') status = 'In Maintenance';

      return {
        id: asset._id,
        title: `${asset.assetName || asset.tractorUnit?.model || asset.assetType || 'Fleet asset'} ${asset.registrationNumber}`,
        status,
        date: formatRelativeTime(asset.updatedAt),
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
    const trailers = await Trailer.find({ owner: req.user._id }).sort({ createdAt: -1 });

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
