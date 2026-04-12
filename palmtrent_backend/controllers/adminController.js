const User = require('../models/User');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const Payment = require('../models/Payment');
const Rating = require('../models/Rating');
const InsuranceClaim = require('../models/InsuranceClaim');

// @desc    Get admin dashboard statistics
// @route   GET /api/v1/admin/dashboard
// @access  Private/Admin
exports.getDashboardStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // User statistics
    const totalUsers = await User.countDocuments();
    const totalShippers = await User.countDocuments({ userType: 'shipper' });
    const totalTransporters = await User.countDocuments({ userType: 'transporter' });
    const totalTrailerOwners = await User.countDocuments({ userType: 'trailer_owner' });
    const newUsersThisMonth = await User.countDocuments({ createdAt: { $gte: startOfMonth } });
    const pendingVerifications = await User.countDocuments({ 'verification.status': 'pending' });

    // Booking statistics
    const totalBookings = await Booking.countDocuments();
    const activeBookings = await Booking.countDocuments({
      status: { $in: ['pending', 'accepted', 'in_transit', 'picked_up'] }
    });
    const completedBookings = await Booking.countDocuments({ status: 'delivered' });
    const bookingsThisMonth = await Booking.countDocuments({ createdAt: { $gte: startOfMonth } });
    const bookingsLastMonth = await Booking.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
    });

    // Revenue statistics
    const revenueAggregation = await Payment.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;

    const revenueThisMonth = await Payment.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const revenueLastMonth = await Payment.aggregate([
      { $match: { status: 'completed', createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Vehicle statistics
    const totalVehicles = await Vehicle.countDocuments();
    const activeVehicles = await Vehicle.countDocuments({ isActive: true });

    // Claims statistics
    const pendingClaims = await InsuranceClaim.countDocuments({ status: 'pending' });
    const totalClaims = await InsuranceClaim.countDocuments();

    // Calculate growth percentages
    const bookingGrowth = bookingsLastMonth > 0
      ? Math.round(((bookingsThisMonth - bookingsLastMonth) / bookingsLastMonth) * 100)
      : 100;

    const monthlyRevenue = revenueThisMonth.length > 0 ? revenueThisMonth[0].total : 0;
    const lastMonthRevenue = revenueLastMonth.length > 0 ? revenueLastMonth[0].total : 0;
    const revenueGrowth = lastMonthRevenue > 0
      ? Math.round(((monthlyRevenue - lastMonthRevenue) / lastMonthRevenue) * 100)
      : 100;

    res.status(200).json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          shippers: totalShippers,
          transporters: totalTransporters,
          trailerOwners: totalTrailerOwners,
          newThisMonth: newUsersThisMonth,
          pendingVerifications
        },
        bookings: {
          total: totalBookings,
          active: activeBookings,
          completed: completedBookings,
          thisMonth: bookingsThisMonth,
          growth: bookingGrowth
        },
        revenue: {
          total: totalRevenue,
          thisMonth: monthlyRevenue,
          growth: revenueGrowth
        },
        vehicles: {
          total: totalVehicles,
          active: activeVehicles
        },
        claims: {
          total: totalClaims,
          pending: pendingClaims
        }
      }
    });
  } catch (error) {
    console.error('Admin dashboard stats error:', error);
    res.status(500).json({ success: false, message: 'Error fetching dashboard statistics' });
  }
};

// @desc    Get all users with filtering
// @route   GET /api/v1/admin/users
// @access  Private/Admin
exports.getUsers = async (req, res) => {
  try {
    const { role, status, search, page = 1, limit = 20, sort = '-createdAt' } = req.query;

    let query = {};

    if (role && role !== 'all') {
      query.userType = role;
    }

    if (status) {
      if (status === 'verified') {
        query['verification.status'] = 'verified';
      } else if (status === 'pending') {
        query['verification.status'] = 'pending';
      } else if (status === 'active') {
        query.isActive = true;
      } else if (status === 'inactive') {
        query.isActive = false;
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find(query)
      .select('-password')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
};

// @desc    Get single user by ID
// @route   GET /api/v1/admin/users/:id
// @access  Private/Admin
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get user's booking statistics
    const bookingStats = await Booking.aggregate([
      { $match: { $or: [{ shipper: user._id }, { transporter: user._id }] } },
      { $group: {
        _id: '$status',
        count: { $sum: 1 }
      }}
    ]);

    // Get user's rating
    const ratingStats = await Rating.aggregate([
      { $match: { ratedUser: user._id } },
      { $group: {
        _id: null,
        avgRating: { $avg: '$rating' },
        totalRatings: { $sum: 1 }
      }}
    ]);

    res.status(200).json({
      success: true,
      data: {
        user,
        bookingStats,
        rating: ratingStats.length > 0 ? ratingStats[0] : { avgRating: 0, totalRatings: 0 }
      }
    });
  } catch (error) {
    console.error('Get user by ID error:', error);
    res.status(500).json({ success: false, message: 'Error fetching user' });
  }
};

// @desc    Update user
// @route   PUT /api/v1/admin/users/:id
// @access  Private/Admin
exports.updateUser = async (req, res) => {
  try {
    const { fullName, email, phone, userType, status, verification } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Update fields
    if (fullName) user.fullName = fullName;
    if (email) user.email = email;
    if (phone) user.phone = phone;
    if (userType) user.userType = userType;
    if (status) user.status = status;
    if (verification) user.verification = { ...user.verification, ...verification };

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: user
    });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ success: false, message: 'Error updating user' });
  }
};

