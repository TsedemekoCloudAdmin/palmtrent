// services/socketService.js
// Socket.io client service for real-time features

import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from './apiService';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.listeners = new Map();
  }

  // Initialize socket connection
  async connect() {
    try {
      const token = await AsyncStorage.getItem('token');

      if (!token) {
        console.log('No token available for socket connection');
        return false;
      }

      // Get base URL without /api/v1
      const baseUrl = API_BASE_URL.replace('/api/v1', '');

      this.socket = io(baseUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000
      });

      this.setupDefaultListeners();

      return new Promise((resolve) => {
        this.socket.on('connect', () => {
          this.isConnected = true;
          this.reconnectAttempts = 0;
          console.log('Socket connected:', this.socket.id);
          resolve(true);
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error.message);
          this.isConnected = false;
          resolve(false);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (!this.isConnected) {
            resolve(false);
          }
        }, 10000);
      });
    } catch (error) {
      console.error('Socket connect error:', error);
      return false;
    }
  }

  // Setup default event listeners
  setupDefaultListeners() {
    if (!this.socket) return;

    this.socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      this.isConnected = false;

      if (reason === 'io server disconnect') {
        // Server disconnected, try to reconnect
        this.socket.connect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('Socket reconnected after', attemptNumber, 'attempts');
      this.isConnected = true;
    });

    this.socket.on('reconnect_failed', () => {
      console.log('Socket reconnection failed');
      this.isConnected = false;
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  // Disconnect socket
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.listeners.clear();
    }
  }

  // ============ LOCATION TRACKING ============

  // Update transporter location
  updateLocation(latitude, longitude, bookingId = null, heading = 0, speed = 0) {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('location:update', {
      latitude,
      longitude,
      bookingId,
      heading,
      speed
    });
  }

  // Subscribe to tracking updates for a booking
  subscribeToTracking(bookingId, callback) {
    if (!this.socket) return;

    this.socket.emit('tracking:subscribe', { bookingId });

    const locationHandler = (data) => {
      if (data.bookingId === bookingId) {
        callback(data);
      }
    };

    this.socket.on('tracking:location', locationHandler);
    this.listeners.set(`tracking:${bookingId}`, locationHandler);
  }

  // Unsubscribe from tracking
  unsubscribeFromTracking(bookingId) {
    if (!this.socket) return;

    this.socket.emit('tracking:unsubscribe', { bookingId });

    const handler = this.listeners.get(`tracking:${bookingId}`);
    if (handler) {
      this.socket.off('tracking:location', handler);
      this.listeners.delete(`tracking:${bookingId}`);
    }
  }

  // ============ BOOKING STATUS ============

  // Update booking status (for transporters)
  updateBookingStatus(bookingId, status, notes = '') {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('booking:statusUpdate', { bookingId, status, notes });
  }

  // Listen for booking status changes
  onBookingStatusChange(callback) {
    if (!this.socket) return;

    this.socket.on('booking:statusChanged', callback);
    this.listeners.set('booking:statusChanged', callback);
  }

  // Listen for booking updates
  onBookingUpdate(callback) {
    if (!this.socket) return;

    this.socket.on('booking:update', callback);
    this.listeners.set('booking:update', callback);
  }

  // ============ JOB NOTIFICATIONS ============

  // Subscribe to new job notifications (for transporters)
  subscribeToJobs(callback) {
    if (!this.socket) return;

    this.socket.emit('jobs:subscribe');
    this.socket.on('jobs:new', callback);
    this.listeners.set('jobs:new', callback);
  }

  // Unsubscribe from job notifications
  unsubscribeFromJobs() {
    if (!this.socket) return;

    this.socket.emit('jobs:unsubscribe');

    const handler = this.listeners.get('jobs:new');
    if (handler) {
      this.socket.off('jobs:new', handler);
      this.listeners.delete('jobs:new');
    }
  }

  // ============ CHAT ============

  // Join chat room for a booking
  joinChat(bookingId) {
    if (!this.socket) return;
    this.socket.emit('chat:join', { bookingId });
  }

  // Send chat message
  sendMessage(bookingId, message) {
    if (!this.socket || !this.isConnected) return;
    this.socket.emit('chat:message', { bookingId, message });
  }

  // Listen for new messages
  onNewMessage(callback) {
    if (!this.socket) return;

    this.socket.on('chat:newMessage', callback);
    this.listeners.set('chat:newMessage', callback);
  }

  // Send typing indicator
  sendTypingIndicator(bookingId, isTyping) {
    if (!this.socket) return;
    this.socket.emit('chat:typing', { bookingId, isTyping });
  }

  // Listen for typing indicators
  onUserTyping(callback) {
    if (!this.socket) return;

    this.socket.on('chat:userTyping', callback);
    this.listeners.set('chat:userTyping', callback);
  }

  // Leave chat room
  leaveChat(bookingId) {
    if (!this.socket) return;
    this.socket.emit('chat:leave', { bookingId });
  }

  // ============ SOS/EMERGENCY ============

  // Trigger SOS alert
  triggerSOS(bookingId, latitude, longitude, type = 'emergency', description = '') {
    if (!this.socket || !this.isConnected) return;

    this.socket.emit('sos:trigger', {
      bookingId,
      latitude,
      longitude,
      type,
      description
    });
  }

  // Listen for SOS alerts
  onSOSAlert(callback) {
    if (!this.socket) return;

    this.socket.on('sos:alert', callback);
    this.listeners.set('sos:alert', callback);
  }

  // ============ UTILITY ============

  // Remove specific listener
  removeListener(event) {
    if (!this.socket) return;

    const handler = this.listeners.get(event);
    if (handler) {
      this.socket.off(event, handler);
      this.listeners.delete(event);
    }
  }

  // Remove all listeners
  removeAllListeners() {
    if (!this.socket) return;

    this.listeners.forEach((handler, event) => {
      this.socket.off(event, handler);
    });
    this.listeners.clear();
  }

  // Check connection status
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      socketId: this.socket?.id || null
    };
  }

  // Emit custom event
  emit(event, data) {
    if (!this.socket || !this.isConnected) return false;
    this.socket.emit(event, data);
    return true;
  }

  // Listen for custom event
  on(event, callback) {
    if (!this.socket) return;
    this.socket.on(event, callback);
    this.listeners.set(event, callback);
  }

  // Remove custom event listener
  off(event) {
    this.removeListener(event);
  }
}

// Export singleton instance
export default new SocketService();
