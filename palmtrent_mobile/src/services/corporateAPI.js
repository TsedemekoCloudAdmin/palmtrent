import apiService from './apiService';

export const corporateAPI = {
  // Profile management
  getProfile: async () => {
    return apiService.request('/corporate/profile');
  },

  updateProfile: async (profileData) => {
    return apiService.request('/corporate/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  },

  // Invoices
  getInvoices: async (filters = {}) => {
    const { startDate, endDate, status, page = 1, limit = 10 } = filters;
    
    let url = `/corporate/invoices?page=${page}&limit=${limit}`;
    const params = new URLSearchParams();
    
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (status) params.append('status', status);
    
    if (params.toString()) {
      url += `&${params.toString()}`;
    }
    
    return apiService.request(url);
  },

  getInvoiceById: async (id) => {
    return apiService.request(`/corporate/invoices/${id}`);
  },

  downloadInvoice: async (id) => {
    return apiService.request(`/corporate/invoices/${id}/download`);
  },

  // Analytics
  getAnalytics: async (period = 'month') => {
    return apiService.request(`/corporate/analytics?period=${period}`);
  },

  getDashboardStats: async () => {
    return apiService.request('/corporate/dashboard-stats');
  },

  // User management
  getUsers: async () => {
    return apiService.request('/corporate/users');
  },

  inviteUser: async (userData) => {
    return apiService.request('/corporate/users/invite', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  updateUser: async (userId, userData) => {
    return apiService.request(`/corporate/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  },

  removeUser: async (userId) => {
    return apiService.request(`/corporate/users/${userId}`, {
      method: 'DELETE',
    });
  },

  // Billing
  getBillingInfo: async () => {
    return apiService.request('/corporate/billing');
  },

  updateBillingInfo: async (billingData) => {
    return apiService.request('/corporate/billing', {
      method: 'PUT',
      body: JSON.stringify(billingData),
    });
  },

  getPaymentMethods: async () => {
    return apiService.request('/corporate/payment-methods');
  },

  addPaymentMethod: async (paymentData) => {
    return apiService.request('/corporate/payment-methods', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }
};