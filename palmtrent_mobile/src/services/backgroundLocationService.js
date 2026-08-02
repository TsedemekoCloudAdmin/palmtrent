// services/backgroundLocationService.js
// Keeps GPS location broadcasting alive when the app is backgrounded.
// Uses expo-task-manager + expo-location background mode.
//
// iOS: add "location" to UIBackgroundModes in app.json (expo.ios.infoPlist).
// Android: expo-location handles the foreground-service notification automatically.

import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BACKGROUND_LOCATION_TASK = 'palmtrent-background-location';
const ACTIVE_BOOKING_KEY = 'palmtrent_active_tracking_booking';

// --------------------------------------------------------------------------
// Task definition (must live at module top-level, outside any component)
// --------------------------------------------------------------------------
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error('[BG Location] Task error:', error.message);
    return;
  }

  if (!data?.locations?.length) return;

  const { latitude, longitude, heading, speed } = data.locations[0].coords;

  try {
    // Retrieve the token and active booking id from storage so the task can
    // POST to the server without needing React component state.
    const [token, bookingId] = await Promise.all([
      AsyncStorage.getItem('userToken') || AsyncStorage.getItem('token'),
      AsyncStorage.getItem(ACTIVE_BOOKING_KEY)
    ]);

    if (!token || !bookingId) return;

    // Dynamically import to avoid circular deps at task-definition time.
    const { default: apiService } = await import('./apiService');

    await apiService.request('/tracking/location', {
      method: 'POST',
      body: JSON.stringify({
        bookingId,
        latitude,
        longitude,
        heading: heading || 0,
        speed: speed || 0,
        timestamp: new Date().toISOString()
      })
    });
  } catch (err) {
    // Background tasks must never throw — swallow and log only.
    console.warn('[BG Location] Failed to send location update:', err.message);
  }
});

// --------------------------------------------------------------------------
// Public API
// --------------------------------------------------------------------------

/**
 * Request background location permission and register the task.
 * Call this when the transporter/driver starts an active job.
 * @param {string} bookingId - The booking or shipment id to tag updates with.
 */
export const startBackgroundLocationTracking = async (bookingId) => {
  try {
    // 1. Ensure foreground permission first (required before background).
    const { status: fg } = await Location.requestForegroundPermissionsAsync();
    if (fg !== 'granted') {
      console.warn('[BG Location] Foreground permission denied');
      return false;
    }

    // 2. Request background permission.
    const { status: bg } = await Location.requestBackgroundPermissionsAsync();
    if (bg !== 'granted') {
      console.warn('[BG Location] Background permission denied — location updates will pause when app is backgrounded');
      // Don't hard-fail; the foreground tracking in socketService still works.
      return false;
    }

    // 3. Persist the active booking id so the task can read it without React state.
    await AsyncStorage.setItem(ACTIVE_BOOKING_KEY, String(bookingId));

    // 4. Start (or re-register) the background task.
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (!isRegistered) {
      await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 20,         // metres — less aggressive than foreground
        timeInterval: 15000,          // ms fallback
        showsBackgroundLocationIndicator: true,  // iOS indicator in status bar
        foregroundService: {
          // Android foreground-service notification keeps the process alive.
          notificationTitle: 'PalmTrent — Live Tracking',
          notificationBody: 'Your location is being shared with the shipper.',
          notificationColor: '#0C2D48'
        }
      });
    }

    console.log('[BG Location] Background tracking started for booking:', bookingId);
    return true;
  } catch (err) {
    console.error('[BG Location] Failed to start background tracking:', err.message);
    return false;
  }
};

/**
 * Stop background location tracking and clear the stored booking id.
 * Call this when the job is completed or the transporter logs out.
 */
export const stopBackgroundLocationTracking = async () => {
  try {
    await AsyncStorage.removeItem(ACTIVE_BOOKING_KEY);

    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
    if (isRegistered) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }

    console.log('[BG Location] Background tracking stopped');
  } catch (err) {
    console.warn('[BG Location] Error stopping background tracking:', err.message);
  }
};

/**
 * Returns true when the background task is currently registered and running.
 */
export const isBackgroundTrackingActive = async () => {
  try {
    return await TaskManager.isTaskRegisteredAsync(BACKGROUND_LOCATION_TASK);
  } catch {
    return false;
  }
};
