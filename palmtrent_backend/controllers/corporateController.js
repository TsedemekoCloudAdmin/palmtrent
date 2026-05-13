// controllers/corporateController.js
const User = require('../models/User');
const Booking = require('../models/Booking');
const CorporateAccount = require('../models/CorporateAccount');
const Invoice = require('../models/Invoice');
const { recordAudit } = require('../services/auditService');

const getCorporateAccountForUser = async (userId) => {
  return CorporateAccount.findOne({
    $or: [
      { user: userId },
      { 'settings.allowedUsers.user': userId }
    ]
  });
};

// Register corporate account
exports.registerCorporateAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const existing = await CorporateAccount.findOne({ user: userId });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Corporate account already exists' });
    }

    const {
      companyName,
      registrationNumber,
      taxNumber,
      taxId,
      industry,
      companySize,
      numberOfEmployees,
      address,
      billingAddress,
      contactPerson,
      paymentTerms,
      creditLimit
    } = req.body;

    if (!companyName || !registrationNumber) {
      return res.status(400).json({ success: false, message: 'Company name and registration number required' });
    }

    const corporateAccount = await CorporateAccount.create({
      user: userId,
      companyName,
      registrationNumber,
      taxId: taxId || taxNumber,
      industry,
      numberOfEmployees: numberOfEmployees || companySize,
      billingAddress: billingAddress || address,
      contactPerson: contactPerson || { name: req.user.fullName, email: req.user.email, phone: req.user.phone },
      paymentTerms: paymentTerms || 'net_15',
      creditLimit: Number(creditLimit || 0),
      settings: {
        allowedUsers: [{ user: userId, role: 'admin' }]
      },
      status: 'pending'
    });

    await User.findByIdAndUpdate(userId, {
      userType: 'corporate',
      companyName,
      corporateAccount: corporateAccount._id
    });

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
    const corporateAccount = await getCorporateAccountForUser(req.user._id);

    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No document uploaded' });
    }

    const documentUrl = `/uploads/corporate/${req.file.filename}`;

    corporateAccount.verification.documents.push({
      type: documentUrl,
      documentType,
      uploadedAt: new Date(),
      verified: false
    });

    if (corporateAccount.status === 'pending') {
      corporateAccount.status = 'pending';
    }
    await corporateAccount.save();

    res.status(200).json({ success: true, data: { url: documentUrl }, message: 'Document uploaded' });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
};

