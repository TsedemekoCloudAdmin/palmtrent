// services/documentExpiryService.js
const Vehicle = require('../models/Vehicle');
const Trailer = require('../models/Trailer');
const User = require('../models/User');
const notificationService = require('./notificationService');

class DocumentExpiryService {
  constructor() {
    // Alert thresholds in days
    this.alertThresholds = [30, 14, 7, 3, 1, 0];
  }

  /**
   * Check all documents for expiry and send notifications
   * This should be run daily via cron job or scheduled task
   */
  async checkAllDocuments() {
    console.log('Starting document expiry check...');

    const results = {
      vehiclesChecked: 0,
      trailersChecked: 0,
      alertsSent: 0,
      expiredDocuments: [],
      expiringDocuments: []
    };

    try {
      // Check vehicle documents
      const vehicleResults = await this.checkVehicleDocuments();
      results.vehiclesChecked = vehicleResults.checked;
      results.alertsSent += vehicleResults.alertsSent;
      results.expiredDocuments.push(...vehicleResults.expired);
      results.expiringDocuments.push(...vehicleResults.expiring);

      // Check trailer documents
      const trailerResults = await this.checkTrailerDocuments();
      results.trailersChecked = trailerResults.checked;
      results.alertsSent += trailerResults.alertsSent;
      results.expiredDocuments.push(...trailerResults.expired);
      results.expiringDocuments.push(...trailerResults.expiring);

      console.log('Document expiry check completed:', results);
      return results;
    } catch (error) {
      console.error('Error checking document expiry:', error);
      throw error;
    }
  }

