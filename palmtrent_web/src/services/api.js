// API Service for Palmtrent Web
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

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

  forgotPassword: (email) => apiFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),

  resetPassword: (token, password) => apiFetch('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  }),

  logout: () => {
    removeToken();
    removeUser();
    window.location.href = '/login';
  },

  getProfile: () => apiFetch('/auth/me'),

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

  getQuote: (quoteData) => apiFetch('/bookings/calculate-pricing', {
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
  track: (bookingId) => apiFetch(`/tracking/${bookingId}`),

  // Get tracking history
  getHistory: (bookingId) => apiFetch(`/tracking/${bookingId}`),

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

  initiate: (bookingId, paymentMethod, amount, customer = {}) => apiFetch('/payments/create', {
    method: 'POST',
    body: JSON.stringify({ bookingId, paymentMethod, amount, customer }),
  }),

  verify: (reference) => apiFetch(`/payments/status/${reference}`),
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

  getModels: (makeId) => apiFetch(`/reference/vehicle-makes/${makeId}/models`),
};

// Trailer owner / fleet rental API
export const fleetAPI = {
  getDashboard: () => apiFetch('/trailer-owner/dashboard-stats'),

  getFleet: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/trailers/my-fleet${queryString ? `?${queryString}` : ''}`);
  },

  createAsset: (data) => apiFetch('/trailers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateAsset: (id, data) => apiFetch(`/trailers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  updateStatus: (id, status) => apiFetch(`/trailers/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }),

  updateRentalSettings: (id, data) => apiFetch(`/trailers/${id}/rental-settings`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),

  getAvailableRentals: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/rentals/available${queryString ? `?${queryString}` : ''}`);
  },

  requestRental: (data) => apiFetch('/rentals/request', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getMyListings: () => apiFetch('/rentals/my-listings'),

  getMyRentals: () => apiFetch('/rentals/my-rentals'),

  approveRental: (id) => apiFetch(`/rentals/${id}/approve`, { method: 'POST' }),

  payRental: (id) => apiFetch(`/rentals/${id}/pay`, { method: 'POST' }),

  checkRentalPayment: (id) => apiFetch(`/rentals/${id}/payment-status`),

  rejectRental: (id, reason) => apiFetch(`/rentals/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  }),

  confirmPickup: (id, data = {}) => apiFetch(`/rentals/${id}/confirm-pickup`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  confirmReturn: (id, data = {}) => apiFetch(`/rentals/${id}/confirm-return`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
};

// Reference Data API
export const referenceAPI = {
  getCargoTypes: () => apiFetch('/reference/cargo-types'),

  getInsuranceOptions: () => apiFetch('/reference/insurance-options'),

  getPaymentOptions: () => apiFetch('/reference/payment-options'),

  getCities: () => apiFetch('/reference/cities'),

  getCrossBoderDestinations: () => apiFetch('/cross-border/destinations'),
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

  getUsers: () => apiFetch('/corporate/users'),

  inviteUser: (data) => apiFetch('/corporate/users/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

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

  getDisputes: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/disputes${queryString ? `?${queryString}` : ''}`);
  },

  resolveDispute: (id, resolution) => apiFetch(`/admin/disputes/${id}/resolve`, {
    method: 'POST',
    body: JSON.stringify(resolution),
  }),

  getPayments: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/payments${queryString ? `?${queryString}` : ''}`);
  },

  getAuditLogs: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/audit-logs${queryString ? `?${queryString}` : ''}`);
  },

  getRentals: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/rentals${queryString ? `?${queryString}` : ''}`);
  },

  getRatings: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/ratings${queryString ? `?${queryString}` : ''}`);
  },

  getReports: (type, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/reports/${type}${queryString ? `?${queryString}` : ''}`);
  },

  getIntegrations: () => apiFetch('/admin/integrations'),

  updateIntegration: (provider, data) => apiFetch(`/admin/integrations/${provider}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  testIntegration: (provider) => apiFetch(`/admin/integrations/${provider}/test`, {
    method: 'POST',
  }),
};

// Notifications API
export const notificationsAPI = {
  getAll: () => apiFetch('/notifications'),

  markAsRead: (id) => apiFetch(`/notifications/${id}/read`, {
    method: 'POST',
  }),

  markAllAsRead: () => apiFetch('/notifications/mark-all-read', {
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
  fleet: fleetAPI,
  reference: referenceAPI,
  corporate: corporateAPI,
  shipper: shipperAPI,
  admin: adminAPI,
  notifications: notificationsAPI,
};
