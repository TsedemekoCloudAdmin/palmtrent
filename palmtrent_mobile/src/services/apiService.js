// src/services/apiService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://palmtrent-api.onrender.com/api/v1';

export const normalizeZimbabwePhone = (phone = '') => {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('263') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+263${digits.slice(1)}`;
  if (digits.length === 9) return `+263${digits}`;
  if (String(phone).trim().startsWith('+263') && digits.length === 12) return `+${digits}`;
  return String(phone || '').trim();
};

export const localZimbabwePhone = (phone = '') => {
  const normalized = normalizeZimbabwePhone(phone);
  return normalized.startsWith('+263') ? normalized.slice(4) : String(phone || '').replace(/\D/g, '').slice(-9);
};

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.timeout = 30000; // 30 seconds
  }

  async request(endpoint, options = {}, data) {
    if (typeof options === 'string') {
      options = { method: options };
    }

    if (data !== undefined && options.body === undefined) {
      options = {
        ...options,
        body: JSON.stringify(data),
      };
    }

    // Check network connectivity
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      throw new Error('No internet connection. Please check your network and try again.');
    }

    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: this.timeout,
      ...options,
    };

    // Add auth token if available
    const token = await this.getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(url, {
        ...config,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      let data;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Unexpected response type: ${contentType}`);
      }

      if (!response.ok) {
        // Handle specific HTTP status codes
        switch (response.status) {
          case 401:
            await this.removeToken();
            throw new Error('Session expired. Please log in again.');
          case 403:
            throw new Error(data.message || 'You do not have permission to perform this action.');
          case 404:
            throw new Error('Resource not found.');
          case 422:
            throw new Error(data.message || 'Validation error occurred.');
          case 429:
            throw new Error('Too many requests. Please try again later.');
          case 500:
            throw new Error(data.message || 'Server error. Please try again later.');
          default:
            throw new Error(data.message || `Request failed with status ${response.status}`);
        }
      }

      return data;
    } catch (error) {
      console.error('API Request Error:', {
        endpoint,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your connection and try again.');
      }

      if (error.message.includes('Network request failed')) {
        throw new Error('Network error. Please check your connection and try again.');
      }

      throw error;
    }
  }

  async uploadRequest(endpoint, formData, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = await this.getToken();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          ...options.headers,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Upload Request Error:', error);
      throw error;
    }
  }

  // Token management
  async getToken() {
    try {
      return await AsyncStorage.getItem('userToken') || await AsyncStorage.getItem('token');
    } catch (error) {
      console.error('Error getting token:', error);
      return null;
    }
  }

  async setToken(token) {
    try {
      await AsyncStorage.setItem('userToken', token);
    } catch (error) {
      console.error('Error setting token:', error);
      throw error;
    }
  }

  async removeToken() {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('userData');
    } catch (error) {
      console.error('Error removing token:', error);
      throw error;
    }
  }

  async getUserData() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  async setUserData(userData) {
    try {
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
    } catch (error) {
      console.error('Error setting user data:', error);
      throw error;
    }
  }

  // Generic HTTP methods (for compatibility with existing code)
  async get(endpoint, params = '') {
    let url = endpoint;
    if (params) {
      url += `${url.includes('?') ? '&' : '?'}${params}`;
    }
    return this.request(url);
  }

  async post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }

  // Vehicle APIs (compatible with short version)
  async getVehicles(params = '') {
    let url = '/vehicles';
    if (params) {
      url += `${url.includes('?') ? '&' : '?'}${params}`;
    }
    return this.request(url);
  }

  async getVehicle(id) {
    return this.request(`/vehicles/${id}`);
  }

  async createVehicle(data) {
    return this.request('/vehicles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateVehicle(id, data) {
    return this.request(`/vehicles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteVehicle(id) {
    return this.request(`/vehicles/${id}`, {
      method: 'DELETE',
    });
  }

  async uploadVehiclePhoto(vehicleId, formData) {
    return this.uploadRequest(`/vehicles/${vehicleId}/photos`, formData);
  }

  // Driver APIs (compatible with short version)
  async getDrivers(params = '') {
    let url = '/drivers';
    if (params) {
      url += `${url.includes('?') ? '&' : '?'}${params}`;
    }
    return this.request(url);
  }

  async getDriver(id) {
    return this.request(`/drivers/${id}`);
  }

  async searchMarketplaceDrivers(params = '') {
    const query = typeof params === 'string' ? params : new URLSearchParams(params).toString();
    return this.request(`/drivers/marketplace${query ? `?${query}` : ''}`);
  }

  async getMyDriverProfile() {
    return this.request('/drivers/me');
  }

  async updateMyDriverProfile(data) {
    return this.request('/drivers/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateMyDriverAvailability(data) {
    return this.request('/drivers/me/availability', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async createDriver(data) {
    return this.request('/drivers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDriver(id, data) {
    return this.request(`/drivers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDriver(id) {
    return this.request(`/drivers/${id}`, {
      method: 'DELETE',
    });
  }

  // Dashboard Stats
  async getDashboardStats() {
    return this.request('/transporter/dashboard-stats');
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.request('/ops/health');
      return response;
    } catch (error) {
      console.error('Health check failed:', error);
      throw error;
    }
  }

  // Auth endpoints
  async register(userData) {
    try {
      const response = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      
      if (response.data?.token) {
        await this.setToken(response.data.token);
        await this.setUserData(response.data.user);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  async login(credentials) {
    try {
      const response = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify(credentials),
      });
      
      if (response.data?.token) {
        await this.setToken(response.data.token);
        await this.setUserData(response.data.user);
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  }

  async logout() {
    try {
      await this.removeToken();
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async getCurrentUser() {
    try {
      const response = await this.request('/auth/me');
      // Extract user from nested response and update stored user data
      const userData = response.data?.user || response.data;
      if (userData) {
        await this.setUserData(userData);
      }
      return { success: response.success, data: userData };
    } catch (error) {
      throw error;
    }
  }

  async updateProfile(profileData) {
    try {
      const response = await this.request('/auth/profile', {
        method: 'PUT',
        body: JSON.stringify(profileData),
      });

      // Extract user from nested response and update stored user data
      const userData = response.data?.user || response.data;
      if (userData) {
        await this.setUserData(userData);
      }

      return { success: response.success, data: userData, message: response.message };
    } catch (error) {
      throw error;
    }
  }

  async forgotPassword(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token, newPassword) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password: newPassword }),
    });
  }

  // Verification endpoints
  async sendVerificationCode(phone) {
    return this.request('/verification/send-code', {
      method: 'POST',
      body: JSON.stringify({ phone: normalizeZimbabwePhone(phone) }),
    });
  }

  async verifyCode(phone, code) {
    return this.request('/verification/verify', {
      method: 'POST',
      body: JSON.stringify({ phone: normalizeZimbabwePhone(phone), code }),
    });
  }

  async resendVerificationCode(phone) {
    return this.request('/verification/resend-code', {
      method: 'POST',
      body: JSON.stringify({ phone: normalizeZimbabwePhone(phone) }),
    });
  }

  // Shipment endpoints
  async getActiveShipments() {
    return this.request('/shipments/active');
  }

  async getAllShipments(page = 1, limit = 10, status = null) {
    let url = `/shipments?page=${page}&limit=${limit}`;
    if (status) {
      url += `&status=${status}`;
    }
    return this.request(url);
  }

  async getShipmentById(shipmentId) {
    return this.request(`/shipments/${shipmentId}`);
  }

  async trackShipment(shipmentId) {
    return this.request(`/shipments/${shipmentId}/track`);
  }

  async createShipment(shipmentData) {
    return this.request('/shipments', {
      method: 'POST',
      body: JSON.stringify(shipmentData),
    });
  }

  async updateLocation(shipmentId, latitude, longitude, note = '') {
    return this.request(`/shipments/${shipmentId}/location`, {
      method: 'PUT',
      body: JSON.stringify({ latitude, longitude, note }),
    });
  }

  async updateStatus(shipmentId, status, notes = '') {
    return this.request(`/shipments/${shipmentId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  }

  async uploadProofOfDelivery(shipmentId, formData) {
    return this.uploadRequest(`/shipments/${shipmentId}/proof-of-delivery`, formData);
  }

  async rateShipment(shipmentId, rating, review = '') {
    return this.request(`/shipments/${shipmentId}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, review }),
    });
  }

  // Booking endpoints
  async getAllBookings(page = 1, limit = 10, status = null) {
    let url = `/bookings?page=${page}&limit=${limit}`;
    if (status) {
      url += `&status=${status}`;
    }
    return this.request(url);
  }

  async getActivityHistory({ page = 1, limit = 50 } = {}) {
    return this.request(`/auth/activity-history?page=${page}&limit=${limit}`);
  }

  async getMyBookings({ page = 1, limit = 50, status = null } = {}) {
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    if (status) {
      params.append('status', status);
    }
    return this.request(`/bookings/my-bookings?${params.toString()}`);
  }

  async getBookingById(bookingId) {
    return this.request(`/bookings/${bookingId}`);
  }

  async createBooking(bookingData) {
    return this.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  }

  async updateBooking(bookingId, bookingData) {
    return this.request(`/bookings/${bookingId}`, {
      method: 'PUT',
      body: JSON.stringify(bookingData),
    });
  }

  async confirmBooking(bookingId) {
    return this.request(`/bookings/${bookingId}/confirm-booking`, {
      method: 'POST',
    });
  }

  async confirmPayment(bookingId, paymentReference, paymentMethod) {
    return this.request(`/bookings/${bookingId}/confirm-payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentReference, paymentMethod }),
    });
  }

  async cancelBooking(bookingId, reason) {
    return this.request(`/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async calculatePricing(bookingData) {
    return this.request('/bookings/calculate-pricing', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  }

  // Corporate endpoints
  async getCorporateProfile() {
    return this.request('/corporate/profile');
  }

  async updateCorporateProfile(profileData) {
    return this.request('/corporate/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async registerCorporateAccount(accountData) {
    return this.request('/corporate/register', {
      method: 'POST',
      body: JSON.stringify(accountData),
    });
  }

  async getInvoices(startDate = null, endDate = null) {
    let url = '/corporate/invoices';
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    
    return this.request(url);
  }

  async getAnalytics(period = 'month') {
    return this.request(`/corporate/analytics?period=${period}`);
  }

  async getCorporateDashboardStats() {
    return this.request('/corporate/dashboard-stats');
  }

  async getPublicPlans(audience = null) {
    const response = await this.request('/public/plans');
    if (!audience) return response;

    const plans = response.data || [];
    return {
      ...response,
      data: plans.filter(plan => {
        if (plan.audience === audience) return true;
        if (audience === 'transporter' && plan.audience === 'trailer_owner') return true;
        if (audience === 'rental_owner' && ['rental_owner', 'trailer_owner'].includes(plan.audience)) return true;
        if (audience === 'trailer_owner' && ['trailer_owner', 'rental_owner'].includes(plan.audience)) return true;
        return false;
      })
    };
  }

  async getMySubscription() {
    return this.request('/public/subscriptions/me');
  }

  async createMySubscription(plan) {
    const planId = typeof plan === 'object' ? plan.id || plan._id : plan;
    const planCode = typeof plan === 'object' ? plan.code : undefined;
    return this.request('/public/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ planId, planCode }),
    });
  }

  async createSubscriptionPayment(subscriptionId, paymentMethod = 'clicknpay', customer = {}) {
    return this.request(`/public/subscriptions/${subscriptionId}/payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod, customer }),
    });
  }

  async getCorporateUsers() {
    return this.request('/corporate/users');
  }

  async inviteCorporateUser(userData) {
    return this.request('/corporate/users/invite', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  // Vehicle endpoints (for transporters and trailer owners)
  async getMyVehicles() {
    return this.request('/vehicles/my-vehicles');
  }

  async addVehicle(vehicleData) {
    return this.request('/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicleData),
    });
  }

  async updateVehicleStatus(vehicleId, status) {
    return this.request(`/vehicles/${vehicleId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Available jobs for transporters
  async getAvailableJobs(page = 1, limit = 10, filters = {}) {
    let url = `/bookings/jobs/available?page=${page}&limit=${limit}`;
    
    const params = new URLSearchParams();
    if (filters.vehicleType) params.append('vehicleType', filters.vehicleType);
    if (filters.maxDistance) params.append('maxDistance', filters.maxDistance);
    if (filters.minPrice) params.append('minPrice', filters.minPrice);
    
    if (params.toString()) {
      url += `&${params.toString()}`;
    }
    
    return this.request(url);
  }

  async acceptJob(shipmentId, payload = {}) {
    return this.request(`/bookings/jobs/${shipmentId}/accept`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async rejectJob(shipmentId, reason = '') {
    return this.request(`/bookings/jobs/${shipmentId}/decline`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // Notifications
  async getNotifications(page = 1, limit = 20) {
    return this.request(`/notifications?page=${page}&limit=${limit}`);
  }

  async markNotificationAsRead(notificationId) {
    return this.request(`/notifications/${notificationId}/read`, {
      method: 'POST',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/mark-all-read', {
      method: 'POST',
    });
  }

  async getUnreadNotificationCount() {
    return this.request('/notifications/unread-count');
  }

  async registerNotificationDevice(deviceData) {
    return this.request('/notifications/register-device', {
      method: 'POST',
      body: JSON.stringify(deviceData),
    });
  }

  async unregisterNotificationDevice(pushToken = null) {
    return this.request('/notifications/unregister-device', {
      method: 'POST',
      body: JSON.stringify(pushToken ? { pushToken } : {}),
    });
  }

  // Support tickets
  async createSupportTicket(ticketData) {
    return this.request('/support/tickets', {
      method: 'POST',
      body: JSON.stringify(ticketData),
    });
  }

  async getSupportTickets(params = {}) {
    const query = typeof params === 'string' ? params : new URLSearchParams(params).toString();
    return this.request(`/support/tickets${query ? `?${query}` : ''}`);
  }

  async getSupportTicket(ticketId) {
    return this.request(`/support/tickets/${ticketId}`);
  }

  async replyToSupportTicket(ticketId, message) {
    return this.request(`/support/tickets/${ticketId}/replies`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  // File upload utility
  async uploadFile(fileUri, fileName, fileType) {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: fileType,
      name: fileName,
    });

    return this.uploadRequest('/uploads/documents', formData);
  }

  // Helper method for handling API errors in components
  handleApiError(error, setError = null) {
    console.error('API Error:', error);
    
    const errorMessage = error.message || 'An unexpected error occurred';
    
    if (setError) {
      setError(errorMessage);
    }
    
    return errorMessage;
  }

  // Retry mechanism for failed requests
  async requestWithRetry(endpoint, options = {}, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.request(endpoint, options);
      } catch (error) {
        lastError = error;
        
        // Don't retry for these errors
        if ([400, 401, 403, 404, 422].includes(error.status)) {
          break;
        }
        
        // Exponential backoff
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  // Transporter endpoints
  async getTransporterDashboardStats() {
    return this.request('/transporter/dashboard-stats');
  }

  async getTransporterRecentActivity(limit = 5) {
    return this.request(`/transporter/recent-activity?limit=${limit}`);
  }

  async getTransporterAvailableJobs(page = 1, limit = 10, filters = {}) {
    let url = `/transporter/available-jobs?page=${page}&limit=${limit}`;
    
    const params = new URLSearchParams();
    if (filters.vehicleType) params.append('vehicleType', filters.vehicleType);
    if (filters.maxDistance) params.append('maxDistance', filters.maxDistance);
    if (filters.minPrice) params.append('minPrice', filters.minPrice);
    
    if (params.toString()) {
      url += `&${params.toString()}`;
    }
    
    return this.request(url);
  }

  // Shipper endpoints
  async getShipperDashboardStats() {
    return this.request('/shipper/dashboard-stats');
  }

  async getShipperRecentActivity(limit = 5) {
    return this.request(`/shipper/recent-activity?limit=${limit}`);
  }

  async getChatMessages(bookingId, limit = 50, before = null) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (before) {
      params.append('before', before);
    }
    return this.request(`/chat/bookings/${bookingId}/messages?${params.toString()}`);
  }

  async sendChatMessage(bookingId, message) {
    return this.request(`/chat/bookings/${bookingId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
  }

  async markChatRead(bookingId) {
    return this.request(`/chat/bookings/${bookingId}/read`, {
      method: 'POST',
    });
  }

  // Trailer Owner endpoints
  async getTrailerOwnerDashboardStats() {
    return this.request('/trailer-owner/dashboard-stats');
  }

  async getTrailerOwnerRecentActivity(limit = 5) {
    return this.request(`/trailer-owner/recent-activity?limit=${limit}`);
  }

  async getTrailerOwnerTrailers() {
    return this.request('/trailer-owner/trailers');
  }

  async getRentalStaff() {
    return this.request('/trailer-owner/staff');
  }

  async createRentalStaff(staffData) {
    return this.request('/trailer-owner/staff', {
      method: 'POST',
      body: JSON.stringify(staffData),
    });
  }

  // Assignment methods
async assignDriverToVehicle(vehicleId, driverId) {
  return this.request(`/vehicles/${vehicleId}/assign-driver`, {
    method: 'POST',
    body: JSON.stringify({ driverId }),
  });
}

async unassignDriverFromVehicle(vehicleId) {
  return this.request(`/vehicles/${vehicleId}/assign-driver`, {
    method: 'POST',
    body: JSON.stringify({ driverId: null }),
  });
}

// Update status methods
async updateVehicleStatus(vehicleId, status) {
  return this.request(`/vehicles/${vehicleId}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

  async updateDriverStatus(driverId, status) {
    return this.request(`/drivers/${driverId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async getResponderProfile() {
    return this.request('/emergency/responders/me');
  }

  async updateResponderProfile(data) {
    return this.request('/emergency/responders/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateResponderAvailability(data) {
    return this.request('/emergency/responders/me/availability', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getResponderRequests() {
    return this.request('/emergency/responders/requests');
  }

  async getEmergencyDecisions() {
    return this.request('/emergency/decisions');
  }

  async respondToEmergency(emergencyId, action, notes = '', quote = null) {
    return this.request(`/emergency/${emergencyId}/respond`, {
      method: 'PUT',
      body: JSON.stringify({ action, notes, ...(quote ? { quote } : {}) }),
    });
  }

  async acceptEmergencyQuote(emergencyId, responderId) {
    return this.request(`/emergency/${emergencyId}/quotes/${responderId}/accept`, {
      method: 'PUT',
      body: JSON.stringify({}),
    });
  }

  async rejectEmergencyQuote(emergencyId, responderId, reason = '') {
    return this.request(`/emergency/${emergencyId}/quotes/${responderId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
  }

  async createEmergencyPayment(emergencyId, paymentMethod = 'clicknpay', customer = {}, options = {}) {
    return this.request(`/emergency/${emergencyId}/payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod, customer, ...options }),
    });
  }

// Rating endpoints
async submitRating(bookingId, ratingData) {
  return this.request(`/ratings/booking/${bookingId}`, {
    method: 'POST',
    body: JSON.stringify(ratingData),
  });
}

async checkCanRate(bookingId) {
  return this.request(`/ratings/booking/${bookingId}/can-rate`);
}

async getBookingRatings(bookingId) {
  return this.request(`/ratings/booking/${bookingId}`);
}

async getMyRatings() {
  return this.request('/ratings/me');
}

async getMyGivenRatings(page = 1, limit = 10) {
  return this.request(`/ratings/me/given?page=${page}&limit=${limit}`);
}

async getUserRating(userId) {
  return this.request(`/ratings/user/${userId}`);
}

async getUserReviews(userId, page = 1, limit = 10) {
  return this.request(`/ratings/user/${userId}/reviews?page=${page}&limit=${limit}`);
}

async respondToRating(ratingId, responseText) {
  return this.request(`/ratings/${ratingId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ responseText }),
  });
}

async flagRating(ratingId, reason) {
  return this.request(`/ratings/${ratingId}/flag`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ============ PAYMENT ENDPOINTS ============

async createPayment(paymentData) {
  return this.request('/payments/create', {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
}

async initiatePayment(paymentData) {
  return this.request('/payments/initiate', {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
}

async confirmCashPayment(paymentData) {
  return this.request('/payments/confirm-cash', {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
}

async checkPaymentStatus(paymentReference) {
  return this.request(`/payments/status/${paymentReference}`);
}

async checkPaymentExpiry(paymentReference) {
  return this.request(`/payments/expiry/${paymentReference}`);
}

async getPaymentByReference(reference) {
  return this.request(`/payments/${reference}`);
}

// Escrow endpoints
async getEscrowStatus(bookingId) {
  return this.request(`/payments/escrow/booking/${bookingId}`);
}

async confirmDeliveryForEscrow(bookingId) {
  return this.request(`/payments/escrow/confirm-delivery/${bookingId}`, {
    method: 'POST',
  });
}

async raiseEscrowDispute(bookingId, disputeData) {
  return this.request(`/payments/escrow/dispute/${bookingId}`, {
    method: 'POST',
    body: JSON.stringify(disputeData),
  });
}

async cancelAndRefund(bookingId, reason) {
  return this.request(`/payments/escrow/cancel/${bookingId}`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

async recordCashCollection(bookingId, collectionData) {
  return this.request(`/payments/escrow/cash-collection/${bookingId}`, {
    method: 'POST',
    body: JSON.stringify(collectionData),
  });
}

// Withdrawal and payout endpoints
async getTransporterBalance() {
  return this.request('/payments/withdrawal/balance');
}

async requestWithdrawal(withdrawalData) {
  return this.request('/payments/withdrawal/request', {
    method: 'POST',
    body: JSON.stringify(withdrawalData),
  });
}

async getWithdrawalHistory(page = 1, limit = 20) {
  return this.request(`/payments/withdrawal/history?page=${page}&limit=${limit}`);
}

async getPayoutPreferences() {
  return this.request('/payments/payout-preferences');
}

async updatePayoutPreferences(preferences) {
  return this.request('/payments/payout-preferences', {
    method: 'PUT',
    body: JSON.stringify(preferences),
  });
}

// ============ TRAILER ENDPOINTS ============

async getMyTrailers(params = '') {
  const query = typeof params === 'string' ? params : new URLSearchParams(params).toString();
  return this.request(`/trailers/my-fleet${query ? `?${query}` : ''}`);
}

async getAvailableTrailers(params = '') {
  const query = typeof params === 'string' ? params : new URLSearchParams(params).toString();
  return this.request(`/trailers/available${query ? `?${query}` : ''}`);
}

async getTrailerById(trailerId) {
  return this.request(`/trailers/${trailerId}`);
}

async createTrailer(trailerData) {
  return this.request('/trailers', {
    method: 'POST',
    body: JSON.stringify(trailerData),
  });
}

async updateTrailer(trailerId, trailerData) {
  return this.request(`/trailers/${trailerId}`, {
    method: 'PUT',
    body: JSON.stringify(trailerData),
  });
}

async deleteTrailer(trailerId) {
  return this.request(`/trailers/${trailerId}`, {
    method: 'DELETE',
  });
}

async updateTrailerStatus(trailerId, status) {
  return this.request(`/trailers/${trailerId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

async updateTrailerRentalSettings(trailerId, settings) {
  return this.request(`/trailers/${trailerId}/rental-settings`, {
    method: 'PATCH',
    body: JSON.stringify(settings),
  });
}

async getTrailerRentals(trailerId) {
  return this.request(`/trailers/${trailerId}/rentals`);
}

// ============ RENTAL ENDPOINTS ============

async getAvailableRentals(params = '') {
  const query = typeof params === 'string' ? params : new URLSearchParams(params).toString();
  return this.request(`/rentals/available${query ? `?${query}` : ''}`);
}

async getRentalDetails(rentalId) {
  return this.request(`/rentals/item/${rentalId}`);
}

async createRentalRequest(rentalData) {
  return this.request('/rentals/request', {
    method: 'POST',
    body: JSON.stringify(rentalData),
  });
}

async createWalkInRental(rentalData) {
  return this.request('/rentals/walk-in', {
    method: 'POST',
    body: JSON.stringify(rentalData),
  });
}

async getMyRentals() {
  return this.request('/rentals/my-rentals');
}

async getMyRentalListings() {
  return this.request('/rentals/my-listings');
}

async getActiveRentals() {
  return this.request('/rentals/active');
}

async getRentalById(rentalId) {
  return this.request(`/rentals/${rentalId}`);
}

async getRentalTracking(rentalId) {
  return this.request(`/rentals/${rentalId}/tracking`);
}

async updateRentalLocation(rentalId, locationData) {
  return this.request(`/rentals/${rentalId}/location`, {
    method: 'PUT',
    body: JSON.stringify(locationData),
  });
}

async approveRental(rentalId) {
  return this.request(`/rentals/${rentalId}/approve`, {
    method: 'POST',
  });
}

async initiateRentalPayment(rentalId) {
  return this.request(`/rentals/${rentalId}/pay`, {
    method: 'POST',
  });
}

async checkRentalPaymentStatus(rentalId) {
  return this.request(`/rentals/${rentalId}/payment-status`);
}

async confirmRentalPayment(paymentReference) {
  return this.request('/rentals/payment/confirm', {
    method: 'POST',
    body: JSON.stringify({ paymentReference }),
  });
}

async getTrailerPairingOptions(jobId, vehicleId) {
  return this.request(`/transporter/jobs/${jobId}/trailer-options?vehicleId=${vehicleId}`);
}

async requestTrailerPairing(jobId, vehicleId, trailerId) {
  return this.request(`/transporter/jobs/${jobId}/trailer-rental`, {
    method: 'POST',
    body: JSON.stringify({ vehicleId, trailerId }),
  });
}

async rejectRental(rentalId, reason) {
  return this.request(`/rentals/${rentalId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

async confirmRentalPickup(rentalId, pickupData) {
  return this.request(`/rentals/${rentalId}/confirm-pickup`, {
    method: 'POST',
    body: JSON.stringify(pickupData),
  });
}

async confirmRentalReturn(rentalId, returnData) {
  return this.request(`/rentals/${rentalId}/confirm-return`, {
    method: 'POST',
    body: JSON.stringify(returnData),
  });
}

// ============ CROSS-BORDER ENDPOINTS ============

async getCrossBorderDestinations() {
  return this.request('/cross-border/destinations');
}

async getCrossBorderDestinationByCode(countryCode) {
  return this.request(`/cross-border/destinations/${countryCode}`);
}

async getBorderPosts(countryCode) {
  return this.request(`/cross-border/border-posts/${countryCode}`);
}

async getRequiredDocuments(countryCode) {
  return this.request(`/cross-border/documents/${countryCode}`);
}

async calculateCrossBorderPrice(bookingData) {
  return this.request('/cross-border/calculate-price', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  });
}

async createCrossBorderBooking(bookingData) {
  return this.request('/cross-border/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  });
}

async getMyCrossBorderBookings() {
  return this.request('/cross-border/my-bookings');
}

// ============ CLAIMS/INSURANCE ENDPOINTS ============

async getMyClaims() {
  return this.request('/claims/me');
}

async submitDispute(formData) {
  return this.uploadRequest('/claims', formData);
}

async createClaim(bookingId, claimData) {
  return this.request(`/claims/booking/${bookingId}`, {
    method: 'POST',
    body: JSON.stringify(claimData),
  });
}

async getClaimById(claimId) {
  return this.request(`/claims/${claimId}`);
}

async uploadClaimDocument(claimId, documentData) {
  return this.request(`/claims/${claimId}/documents`, {
    method: 'POST',
    body: JSON.stringify(documentData),
  });
}

async submitClaim(claimId) {
  return this.request(`/claims/${claimId}/submit`, {
    method: 'POST',
  });
}

async addClaimMessage(claimId, message) {
  return this.request(`/claims/${claimId}/message`, {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

async withdrawClaim(claimId, reason) {
  return this.request(`/claims/${claimId}/withdraw`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ============ FILE UPLOAD METHODS ============

// Helper to create FormData from file URI
createFileFormData(fileUri, fieldName = 'file', additionalFields = {}) {
  const formData = new FormData();

  // Extract filename from URI
  const filename = fileUri.split('/').pop();

  // Determine MIME type from extension
  const ext = filename.split('.').pop().toLowerCase();
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'pdf': 'application/pdf',
    'webp': 'image/webp'
  };
  const type = mimeTypes[ext] || 'application/octet-stream';

  formData.append(fieldName, {
    uri: fileUri,
    name: filename,
    type
  });

  // Add any additional fields
  Object.keys(additionalFields).forEach(key => {
    formData.append(key, additionalFields[key]);
  });

  return formData;
}

// Upload cargo photo
async uploadCargoPhoto(fileUri) {
  const formData = this.createFileFormData(fileUri);
  return this.uploadRequest('/uploads/cargo', formData);
}

// Upload multiple cargo photos
async uploadCargoPhotos(fileUris) {
  const formData = new FormData();
  fileUris.forEach((uri, index) => {
    const filename = uri.split('/').pop();
    const ext = filename.split('.').pop().toLowerCase();
    const type = ext === 'png' ? 'image/png' : 'image/jpeg';
    formData.append('files', { uri, name: filename, type });
  });
  return this.uploadRequest('/uploads/cargo/multiple', formData);
}

// Upload vehicle photo
async uploadVehiclePhoto(vehicleId, fileUri, photoType) {
  const formData = this.createFileFormData(fileUri, 'file', { photoType });
  return this.uploadRequest(`/vehicles/${vehicleId}/photos`, formData);
}

// Upload verification document
async uploadVerificationDocument(fileUri, documentType) {
  const formData = this.createFileFormData(fileUri, 'file', { documentType });
  return this.uploadRequest('/uploads/verification', formData);
}

// Upload profile photo
async uploadProfilePhoto(fileUri) {
  const formData = this.createFileFormData(fileUri);
  return this.uploadRequest('/uploads/profiles', formData);
}

// Upload proof of delivery photo
async uploadPODPhoto(fileUri, bookingId) {
  const formData = this.createFileFormData(fileUri, 'file', { bookingId });
  return this.uploadRequest('/uploads/pod', formData);
}

// Upload rental inspection evidence
async uploadRentalInspectionPhoto(fileUri, rentalId, inspectionType) {
  const formData = this.createFileFormData(fileUri, 'file', { rentalId, inspectionType });
  return this.uploadRequest('/uploads/rental-inspections', formData);
}

// Upload signature
async uploadSignature(fileUri, bookingId) {
  const formData = this.createFileFormData(fileUri, 'file', { bookingId });
  return this.uploadRequest('/uploads/signatures', formData);
}

// Upload claim evidence
async uploadClaimEvidence(fileUri, claimId) {
  const formData = this.createFileFormData(fileUri, 'file', { claimId });
  return this.uploadRequest('/uploads/claims', formData);
}

// Upload multiple claim evidence files
async uploadMultipleClaimEvidence(fileUris, claimId) {
  const formData = new FormData();
  fileUris.forEach(uri => {
    const filename = uri.split('/').pop();
    const ext = filename.split('.').pop().toLowerCase();
    const mimeTypes = { 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'pdf': 'application/pdf' };
    const type = mimeTypes[ext] || 'application/octet-stream';
    formData.append('files', { uri, name: filename, type });
  });
  formData.append('claimId', claimId);
  return this.uploadRequest('/uploads/claims/multiple', formData);
}

// Upload corporate document
async uploadCorporateDocument(fileUri, documentType) {
  const formData = this.createFileFormData(fileUri, 'document', { documentType });
  return this.uploadRequest('/corporate/documents', formData);
}

// Delete uploaded file
async deleteUploadedFile(fileType, filename) {
  return this.request(`/uploads/${fileType}/${filename}`, {
    method: 'DELETE'
  });
}

}


// Create singleton instance
const apiService = new ApiService();

// Export both the instance and the class
export { ApiService };
export default apiService;
