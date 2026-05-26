const notificationService = require('../services/notificationService');
const User = require('../models/User');

// Register device for push notifications
exports.registerDevice = async (req, res) => {
  try {
    const { expoPushToken, fcmToken, platform, deviceInfo } = req.body;
    const pushToken = req.body.pushToken || expoPushToken || fcmToken;

    if (!pushToken) {
      return res.status(400).json({
        success: false,
        message: 'Push token is required'
      });
    }

    // Determine token type and update user
    const updateData = {};

    if (expoPushToken || pushToken.startsWith('ExponentPushToken')) {
      updateData.expoPushToken = pushToken;
    } else {
      updateData.fcmToken = pushToken;
    }

    // Store device info if provided
    if (platform || deviceInfo) {
      updateData.deviceInfo = {
        platform: platform || 'unknown',
        ...deviceInfo,
        lastUpdated: new Date()
      };
    }

    await User.findByIdAndUpdate(req.user.id, updateData);

    res.status(200).json({
      success: true,
      message: 'Device registered for push notifications'
    });
  } catch (error) {
    console.error('Register device error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register device'
    });
  }
};

// Unregister device from push notifications
exports.unregisterDevice = async (req, res) => {
  try {
    const { expoPushToken, fcmToken } = req.body;
    const pushToken = req.body.pushToken || expoPushToken || fcmToken;

    const updateData = {};

    if (expoPushToken || pushToken?.startsWith('ExponentPushToken')) {
      updateData.expoPushToken = null;
    } else {
      updateData.fcmToken = null;
    }

    // If no specific token, clear both
    if (!pushToken) {
      updateData.expoPushToken = null;
      updateData.fcmToken = null;
    }

    await User.findByIdAndUpdate(req.user.id, updateData);

    res.status(200).json({
      success: true,
      message: 'Device unregistered from push notifications'
    });
  } catch (error) {
    console.error('Unregister device error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unregister device'
    });
  }
};

// Get user's notifications
exports.getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly } = req.query;

    const result = await notificationService.getUserNotifications(req.user.id, {
      page: parseInt(page),
      limit: parseInt(limit),
      unreadOnly: unreadOnly === 'true'
    });

    res.status(200).json({
      success: true,
      data: result.notifications,
      unreadCount: result.unreadCount,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    });
  }
};

// Get unread notification count
exports.getUnreadCount = async (req, res) => {
  try {
    const result = await notificationService.getUserNotifications(req.user.id, {
      page: 1,
      limit: 1
    });

    res.status(200).json({
      success: true,
      data: {
        unreadCount: result.unreadCount
      }
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count'
    });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = await notificationService.markAsRead(notificationId, req.user.id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    });
  }
};

// Mark all notifications as read
exports.markAllAsRead = async (req, res) => {
  try {
    const result = await notificationService.markAllAsRead(req.user.id);

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read'
    });
  }
};
