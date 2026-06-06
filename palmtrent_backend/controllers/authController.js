const User = require('../models/User');
const Driver = require('../models/Driver');
const VerificationCode = require('../models/VerificationCode');
const PasswordReset = require('../models/PasswordReset');
const { generateToken } = require('../middleware/auth');
const { generateVerificationCode, generateRandomToken } = require('../utils/generateCode');
const { sendVerificationSMS } = require('../utils/sendSMS');
const { sendPasswordResetEmail } = require('../utils/sendEmail');
const { isSmsDeliveryDisabled } = require('../utils/smsSettings');
const { normalizeZimbabwePhone } = require('../utils/phone');

function duplicateRegistrationPayload(existingUser, duplicateKey = null) {
  const duplicateEmail = duplicateKey === 'email' || Boolean(existingUser?.email);
  const duplicatePhone = duplicateKey === 'phone' || Boolean(existingUser?.phone);

  if (duplicateEmail && duplicatePhone) {
    return {
      field: 'email_phone',
      message: 'Email address and mobile number are already registered'
    };
  }

  if (duplicateEmail) {
    return {
      field: 'email',
      message: 'Email address is already registered'
    };
  }

  return {
    field: 'phone',
    message: 'Mobile number is already registered'
  };
}

function getDuplicateKey(error) {
  if (error?.keyPattern?.email || error?.keyValue?.email) return 'email';
  if (error?.keyPattern?.phone || error?.keyValue?.phone) return 'phone';
  return null;
}

// Register new user
const register = async (req, res) => {
  try {
    const { fullName, phone, password, userType } = req.body;
    const email = String(req.body.email || '').trim().toLowerCase();
    const normalizedPhone = normalizeZimbabwePhone(phone);

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { phone: normalizedPhone }]
    });

    if (existingUser) {
      const duplicate = duplicateRegistrationPayload({
        email: existingUser.email === email,
        phone: existingUser.phone === normalizedPhone
      });

      return res.status(409).json({
        success: false,
        field: duplicate.field,
        message: duplicate.message
      });
    }

    const skipPhoneVerification = isSmsDeliveryDisabled();
    let verifiedCode = null;

    if (!skipPhoneVerification) {
      verifiedCode = await VerificationCode.findOne({
        phone: normalizedPhone,
        type: 'phone_verification',
        used: true,
        expiresAt: { $gt: new Date() }
      });
    }

    if (!skipPhoneVerification && !verifiedCode) {
      return res.status(400).json({
        success: false,
        message: 'Phone number not verified. Please verify your phone first.'
      });
    }

    const allowedUserTypes = ['shipper', 'transporter', 'trailer_owner', 'rental_owner', 'driver', 'roadside_provider', 'corporate'];
    const safeUserType = allowedUserTypes.includes(userType) ? userType : 'shipper';

    // Create user
    const user = await User.create({
      fullName,
      email,
      phone: normalizedPhone,
      password,
      userType: safeUserType,
      roles: [safeUserType],
      isPhoneVerified: skipPhoneVerification || Boolean(verifiedCode)
    });

    if (safeUserType === 'driver') {
      // If a fleet owner already added this person to their roster (a managed
      // driver with no login), link that existing record to the new account
      // instead of creating a duplicate. The fleet owner stays as `owner`; the
      // driver can now manage their own availability/marketplace visibility.
      const existingManaged = await Driver.findOne({
        phone: normalizedPhone,
        user: null
      });

      if (existingManaged) {
        existingManaged.user = user._id;
        existingManaged.email = existingManaged.email || user.email;
        existingManaged.profileType = 'marketplace';
        existingManaged.marketplace = {
          ...(existingManaged.marketplace?.toObject?.() || existingManaged.marketplace || {}),
          // Stay hidden until the driver opts in and holds a paid subscription.
          visible: existingManaged.marketplace?.visible ?? false,
          lookingForWork: existingManaged.marketplace?.lookingForWork ?? true
        };
        await existingManaged.save();
      } else {
        await Driver.create({
          owner: user._id,
          user: user._id,
          profileType: 'marketplace',
          fullName: user.fullName,
          phone: user.phone,
          email: user.email,
          status: 'available',
          availability: { isAvailable: true },
          marketplace: {
            visible: false,
            lookingForWork: true,
            availableImmediately: true,
            headline: 'Driver looking for work'
          }
        });
      }
    }

    // Generate JWT token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
      token,
      data: {
        user,
        token
      }
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors || {})[0]?.message || 'Validation errors',
        errors: Object.values(error.errors || {}).map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    if (error.code === 11000) {
      const duplicate = duplicateRegistrationPayload(null, getDuplicateKey(error));
      return res.status(409).json({
        success: false,
        field: duplicate.field,
        message: duplicate.message
      });
    }

    console.error('Registration error:', error);

    res.status(500).json({
      success: false,
      message: 'Error registering user',
      error: error.message
    });
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;
    const normalizedPhone = normalizeZimbabwePhone(phone);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const loginQuery = normalizedPhone
      ? { phone: normalizedPhone }
      : { email: normalizedEmail };

    if (!loginQuery.phone && !loginQuery.email) {
      return res.status(400).json({
        success: false,
        message: 'Enter your email or mobile number to sign in.'
      });
    }

    // Find user and include password for comparison
    const user = await User.findOne(loginQuery).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active. Please contact support.'
      });
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      message: 'Login successful',
      user,
      token,
      data: {
        user,
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during login',
      error: error.message
    });
  }
};

