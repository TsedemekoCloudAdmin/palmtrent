const jwt = require('jsonwebtoken');
const User = require('../models/User');

const platformRoleAliases = {
  main_admin: 'admin',
  admin: 'admin',
  clerk: 'admin'
};

const getEffectiveRoles = (user) => {
  const roles = new Set();
  if (!user) return roles;
  if (user.userType) roles.add(user.userType);
  (user.roles || []).forEach(role => roles.add(role));
  if (user.platformRole) {
    roles.add(user.platformRole);
    if (platformRoleAliases[user.platformRole]) roles.add(platformRoleAliases[user.platformRole]);
  }
  if (user.isPlatformStaff) roles.add('admin');
  return roles;
};

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

      // Accounts provisioned with a temporary password must change it before
      // they can use any other endpoint. Only allow changing the password and
      // reading the current user while the requirement is pending.
      if (user.mustChangePassword) {
        const path = (req.originalUrl || '').split('?')[0];
        const allowedWhilePending = ['/auth/change-password', '/auth/me'];
        const isAllowed = allowedWhilePending.some(allowed => path.endsWith(allowed));
        if (!isAllowed) {
          return res.status(403).json({
            success: false,
            code: 'PASSWORD_CHANGE_REQUIRED',
            message: 'You must change your temporary password before continuing.'
          });
        }
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
    const effectiveRoles = getEffectiveRoles(req.user);
    const hasRole = roles.some(role => effectiveRoles.has(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        message: `User role ${req.user.userType} is not authorized to access this route`
      });
    }
    next();
  };
};

const CORPORATE_PERMISSIONS = ['create_bookings', 'view_all_bookings', 'manage_team', 'view_reports'];
const CORPORATE_ROLE_DEFAULT_PERMISSIONS = {
  admin: CORPORATE_PERMISSIONS,
  manager: ['create_bookings', 'view_all_bookings', 'view_reports'],
  viewer: ['view_all_bookings']
};

function getCorporateMemberAccess(account, user) {
  const userId = (user._id || user.id).toString();
  const isOwner = account.user?.toString() === userId;
  const member = account.settings?.allowedUsers?.find(item => item.user.toString() === userId);
  const role = isOwner ? 'admin' : member?.role;
  const permissions = isOwner
    ? CORPORATE_PERMISSIONS
    : (Array.isArray(member?.permissions) && member.permissions.length
      ? member.permissions
      : CORPORATE_ROLE_DEFAULT_PERMISSIONS[role] || []);

  return { role, permissions };
}

async function loadCorporateAccount(req, res) {
  const CorporateAccount = require('../models/CorporateAccount');
  const userId = req.user._id || req.user.id;
  const account = await CorporateAccount.findOne({
    $or: [
      { user: userId },
      { 'settings.allowedUsers.user': userId }
    ]
  });

  if (!account) {
    res.status(403).json({ success: false, message: 'Corporate account access required' });
    return null;
  }

  const access = getCorporateMemberAccess(account, req.user);
  req.corporateAccount = account;
  req.corporateRole = access.role;
  req.corporatePermissions = access.permissions;
  return { account, ...access };
}

const requireCorporateRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      if (getEffectiveRoles(req.user).has('admin')) return next();

      const access = await loadCorporateAccount(req, res);
      if (!access) return;
      const { role } = access;

      if (!allowedRoles.includes(role)) {
        return res.status(403).json({ success: false, message: `Corporate role ${role || 'none'} is not authorized` });
      }

      next();
    } catch (error) {
      res.status(500).json({ success: false, message: 'Corporate authorization failed' });
    }
  };
};

const requireCorporatePermission = (...requiredPermissions) => {
  return async (req, res, next) => {
    try {
      if (getEffectiveRoles(req.user).has('admin')) return next();

      const access = await loadCorporateAccount(req, res);
      if (!access) return;

      const hasPermission = requiredPermissions.every(permission => access.permissions.includes(permission));
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Corporate permission ${requiredPermissions.join(', ')} is required`
        });
      }

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
  requireCorporatePermission,
  requireVerified,
  generateToken
};
