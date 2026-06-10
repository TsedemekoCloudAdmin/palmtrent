// API Service for Palmtrent Web
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';
const DEFAULT_REQUEST_TIMEOUT_MS = Number(import.meta.env.VITE_API_TIMEOUT_MS || 20000);

export const resolveApiUrl = (url) => {
  if (!url) return '';
  if (/^(https?:|blob:|data:)/i.test(url)) return url;

  const apiOrigin = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  if (url.startsWith('/api/')) return `${apiOrigin}${url}`;
  if (url.startsWith('/uploads/')) return `${apiOrigin}${url}`;
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`;
};

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

const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const downloadAuthorizedBlob = async (url) => {
  const response = await fetch(resolveApiUrl(url), {
    headers: authHeaders(),
  });

  if (response.status === 401) {
    removeToken();
    removeUser();
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Unable to download file');
  }

  return response.blob();
};

// Base fetch wrapper
const apiFetch = async (endpoint, options = {}) => {
  const token = getToken();
  const { timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const isFormData = typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData;

  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...fetchOptions.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      headers,
      signal: fetchOptions.signal || controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('The request timed out. Please check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  // Handle 401 - unauthorized
  if (response.status === 401) {
    removeToken();
    removeUser();
    window.location.href = '/login';
    throw new Error('Session expired. Please login again.');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Account provisioned with a temporary password must change it first.
    if (response.status === 403 && data.code === 'PASSWORD_CHANGE_REQUIRED') {
      if (!window.location.pathname.startsWith('/change-password')) {
        window.location.href = '/change-password';
      }
      throw new Error(data.message || 'You must change your temporary password before continuing.');
    }
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

    const token = response.token || response.data?.token;
    const user = response.user || response.data?.user;

    if (token) {
      setToken(token);
      if (user) setUser(user);
    }

    return response;
  },

  register: async (userData) => {
    const response = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });

    const token = response.token || response.data?.token;
    const user = response.user || response.data?.user;

    if (token) {
      setToken(token);
      if (user) setUser(user);
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

  sendVerificationCode: (phone) => apiFetch('/verification/send-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  }),

  verifyCode: (phone, code) => apiFetch('/verification/verify', {
    method: 'POST',
    body: JSON.stringify({ phone, code }),
  }),

  resendVerificationCode: (phone) => apiFetch('/verification/resend-code', {
    method: 'POST',
    body: JSON.stringify({ phone }),
  }),

  logout: () => {
    removeToken();
    removeUser();
    window.location.href = '/login';
  },

  getProfile: () => apiFetch('/auth/me'),

  changePassword: async (currentPassword, newPassword) => {
    const response = await apiFetch('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const current = getUser();
    if (current) setUser({ ...current, mustChangePassword: false });
    return response;
  },

  updateProfile: async (data) => {
    const response = await apiFetch('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    const user = response.user || response.data?.user || response.data;
    if (user) setUser(user);
    return response;
  },

  isAuthenticated: () => !!getToken(),

  getCurrentUser: getUser,
};

export const publicAPI = {
  getLanding: () => apiFetch('/public/landing'),
  getPlans: () => apiFetch('/public/plans'),
  getMySubscription: () => apiFetch('/public/subscriptions/me'),
  createSubscription: (planCode) => apiFetch('/public/subscriptions', {
    method: 'POST',
    body: JSON.stringify({ planCode }),
  }),
  createSubscriptionPayment: (subscriptionId, paymentMethod = 'clicknpay', customer = {}) => apiFetch(`/public/subscriptions/${subscriptionId}/payment`, {
    method: 'POST',
    body: JSON.stringify({ paymentMethod, customer }),
  }),
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

  createWithPayment: (bookingData) => apiFetch('/bookings/create-with-payment', {
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
    const normalizedTrackingId = String(trackingId || '').trim();
    const response = await fetch(`${API_BASE_URL}/tracking/public/${encodeURIComponent(normalizedTrackingId)}`);
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

  startCheckout: (paymentReference, customer = {}) => apiFetch('/payments/initiate', {
    method: 'POST',
    body: JSON.stringify({ paymentReference, customer }),
  }),

  verify: (reference) => apiFetch(`/payments/status/${reference}`),
};

export const subscriptionCheckoutAPI = {
  start: async (subscription, customer = {}) => {
    const subscriptionId = subscription?._id || subscription?.id;
    const amount = Number(subscription?.amount || subscription?.plan?.price || 0);
    const paymentStatus = subscription?.payment?.status;

    if (!subscriptionId || amount <= 0 || paymentStatus === 'paid' || paymentStatus === 'not_required') {
      return false;
    }

    const currentUser = authAPI.getCurrentUser() || {};
    const payer = {
      email: customer.email || currentUser.email || '',
      phone: customer.phone || currentUser.phone || ''
    };
    const paymentResponse = await publicAPI.createSubscriptionPayment(subscriptionId, 'clicknpay', payer);
    const payment = paymentResponse.data || {};

    if (!payment.paymentRequired) {
      return false;
    }

    const checkout = await paymentsAPI.startCheckout(payment.paymentReference, payer);
    const redirectUrl = checkout.data?.redirectUrl;

    if (!redirectUrl) {
      throw new Error('Payment was created, but no checkout link was returned.');
    }

    sessionStorage.setItem('palmtrent_pending_payment_reference', payment.paymentReference);
    sessionStorage.setItem('palmtrent_pending_payment_context', 'subscription');
    sessionStorage.setItem('palmtrent_pending_subscription_name', subscription?.plan?.name || 'Subscription');
    window.location.href = redirectUrl;
    return true;
  },
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

// Shipments API
export const shipmentsAPI = {
  getPODDocument: (shipmentId) => apiFetch(`/shipments/${shipmentId}/proof-of-delivery/document`),

  emailPODDocument: (shipmentId, email) => apiFetch(`/shipments/${shipmentId}/proof-of-delivery/email`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  }),
};

// Vehicles API
export const vehiclesAPI = {
  getMine: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/vehicles${queryString ? `?${queryString}` : ''}`);
  },

  create: (data) => apiFetch('/vehicles', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id, data) => apiFetch(`/vehicles/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  updateStatus: (id, status) => apiFetch(`/vehicles/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),

  updateRentalSettings: (id, data) => apiFetch(`/vehicles/${id}/rental-settings`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  assignDriver: (id, driverId) => apiFetch(`/vehicles/${id}/assign-driver`, {
    method: 'POST',
    body: JSON.stringify({ driverId }),
  }),

  getTypes: () => apiFetch('/reference/vehicle-types'),

  getMakes: () => apiFetch('/reference/vehicle-makes'),

  getModels: (makeId) => apiFetch(`/reference/vehicle-makes/${makeId}/models`),
};

