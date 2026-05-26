jest.mock('../models/User', () => ({
  findByIdAndUpdate: jest.fn()
}));

jest.mock('../services/notificationService', () => ({
  getUserNotifications: jest.fn(),
  markAsRead: jest.fn(),
  markAllAsRead: jest.fn()
}));

const User = require('../models/User');
const notificationService = require('../services/notificationService');
const {
  registerDevice,
  unregisterDevice,
  getUnreadCount
} = require('../controllers/notificationController');

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn()
  };
}

describe('notificationController device registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('registers Expo push tokens and device metadata', async () => {
    const res = response();

    await registerDevice({
      user: { id: 'user-1' },
      body: {
        expoPushToken: 'ExponentPushToken[test-token]',
        platform: 'android',
        deviceInfo: {
          brand: 'Samsung',
          model: 'A54',
          osVersion: '14'
        }
      }
    }, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user-1', expect.objectContaining({
      expoPushToken: 'ExponentPushToken[test-token]',
      deviceInfo: expect.objectContaining({
        platform: 'android',
        brand: 'Samsung',
        model: 'A54',
        osVersion: '14',
        lastUpdated: expect.any(Date)
      })
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('registers FCM tokens when an Expo token is not supplied', async () => {
    const res = response();

    await registerDevice({
      user: { id: 'user-1' },
      body: {
        pushToken: 'fcm-token-1',
        platform: 'android'
      }
    }, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user-1', expect.objectContaining({
      fcmToken: 'fcm-token-1',
      deviceInfo: expect.objectContaining({ platform: 'android' })
    }));
  });

  test('rejects registration without a push token', async () => {
    const res = response();

    await registerDevice({
      user: { id: 'user-1' },
      body: {}
    }, res);

    expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Push token is required'
    }));
  });

  test('unregisters a specific Expo token', async () => {
    const res = response();

    await unregisterDevice({
      user: { id: 'user-1' },
      body: { expoPushToken: 'ExponentPushToken[test-token]' }
    }, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user-1', {
      expoPushToken: null
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('clears all push tokens when no token is supplied', async () => {
    const res = response();

    await unregisterDevice({
      user: { id: 'user-1' },
      body: {}
    }, res);

    expect(User.findByIdAndUpdate).toHaveBeenCalledWith('user-1', {
      fcmToken: null,
      expoPushToken: null
    });
  });
});

describe('notificationController unread counts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns unread count from notification service', async () => {
    notificationService.getUserNotifications.mockResolvedValue({
      notifications: [],
      unreadCount: 3,
      pagination: {}
    });
    const res = response();

    await getUnreadCount({
      user: { id: 'user-1' }
    }, res);

    expect(notificationService.getUserNotifications).toHaveBeenCalledWith('user-1', {
      page: 1,
      limit: 1
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: { unreadCount: 3 }
    }));
  });
});