// @desc    Verify user account
// @route   PUT /api/v1/admin/users/:id/verify
// @access  Private/Admin
exports.verifyUser = async (req, res) => {
  try {
    const { status, notes } = req.body;

    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.verification = {
      ...user.verification,
      status,
      verifiedAt: status === 'verified' ? new Date() : null,
      verifiedBy: req.user._id,
      notes
    };

    await user.save();

    res.status(200).json({
      success: true,
      message: `User ${status === 'verified' ? 'verified' : 'verification updated'} successfully`,
      data: user
    });
  } catch (error) {
    console.error('Verify user error:', error);
    res.status(500).json({ success: false, message: 'Error verifying user' });
  }
};

// @desc    Get all bookings for admin
// @route   GET /api/v1/admin/bookings
// @access  Private/Admin
exports.getBookings = async (req, res) => {
  try {
    const { status, search, startDate, endDate, page = 1, limit = 20, sort = '-createdAt' } = req.query;

    let query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (search) {
      query.$or = [
        { bookingId: { $regex: search, $options: 'i' } },
        { 'pickup.address': { $regex: search, $options: 'i' } },
        { 'delivery.address': { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await Booking.find(query)
      .populate('shipper', 'name email phone')
      .populate('transporter', 'name email phone')
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get admin bookings error:', error);
    res.status(500).json({ success: false, message: 'Error fetching bookings' });
  }
};

// @desc    Get all disputes
// @route   GET /api/v1/admin/disputes
// @access  Private/Admin
exports.getDisputes = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    let query = { hasDispute: true };

    if (status && status !== 'all') {
      query['dispute.status'] = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await Booking.find(query)
      .populate('shipper', 'name email phone')
      .populate('transporter', 'name email phone')
      .sort('-dispute.createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Booking.countDocuments(query);

    res.status(200).json({
      success: true,
      data: bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get disputes error:', error);
    res.status(500).json({ success: false, message: 'Error fetching disputes' });
  }
};

// @desc    Resolve dispute
// @route   POST /api/v1/admin/disputes/:id/resolve
// @access  Private/Admin
exports.resolveDispute = async (req, res) => {
  try {
    const { resolution, notes, refundAmount } = req.body;

    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (!booking.hasDispute) {
      return res.status(400).json({ success: false, message: 'No dispute found for this booking' });
    }

    booking.dispute = {
      ...booking.dispute,
      status: 'resolved',
      resolution,
      resolvedAt: new Date(),
      resolvedBy: req.user._id,
      notes,
      refundAmount
    };

    await booking.save();

    res.status(200).json({
      success: true,
      message: 'Dispute resolved successfully',
      data: booking
    });
  } catch (error) {
    console.error('Resolve dispute error:', error);
    res.status(500).json({ success: false, message: 'Error resolving dispute' });
  }
};

// @desc    Get all payments
// @route   GET /api/v1/admin/payments
// @access  Private/Admin
exports.getPayments = async (req, res) => {
  try {
    const { status, method, startDate, endDate, page = 1, limit = 20 } = req.query;

    let query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    if (method) {
      query.method = method;
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const payments = await Payment.find(query)
      .populate('user', 'name email')
      .populate('booking', 'bookingId')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Payment.countDocuments(query);

    // Calculate totals
    const totals = await Payment.aggregate([
      { $match: query },
      { $group: {
        _id: '$status',
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }}
    ]);

    res.status(200).json({
      success: true,
      data: payments,
      totals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get admin payments error:', error);
    res.status(500).json({ success: false, message: 'Error fetching payments' });
  }
};

// @desc    Get reports
// @route   GET /api/v1/admin/reports/:type
// @access  Private/Admin
exports.getReports = async (req, res) => {
  try {
    const { type } = req.params;
    const { startDate, endDate, groupBy = 'day' } = req.query;

    const dateFilter = {};
    if (startDate && endDate) {
      dateFilter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    let report;

    switch (type) {
      case 'bookings':
        report = await Booking.aggregate([
          { $match: dateFilter },
          { $group: {
            _id: {
              $dateToString: { format: groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d', date: '$createdAt' }
            },
            count: { $sum: 1 },
            completed: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
            cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
          }},
          { $sort: { _id: 1 } }
        ]);
        break;

      case 'revenue':
        report = await Payment.aggregate([
          { $match: { ...dateFilter, status: 'completed' } },
          { $group: {
            _id: {
              $dateToString: { format: groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d', date: '$createdAt' }
            },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
            avgTransaction: { $avg: '$amount' }
          }},
          { $sort: { _id: 1 } }
        ]);
        break;

      case 'users':
        report = await User.aggregate([
          { $match: dateFilter },
          { $group: {
            _id: {
              date: { $dateToString: { format: groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d', date: '$createdAt' } },
              userType: '$userType'
            },
            count: { $sum: 1 }
          }},
          { $sort: { '_id.date': 1 } }
        ]);
        break;

      case 'routes':
        report = await Booking.aggregate([
          { $match: dateFilter },
          { $group: {
            _id: {
              from: '$pickup.city',
              to: '$delivery.city'
            },
            count: { $sum: 1 },
            totalRevenue: { $sum: '$pricing.total' }
          }},
          { $sort: { count: -1 } },
          { $limit: 20 }
        ]);
        break;

      default:
        return res.status(400).json({ success: false, message: 'Invalid report type' });
    }

    res.status(200).json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, message: 'Error generating report' });
  }
};

// @desc    Get pending verifications
// @route   GET /api/v1/admin/verifications
// @access  Private/Admin
exports.getPendingVerifications = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const users = await User.find({ 'verification.status': 'pending' })
      .select('-password')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await User.countDocuments({ 'verification.status': 'pending' });

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get pending verifications error:', error);
    res.status(500).json({ success: false, message: 'Error fetching pending verifications' });
  }
};
