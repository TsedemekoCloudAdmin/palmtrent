// src/services/apiService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:5000/api/v1';

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.timeout = 30000; // 30 seconds
  }

  async request(endpoint, options = {}) {
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
            throw new Error('You do not have permission to perform this action.');
          case 404:
            throw new Error('Resource not found.');
          case 422:
            throw new Error(data.message || 'Validation error occurred.');
          case 429:
            throw new Error('Too many requests. Please try again later.');
          case 500:
            throw new Error('Server error. Please try again later.');
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
      return await AsyncStorage.getItem('userToken');
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

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, {
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
      const response = await this.request('/health');
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
      // Update stored user data
      if (response.data) {
        await this.setUserData(response.data);
      }
      return response;
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
      
      // Update stored user data
      if (response.data) {
        await this.setUserData(response.data);
      }
      
      return response;
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
      body: JSON.stringify({ phone: `+263${phone}` }),
    });
  }

  async verifyCode(phone, code) {
    return this.request('/verification/verify', {
      method: 'POST',
      body: JSON.stringify({ phone: `+263${phone}`, code }),
    });
  }

  async resendVerificationCode(phone) {
    return this.request('/verification/resend-code', {
      method: 'POST',
      body: JSON.stringify({ phone: `+263${phone}` }),
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
    return this.request(`/bookings/${bookingId}/confirm`, {
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
    let url = `/jobs/available?page=${page}&limit=${limit}`;
    
    const params = new URLSearchParams();
    if (filters.vehicleType) params.append('vehicleType', filters.vehicleType);
    if (filters.maxDistance) params.append('maxDistance', filters.maxDistance);
    if (filters.minPrice) params.append('minPrice', filters.minPrice);
    
    if (params.toString()) {
      url += `&${params.toString()}`;
    }
    
    return this.request(url);
  }

  async acceptJob(shipmentId) {
    return this.request(`/jobs/${shipmentId}/accept`, {
      method: 'POST',
    });
  }

  async rejectJob(shipmentId, reason = '') {
    return this.request(`/jobs/${shipmentId}/reject`, {
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
      method: 'PUT',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request('/notifications/read-all', {
      method: 'PUT',
    });
  }

  async getUnreadNotificationCount() {
    return this.request('/notifications/unread-count');
  }

  // File upload utility
  async uploadFile(fileUri, fileName, fileType) {
    const formData = new FormData();
    formData.append('file', {
      uri: fileUri,
      type: fileType,
      name: fileName,
    });

    return this.uploadRequest('/upload', formData);
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


}


// Create singleton instance
const apiService = new ApiService();

// Export both the instance and the class
export { ApiService };
export default apiService;