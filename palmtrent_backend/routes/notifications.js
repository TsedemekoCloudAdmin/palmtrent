const express = require('express');
const router = express.Router();
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  registerDevice,
  unregisterDevice
} = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// GET /api/v1/notifications - Get user's notifications
router.get('/', getNotifications);

// GET /api/v1/notifications/unread-count - Get unread notification count
router.get('/unread-count', getUnreadCount);

// POST /api/v1/notifications/register-device - Register device for push notifications
router.post('/register-device', registerDevice);

// POST /api/v1/notifications/unregister-device - Unregister device from push notifications
router.post('/unregister-device', unregisterDevice);

// POST /api/v1/notifications/mark-all-read - Mark all as read
router.post('/mark-all-read', markAllAsRead);

// POST /api/v1/notifications/:notificationId/read - Mark single notification as read
router.post('/:notificationId/read', markAsRead);

module.exports = router;