// Forgot password
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      // Don't reveal whether email exists
      return res.json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    }

    // Generate reset token
    const resetToken = generateRandomToken();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Save reset token
    await PasswordReset.create({
      email,
      token: resetToken,
      expiresAt
    });

    // Send email
    const emailSent = await sendPasswordResetEmail(email, resetToken);

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Error sending reset email'
      });
    }

    res.json({
      success: true,
      message: 'If the email exists, a password reset link has been sent'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error processing forgot password request',
      error: error.message
    });
  }
};

// Reset password
const resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    // Find valid reset token
    const resetRequest = await PasswordReset.findOne({
      token,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!resetRequest) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token'
      });
    }

    // Find user
    const user = await User.findOne({ email: resetRequest.email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update password
    user.password = password;
    await user.save();

    // Mark reset token as used
    resetRequest.used = true;
    await resetRequest.save();

    res.json({
      success: true,
      message: 'Password reset successfully'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error resetting password',
      error: error.message
    });
  }
};

// Get current user
const getMe = async (req, res) => {
  try {
    console.log("getting user");
    const user = await User.findById(req.user.id);

    res.json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user data',
      error: error.message
    });
  }
};

// Change password (for logged in users)
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters long'
      });
    }

    // Find user and include password for comparison
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordValid = await user.comparePassword(currentPassword);

    if (!isPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Update password and clear any forced-change requirement
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Error changing password',
      error: error.message
    });
  }
};

// Update user profile
const updateProfile = async (req, res) => {
  try {
    const { fullName, email, phone, companyName, address, preferences } = req.body;
    const updates = {};

    if (fullName !== undefined) updates.fullName = String(fullName).trim();
    if (companyName !== undefined) updates.companyName = String(companyName).trim();
    if (address !== undefined) updates.address = address;
    if (preferences !== undefined) updates.preferences = preferences;

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid email' });
      }
      const emailOwner = await User.findOne({ email: normalizedEmail, _id: { $ne: req.user.id } });
      if (emailOwner) {
        return res.status(409).json({ success: false, message: 'Email is already in use' });
      }
      updates.email = normalizedEmail;
    }

    if (phone !== undefined) {
      const normalizedPhone = normalizeZimbabwePhone(phone);
      if (!/^\+263[0-9]{9}$/.test(normalizedPhone)) {
        return res.status(400).json({ success: false, message: 'Please provide a valid Zimbabwean phone number (+263 format)' });
      }
      const phoneOwner = await User.findOne({ phone: normalizedPhone, _id: { $ne: req.user.id } });
      if (phoneOwner) {
        return res.status(409).json({ success: false, message: 'Phone number is already in use' });
      }
      updates.phone = normalizedPhone;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'No profile fields provided' });
    }

    updates.profileCompleted = true;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating profile',
      error: error.message
    });
  }
};

