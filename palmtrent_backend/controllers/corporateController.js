// controllers/corporateController.js
const CorporateAccount = require('../models/CorporateAccount');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');

// Get corporate profile
exports.getProfile = async (req, res) => {
  try {
    const corporateAccount = await CorporateAccount.findOne({ user: req.user.id })
      .populate('user', 'fullName email phone');

    if (!corporateAccount) {
      return res.status(404).json({
        success: false,
        message: 'Corporate account not found'
      });
    }

    res.status(200).json({
      success: true,
      data: corporateAccount
    });
  } catch (error) {
    console.error('Error fetching corporate profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching profile',
      error: error.message
    });
  }
};

// Update corporate profile
exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    
    const corporateAccount = await CorporateAccount.findOneAndUpdate(
      { user: req.user.id },
      updates,
      { new: true, runValidators: true }
    );

    if (!corporateAccount) {
      return res.status(404).json({
        success: false,
        message: 'Corporate account not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: corporateAccount
    });
  } catch (error) {
    console.error('Error updating corporate profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// Get invoices
exports.getInvoices = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = { corporateAccount: req.user.corporateAccountId };
    
    if (startDate && endDate) {
      query.billingPeriod = {
        start: { $gte: new Date(startDate) },
        end: { $lte: new Date(endDate) }
      };
    }

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: invoices.length,
      data: invoices
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching invoices',
      error: error.message
    });
  }
};

// Get analytics
exports.getAnalytics = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
    // Calculate date range
    const endDate = new Date();
    let startDate = new Date();
    
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
    }

    // Get bookings in date range
    const bookings = await Booking.find({
      shipper: req.user.id,
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Calculate metrics
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const totalSpend = bookings.reduce((sum, b) => sum + (b.pricing?.total || 0), 0);
    const avgOrderValue = totalBookings > 0 ? totalSpend / totalBookings : 0;

    // Group by route
    const routeStats = {};
    bookings.forEach(booking => {
      const route = `${booking.route.pickup.address} → ${booking.route.delivery.address}`;
      if (!routeStats[route]) {
        routeStats[route] = { count: 0, totalSpend: 0 };
      }
      routeStats[route].count++;
      routeStats[route].totalSpend += booking.pricing?.total || 0;
    });

    // Group by status
    const statusBreakdown = bookings.reduce((acc, booking) => {
      acc[booking.status] = (acc[booking.status] || 0) + 1;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: {
        period,
        dateRange: { startDate, endDate },
        summary: {
          totalBookings,
          completedBookings,
          completionRate: totalBookings > 0 ? (completedBookings / totalBookings * 100).toFixed(1) : 0,
          totalSpend,
          avgOrderValue: avgOrderValue.toFixed(2)
        },
        routeStats,
        statusBreakdown
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching analytics',
      error: error.message
    });
  }
};

// Get monthly dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const currentMonth = new Date();
    currentMonth.setDate(1);
    currentMonth.setHours(0, 0, 0, 0);

    const bookings = await Booking.find({
      shipper: req.user.id,
      createdAt: { $gte: currentMonth }
    });

    const activeBookings = bookings.filter(b => 
      ['payment_confirmed', 'finding_transporter', 'matched', 'in_progress'].includes(b.status)
    ).length;

    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const totalSpend = bookings.reduce((sum, b) => sum + (b.pricing?.total || 0), 0);

    // On-time delivery rate
    const deliveredBookings = bookings.filter(b => b.status === 'completed');
    const onTimeDeliveries = deliveredBookings.filter(b => {
      // Check if actual delivery was before or equal to scheduled delivery
      return b.route.delivery.deadline >= b.updatedAt;
    }).length;

    const onTimeRate = deliveredBookings.length > 0 
      ? ((onTimeDeliveries / deliveredBookings.length) * 100).toFixed(1)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        activeBookings,
        completedBookings,
        totalSpend,
        onTimeRate: `${onTimeRate}%`
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching dashboard stats',
      error: error.message
    });
  }
};