  /**
   * Check vehicle documents for expiry
   */
  async checkVehicleDocuments() {
    const results = {
      checked: 0,
      alertsSent: 0,
      expired: [],
      expiring: []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find vehicles with documents expiring within 30 days or already expired
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const vehicles = await Vehicle.find({
      $or: [
        { 'insurance.expiryDate': { $lte: thirtyDaysFromNow } },
        { 'documents.license.expiryDate': { $lte: thirtyDaysFromNow } },
        { 'documents.roadworthyCertificate.expiryDate': { $lte: thirtyDaysFromNow } },
        { 'documents.permits.expiryDate': { $lte: thirtyDaysFromNow } }
      ],
      status: { $ne: 'inactive' }
    }).populate('owner', 'name email phone pushToken');

    results.checked = vehicles.length;

    for (const vehicle of vehicles) {
      // Check insurance
      if (vehicle.insurance?.expiryDate) {
        const alert = await this.processDocumentExpiry(
          vehicle.owner,
          vehicle,
          'vehicle',
          'Insurance',
          vehicle.insurance.expiryDate,
          vehicle.registrationNumber
        );
        if (alert) {
          results.alertsSent++;
          if (alert.isExpired) {
            results.expired.push(alert);
          } else {
            results.expiring.push(alert);
          }
        }
      }

      // Check license
      if (vehicle.documents?.license?.expiryDate) {
        const alert = await this.processDocumentExpiry(
          vehicle.owner,
          vehicle,
          'vehicle',
          'License Disc',
          vehicle.documents.license.expiryDate,
          vehicle.registrationNumber
        );
        if (alert) {
          results.alertsSent++;
          if (alert.isExpired) {
            results.expired.push(alert);
          } else {
            results.expiring.push(alert);
          }
        }
      }

      // Check roadworthy certificate
      if (vehicle.documents?.roadworthyCertificate?.expiryDate) {
        const alert = await this.processDocumentExpiry(
          vehicle.owner,
          vehicle,
          'vehicle',
          'Roadworthy Certificate',
          vehicle.documents.roadworthyCertificate.expiryDate,
          vehicle.registrationNumber
        );
        if (alert) {
          results.alertsSent++;
          if (alert.isExpired) {
            results.expired.push(alert);
          } else {
            results.expiring.push(alert);
          }
        }
      }

      // Check permits
      if (vehicle.documents?.permits?.length > 0) {
        for (const permit of vehicle.documents.permits) {
          if (permit.expiryDate) {
            const alert = await this.processDocumentExpiry(
              vehicle.owner,
              vehicle,
              'vehicle',
              `${permit.type || 'Operating'} Permit`,
              permit.expiryDate,
              vehicle.registrationNumber
            );
            if (alert) {
              results.alertsSent++;
              if (alert.isExpired) {
                results.expired.push(alert);
              } else {
                results.expiring.push(alert);
              }
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Check trailer documents for expiry
   */
  async checkTrailerDocuments() {
    const results = {
      checked: 0,
      alertsSent: 0,
      expired: [],
      expiring: []
    };

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const trailers = await Trailer.find({
      $or: [
        { 'insurance.expiryDate': { $lte: thirtyDaysFromNow } },
        { 'documents.roadworthyCertificate.expiryDate': { $lte: thirtyDaysFromNow } },
        { 'documents.licenseDisc.expiryDate': { $lte: thirtyDaysFromNow } }
      ],
      status: { $ne: 'inactive' }
    }).populate('owner', 'name email phone pushToken');

    results.checked = trailers.length;

    for (const trailer of trailers) {
      // Check insurance
      if (trailer.insurance?.expiryDate) {
        const alert = await this.processDocumentExpiry(
          trailer.owner,
          trailer,
          'trailer',
          'Insurance',
          trailer.insurance.expiryDate,
          trailer.registrationNumber
        );
        if (alert) {
          results.alertsSent++;
          if (alert.isExpired) {
            results.expired.push(alert);
          } else {
            results.expiring.push(alert);
          }
        }
      }

      // Check roadworthy
      if (trailer.documents?.roadworthyCertificate?.expiryDate) {
        const alert = await this.processDocumentExpiry(
          trailer.owner,
          trailer,
          'trailer',
          'Roadworthy Certificate',
          trailer.documents.roadworthyCertificate.expiryDate,
          trailer.registrationNumber
        );
        if (alert) {
          results.alertsSent++;
          if (alert.isExpired) {
            results.expired.push(alert);
          } else {
            results.expiring.push(alert);
          }
        }
      }

      // Check license disc
      if (trailer.documents?.licenseDisc?.expiryDate) {
        const alert = await this.processDocumentExpiry(
          trailer.owner,
          trailer,
          'trailer',
          'License Disc',
          trailer.documents.licenseDisc.expiryDate,
          trailer.registrationNumber
        );
        if (alert) {
          results.alertsSent++;
          if (alert.isExpired) {
            results.expired.push(alert);
          } else {
            results.expiring.push(alert);
          }
        }
      }
    }

    return results;
  }

  /**
   * Process a single document expiry check
   */
  async processDocumentExpiry(owner, asset, assetType, documentType, expiryDate, registrationNumber) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(expiryDate);
    expiry.setHours(0, 0, 0, 0);

    const daysUntilExpiry = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

    // Check if this falls within our alert thresholds
    const shouldAlert = this.alertThresholds.includes(daysUntilExpiry) || daysUntilExpiry < 0;

    if (!shouldAlert) {
      return null;
    }

    const isExpired = daysUntilExpiry < 0;
    const alertData = {
      owner: owner?._id,
      ownerEmail: owner?.email,
      ownerPhone: owner?.phone,
      assetType,
      assetId: asset._id,
      registrationNumber,
      documentType,
      expiryDate,
      daysUntilExpiry,
      isExpired,
      alertLevel: this.getAlertLevel(daysUntilExpiry)
    };

    // Send notification
    try {
      await this.sendExpiryNotification(alertData, owner);
    } catch (error) {
      console.error('Error sending expiry notification:', error);
    }

    return alertData;
  }

  /**
   * Get alert level based on days until expiry
   */
  getAlertLevel(daysUntilExpiry) {
    if (daysUntilExpiry < 0) return 'critical'; // Already expired
    if (daysUntilExpiry <= 3) return 'urgent';
    if (daysUntilExpiry <= 7) return 'high';
    if (daysUntilExpiry <= 14) return 'medium';
    return 'low';
  }

  /**
   * Send expiry notification to user
   */
  async sendExpiryNotification(alertData, owner) {
    if (!owner) return;

    const { documentType, registrationNumber, daysUntilExpiry, isExpired, alertLevel, assetType } = alertData;

    let title, message;

    if (isExpired) {
      title = `${documentType} EXPIRED`;
      message = `The ${documentType} for your ${assetType} (${registrationNumber}) has expired ${Math.abs(daysUntilExpiry)} day(s) ago. Please renew immediately to avoid penalties and service suspension.`;
    } else if (daysUntilExpiry === 0) {
      title = `${documentType} Expires TODAY`;
      message = `The ${documentType} for your ${assetType} (${registrationNumber}) expires today. Please renew immediately.`;
    } else {
      title = `${documentType} Expiring Soon`;
      message = `The ${documentType} for your ${assetType} (${registrationNumber}) will expire in ${daysUntilExpiry} day(s). Please renew before it expires.`;
    }

    // Create in-app notification
    try {
      await notificationService.createNotification({
        userId: owner._id,
        type: 'document_expiry',
        title,
        message,
        data: {
          ...alertData,
          actionRequired: true,
          actionUrl: assetType === 'vehicle'
            ? `/vehicles/${alertData.assetId}/documents`
            : `/trailers/${alertData.assetId}/documents`
        },
        priority: alertLevel === 'critical' || alertLevel === 'urgent' ? 'high' : 'normal'
      });
    } catch (error) {
      console.error('Error creating in-app notification:', error);
    }

    // Send push notification for urgent alerts
    if (['critical', 'urgent', 'high'].includes(alertLevel) && owner.pushToken) {
      try {
        await notificationService.sendPushNotification(owner.pushToken, {
          title,
          body: message,
          data: { type: 'document_expiry', assetId: alertData.assetId }
        });
      } catch (error) {
        console.error('Error sending push notification:', error);
      }
    }

    // Send email for critical alerts
    if (alertLevel === 'critical' && owner.email) {
      try {
        await notificationService.sendEmail({
          to: owner.email,
          subject: `[ACTION REQUIRED] ${title}`,
          template: 'document-expiry',
          data: alertData
        });
      } catch (error) {
        console.error('Error sending email notification:', error);
      }
    }
  }

  /**
   * Get expiring documents summary for a user
   */
  async getUserDocumentSummary(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const summary = {
      expired: [],
      expiringIn7Days: [],
      expiringIn30Days: [],
      valid: []
    };

    // Get user's vehicles
    const vehicles = await Vehicle.find({ owner: userId }).populate('vehicleType');

    for (const vehicle of vehicles) {
      const docs = this.extractVehicleDocuments(vehicle);

      for (const doc of docs) {
        if (!doc.expiryDate) continue;

        const expiry = new Date(doc.expiryDate);
        const daysUntil = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

        const docInfo = {
          assetType: 'vehicle',
          assetId: vehicle._id,
          registrationNumber: vehicle.registrationNumber,
          documentType: doc.type,
          expiryDate: doc.expiryDate,
          daysUntilExpiry: daysUntil
        };

        if (daysUntil < 0) {
          summary.expired.push(docInfo);
        } else if (daysUntil <= 7) {
          summary.expiringIn7Days.push(docInfo);
        } else if (daysUntil <= 30) {
          summary.expiringIn30Days.push(docInfo);
        } else {
          summary.valid.push(docInfo);
        }
      }
    }

    // Get user's trailers
    const trailers = await Trailer.find({ owner: userId }).populate('trailerType');

    for (const trailer of trailers) {
      const docs = this.extractTrailerDocuments(trailer);

      for (const doc of docs) {
        if (!doc.expiryDate) continue;

        const expiry = new Date(doc.expiryDate);
        const daysUntil = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));

        const docInfo = {
          assetType: 'trailer',
          assetId: trailer._id,
          registrationNumber: trailer.registrationNumber,
          documentType: doc.type,
          expiryDate: doc.expiryDate,
          daysUntilExpiry: daysUntil
        };

        if (daysUntil < 0) {
          summary.expired.push(docInfo);
        } else if (daysUntil <= 7) {
          summary.expiringIn7Days.push(docInfo);
        } else if (daysUntil <= 30) {
          summary.expiringIn30Days.push(docInfo);
        } else {
          summary.valid.push(docInfo);
        }
      }
    }

    // Sort by expiry date
    summary.expired.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    summary.expiringIn7Days.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
    summary.expiringIn30Days.sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));

    return summary;
  }

  /**
   * Extract all trackable documents from a vehicle
   */
  extractVehicleDocuments(vehicle) {
    const docs = [];

    if (vehicle.insurance?.expiryDate) {
      docs.push({ type: 'Insurance', expiryDate: vehicle.insurance.expiryDate });
    }
    if (vehicle.documents?.license?.expiryDate) {
      docs.push({ type: 'License Disc', expiryDate: vehicle.documents.license.expiryDate });
    }
    if (vehicle.documents?.roadworthyCertificate?.expiryDate) {
      docs.push({ type: 'Roadworthy Certificate', expiryDate: vehicle.documents.roadworthyCertificate.expiryDate });
    }
    if (vehicle.documents?.permits?.length > 0) {
      for (const permit of vehicle.documents.permits) {
        if (permit.expiryDate) {
          docs.push({ type: `${permit.type || 'Operating'} Permit`, expiryDate: permit.expiryDate });
        }
      }
    }

    return docs;
  }

  /**
   * Extract all trackable documents from a trailer
   */
  extractTrailerDocuments(trailer) {
    const docs = [];

    if (trailer.insurance?.expiryDate) {
      docs.push({ type: 'Insurance', expiryDate: trailer.insurance.expiryDate });
    }
    if (trailer.documents?.roadworthyCertificate?.expiryDate) {
      docs.push({ type: 'Roadworthy Certificate', expiryDate: trailer.documents.roadworthyCertificate.expiryDate });
    }
    if (trailer.documents?.licenseDisc?.expiryDate) {
      docs.push({ type: 'License Disc', expiryDate: trailer.documents.licenseDisc.expiryDate });
    }

    return docs;
  }
}

module.exports = new DocumentExpiryService();
