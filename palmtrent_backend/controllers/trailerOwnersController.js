const Trailer = require('../models/Trailer');
const Rental = require('../models/Rental');
const User = require('../models/User');
const { formatRelativeTime } = require('../utils/formatDate');
const { getRentalOwnerScopeId, canAccessRentalOwnerResource } = require('../services/resourceAccessService');

exports.getDashboardStats = async (req, res) => {
  try {
    const ownerId = getRentalOwnerScopeId(req.user);

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

    const recentAssets = await Trailer.find({ owner: getRentalOwnerScopeId(req.user) })
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
    const trailers = await Trailer.find({ owner: getRentalOwnerScopeId(req.user) }).sort({ createdAt: -1 });

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

exports.getStaffUsers = async (req, res) => {
  try {
    const ownerId = getRentalOwnerScopeId(req.user);
    const staff = await User.find({ associatedRentalOwner: ownerId })
      .select('fullName email phone userType status rentalStaffRole rentalStaffPermissions createdAt')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: staff });
  } catch (error) {
    console.error('Get rental staff error:', error);
    res.status(500).json({ success: false, message: 'Failed to load staff users' });
  }
};

exports.createStaffUser = async (req, res) => {
  try {
    if (!canAccessRentalOwnerResource(req.user, getRentalOwnerScopeId(req.user))) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }
    const { fullName, email, phone, password, role = 'agent' } = req.body;
    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Full name, email, phone, and password are required' });
    }

    // Permissions are derived from the chosen role (explicit permissions in the
    // body override). manager = full; agent = rentals; viewer = read-only.
    const ROLE_PERMISSIONS = {
      manager: ['rentals:read', 'rentals:write', 'fleet:read', 'fleet:write', 'drivers:read', 'drivers:write', 'staff:manage'],
      agent: ['rentals:read', 'rentals:write', 'fleet:read'],
      viewer: ['rentals:read', 'fleet:read']
    };
    const permissions = Array.isArray(req.body.permissions) && req.body.permissions.length
      ? req.body.permissions
      : (ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.agent);

    const staff = await User.create({
      fullName,
      email: String(email).trim().toLowerCase(),
      phone,
      password,
      userType: 'rental_owner',
      roles: ['rental_owner'],
      associatedRentalOwner: getRentalOwnerScopeId(req.user),
      rentalStaffRole: role,
      rentalStaffPermissions: permissions,
      isPhoneVerified: true,
      profileCompleted: true,
      // Owner sets an initial password (UI labels it "Temporary"); force a change
      // on first login so the staff member owns their own credential.
      mustChangePassword: true
    });

    res.status(201).json({
      success: true,
      data: staff,
      message: 'Staff user added'
    });
  } catch (error) {
    console.error('Create rental staff error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email or phone is already registered' });
    }
    res.status(500).json({ success: false, message: error.message || 'Failed to create staff user' });
  }
};