// Trailer owner / fleet rental API
export const fleetAPI = {
  getDashboard: () => apiFetch('/trailer-owner/dashboard-stats'),

  addMaintenance: (assetId, data) => apiFetch(`/trailers/${assetId}/maintenance`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getAsset: (assetId) => apiFetch(`/trailers/${assetId}`),

  getStaff: () => apiFetch('/trailer-owner/staff'),

  createStaff: (data) => apiFetch('/trailer-owner/staff', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

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

  createWalkInRental: (data) => apiFetch('/rentals/walk-in', {
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

  uploadRentalInspectionPhoto: (file, rentalId, inspectionType) => {
    const formData = new FormData();
    formData.append('file', file);
    if (rentalId) formData.append('rentalId', rentalId);
    if (inspectionType) formData.append('inspectionType', inspectionType);
    return apiFetch('/uploads/rental-inspections', {
      method: 'POST',
      body: formData,
      timeoutMs: 60000,
    });
  },
};

export const driversAPI = {
  getAll: (params = {}) => {
    const queryString = typeof params === 'string' ? params : new URLSearchParams(params).toString();
    return apiFetch(`/drivers${queryString ? `?${queryString}` : ''}`);
  },

  searchMarketplace: (params = {}) => {
    const queryString = typeof params === 'string' ? params : new URLSearchParams(params).toString();
    return apiFetch(`/drivers/marketplace${queryString ? `?${queryString}` : ''}`);
  },

  getMyProfile: () => apiFetch('/drivers/me'),

  updateMyProfile: (data) => apiFetch('/drivers/me', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  updateMyAvailability: (data) => apiFetch('/drivers/me/availability', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  create: (data) => apiFetch('/drivers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  update: (id, data) => apiFetch(`/drivers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  delete: (id) => apiFetch(`/drivers/${id}`, {
    method: 'DELETE',
  }),

  updateStatus: (id, status) => apiFetch(`/drivers/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  }),

  invite: (id) => apiFetch(`/drivers/${id}/invite`, {
    method: 'POST',
  }),
};

// Reference Data API
export const referenceAPI = {
  getAll: () => apiFetch('/reference/all'),

  getCargoTypes: () => apiFetch('/reference/cargo-types'),

  getInsuranceOptions: () => apiFetch('/reference/insurance-options'),

  getInsuranceQuotes: (quoteData) => apiFetch('/reference/insurance-quotes', {
    method: 'POST',
    body: JSON.stringify(quoteData),
  }),

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

  getReportSchedules: () => apiFetch('/corporate/report-schedules'),

  saveReportSchedule: (data) => apiFetch('/corporate/report-schedules', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateReportSchedule: (id, data) => apiFetch(`/corporate/report-schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  getInvoices: () => apiFetch('/corporate/invoices'),

  getInvoiceById: (id) => apiFetch(`/corporate/invoices/${id}`),

  downloadInvoice: async (id) => {
    const response = await fetch(`${API_BASE_URL}/corporate/invoices/${id}/download`, {
      headers: authHeaders(),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.message || 'Unable to download invoice');
    }

    return response.blob();
  },

  getUsers: () => apiFetch('/corporate/users'),

  inviteUser: (data) => apiFetch('/corporate/users/invite', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateUser: (userId, data) => apiFetch(`/corporate/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  removeUser: (userId) => apiFetch(`/corporate/users/${userId}`, {
    method: 'DELETE',
  }),

  getBillingInfo: () => apiFetch('/corporate/billing'),

  updateBillingInfo: (data) => apiFetch('/corporate/billing', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  addPaymentMethod: (data) => apiFetch('/corporate/payment-methods', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  getApiAccess: () => apiFetch('/corporate/api-access'),

  regenerateApiKey: () => apiFetch('/corporate/api-access/regenerate', {
    method: 'POST',
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

  getDashboardStats: () => apiFetch('/shipper/dashboard-stats'),

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
  getDashboardStats: (range) => apiFetch(`/admin/dashboard${range ? `?range=${range}` : ''}`),

  getUsers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/users${queryString ? `?${queryString}` : ''}`);
  },

  getUserById: (id) => apiFetch(`/admin/users/${id}`),

  createUser: (data) => apiFetch('/admin/users', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateUser: (id, data) => apiFetch(`/admin/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  verifyUser: (id, data) => apiFetch(`/admin/users/${id}/verify`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  verifyVehicle: (id, data) => apiFetch(`/admin/vehicles/${id}/verify`, {
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

  confirmPayment: (id, note = '') => apiFetch(`/admin/payments/${id}/confirm`, {
    method: 'POST',
    body: JSON.stringify({ note }),
  }),

  reconcileEcocashAgentPayments: (payload = {}) => apiFetch('/payments/ecocash-agent/reconcile-admin', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  verifyAgentPayment: (payload = {}) => apiFetch('/payments/verify-agent', {
    method: 'POST',
    body: JSON.stringify(payload),
  }),

  getAuditLogs: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/audit-logs${queryString ? `?${queryString}` : ''}`);
  },

  getPreferences: () => apiFetch('/admin/preferences'),

  updatePreferences: (data) => apiFetch('/admin/preferences', {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  seedReferenceData: () => apiFetch('/admin/seed/reference-data', {
    method: 'POST',
    timeoutMs: 60000,
  }),

  seedVehicleModels: () => apiFetch('/admin/seed/vehicle-models', {
    method: 'POST',
    timeoutMs: 60000,
  }),

  getSeedJob: (jobId) => apiFetch(`/admin/seed/jobs/${jobId}`, {
    timeoutMs: 60000,
  }),

  getRentals: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/admin/rentals${queryString ? `?${queryString}` : ''}`);
  },

  confirmRentalPayment: (id, data = {}) => apiFetch(`/admin/rentals/${id}/confirm-payment`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  cancelRental: (id, data = {}) => apiFetch(`/admin/rentals/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  extendRental: (id, data = {}) => apiFetch(`/admin/rentals/${id}/extend`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  disputeRental: (id, data = {}) => apiFetch(`/admin/rentals/${id}/dispute`, {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  settleRental: (id) => apiFetch(`/admin/rentals/${id}/settle`, {
    method: 'POST',
  }),

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

  getEmergencies: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/emergency/admin/list${queryString ? `?${queryString}` : ''}`);
  },

  acknowledgeEmergency: (id) => apiFetch(`/emergency/${id}/acknowledge`, {
    method: 'PUT',
  }),

  dispatchEmergencyResponder: (id, data) => apiFetch(`/emergency/${id}/dispatch`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  resolveEmergency: (id, data) => apiFetch(`/emergency/${id}/resolve`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  acceptEmergencyQuote: (id, responderId) => apiFetch(`/emergency/${id}/quotes/${responderId}/accept`, {
    method: 'PUT',
    body: JSON.stringify({}),
  }),

  rejectEmergencyQuote: (id, responderId, reason = '') => apiFetch(`/emergency/${id}/quotes/${responderId}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  }),

  getEmergencyResponders: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/emergency/admin/responders${queryString ? `?${queryString}` : ''}`);
  },

  verifyEmergencyResponder: (id, data) => apiFetch(`/emergency/admin/responders/${id}/verify`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  getMonetization: () => apiFetch('/admin/monetization'),

  savePlan: (data) => apiFetch('/admin/monetization/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updatePlan: (id, data) => apiFetch(`/admin/monetization/plans/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  saveCommissionRule: (data) => apiFetch('/admin/monetization/commission-rules', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateCommissionRule: (id, data) => apiFetch(`/admin/monetization/commission-rules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  createSubscription: (data) => apiFetch('/admin/monetization/subscriptions', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateSubscription: (id, data) => apiFetch(`/admin/monetization/subscriptions/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  createPayout: (data) => apiFetch('/admin/monetization/payouts', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updatePayout: (id, data) => apiFetch(`/admin/monetization/payouts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  getInsuranceProviders: () => apiFetch('/admin/insurance/providers'),

  createInsuranceProvider: (data) => apiFetch('/admin/insurance/providers', {
    method: 'POST',
    body: JSON.stringify(data),
  }),

  updateInsuranceProvider: (id, data) => apiFetch(`/admin/insurance/providers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  getSupportTickets: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiFetch(`/support/tickets${queryString ? `?${queryString}` : ''}`);
  },

  updateSupportTicket: (id, data) => apiFetch(`/support/tickets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),

  replyToSupportTicket: (id, message, internal = false) => apiFetch(`/support/tickets/${id}/replies`, {
    method: 'POST',
    body: JSON.stringify({ message, internal }),
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

// Bus/depot courier API
export const courierAPI = {
  getDepots: () => apiFetch('/courier/depots'),
  createDepot: (data) => apiFetch('/courier/depots', { method: 'POST', body: JSON.stringify(data) }),
  quote: (data) => apiFetch('/courier/quote', { method: 'POST', body: JSON.stringify(data) }),
  listShipments: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiFetch(`/courier/shipments${q ? `?${q}` : ''}`);
  },
  getShipment: (id) => apiFetch(`/courier/shipments/${id}`),
  createShipment: (data) => apiFetch('/courier/shipments', { method: 'POST', body: JSON.stringify(data) }),
  getZpl: (id, copies) => apiFetch(`/courier/shipments/${id}/zpl${copies ? `?copies=${copies}` : ''}`),
  printZpl: (id, data) => apiFetch(`/courier/shipments/${id}/zpl/print`, { method: 'POST', body: JSON.stringify(data) }),
  load: (id, data = {}) => apiFetch(`/courier/shipments/${id}/load`, { method: 'POST', body: JSON.stringify(data) }),
  depart: (id, data = {}) => apiFetch(`/courier/shipments/${id}/depart`, { method: 'POST', body: JSON.stringify(data) }),
  arrive: (id, data = {}) => apiFetch(`/courier/shipments/${id}/arrive`, { method: 'POST', body: JSON.stringify(data) }),
  collect: (id, data) => apiFetch(`/courier/shipments/${id}/collect`, { method: 'POST', body: JSON.stringify(data) }),
  cancel: (id, data = {}) => apiFetch(`/courier/shipments/${id}/cancel`, { method: 'POST', body: JSON.stringify(data) }),
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
  drivers: driversAPI,
  reference: referenceAPI,
  corporate: corporateAPI,
  shipper: shipperAPI,
  admin: adminAPI,
  public: publicAPI,
  notifications: notificationsAPI,
  courier: courierAPI,
};
