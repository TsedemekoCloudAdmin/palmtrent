const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.status !== 'active') {
        return res.status(401).json({
          success: false,
          message: 'Account is not active'
        });
      }

      req.user = user;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error in authentication'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.userType} is not authorized to access this route`
      });
    }
    next();
  };
};

const requireCorporateRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (req.user.userType === 'admin') return next();

      const CorporateAccount = require('../models/CorporateAccount');
      const account = await CorporateAccount.findOne({
        $or: [
          { user: req.user._id },
          { 'settings.allowedUsers.user': req.user._id }
        ]
      });

      if (!account) {
        return res.status(403).json({ success: false, message: 'Corporate account access required' });
      }

      const isOwner = account.user.toString() === req.user._id.toString();
      const member = account.settings?.allowedUsers?.find(item => item.user.toString() === req.user._id.toString());
      const role = isOwner ? 'admin' : member?.role;

      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, message: `Corporate role ${role || 'none'} is not authorized` });
      }

      req.corporateAccount = account;
      req.corporateRole = role;
      next();
    } catch (error) {
      res.status(500).json({ success: false, message: 'Corporate authorization failed' });
    }
  };
};

const requireVerified = (role = null) => {
  return (req, res, next) => {
    const targetRole = role || req.user.userType;
    const verified = req.user.isVerified ||
      req.user.verification?.isVerified ||
      ['approved', 'verified'].includes(req.user.verification?.status);

    if (['transporter', 'corporate'].includes(targetRole) && !verified) {
      return res.status(403).json({ success: false, message: `${targetRole} verification is required` });
    }
    next();
  };
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

module.exports = {
  protect,
  authorize,
  requireCorporateRole,
  requireVerified,
  generateToken
};
