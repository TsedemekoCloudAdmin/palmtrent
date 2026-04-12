// controllers/documentExpiryController.js
const documentExpiryService = require('../services/documentExpiryService');

/**
 * Run document expiry check (admin/cron endpoint)
 */
exports.runExpiryCheck = async (req, res) => {
  try {
    // Only allow admin or internal calls
    if (req.user?.role !== 'admin' && !req.headers['x-internal-key']) {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const results = await documentExpiryService.checkAllDocuments();

    res.json({
      success: true,
      data: results,
      message: `Document expiry check completed. ${results.alertsSent} alerts sent.`
    });

  } catch (error) {
    console.error('Error running expiry check:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to run document expiry check'
    });
  }
};

/**
 * Get document summary for authenticated user
 */
exports.getMyDocumentSummary = async (req, res) => {
  try {
    const userId = req.user.id;

    const summary = await documentExpiryService.getUserDocumentSummary(userId);

    res.json({
      success: true,
      data: {
        summary,
        counts: {
          expired: summary.expired.length,
          expiringIn7Days: summary.expiringIn7Days.length,
          expiringIn30Days: summary.expiringIn30Days.length,
          valid: summary.valid.length,
          total: summary.expired.length + summary.expiringIn7Days.length +
                 summary.expiringIn30Days.length + summary.valid.length
        },
        hasUrgentItems: summary.expired.length > 0 || summary.expiringIn7Days.length > 0
      }
    });

  } catch (error) {
    console.error('Error getting document summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get document summary'
    });
  }
};

/**
 * Get document summary for a specific user (admin)
 */
exports.getUserDocumentSummary = async (req, res) => {
  try {
    const { userId } = req.params;

    // Only allow admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const summary = await documentExpiryService.getUserDocumentSummary(userId);

    res.json({
      success: true,
      data: {
        summary,
        counts: {
          expired: summary.expired.length,
          expiringIn7Days: summary.expiringIn7Days.length,
          expiringIn30Days: summary.expiringIn30Days.length,
          valid: summary.valid.length
        }
      }
    });

  } catch (error) {
    console.error('Error getting user document summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user document summary'
    });
  }
};

/**
 * Get expiring documents dashboard (admin)
 */
exports.getExpiringDocumentsDashboard = async (req, res) => {
  try {
    // Only allow admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin access required'
      });
    }

    const Vehicle = require('../models/Vehicle');
    const Trailer = require('../models/Trailer');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sevenDays = new Date(today);
    sevenDays.setDate(sevenDays.getDate() + 7);

    const thirtyDays = new Date(today);
    thirtyDays.setDate(thirtyDays.getDate() + 30);

    // Get vehicles with expiring documents
    const vehiclesExpired = await Vehicle.find({
      $or: [
        { 'insurance.expiryDate': { $lt: today } },
        { 'documents.license.expiryDate': { $lt: today } },
        { 'documents.roadworthyCertificate.expiryDate': { $lt: today } }
      ],
      status: { $ne: 'inactive' }
    }).populate('owner', 'name email phone').select('registrationNumber insurance documents owner');

    const vehiclesExpiringSoon = await Vehicle.find({
      $or: [
        { 'insurance.expiryDate': { $gte: today, $lte: sevenDays } },
        { 'documents.license.expiryDate': { $gte: today, $lte: sevenDays } },
        { 'documents.roadworthyCertificate.expiryDate': { $gte: today, $lte: sevenDays } }
      ],
      status: { $ne: 'inactive' }
    }).populate('owner', 'name email phone').select('registrationNumber insurance documents owner');

    // Get trailers with expiring documents
    const trailersExpired = await Trailer.find({
      $or: [
        { 'insurance.expiryDate': { $lt: today } },
        { 'documents.roadworthyCertificate.expiryDate': { $lt: today } },
        { 'documents.licenseDisc.expiryDate': { $lt: today } }
      ],
      status: { $ne: 'inactive' }
    }).populate('owner', 'name email phone').select('registrationNumber insurance documents owner');

    const trailersExpiringSoon = await Trailer.find({
      $or: [
        { 'insurance.expiryDate': { $gte: today, $lte: sevenDays } },
        { 'documents.roadworthyCertificate.expiryDate': { $gte: today, $lte: sevenDays } },
        { 'documents.licenseDisc.expiryDate': { $gte: today, $lte: sevenDays } }
      ],
      status: { $ne: 'inactive' }
    }).populate('owner', 'name email phone').select('registrationNumber insurance documents owner');

    res.json({
      success: true,
      data: {
        overview: {
          totalExpired: vehiclesExpired.length + trailersExpired.length,
          totalExpiringSoon: vehiclesExpiringSoon.length + trailersExpiringSoon.length,
          vehiclesExpired: vehiclesExpired.length,
          vehiclesExpiringSoon: vehiclesExpiringSoon.length,
          trailersExpired: trailersExpired.length,
          trailersExpiringSoon: trailersExpiringSoon.length
        },
        expired: {
          vehicles: vehiclesExpired,
          trailers: trailersExpired
        },
        expiringSoon: {
          vehicles: vehiclesExpiringSoon,
          trailers: trailersExpiringSoon
        }
      }
    });

  } catch (error) {
    console.error('Error getting expiring documents dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get expiring documents dashboard'
    });
  }
};
