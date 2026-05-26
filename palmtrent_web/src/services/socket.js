import { io } from 'socket.io-client';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const SOCKET_BASE_URL = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

const getToken = () => localStorage.getItem('palmtrent_token');

class SocketService {
  constructor() {
    this.socket = null;
    this.connecting = null;
    this.listeners = new Map();
  }

  async connect() {
    const token = getToken();
    if (!token) return false;

    if (this.socket?.connected) return true;
    if (this.connecting) return this.connecting;

    this.socket = io(SOCKET_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000
    });

    this.connecting = new Promise((resolve) => {
      const cleanup = () => {
        this.socket?.off('connect', handleConnect);
        this.socket?.off('connect_error', handleError);
        clearTimeout(timeout);
        this.connecting = null;
      };

      const handleConnect = () => {
        cleanup();
        resolve(true);
      };

      const handleError = () => {
        cleanup();
        resolve(false);
      };

      const timeout = setTimeout(() => {
        cleanup();
        resolve(false);
      }, 10000);

      this.socket.once('connect', handleConnect);
      this.socket.once('connect_error', handleError);
    });

    return this.connecting;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.listeners.clear();
      this.connecting = null;
    }
  }

  async subscribeToTracking(bookingId, { onLocation, onStatus, onSubscribed, onError } = {}) {
    const connected = await this.connect();
    if (!connected || !this.socket) {
      onError?.({ message: 'Live tracking connection is unavailable.' });
      return false;
    }

    this.unsubscribeFromTracking(bookingId);

    const locationHandler = (data) => {
      if (this.matchesTrackingId(data, bookingId)) onLocation?.(data);
    };
    const statusHandler = (data) => {
      if (this.matchesTrackingId(data, bookingId)) onStatus?.(data);
    };
    const subscribedHandler = (data) => {
      if (this.matchesTrackingId(data, bookingId)) onSubscribed?.(data);
    };
    const errorHandler = (error) => onError?.(error);

    this.socket.on('tracking:location', locationHandler);
    this.socket.on('booking:statusChanged', statusHandler);
    this.socket.on('tracking:subscribed', subscribedHandler);
    this.socket.on('error', errorHandler);

    this.listeners.set(`tracking:${bookingId}`, {
      locationHandler,
      statusHandler,
      subscribedHandler,
      errorHandler
    });

    this.socket.emit('tracking:subscribe', { bookingId });
    return true;
  }

  unsubscribeFromTracking(bookingId) {
    if (!this.socket) return;

    const listener = this.listeners.get(`tracking:${bookingId}`);
    if (listener) {
      this.socket.off('tracking:location', listener.locationHandler);
      this.socket.off('booking:statusChanged', listener.statusHandler);
      this.socket.off('tracking:subscribed', listener.subscribedHandler);
      this.socket.off('error', listener.errorHandler);
      this.listeners.delete(`tracking:${bookingId}`);
    }

    this.socket.emit('tracking:unsubscribe', { bookingId });
  }

  matchesTrackingId(data, bookingId) {
    const value = String(bookingId);
    return [
      data?.bookingId,
      data?.reference,
      data?.bookingObjectId,
      data?.shipmentObjectId
    ].some(candidate => String(candidate || '') === value);
  }
}

export default new SocketService();
