// services/pushNotificationService.js
// Expo Push Notification Service

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './apiService';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class PushNotificationService {
  constructor() {
    this.expoPushToken = null;
    this.notificationListener = null;
    this.responseListener = null;
  }

  // Register for push notifications
  async registerForPushNotifications() {
    try {
      if (!Device.isDevice) {
        console.log('Push notifications require a physical device');
        return null;
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permissions not granted');
        return null;
      }

      // EAS builds expose the project ID through expo-constants.
      const projectId = Constants.easConfig?.projectId || Constants.expoConfig?.extra?.eas?.projectId;
      const tokenOptions = projectId ? { projectId } : undefined;
      const tokenData = await Notifications.getExpoPushTokenAsync(tokenOptions);

      this.expoPushToken = tokenData.data;
      console.log('Expo Push Token:', this.expoPushToken);

      // Store token locally
      await AsyncStorage.setItem('expoPushToken', this.expoPushToken);

      // Send token to backend
      await this.sendTokenToServer(this.expoPushToken);

      // Configure Android channel
      if (Platform.OS === 'android') {
        await this.setupAndroidChannel();
      }

      return this.expoPushToken;
    } catch (error) {
      console.error('Error registering for push notifications:', error);
      return null;
    }
  }

  // Setup Android notification channel
  async setupAndroidChannel() {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#F37021',
    });

    await Notifications.setNotificationChannelAsync('bookings', {
      name: 'Booking Updates',
      description: 'Notifications about your bookings and shipments',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0C2D48',
    });

    await Notifications.setNotificationChannelAsync('jobs', {
      name: 'New Jobs',
      description: 'Notifications about available transport jobs',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: '#16a34a',
    });

    await Notifications.setNotificationChannelAsync('payments', {
      name: 'Payment Updates',
      description: 'Notifications about payments and earnings',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#F37021',
    });

    await Notifications.setNotificationChannelAsync('emergency', {
      name: 'Emergency Alerts',
      description: 'Urgent emergency notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 1000, 500, 1000],
      lightColor: '#dc2626',
    });
  }

  // Send token to backend
  async sendTokenToServer(token) {
    try {
      const authToken = await apiService.getToken();
      if (!authToken) return;

      await apiService.registerNotificationDevice({
        pushToken: token,
        expoPushToken: token,
        platform: Platform.OS,
        deviceInfo: {
          brand: Device.brand,
          model: Device.modelName,
          osVersion: Device.osVersion
        }
      });

      console.log('Push token registered with server');
    } catch (error) {
      console.error('Error sending token to server:', error);
    }
  }

  // Setup notification listeners
  setupListeners(onNotificationReceived, onNotificationResponse) {
    // Listener for notifications received while app is foregrounded
    this.notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      if (onNotificationReceived) {
        onNotificationReceived(notification);
      }
    });

    // Listener for user interaction with notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      if (onNotificationResponse) {
        onNotificationResponse(response);
      }
    });

    return () => {
      this.removeListeners();
    };
  }

  // Remove listeners
  removeListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
      this.notificationListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  // Schedule local notification
  async scheduleLocalNotification(title, body, data = {}, trigger = null) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: trigger || null, // null = immediate
      });
      return id;
    } catch (error) {
      console.error('Error scheduling notification:', error);
      return null;
    }
  }

  // Cancel scheduled notification
  async cancelNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.error('Error canceling notification:', error);
    }
  }

  // Cancel all notifications
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('Error canceling all notifications:', error);
    }
  }

  // Get badge count
  async getBadgeCount() {
    try {
      return await Notifications.getBadgeCountAsync();
    } catch (error) {
      return 0;
    }
  }

  // Set badge count
  async setBadgeCount(count) {
    try {
      await Notifications.setBadgeCountAsync(count);
    } catch (error) {
      console.error('Error setting badge count:', error);
    }
  }

  // Clear badge
  async clearBadge() {
    await this.setBadgeCount(0);
  }

  // Get last notification response (for deep linking on app launch)
  async getLastNotificationResponse() {
    try {
      return await Notifications.getLastNotificationResponseAsync();
    } catch (error) {
      return null;
    }
  }

  // Clear the stored last notification response so a previously tapped push is
  // not replayed as a deep link on subsequent cold starts.
  async clearLastNotificationResponse() {
    try {
      await Notifications.clearLastNotificationResponseAsync();
    } catch (error) {
      // Older SDKs may not support this; ignore.
    }
  }

  // Dismiss all notifications from notification center
  async dismissAllNotifications() {
    try {
      await Notifications.dismissAllNotificationsAsync();
    } catch (error) {
      console.error('Error dismissing notifications:', error);
    }
  }

  // Present local notification immediately (useful for testing)
  async presentNotification(title, body, data = {}) {
    return this.scheduleLocalNotification(title, body, data, null);
  }

  // Check if notifications are enabled
  async areNotificationsEnabled() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      return false;
    }
  }

  // Get current push token
  getToken() {
    return this.expoPushToken;
  }

  // Unregister device from push notifications
  async unregister() {
    try {
      const authToken = await apiService.getToken();
      const storedToken = this.expoPushToken || await AsyncStorage.getItem('expoPushToken');

      if (authToken && storedToken) {
        await apiService.unregisterNotificationDevice(storedToken);
      }

      await AsyncStorage.removeItem('expoPushToken');
      this.expoPushToken = null;
      this.removeListeners();

      console.log('Device unregistered from push notifications');
    } catch (error) {
      console.error('Error unregistering device:', error);
    }
  }
}

// Export singleton instance
export default new PushNotificationService();
