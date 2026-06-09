// controllers/corporateController.js
const User = require('../models/User');
const Booking = require('../models/Booking');
const CorporateAccount = require('../models/CorporateAccount');
const CorporateReportSchedule = require('../models/CorporateReportSchedule');
const Invoice = require('../models/Invoice');
const crypto = require('crypto');
const { recordAudit } = require('../services/auditService');
const { finalizeUploadedFile } = require('../services/uploadFinalizationService');

const getCorporateAccountForUser = async (userId) => {
  return CorporateAccount.findOne({
    $or: [
      { user: userId },
      { 'settings.allowedUsers.user': userId }
    ]
  });
};

const CORPORATE_PERMISSIONS = ['create_bookings', 'view_all_bookings', 'manage_team', 'view_reports'];
const ROLE_PERMISSION_DEFAULTS = {
  admin: CORPORATE_PERMISSIONS,
  manager: ['create_bookings', 'view_all_bookings', 'view_reports'],
  viewer: ['view_all_bookings']
};

function normalizeCorporateRole(role) {
  return ['admin', 'manager', 'viewer'].includes(role) ? role : 'manager';
}

function normalizeCorporatePermissions(role, permissions) {
  if (!Array.isArray(permissions)) return ROLE_PERMISSION_DEFAULTS[role] || ROLE_PERMISSION_DEFAULTS.manager;
  const allowed = permissions.filter(permission => CORPORATE_PERMISSIONS.includes(permission));
  return [...new Set(allowed)];
}

