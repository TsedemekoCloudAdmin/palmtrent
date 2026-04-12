// API Service for Palmtrent Web
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';

// Token management
const getToken = () => localStorage.getItem('palmtrent_token');
const setToken = (token) => localStorage.setItem('palmtrent_token', token);
const removeToken = () => localStorage.removeItem('palmtrent_token');

// User management
const getUser = () => {
  const user = localStorage.getItem('palmtrent_user');
  return user ? JSON.parse(user) : null;
};
const setUser = (user) => localStorage.setItem('palmtrent_user', JSON.stringify(user));
const removeUser = () => localStorage.removeItem('palmtrent_user');

// Base fetch wrapper
const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 - unauthorized
  if (response.status === 401) {
    removeToken();
    removeUser();
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
  }

  return data;
};

// Auth API
export const authAPI = {
  login: async (email, password) => {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.token) {
      setToken(response.token);
      setUser(response.user);
    }

    return response;
  },

  register: async (userData) => {
    const response = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    if (response.token) {
      setToken(response.token);
      setUser(response.user);
    }

    return response;
  },

  logout: () => {
    removeToken();
    removeUser();
    window.location.href = '/login';
  },

  getProfile: () => apiFetch('/auth/profile'),

  updateProfile: (data) => apiFetch('/auth/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  isAuthenticated: () => !!getToken(),

  getCurrentUser: getUser,
};

// Bookings API
export const bookingsAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/bookings${queryString ? `?${queryString}` : ''}`);
  },

  getById: (id) => apiFetch(`/bookings/${id}`),

  create: (bookingData) => apiFetch('/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  }),

  update: (id, bookingData) => apiFetch(`/bookings/${id}`, {
    method: 'PUT',
    body: JSON.stringify(bookingData),
  }),

  cancel: (id, reason) => apiFetch(`/bookings/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),

  getQuote: (quoteData) => apiFetch('/bookings/quote', {
    method: 'POST',
    body: JSON.stringify(quoteData),
  }),
};

// Tracking API (public and authenticated)
export const trackingAPI = {
  // Public tracking - no auth required
  trackPublic: async (trackingId) => {
    const response = await fetch(`${API_BASE_URL}/tracking/public/${trackingId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Tracking not found');
    }

    return data;
  },

  // Authenticated tracking with full details
  track: (bookingId) => apiFetch(`/bookings/${bookingId}/tracking`),

  // Get tracking history
  getHistory: (bookingId) => apiFetch(`/bookings/${bookingId}/tracking/history`),

  // Subscribe to live updates (returns WebSocket URL)
  getLiveTrackingUrl: (bookingId) => {
    const wsBase = API_BASE_URL.replace('http', 'ws').replace('/api/v1', '');
    return `${wsBase}/tracking/${bookingId}`;
  },
};

// Payments API
export const paymentsAPI = {
  getAll: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/payments${queryString ? `?${queryString}` : ''}`);
  },

  getById: (id) => apiFetch(`/payments/${id}`),

  initiate: (bookingId, paymentMethod) => apiFetch('/payments/initiate', {
    method: 'POST',
    body: JSON.stringify({ bookingId, paymentMethod }),
  }),

  verify: (reference) => apiFetch(`/payments/verify/${reference}`),
};

// Ratings API
export const ratingsAPI = {
  create: (ratingData) => apiFetch('/ratings', {
    method: 'POST',
    body: JSON.stringify(ratingData),
  }),

  getForBooking: (bookingId) => apiFetch(`/ratings/booking/${bookingId}`),

  getForUser: (userId) => apiFetch(`/ratings/user/${userId}`),
};

// Vehicles API
export const vehiclesAPI = {
  getTypes: () => apiFetch('/reference/vehicle-types'),

  getMakes: () => apiFetch('/reference/vehicle-makes'),

  getModels: (makeId) => apiFetch(`/reference/vehicle-models/${makeId}`),
};

// Reference Data API
export const referenceAPI = {
  getCargoTypes: () => apiFetch('/reference/cargo-types'),

  getInsuranceOptions: () => apiFetch('/reference/insurance-options'),

  getPaymentOptions: () => apiFetch('/reference/payment-options'),

  getCities: () => apiFetch('/reference/cities'),

  getCrossBoderDestinations: () => apiFetch('/reference/cross-border-destinations'),
};

// Corporate API
export const corporateAPI = {
  register: (companyData) => apiFetch('/corporate/register', {
    method: 'POST',
    body: JSON.stringify(companyData),
  }),

  getProfile: () => apiFetch('/corporate/profile'),

  updateProfile: (data) => apiFetch('/corporate/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  getDashboardStats: () => apiFetch('/corporate/dashboard-stats'),

  getAnalytics: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/corporate/analytics${queryString ? `?${queryString}` : ''}`);
  },

  getInvoices: () => apiFetch('/corporate/invoices'),

  uploadDocument: (formData) => {
    const token = getToken();
    return fetch(`${API_BASE_URL}/corporate/documents`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    }).then(res => res.json());
  },
};

// Shipper API
export const shipperAPI = {
  getDashboard: () => apiFetch('/shipper/dashboard'),

  getActiveShipments: () => apiFetch('/shipper/shipments/active'),

  getFavoriteTransporters: () => apiFetch('/shipper/favorites'),

  addFavorite: (transporterId) => apiFetch('/shipper/favorites', {
    method: 'POST',
    body: JSON.stringify({ transporterId }),
  }),

  removeFavorite: (transporterId) => apiFetch(`/shipper/favorites/${transporterId}`, {
    method: 'DELETE',
  }),

  getRecentActivity: () => apiFetch('/shipper/activity'),
};

// Admin API
export const adminAPI = {
  getDashboardStats: () => apiFetch('/admin/dashboard'),

  getUsers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/users${queryString ? `?${queryString}` : ''}`);
  },

  getUserById: (id) => apiFetch(`/admin/users/${id}`),

  updateUser: (id, data) => apiFetch(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  getBookings: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/bookings${queryString ? `?${queryString}` : ''}`);
  },

  getDisputes: () => apiFetch('/admin/disputes'),

  resolveDispute: (id, resolution) => apiFetch(`/admin/disputes/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(resolution),
  }),

  getPayments: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/payments${queryString ? `?${queryString}` : ''}`);
  },

  getReports: (type, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/reports/${type}${queryString ? `?${queryString}` : ''}`);
  },
};

// Notifications API
export const notificationsAPI = {
  getAll: () => apiFetch('/notifications'),

  markAsRead: (id) => apiFetch(`/notifications/${id}/read`, {
    method: 'POST',
  }),

  markAllAsRead: () => apiFetch('/notifications/read-all', {
    method: 'POST',
  }),

  getUnreadCount: () => apiFetch('/notifications/unread-count'),
};

// Export all APIs
export default {
  auth: authAPI,
  bookings: bookingsAPI,
  tracking: trackingAPI,
  payments: paymentsAPI,
  ratings: ratingsAPI,
  vehicles: vehiclesAPI,
  reference: referenceAPI,
  corporate: corporateAPI,
  shipper: shipperAPI,
  admin: adminAPI,
  notifications: notificationsAPI,
};
