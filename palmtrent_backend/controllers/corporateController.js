// controllers/corporateController.js
const User = require('../models/User');
const Booking = require('../models/Booking');
const mongoose = require('mongoose');

// CorporateAccount Schema
const CorporateAccountSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyName: { type: String, required: true },
  registrationNumber: { type: String, required: true },
  taxNumber: String,
  industry: String,
  companySize: { type: String, enum: ['1-10', '11-50', '51-200', '201-500', '500+'] },
  address: {
    street: String,
    city: String,
    province: String,
    postalCode: String,
    country: { type: String, default: 'Zimbabwe' }
  },
  contactPerson: { name: String, position: String, email: String, phone: String },
  documents: {
    companyRegistration: { url: String, uploadedAt: Date, verified: { type: Boolean, default: false } },
    taxCertificate: { url: String, uploadedAt: Date, verified: { type: Boolean, default: false } }
  },
  billing: {
    paymentTerms: { type: String, enum: ['prepaid', 'net_7', 'net_14', 'net_30'], default: 'prepaid' },
    creditLimit: { type: Number, default: 0 }
  },
  authorizedUsers: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    role: { type: String, enum: ['admin', 'booker', 'viewer'], default: 'booker' }
  }],
  status: { type: String, enum: ['pending', 'under_review', 'approved', 'rejected'], default: 'pending' }
}, { timestamps: true });

const CorporateAccount = mongoose.models.CorporateAccount || mongoose.model('CorporateAccount', CorporateAccountSchema);

// Register corporate account
exports.registerCorporateAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const existing = await CorporateAccount.findOne({ user: userId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Corporate account already exists' });
    }

    const { companyName, registrationNumber, taxNumber, industry, companySize, address, contactPerson } = req.body;

    if (!companyName || !registrationNumber) {
      return res.status(400).json({ success: false, message: 'Company name and registration number required' });
    }

    const corporateAccount = await CorporateAccount.create({
      user: userId,
      companyName,
      registrationNumber,
      taxNumber,
      industry,
      companySize,
      address,
      contactPerson: contactPerson || { name: req.user.fullName, email: req.user.email, phone: req.user.phone },
      authorizedUsers: [{ user: userId, role: 'admin' }],
      status: 'pending'
    });

    await User.findByIdAndUpdate(userId, { accountType: 'corporate', corporateAccount: corporateAccount._id });

    res.status(201).json({ success: true, data: corporateAccount, message: 'Corporate account created' });
  } catch (error) {
    console.error('Register corporate error:', error);
    res.status(500).json({ success: false, message: 'Failed to register corporate account' });
  }
};

// Upload corporate documents
exports.uploadDocument = async (req, res) => {
  try {
    const { documentType } = req.body;
    const corporateAccount = await CorporateAccount.findOne({ user: req.user._id });

    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document uploaded' });
    }

    const documentUrl = `/uploads/corporate/${req.file.filename}`;

    if (['companyRegistration', 'taxCertificate'].includes(documentType)) {
      corporateAccount.documents[documentType] = { url: documentUrl, uploadedAt: new Date(), verified: false };

      if (corporateAccount.documents.companyRegistration?.url && corporateAccount.status === 'pending') {
        corporateAccount.status = 'under_review';
      }

      await corporateAccount.save();
    }

    res.status(200).json({ success: true, data: { url: documentUrl }, message: 'Document uploaded' });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
};

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