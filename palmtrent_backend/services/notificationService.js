// services/notificationService.js
const mongoose = require('mongoose');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { getIntegrationConfig } = require('./integrationSettingsService');

// Expo Push Notification URL
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Notification model schema (inline for simplicity)
const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'booking_confirmed',
      'transporter_assigned',
      'pickup_started',
      'in_transit',
      'delivery_completed',
      'payment_received',
      'payment_released',
      'rating_received',
      'claim_update',
      'document_expiry',
      'emergency_alert',
      'new_job',
      'courier_update',
      'corporate_invoice',
      'cross_border_document',
      'safety_alert',
      'system_message'
    ],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  body: {
    type: String,
    required: true
  },
  data: mongoose.Schema.Types.Mixed,
  read: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  pushSent: {
    type: Boolean,
    default: false
  },
  pushSentAt: Date,
  pushError: String
}, {
  timestamps: true
});

notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, read: 1 });

const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

class NotificationService {
  constructor() {
    this.fcmEnabled = !!process.env.FIREBASE_SERVICE_ACCOUNT;
    this.admin = null;
  }

  /**
   * Initialize Firebase Admin SDK
   */
  async initFirebase() {
    if (this.admin) return;

    try {
      const admin = await import('firebase-admin');

      if (!admin.apps.length) {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT || '{}');

        if (serviceAccount.project_id) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
          this.admin = admin;
          console.log('Firebase Admin initialized');
        }
      } else {
        this.admin = admin;
      }
    } catch (error) {
      console.warn('Firebase Admin initialization failed:', error.message);
    }
  }

  /**
   * Send push notification via Firebase Cloud Messaging
   */
  async sendPushNotification(fcmToken, title, body, data = {}) {
    if (!this.fcmEnabled) {
      console.log('FCM not enabled, skipping push notification');
      return { success: false, reason: 'FCM not configured' };
    }

    await this.initFirebase();

    if (!this.admin) {
      return { success: false, reason: 'Firebase not initialized' };
    }

    try {
      const message = {
        notification: {
          title,
          body
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        token: fcmToken
      };

      const response = await this.admin.messaging().send(message);
      console.log('Push notification sent:', response);

      return { success: true, messageId: response };
    } catch (error) {
      console.error('Push notification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send notification to multiple devices
   */
  async sendMulticast(fcmTokens, title, body, data = {}) {
    if (!this.fcmEnabled || fcmTokens.length === 0) {
      return { success: false, reason: 'FCM not configured or no tokens' };
    }

    await this.initFirebase();

    if (!this.admin) {
      return { success: false, reason: 'Firebase not initialized' };
    }

    try {
      const message = {
        notification: {
          title,
          body
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        tokens: fcmTokens
      };

      const response = await this.admin.messaging().sendEachForMulticast(message);
      console.log('Multicast sent:', response.successCount, 'success,', response.failureCount, 'failed');

      return {
        success: true,
        successCount: response.successCount,
        failureCount: response.failureCount
      };
    } catch (error) {
      console.error('Multicast notification error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notification via Expo Push Service
   */
  async sendExpoPushNotification(expoPushToken, title, body, data = {}, channelId = 'default') {
    if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
      return { success: false, reason: 'Invalid Expo push token' };
    }

    try {
      const message = {
        to: expoPushToken,
        sound: 'default',
        title,
        body,
        data,
        channelId,
        priority: 'high',
        badge: 1
      };

      const response = await axios.post(EXPO_PUSH_URL, message, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json'
        }
      });

      const result = response.data?.data?.[0] || response.data;

      if (result.status === 'ok') {
        return { success: true, ticketId: result.id };
      } else {
        return { success: false, error: result.message || 'Unknown error' };
      }
    } catch (error) {
      console.error('Expo push notification error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send push notifications to multiple Expo tokens
   */
  async sendExpoMulticast(expoPushTokens, title, body, data = {}, channelId = 'default') {
    if (!expoPushTokens || expoPushTokens.length === 0) {
      return { success: false, reason: 'No tokens provided' };
    }

    // Filter valid Expo tokens
    const validTokens = expoPushTokens.filter(t => t && t.startsWith('ExponentPushToken'));

    if (validTokens.length === 0) {
      return { success: false, reason: 'No valid Expo tokens' };
    }

    try {
      const messages = validTokens.map(token => ({
        to: token,
        sound: 'default',
        title,
        body,
        data,
        channelId,
        priority: 'high'
      }));

      const response = await axios.post(EXPO_PUSH_URL, messages, {
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json'
        }
      });

      const results = response.data?.data || [];
      const successCount = results.filter(r => r.status === 'ok').length;
      const failureCount = results.filter(r => r.status === 'error').length;

      return {
        success: true,
        successCount,
        failureCount,
        totalSent: validTokens.length
      };
    } catch (error) {
      console.error('Expo multicast error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create and send notification to user
   */
  async notify(userId, type, title, body, data = {}) {
    try {
      // Create in-app notification
      const notification = await Notification.create({
        user: userId,
        type,
        title,
        body,
        data
      });

      // Get user's push tokens
      const User = require('../models/User');
      const user = await User.findById(userId).select('fcmToken expoPushToken');

      let pushResult = { success: false };

      // Try Expo push token first (preferred for React Native/Expo apps)
      if (user?.expoPushToken) {
        pushResult = await this.sendExpoPushNotification(
          user.expoPushToken,
          title,
          body,
          { notificationId: notification._id.toString(), type, ...data },
          this.getChannelForType(type)
        );
      }
      // Fallback to FCM if Expo fails or not available
      else if (user?.fcmToken) {
        pushResult = await this.sendPushNotification(
          user.fcmToken,
          title,
          body,
          { notificationId: notification._id.toString(), type, ...data }
        );
      }

      if (user?.expoPushToken || user?.fcmToken) {
        notification.pushSent = pushResult.success;
        notification.pushSentAt = new Date();
        if (!pushResult.success) {
          notification.pushError = pushResult.error || pushResult.reason;
        }
        await notification.save();
      }

      return notification;
    } catch (error) {
      console.error('Notification error:', error);
      throw error;
    }
  }

  /**
   * Get Android notification channel for notification type
   */
  getChannelForType(type) {
    const channelMap = {
      'booking_confirmed': 'bookings',
      'transporter_assigned': 'bookings',
      'pickup_started': 'bookings',
      'in_transit': 'bookings',
      'delivery_completed': 'bookings',
      'payment_received': 'payments',
      'payment_released': 'payments',
      'rating_received': 'default',
      'claim_update': 'default',
      'document_expiry': 'default',
      'emergency_alert': 'emergency',
      'new_job': 'jobs',
      'system_message': 'default'
    };
    return channelMap[type] || 'default';
  }

  /**
   * Notification templates
   */
  getTemplate(type, data = {}) {
    const templates = {
      booking_confirmed: {
        title: 'Booking Confirmed',
        body: `Your booking ${data.bookingReference} has been confirmed. We're finding a transporter for you.`
      },
      transporter_assigned: {
        title: 'Transporter Assigned',
        body: `${data.transporterName} has been assigned to your booking ${data.bookingReference}.`
      },
      pickup_started: {
        title: 'Pickup Started',
        body: `Your transporter is on the way to pick up your cargo for booking ${data.bookingReference}.`
      },
      in_transit: {
        title: 'Cargo In Transit',
        body: `Your cargo is now in transit. Track your shipment in the app.`
      },
      delivery_completed: {
        title: 'Delivery Completed',
        body: `Your cargo has been delivered successfully. Please rate your experience.`
      },
      payment_received: {
        title: 'Payment Received',
        body: `We've received your payment of $${data.amount} for booking ${data.bookingReference}.`
      },
      payment_released: {
        title: 'Payment Released',
        body: `Your earnings of $${data.amount} have been released to your account.`
      },
      rating_received: {
        title: 'New Rating Received',
        body: `You received a ${data.rating}-star rating. Check your profile for details.`
      },
      claim_update: {
        title: 'Claim Update',
        body: `Your insurance claim ${data.claimReference} has been updated to: ${data.status}.`
      },
      new_job: {
        title: 'New Job Available',
        body: `${data.origin || 'Pickup'} to ${data.destination || 'delivery'} is ready for review.`
      },
      corporate_invoice: {
        title: 'Corporate Invoice Update',
        body: `Invoice ${data.invoiceNumber || ''} is now ${data.status || 'updated'}.`
      },
      cross_border_document: {
        title: 'Cross-border Document Update',
        body: `Document ${data.documentName || ''} is ${data.status || 'updated'}.`
      },
      safety_alert: {
        title: 'Safety Alert',
        body: data.message || 'A safety issue requires attention.'
      },
      system_message: {
        title: data.title || 'Palmtrent Update',
        body: data.message || 'You have a new message from Palmtrent.'
      }
    };

    return templates[type] || templates.system_message;
  }

  /**
   * Send booking confirmation notification
   */
  async notifyBookingConfirmed(booking) {
    const template = this.getTemplate('booking_confirmed', {
      bookingReference: booking.bookingReference
    });

    return this.notify(
      booking.user,
      'booking_confirmed',
      template.title,
      template.body,
      { bookingId: booking._id.toString(), bookingReference: booking.bookingReference }
    );
  }

  /**
   * Send transporter assigned notification
   */
  async notifyTransporterAssigned(booking, transporter) {
    const template = this.getTemplate('transporter_assigned', {
      bookingReference: booking.bookingReference,
      transporterName: transporter.fullName || transporter.name || 'A transporter'
    });

    return this.notify(
      booking.user || booking.shipper,
      'transporter_assigned',
      template.title,
      template.body,
      { bookingId: booking._id.toString(), transporterId: transporter._id.toString() }
    );
  }

  /**
   * Send delivery completed notification
   */
  async notifyDeliveryCompleted(booking) {
    const template = this.getTemplate('delivery_completed', {});

    return this.notify(
      booking.user,
      'delivery_completed',
      template.title,
      template.body,
      { bookingId: booking._id.toString() }
    );
  }

  /**
   * Send payment released notification to transporter
   */
  async notifyPaymentReleased(transporterId, amount, bookingReference) {
    const template = this.getTemplate('payment_released', { amount });

    return this.notify(
      transporterId,
      'payment_released',
      template.title,
      template.body,
      { amount, bookingReference }
    );
  }

  async notifyRole(userType, type, title, body, data = {}) {
    const User = require('../models/User');
    const users = await User.find({ userType, status: 'active' }).select('_id');
    return Promise.allSettled(users.map(user => this.notify(user._id, type, title, body, data)));
  }

  async notifyBookingEvent(booking, eventType, extraData = {}) {
    const recipients = [booking.user, booking.shipper, booking.transporter].filter(Boolean);
    const uniqueRecipients = [...new Set(recipients.map(id => id.toString()))];
    const template = this.getTemplate(eventType, {
      bookingReference: booking.bookingReference,
      origin: booking.origin || booking.route?.pickup?.address,
      destination: booking.destination || booking.route?.delivery?.address,
      ...extraData
    });

    return Promise.allSettled(uniqueRecipients.map(userId =>
      this.notify(userId, eventType, template.title, template.body, {
        bookingId: booking._id.toString(),
        bookingReference: booking.bookingReference,
        ...extraData
      })
    ));
  }

  /**
   * Get user's notifications
   */
  async getUserNotifications(userId, options = {}) {
    const { page = 1, limit = 20, unreadOnly = false } = options;

    const query = { user: userId };
    if (unreadOnly) query.read = false;

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ user: userId, read: false });

    return {
      notifications,
      unreadCount,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, user: userId },
      { read: true, readAt: new Date() },
      { new: true }
    );

    return notification;
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(userId) {
    const result = await Notification.updateMany(
      { user: userId, read: false },
      { read: true, readAt: new Date() }
    );

    return { modifiedCount: result.modifiedCount };
  }

  /**
   * Delete old notifications
   */
  async cleanupOldNotifications(daysOld = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await Notification.deleteMany({
      createdAt: { $lt: cutoffDate },
      read: true
    });

    return { deletedCount: result.deletedCount };
  }

  /**
   * Create notification (alias for document expiry service compatibility)
   */
  async createNotification({ userId, type, title, message, data = {}, priority = 'normal' }) {
    try {
      const notification = await Notification.create({
        user: userId,
        type: type || 'system_message',
        title,
        body: message,
        data: { ...data, priority }
      });

      // Get user's FCM token for high priority notifications
      if (priority === 'high') {
        const User = require('../models/User');
        const user = await User.findById(userId).select('fcmToken');

        if (user?.fcmToken) {
          const pushResult = await this.sendPushNotification(
            user.fcmToken,
            title,
            message,
            { notificationId: notification._id.toString(), type, ...data }
          );

          notification.pushSent = pushResult.success;
          notification.pushSentAt = new Date();
          if (!pushResult.success) {
            notification.pushError = pushResult.error || pushResult.reason;
          }
          await notification.save();
        }
      }

      return notification;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  buildEmailContent(template, data = {}) {
    const title = data.title || data.documentType || 'Palmtrent Update';
    const message = data.message ||
      (template === 'document-expiry'
        ? `A ${data.documentType || 'document'} needs attention.`
        : 'You have a new Palmtrent notification.');

    return {
      text: `${title}\n\n${message}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #1f2937;">
          <h2 style="color: #0C2D48;">${title}</h2>
          <p>${message}</p>
          ${data.actionUrl ? `<p><a href="${data.actionUrl}">Open in Palmtrent</a></p>` : ''}
          <p style="font-size: 12px; color: #6b7280;">Palmtrent transactional notification.</p>
        </div>
      `
    };
  }

  /**
   * Send transactional email via configured SMTP credentials.
   */
  async sendEmail({ to, subject, template, data = {}, html, text, attachments = [] }) {
    if (!to || !subject) {
      throw new Error('Email recipient and subject are required');
    }

    const config = await getIntegrationConfig('email');
    if (!config.host || !config.user || !config.pass) {
      const message = 'Email provider is not configured';
      if (process.env.NODE_ENV === 'production') {
        throw new Error(message);
      }

      console.warn(`${message}; skipping email to ${to}`);
      return { success: false, reason: message };
    }

    const content = this.buildEmailContent(template, data);
    const port = Number(config.port || 587);
    const transporter = nodemailer.createTransport({
      host: config.host,
      port,
      secure: port === 465 || process.env.EMAIL_SECURE === 'true',
      auth: {
        user: config.user,
        pass: config.pass
      }
    });

    const result = await transporter.sendMail({
      from: config.from || process.env.EMAIL_FROM || `"Palmtrent" <${config.user}>`,
      to,
      subject,
      text: text || content.text,
      html: html || content.html,
      attachments
    });

    return {
      success: true,
      messageId: result.messageId
    };
  }

  /**
   * Send document expiry notification
   */
  async notifyDocumentExpiry(userId, documentInfo) {
    const { documentType, registrationNumber, daysUntilExpiry, isExpired, assetType } = documentInfo;

    let title, body;
    if (isExpired) {
      title = `${documentType} EXPIRED`;
      body = `The ${documentType} for your ${assetType} (${registrationNumber}) has expired. Please renew immediately.`;
    } else {
      title = `${documentType} Expiring Soon`;
      body = `The ${documentType} for your ${assetType} (${registrationNumber}) will expire in ${daysUntilExpiry} day(s).`;
    }

    return this.notify(
      userId,
      'document_expiry',
      title,
      body,
      documentInfo
    );
  }

  /**
   * Send emergency alert notification
   */
  async notifyEmergency(userId, emergencyInfo) {
    const { type, location, emergencyId } = emergencyInfo;

    const title = 'Emergency Alert';
    const body = `An emergency (${type}) has been triggered. Help is on the way.`;

    return this.notify(
      userId,
      'emergency_alert',
      title,
      body,
      { emergencyId, type, location }
    );
  }
}

module.exports = new NotificationService();