// Get user activity history
const getActivityHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const userType = req.user.userType;
    const { page = 1, limit = 20 } = req.query;

    const activities = [];
    const bookingIds = new Set();
    const addActivity = (activity) => {
      const config = {
        booking: { icon: 'local-shipping', color: '#0ea5e9' },
        payment: { icon: 'payments', color: '#16a34a' },
        rating: { icon: 'star', color: '#f59e0b' },
        account: { icon: 'person', color: '#6366f1' }
      }[activity.type] || { icon: 'history', color: '#6b7280' };

      activities.push({
        ...config,
        ...activity,
        id: String(activity.id),
        timestamp: activity.timestamp || activity.date || new Date()
      });
    };

    // Get bookings based on user type
    const Booking = require('../models/Booking');
    const Rental = require('../models/Rental');
    const Payment = require('../models/Payment');
    const Rating = require('../models/Rating');
    const AuditLog = require('../models/AuditLog');

    if (userType === 'shipper' || userType === 'corporate') {
      const bookings = await Booking.find({
        $or: [
          { user: userId },
          { shipper: userId },
          ...(req.user.corporateAccount ? [{ corporateAccount: req.user.corporateAccount }] : [])
        ]
      })
        .select('bookingReference status createdAt updatedAt totalPrice')
        .sort({ createdAt: -1 })
        .limit(10);

      bookings.forEach(booking => {
        bookingIds.add(booking._id.toString());
        addActivity({
          id: booking._id,
          type: 'booking',
          title: `Booking ${booking.bookingReference || booking._id.toString().slice(-8).toUpperCase()}`,
          description: `Status: ${booking.status}`,
          status: booking.status,
          amount: booking.totalPrice,
          timestamp: booking.updatedAt || booking.createdAt
        });
      });
    }

    if (userType === 'transporter') {
      const Shipment = require('../models/Shipment');
      const shipments = await Shipment.find({ transporter: userId })
        .select('booking bookingReference status createdAt updatedAt transporterEarnings')
        .sort({ createdAt: -1 })
        .limit(10);

      shipments.forEach(shipment => {
        if (shipment.booking) bookingIds.add(shipment.booking.toString());
        addActivity({
          id: shipment._id,
          type: 'booking',
          title: `Job ${shipment.bookingReference || shipment._id.toString().slice(-8).toUpperCase()}`,
          description: `Status: ${shipment.status}`,
          status: shipment.status,
          amount: shipment.transporterEarnings,
          timestamp: shipment.updatedAt || shipment.createdAt
        });
      });
    }

    if (userType === 'trailer_owner') {
      const rentals = await Rental.find({ owner: userId })
        .select('status createdAt pricing')
        .sort({ createdAt: -1 })
        .limit(10);

      rentals.forEach(rental => {
        addActivity({
          id: rental._id,
          type: 'booking',
          title: `Rental ${rental._id.toString().slice(-8).toUpperCase()}`,
          description: `Status: ${rental.status}`,
          status: rental.status,
          amount: rental.pricing?.total,
          timestamp: rental.createdAt
        });
      });
    }

    const payments = bookingIds.size
      ? await Payment.find({ booking: { $in: [...bookingIds] } })
        .select('paymentReference amount currency status paymentMethod createdAt updatedAt')
        .sort({ createdAt: -1 })
        .limit(10)
      : [];

    payments.forEach(payment => {
      addActivity({
        id: payment._id,
        type: 'payment',
        title: `Payment ${payment.paymentReference}`,
        description: `${payment.status} ${payment.paymentMethod} payment`,
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        timestamp: payment.updatedAt || payment.createdAt
      });
    });

    const ratings = await Rating.find({
      $or: [
        { 'rater.user': userId },
        { 'ratee.user': userId }
      ]
    })
      .select('overallRating rater ratee createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    ratings.forEach(rating => {
      const userIsRater = rating.rater?.user?.toString() === userId;
      addActivity({
        id: rating._id,
        type: 'rating',
        title: userIsRater ? 'Rating submitted' : 'Rating received',
        description: `${rating.overallRating}/5 stars`,
        timestamp: rating.createdAt
      });
    });

    const auditLogs = await AuditLog.find({ actor: userId })
      .select('action entityType entityRef createdAt')
      .sort({ createdAt: -1 })
      .limit(10);

    auditLogs.forEach(log => {
      addActivity({
        id: log._id,
        type: 'account',
        title: log.action.replace(/\./g, ' '),
        description: [log.entityType, log.entityRef].filter(Boolean).join(' '),
        timestamp: log.createdAt
      });
    });

    // Sort by date
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const start = (parseInt(page) - 1) * parseInt(limit);
    const end = start + parseInt(limit);

    res.status(200).json({
      success: true,
      data: activities.slice(start, end),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: activities.length
      }
    });
  } catch (error) {
    console.error('Get activity history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity history',
      error: error.message
    });
  }
};

module.exports = {
  register,
  login,
  forgotPassword,
  resetPassword,
  changePassword,
  getMe,
  updateProfile,
  getActivityHistory
};
