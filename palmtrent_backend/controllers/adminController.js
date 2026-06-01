const User = require('../models/User');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const Payment = require('../models/Payment');
const Rental = require('../models/Rental');
const Rating = require('../models/Rating');
const InsuranceClaim = require('../models/InsuranceClaim');
const CorporateAccount = require('../models/CorporateAccount');
const AuditLog = require('../models/AuditLog');
const PlatformLedger = require('../models/PlatformLedger');
const AdminPreference = require('../models/AdminPreference');
const { recordAudit } = require('../services/auditService');
const paymentService = require('../services/paymentService');
const rentalPaymentService = require('../services/rentalPaymentService');
const {
  listIntegrationSettings,
  updateIntegrationSetting,
  testIntegrationSetting
} = require('../services/integrationSettingsService');

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

    // Platform-owner revenue statistics. Gross payment volume is useful, but it is not
    // the same as revenue earned by the platform.
    const revenueMatch = {
      status: 'posted',
      direction: 'credit',
      category: { $in: ['platform_fee', 'commission', 'subscription_fee'] }
    };
    const revenueAggregation = await PlatformLedger.aggregate([
      { $match: revenueMatch },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);
    const totalRevenue = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;

    const revenueThisMonth = await PlatformLedger.aggregate([
      { $match: { ...revenueMatch, postedAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const revenueLastMonth = await PlatformLedger.aggregate([
      { $match: { ...revenueMatch, postedAt: { $gte: startOfLastMonth, $lte: endOfLastMonth } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    const grossPaymentVolume = await Payment.aggregate([
      { $match: { status: { $in: ['confirmed', 'completed'] } } },
      { $group: { _id: null, total: { $sum: '$amount' } } }
    ]);

    // Vehicle statistics
    const totalVehicles = await Vehicle.countDocuments();
    const activeVehicles = await Vehicle.countDocuments({ isActive: true });

    // Claims statistics
    const pendingClaims = await InsuranceClaim.countDocuments({ status: 'pending' });
    const totalClaims = await InsuranceClaim.countDocuments();
    const unattendedDisputes = await Booking.countDocuments({
      hasDispute: true,
      'dispute.status': { $in: ['open', 'investigating'] }
    });

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
          growth: revenueGrowth,
          grossPaymentVolume: grossPaymentVolume.length > 0 ? grossPaymentVolume[0].total : 0
        },
        vehicles: {
          total: totalVehicles,
          active: activeVehicles
        },
        claims: {
          total: totalClaims,
          pending: pendingClaims,
          unattendedDisputes
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

    const userIds = users.map(user => user._id);
    const bookingCounts = await Booking.aggregate([
      { $match: { $or: [{ shipper: { $in: userIds } }, { user: { $in: userIds } }, { transporter: { $in: userIds } }] } },
      { $project: { parties: { $setUnion: [['$shipper', '$user', '$transporter'], []] } } },
      { $unwind: '$parties' },
      { $match: { parties: { $in: userIds } } },
      { $group: { _id: '$parties', totalBookings: { $sum: 1 } } }
    ]);
    const bookingCountMap = new Map(bookingCounts.map(item => [item._id.toString(), item.totalBookings]));

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users.map(user => ({
        ...user.toObject(),
        totalBookings: bookingCountMap.get(user._id.toString()) || 0
      })),
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

    const approved = ['verified', 'approved'].includes(status);
    user.verification = {
      ...user.verification,
      status: approved ? 'approved' : status,
      isVerified: approved,
      verifiedAt: approved ? new Date() : null,
      verifiedBy: req.user._id,
      notes
    };
    user.isVerified = approved;

    await user.save();

    if (user.userType === 'corporate' && approved) {
      await CorporateAccount.findOneAndUpdate(
        { $or: [{ user: user._id }, { _id: user.corporateAccount }] },
        {
          status: 'active',
          'verification.verifiedAt': new Date(),
          'verification.verifiedBy': req.user._id
        }
      );
    }

    await recordAudit({
      actor: req.user,
      action: 'user.verification_updated',
      entityType: 'User',
      entityId: user._id,
      after: { verification: user.verification, isVerified: user.isVerified },
      metadata: { notes },
      req
    });

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

exports.verifyCorporateAccount = async (req, res) => {
  try {
    const { status = 'active', notes, creditLimit, paymentTerms, maxBookingValue } = req.body;

    const account = await CorporateAccount.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const before = {
      status: account.status,
      creditLimit: account.creditLimit,
      paymentTerms: account.paymentTerms,
      maxBookingValue: account.settings?.maxBookingValue
    };

    account.status = status;
    if (creditLimit !== undefined) account.creditLimit = Number(creditLimit);
    if (paymentTerms) account.paymentTerms = paymentTerms;
    if (maxBookingValue !== undefined) {
      account.settings = {
        ...account.settings,
        maxBookingValue: Number(maxBookingValue)
      };
    }
    account.verification = {
      ...account.verification,
      verifiedAt: status === 'active' ? new Date() : account.verification?.verifiedAt,
      verifiedBy: status === 'active' ? req.user._id : account.verification?.verifiedBy
    };

    await account.save();

    await User.findByIdAndUpdate(account.user, {
      corporateAccount: account._id,
      isVerified: status === 'active',
      'verification.status': status === 'active' ? 'approved' : 'pending',
      'verification.isVerified': status === 'active'
    });

    await recordAudit({
      actor: req.user,
      action: 'corporate.verification_updated',
      entityType: 'CorporateAccount',
      entityId: account._id,
      entityRef: account.companyName,
      before,
      after: {
        status: account.status,
        creditLimit: account.creditLimit,
        paymentTerms: account.paymentTerms,
        maxBookingValue: account.settings?.maxBookingValue
      },
      metadata: { notes },
      req
    });

    res.json({
      success: true,
      message: 'Corporate account updated successfully',
      data: account
    });
  } catch (error) {
    console.error('Verify corporate account error:', error);
    res.status(500).json({ success: false, message: 'Error updating corporate account', error: error.message });
  }
};

exports.verifyVehicle = async (req, res) => {
  try {
    const { status = 'approved', notes } = req.body;
    const vehicle = await Vehicle.findById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({ success: false, message: 'Vehicle not found' });
    }

    const before = { verification: vehicle.verification, status: vehicle.status };
    vehicle.verification = {
      ...vehicle.verification,
      status,
      notes,
      verifiedAt: status === 'approved' ? new Date() : vehicle.verification?.verifiedAt,
      verifiedBy: status === 'approved' ? req.user._id : vehicle.verification?.verifiedBy
    };
    await vehicle.save();

    await recordAudit({
      actor: req.user,
      action: 'vehicle.verification_updated',
      entityType: 'Vehicle',
      entityId: vehicle._id,
      entityRef: vehicle.registrationNumber,
      before,
      after: { verification: vehicle.verification, status: vehicle.status },
      req
    });

    res.json({
      success: true,
      message: 'Vehicle verification updated successfully',
      data: vehicle
    });
  } catch (error) {
    console.error('Verify vehicle error:', error);
    res.status(500).json({ success: false, message: 'Error verifying vehicle', error: error.message });
  }
};

exports.getAuditLogs = async (req, res) => {
  try {
    const { entityType, entityId, action, page = 1, limit = 50 } = req.query;
    const query = {};
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    if (action) query.action = action;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const logs = await AuditLog.find(query)
      .populate('actor', 'fullName email phone userType')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({ success: false, message: 'Error fetching audit logs', error: error.message });
  }
};

// @desc    Get all bookings for admin
// @route   GET /api/v1/admin/bookings
// @access  Private/Admin
exports.getBookings = async (req, res) => {
  try {
    const { status, search, startDate, endDate, userId, page = 1, limit = 20, sort = '-createdAt' } = req.query;

    let query = {};

    if (status && status !== 'all') {
      query.status = status;
    }

    const andConditions = [];

    if (userId) {
      andConditions.push({ $or: [
        { shipper: userId },
        { user: userId },
        { transporter: userId }
      ] });
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    if (search) {
      andConditions.push({ $or: [
        { bookingId: { $regex: search, $options: 'i' } },
        { bookingReference: { $regex: search, $options: 'i' } },
        { 'pickup.address': { $regex: search, $options: 'i' } },
        { 'delivery.address': { $regex: search, $options: 'i' } }
      ] });
    }

    if (andConditions.length) {
      query.$and = andConditions;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const bookings = await Booking.find(query)
      .populate('shipper', 'fullName name email phone')
      .populate('transporter', 'fullName name email phone')
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
      .populate('shipper', 'fullName name email phone')
      .populate('transporter', 'fullName name email phone')
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

    if (method && method !== 'all') {
      query.paymentMethod = method;
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
      .populate('booking', 'bookingId bookingReference')
      .populate('rental', 'rentalReference')
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

exports.confirmPayment = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found' });

    const confirmed = payment.rental
      ? await rentalPaymentService.confirmRentalPayment(payment.paymentReference, {
        confirmedBy: req.user._id,
        source: 'admin_portal',
        note: req.body.note
      })
      : await paymentService.confirmPayment(payment.paymentReference, {
        confirmedBy: req.user._id,
        source: 'admin_portal',
        note: req.body.note
      });

    await recordAudit({
      actor: req.user,
      action: 'payment.admin_confirmed',
      entityType: 'Payment',
      entityId: payment._id,
      entityRef: payment.paymentReference,
      req
    });

    res.json({ success: true, data: confirmed, message: 'Payment confirmed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to confirm payment', error: error.message });
  }
};

// @desc    Get fleet rentals for admin operations
// @route   GET /api/v1/admin/rentals
// @access  Private/Admin
exports.getRentals = async (req, res) => {
  try {
    const { status, itemType, page = 1, limit = 20 } = req.query;
    const query = {};

    if (status && status !== 'all') query.status = status;
    if (itemType && itemType !== 'all') query.itemType = itemType;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const rentals = await Rental.find(query)
      .populate('owner', 'fullName email phone')
      .populate('renter', 'fullName email phone')
      .populate('trailer', 'registrationNumber assetName assetType')
      .populate('vehicle', 'registrationNumber')
      .populate('linkedShipment.booking', 'bookingReference status')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Rental.countDocuments(query);
    const totals = await Rental.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          value: { $sum: '$pricing.total' },
          ownerEarnings: { $sum: '$settlement.ownerEarnings' }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: rentals,
      totals,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get admin rentals error:', error);
    res.status(500).json({ success: false, message: 'Error fetching rentals' });
  }
};

exports.getRatings = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const ratings = await Rating.find({})
      .populate('booking', 'bookingReference bookingId')
      .populate('rater.user', 'fullName email userType')
      .populate('ratee.user', 'fullName email userType')
      .sort('-createdAt')
      .skip(skip)
      .limit(parseInt(limit));
    const total = await Rating.countDocuments({});

    res.json({
      success: true,
      data: ratings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get admin ratings error:', error);
    res.status(500).json({ success: false, message: 'Error fetching ratings' });
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
        const ledgerDateFilter = dateFilter.createdAt ? { postedAt: dateFilter.createdAt } : {};
        report = await PlatformLedger.aggregate([
          {
            $match: {
              ...ledgerDateFilter,
              status: 'posted',
              direction: 'credit',
              category: { $in: ['platform_fee', 'commission', 'subscription_fee'] }
            }
          },
          { $group: {
            _id: {
              $dateToString: { format: groupBy === 'month' ? '%Y-%m' : '%Y-%m-%d', date: '$postedAt' }
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

// @desc    Get integration settings
// @route   GET /api/v1/admin/integrations
// @access  Private/Admin
exports.getIntegrationSettings = async (req, res) => {
  try {
    const integrations = await listIntegrationSettings();
    res.status(200).json({ success: true, data: integrations });
  } catch (error) {
    console.error('Get integration settings error:', error);
    res.status(500).json({ success: false, message: 'Error fetching integration settings' });
  }
};

exports.getPreferences = async (req, res) => {
  try {
    const preferences = await AdminPreference.findOneAndUpdate(
      { user: req.user._id },
      { $setOnInsert: { user: req.user._id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: preferences });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error loading admin preferences', error: error.message });
  }
};

exports.updatePreferences = async (req, res) => {
  try {
    const platform = req.body.platformSettings || {};
    const notifications = req.body.notifications || {};

    const update = {
      platformSettings: {
        platformCommissionRate: Number(platform.platformCommissionRate ?? 15),
        minimumBookingAmount: Number(platform.minimumBookingAmount ?? 50),
        autoCancelTimeoutHours: Number(platform.autoCancelTimeoutHours ?? 24)
      },
      notifications: {
        email: notifications.email !== false,
        sms: notifications.sms !== false,
        whatsapp: notifications.whatsapp !== false
      }
    };

    if (update.platformSettings.platformCommissionRate < 0 || update.platformSettings.platformCommissionRate > 100) {
      return res.status(400).json({ success: false, message: 'Platform commission must be between 0 and 100' });
    }
    if (update.platformSettings.minimumBookingAmount < 0) {
      return res.status(400).json({ success: false, message: 'Minimum booking amount cannot be negative' });
    }
    if (update.platformSettings.autoCancelTimeoutHours < 1) {
      return res.status(400).json({ success: false, message: 'Auto-cancel timeout must be at least 1 hour' });
    }

    const preferences = await AdminPreference.findOneAndUpdate(
      { user: req.user._id },
      { $set: update, $setOnInsert: { user: req.user._id } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await recordAudit({
      actor: req.user,
      action: 'admin.preferences_updated',
      entityType: 'AdminPreference',
      entityId: preferences._id,
      after: update,
      req
    });

    res.json({ success: true, message: 'Admin preferences saved', data: preferences });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error saving admin preferences', error: error.message });
  }
};

// @desc    Update integration setting
// @route   PUT /api/v1/admin/integrations/:provider
// @access  Private/Admin
exports.updateIntegrationSetting = async (req, res) => {
  try {
    const updated = await updateIntegrationSetting(req.params.provider, req.body, req.user?._id);

    await recordAudit({
      actor: req.user,
      action: 'integration_setting_updated',
      entityType: 'IntegrationSetting',
      entityId: updated.id,
      entityRef: updated.provider,
      after: {
        provider: updated.provider,
        enabled: updated.enabled,
        status: updated.status,
        configuredFields: updated.configuredFields
      },
      req
    });

    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('Update integration setting error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Error updating integration setting'
    });
  }
};

// @desc    Validate integration setting requirements
// @route   POST /api/v1/admin/integrations/:provider/test
// @access  Private/Admin
exports.testIntegrationSetting = async (req, res) => {
  try {
    const result = await testIntegrationSetting(req.params.provider);

    await recordAudit({
      actor: req.user,
      action: 'integration_setting_tested',
      entityType: 'IntegrationSetting',
      entityRef: req.params.provider,
      metadata: result,
      req
    });

    res.status(result.passed ? 200 : 400).json({ success: result.passed, data: result, message: result.message });
  } catch (error) {
    console.error('Test integration setting error:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : 'Error testing integration setting'
    });
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