// Get corporate profile
exports.getProfile = async (req, res) => {
  try {
    const corporateAccount = await getCorporateAccountForUser(req.user.id)
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
      {
        $or: [
          { user: req.user.id },
          { 'settings.allowedUsers.user': req.user.id, 'settings.allowedUsers.role': { $in: ['admin', 'manager'] } }
        ]
      },
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
    
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const query = { corporateAccount: corporateAccount._id };
    
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
      data: { invoices },
      invoices
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
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const bookings = await Booking.find({
      $or: [
        { corporateAccount: corporateAccount._id },
        { shipper: req.user.id }
      ],
      createdAt: { $gte: startDate, $lte: endDate }
    });

    // Calculate metrics
    const totalBookings = bookings.length;
    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const totalSpend = bookings.reduce((sum, b) => sum + (b.pricing?.totals?.total || b.pricing?.total || b.totalAmount || 0), 0);
    const avgOrderValue = totalBookings > 0 ? totalSpend / totalBookings : 0;

    // Group by route
    const routeStats = {};
    bookings.forEach(booking => {
      const route = `${booking.route.pickup.address} → ${booking.route.delivery.address}`;
      if (!routeStats[route]) {
        routeStats[route] = { count: 0, totalSpend: 0 };
      }
      routeStats[route].count++;
      routeStats[route].totalSpend += booking.pricing?.totals?.total || booking.pricing?.total || booking.totalAmount || 0;
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

    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const bookings = await Booking.find({
      $or: [
        { corporateAccount: corporateAccount._id },
        { shipper: req.user.id }
      ],
      createdAt: { $gte: currentMonth }
    });

    const activeBookings = bookings.filter(b => 
      ['payment_confirmed', 'finding_transporter', 'matched', 'in_progress'].includes(b.status)
    ).length;

    const completedBookings = bookings.filter(b => b.status === 'completed').length;
    const totalSpend = bookings.reduce((sum, b) => sum + (b.pricing?.totals?.total || b.pricing?.total || b.totalAmount || 0), 0);

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

exports.getUsers = async (req, res) => {
  try {
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    await corporateAccount.populate('settings.allowedUsers.user', 'fullName email phone userType status');
    res.json({ success: true, data: corporateAccount.settings.allowedUsers || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching corporate users', error: error.message });
  }
};

exports.inviteUser = async (req, res) => {
  try {
    const { userId, email, role = 'manager' } = req.body;
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    let user = userId ? await User.findById(userId) : await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User must register before being added to a corporate account' });
    }

    const alreadyAdded = corporateAccount.settings.allowedUsers.some(item =>
      item.user.toString() === user._id.toString()
    );

    if (!alreadyAdded) {
      corporateAccount.settings.allowedUsers.push({ user: user._id, role });
      await corporateAccount.save();
    }

    user.corporateAccount = corporateAccount._id;
    if (user.userType === 'shipper') user.userType = 'corporate';
    await user.save();

    res.status(200).json({ success: true, message: 'Corporate user added', data: { user: user._id, role } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding corporate user', error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const allowedUser = corporateAccount.settings.allowedUsers.find(item => item.user.toString() === userId);
    if (!allowedUser) {
      return res.status(404).json({ success: false, message: 'Corporate user not found' });
    }

    allowedUser.role = role || allowedUser.role;
    await corporateAccount.save();
    res.json({ success: true, message: 'Corporate user updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating corporate user', error: error.message });
  }
};

exports.removeUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    corporateAccount.settings.allowedUsers = corporateAccount.settings.allowedUsers.filter(item =>
      item.user.toString() !== userId
    );
    await corporateAccount.save();
    await User.findByIdAndUpdate(userId, { $unset: { corporateAccount: 1 } });

    res.json({ success: true, message: 'Corporate user removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error removing corporate user', error: error.message });
  }
};

exports.getBillingInfo = async (req, res) => {
  try {
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    res.json({
      success: true,
      data: {
        paymentTerms: corporateAccount.paymentTerms,
        creditLimit: corporateAccount.creditLimit,
        currentBalance: corporateAccount.currentBalance,
        billingAddress: corporateAccount.billingAddress,
        billingContact: corporateAccount.billingContact,
        preferredPaymentMethod: corporateAccount.preferredPaymentMethod
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching billing info', error: error.message });
  }
};

exports.updateBillingInfo = async (req, res) => {
  try {
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    ['paymentTerms', 'creditLimit', 'billingAddress', 'billingContact', 'preferredPaymentMethod'].forEach(field => {
      if (req.body[field] !== undefined) corporateAccount[field] = req.body[field];
    });

    await corporateAccount.save();
    res.json({ success: true, message: 'Billing info updated', data: corporateAccount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating billing info', error: error.message });
  }
};

exports.getPaymentMethods = async (req, res) => {
  try {
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    res.json({
      success: true,
      data: [{ method: corporateAccount.preferredPaymentMethod, isDefault: true }]
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching payment methods', error: error.message });
  }
};

exports.addPaymentMethod = async (req, res) => {
  try {
    const { method } = req.body;
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    corporateAccount.preferredPaymentMethod = method || corporateAccount.preferredPaymentMethod;
    await corporateAccount.save();
    res.json({ success: true, message: 'Payment method saved', data: { method: corporateAccount.preferredPaymentMethod } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error saving payment method', error: error.message });
  }
};

exports.getInvoiceById = async (req, res) => {
  try {
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const invoice = await Invoice.findOne({ _id: req.params.id, corporateAccount: corporateAccount._id });
    if (!invoice) {
      return res.status(404).json({ success: false, message: 'Invoice not found' });
    }

    if (req.path.endsWith('/download')) {
      const rows = (invoice.items || []).map(item =>
        `<tr><td>${item.bookingReference || ''}</td><td>${item.description || ''}</td><td>${item.quantity || 1}</td><td>${item.unitPrice || 0}</td><td>${item.amount || 0}</td></tr>`
      ).join('');
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>${invoice.invoiceNumber}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#111}table{width:100%;border-collapse:collapse;margin-top:24px}td,th{border:1px solid #ddd;padding:8px;text-align:left}.total{text-align:right;font-weight:bold}</style></head><body><h1>Palmtrent Invoice</h1><p><strong>Invoice:</strong> ${invoice.invoiceNumber}</p><p><strong>Status:</strong> ${invoice.status}</p><p><strong>Due:</strong> ${invoice.dueDate ? new Date(invoice.dueDate).toDateString() : 'N/A'}</p><table><thead><tr><th>Booking</th><th>Description</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead><tbody>${rows}</tbody></table><p class="total">Subtotal: ${invoice.subtotal || 0} ${invoice.currency}</p><p class="total">Tax: ${invoice.taxAmount || 0} ${invoice.currency}</p><h2 class="total">Total: ${invoice.total || 0} ${invoice.currency}</h2></body></html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoiceNumber}.html"`);
      return res.send(html);
    }

    res.json({ success: true, data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching invoice', error: error.message });
  }
};

exports.generateInvoice = async (req, res) => {
  try {
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const periodStart = req.body.startDate ? new Date(req.body.startDate) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const periodEnd = req.body.endDate ? new Date(req.body.endDate) : new Date();

    const bookings = await Booking.find({
      corporateAccount: corporateAccount._id,
      createdAt: { $gte: periodStart, $lte: periodEnd },
      status: { $nin: ['cancelled'] }
    }).sort({ createdAt: 1 });

    const items = bookings.map(booking => {
      const amount = booking.totalAmount || booking.pricing?.totals?.total || 0;
      return {
        description: `${booking.origin || booking.route?.pickup?.address || 'Pickup'} to ${booking.destination || booking.route?.delivery?.address || 'Delivery'}`,
        bookingReference: booking.bookingReference,
        shipmentId: booking.shipments?.[0]?.toString(),
        quantity: 1,
        unitPrice: amount,
        amount
      };
    });

    const subtotal = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    const taxAmount = Number(req.body.taxAmount || 0);
    const dueDate = new Date(periodEnd);
    const days = Number((corporateAccount.paymentTerms || 'net_15').replace('net_', '')) || 15;
    dueDate.setDate(dueDate.getDate() + days);

    const invoice = await Invoice.create({
      corporateAccount: corporateAccount._id,
      billingPeriod: { start: periodStart, end: periodEnd },
      dueDate,
      status: req.body.sendNow ? 'sent' : 'draft',
      sentAt: req.body.sendNow ? new Date() : undefined,
      items,
      subtotal,
      taxAmount,
      total: subtotal + taxAmount,
      generatedBy: req.user.id,
      notes: req.body.notes
    });

    await recordAudit({
      actor: req.user,
      action: 'corporate.invoice_generated',
      entityType: 'Invoice',
      entityId: invoice._id,
      entityRef: invoice.invoiceNumber,
      after: { total: invoice.total, status: invoice.status, itemCount: items.length },
      req
    });

    res.status(201).json({ success: true, message: 'Invoice generated', data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error generating invoice', error: error.message });
  }
};

exports.updateInvoiceStatus = async (req, res) => {
  try {
    const { status, paymentReference, paymentMethod, amount, notes } = req.body;
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount && req.user.userType !== 'admin') {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const query = { _id: req.params.id };
    if (corporateAccount) query.corporateAccount = corporateAccount._id;

    const invoice = await Invoice.findOne(query);
    if (!invoice) return res.status(404).json({ success: false, message: 'Invoice not found' });

    const before = { status: invoice.status, total: invoice.total };
    invoice.status = status || invoice.status;
    if (notes) invoice.notes = notes;

    if (status === 'sent' && !invoice.sentAt) invoice.sentAt = new Date();
    if (status === 'paid') {
      const paidAmount = Number(amount || invoice.total || 0);
      invoice.paidAt = new Date();
      invoice.payments.push({
        amount: paidAmount,
        method: paymentMethod || 'bank_transfer',
        reference: paymentReference,
        paidAt: new Date()
      });
      await CorporateAccount.findByIdAndUpdate(invoice.corporateAccount, {
        $inc: { currentBalance: -Math.abs(paidAmount) }
      });
    }
    if (status === 'cancelled') invoice.cancelledAt = new Date();

    await invoice.save();

    await recordAudit({
      actor: req.user,
      action: 'corporate.invoice_status_updated',
      entityType: 'Invoice',
      entityId: invoice._id,
      entityRef: invoice.invoiceNumber,
      before,
      after: { status: invoice.status, paymentReference },
      req
    });

    res.json({ success: true, message: 'Invoice updated', data: invoice });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating invoice', error: error.message });
  }
};