const getNextReportRun = (frequency) => {
  const next = new Date();
  if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else {
    next.setMonth(next.getMonth() + 1);
  }
  next.setHours(8, 0, 0, 0);
  return next;
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
      billing,
      plan,
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
      paymentTerms: paymentTerms || billing?.paymentTerms || 'net_15',
      plan: plan || billing?.plan || 'standard',
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

    const finalized = await finalizeUploadedFile(req.file, 'corporate');
    const documentUrl = finalized.url;

    corporateAccount.verification.documents.push({
      type: documentUrl,
      documentType,
      uploadedAt: new Date(),
      verified: false,
      storageKey: finalized.key,
      storageProvider: finalized.provider,
      originalName: finalized.originalName
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

    // Top routes + 6-month spending trend use the full booking history.
    const historyBookings = await Booking.find({
      $or: [
        { corporateAccount: corporateAccount._id },
        { shipper: req.user.id }
      ]
    }).select('route pricing totalAmount createdAt');

    const amountOf = (b) => b.pricing?.totals?.total || b.pricing?.total || b.totalAmount || 0;

    const routeMap = {};
    historyBookings.forEach(b => {
      const from = b.route?.pickup?.city || b.route?.pickup?.address || 'Unknown';
      const to = b.route?.delivery?.city || b.route?.delivery?.address || 'Unknown';
      const key = `${from} → ${to}`;
      if (!routeMap[key]) routeMap[key] = { route: key, count: 0, total: 0 };
      routeMap[key].count += 1;
      routeMap[key].total += amountOf(b);
    });
    const topRoutes = Object.values(routeMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const spendTrend = [];
    for (let i = 5; i >= 0; i -= 1) {
      const start = new Date();
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      start.setMonth(start.getMonth() - i);
      const end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      const amount = historyBookings
        .filter(b => b.createdAt >= start && b.createdAt < end)
        .reduce((sum, b) => sum + amountOf(b), 0);
      spendTrend.push({ month: start.toLocaleString('default', { month: 'short' }), amount });
    }

    res.status(200).json({
      success: true,
      data: {
        activeBookings,
        completedBookings,
        totalSpend,
        onTimeRate: `${onTimeRate}%`,
        topRoutes,
        spendTrend
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
    const { userId, email, role = 'manager', permissions } = req.body;
    const normalizedRole = normalizeCorporateRole(role);
    const normalizedPermissions = normalizeCorporatePermissions(normalizedRole, permissions);
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const normalizedEmail = String(email || '').trim().toLowerCase();
    let user = userId ? await User.findById(userId) : (normalizedEmail ? await User.findOne({ email: normalizedEmail }) : null);

    // Provision a login for a brand-new team member (no app registration needed).
    let createdCredentials = null;
    if (!user) {
      const { normalizeZimbabwePhone } = require('../utils/phone');
      const phone = normalizeZimbabwePhone(req.body.phone);
      if (!normalizedEmail || !phone || !/^\+263[0-9]{9}$/.test(phone)) {
        return res.status(400).json({
          success: false,
          message: 'To invite a new member, provide their name, email and a valid Zimbabwean phone number (+263).'
        });
      }
      const temporaryPassword = crypto.randomBytes(9).toString('hex');
      try {
        user = await User.create({
          fullName: req.body.fullName || 'Corporate Team Member',
          email: normalizedEmail,
          phone,
          password: temporaryPassword,
          userType: 'corporate',
          roles: ['corporate'],
          isPhoneVerified: true,
          profileCompleted: false,
          mustChangePassword: true
        });
        createdCredentials = { email: normalizedEmail, phone, temporaryPassword };
        try {
          const { sendSMS } = require('../utils/sendSMS');
          await sendSMS(phone, `You've been added to a Palmtrent corporate account. Sign in with email ${normalizedEmail} and temporary password ${temporaryPassword}. Please change it after your first login.`);
        } catch (smsError) {
          console.error('Corporate invite SMS error:', smsError.message);
        }
      } catch (createError) {
        if (createError.code === 11000) {
          user = await User.findOne({ $or: [{ email: normalizedEmail }, { phone }] });
        }
        if (!user) {
          return res.status(409).json({ success: false, message: 'Another account already uses this email or phone number.' });
        }
      }
    }

    const alreadyAdded = corporateAccount.settings.allowedUsers.some(item =>
      item.user.toString() === user._id.toString()
    );

    if (!alreadyAdded) {
      corporateAccount.settings.allowedUsers.push({
        user: user._id,
        role: normalizedRole,
        permissions: normalizedPermissions
      });
      await corporateAccount.save();
    }

    user.corporateAccount = corporateAccount._id;
    if (user.userType === 'shipper') user.userType = 'corporate';
    await user.save();

    res.status(200).json({
      success: true,
      message: createdCredentials ? 'Corporate team member created and invited' : 'Corporate user added',
      data: {
        user: user._id,
        role: normalizedRole,
        permissions: normalizedPermissions,
        createdAccount: Boolean(createdCredentials),
        credentials: createdCredentials || undefined
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error adding corporate user', error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role, permissions } = req.body;
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const allowedUser = corporateAccount.settings.allowedUsers.find(item => item.user.toString() === userId);
    if (!allowedUser) {
      return res.status(404).json({ success: false, message: 'Corporate user not found' });
    }

    const normalizedRole = role ? normalizeCorporateRole(role) : allowedUser.role;
    allowedUser.role = normalizedRole;
    if (permissions !== undefined || role) {
      allowedUser.permissions = normalizeCorporatePermissions(normalizedRole, permissions);
    }
    await corporateAccount.save();
    res.json({
      success: true,
      message: 'Corporate user updated',
      data: {
        user: allowedUser.user,
        role: allowedUser.role,
        permissions: allowedUser.permissions || []
      }
    });
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

exports.getApiAccess = async (req, res) => {
  try {
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const apiAccess = corporateAccount.apiAccess || {};
    res.json({
      success: true,
      data: {
        hasKey: Boolean(apiAccess.keyHash),
        keyPrefix: apiAccess.keyPrefix,
        keyLastFour: apiAccess.keyLastFour,
        generatedAt: apiAccess.generatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching API access', error: error.message });
  }
};

exports.regenerateApiKey = async (req, res) => {
  try {
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const rawKey = `pt_corp_${crypto.randomBytes(24).toString('hex')}`;
    corporateAccount.apiAccess = {
      keyHash: crypto.createHash('sha256').update(rawKey).digest('hex'),
      keyPrefix: rawKey.slice(0, 12),
      keyLastFour: rawKey.slice(-4),
      generatedAt: new Date(),
      generatedBy: req.user._id
    };
    await corporateAccount.save();

    await recordAudit({
      action: 'corporate.api_key_regenerated',
      actor: req.user._id,
      entityType: 'CorporateAccount',
      entityId: corporateAccount._id,
      metadata: { keyPrefix: corporateAccount.apiAccess.keyPrefix }
    }).catch(() => {});

    res.json({
      success: true,
      message: 'API key regenerated. Store it now; it will not be shown again.',
      data: {
        apiKey: rawKey,
        keyPrefix: corporateAccount.apiAccess.keyPrefix,
        keyLastFour: corporateAccount.apiAccess.keyLastFour,
        generatedAt: corporateAccount.apiAccess.generatedAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error regenerating API key', error: error.message });
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

exports.getReportSchedules = async (req, res) => {
  try {
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const schedules = await CorporateReportSchedule.find({ corporateAccount: corporateAccount._id })
      .sort({ createdAt: -1 });

    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error loading report schedules', error: error.message });
  }
};

exports.upsertReportSchedule = async (req, res) => {
  try {
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const allowedReportTypes = ['bookings', 'spending', 'team', 'routes', 'invoices', 'analytics'];
    const reportType = String(req.body.reportType || req.body.type || '').trim();
    if (!allowedReportTypes.includes(reportType)) {
      return res.status(400).json({ success: false, message: 'A valid report type is required' });
    }

    const frequency = ['weekly', 'monthly'].includes(req.body.frequency) ? req.body.frequency : 'monthly';
    const recipients = Array.isArray(req.body.recipients) && req.body.recipients.length
      ? req.body.recipients
      : [req.user.email].filter(Boolean);

    const invalidRecipient = recipients.find(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()));
    if (invalidRecipient) {
      return res.status(400).json({ success: false, message: 'All report recipients must be valid email addresses' });
    }

    const update = {
      corporateAccount: corporateAccount._id,
      createdBy: req.user.id,
      reportType,
      reportName: req.body.reportName || req.body.name || `${reportType} report`,
      frequency,
      format: 'csv',
      recipients,
      status: req.body.status === 'paused' ? 'paused' : 'active',
      nextRunAt: getNextReportRun(frequency)
    };

    const schedule = await CorporateReportSchedule.findOneAndUpdate(
      { corporateAccount: corporateAccount._id, reportType, frequency },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await recordAudit({
      actor: req.user,
      action: 'corporate.report_schedule_saved',
      entityType: 'CorporateReportSchedule',
      entityId: schedule._id,
      entityRef: schedule.reportName,
      after: {
        reportType: schedule.reportType,
        frequency: schedule.frequency,
        status: schedule.status,
        nextRunAt: schedule.nextRunAt
      },
      req
    });

    res.status(201).json({ success: true, message: 'Report schedule saved', data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error saving report schedule', error: error.message });
  }
};

exports.updateReportSchedule = async (req, res) => {
  try {
    const corporateAccount = await getCorporateAccountForUser(req.user.id);
    if (!corporateAccount) {
      return res.status(404).json({ success: false, message: 'Corporate account not found' });
    }

    const updates = {};
    if (['active', 'paused'].includes(req.body.status)) updates.status = req.body.status;
    if (['weekly', 'monthly'].includes(req.body.frequency)) {
      updates.frequency = req.body.frequency;
      updates.nextRunAt = getNextReportRun(req.body.frequency);
    }
    if (Array.isArray(req.body.recipients)) {
      const invalidRecipient = req.body.recipients.find(email => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim()));
      if (invalidRecipient) {
        return res.status(400).json({ success: false, message: 'All report recipients must be valid email addresses' });
      }
      updates.recipients = req.body.recipients;
    }

    const schedule = await CorporateReportSchedule.findOneAndUpdate(
      { _id: req.params.id, corporateAccount: corporateAccount._id },
      updates,
      { new: true }
    );

    if (!schedule) {
      return res.status(404).json({ success: false, message: 'Report schedule not found' });
    }

    await recordAudit({
      actor: req.user,
      action: 'corporate.report_schedule_updated',
      entityType: 'CorporateReportSchedule',
      entityId: schedule._id,
      entityRef: schedule.reportName,
      after: updates,
      req
    });

    res.json({ success: true, message: 'Report schedule updated', data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error updating report schedule', error: error.message });
  }
};
