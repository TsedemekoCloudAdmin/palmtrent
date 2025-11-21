import apiService from './apiService';

export const shipmentAPI = {
  // Get all shipments with filtering
  getAllShipments: async (filters = {}) => {
    const { page = 1, limit = 10, status, dateFrom, dateTo } = filters;
    
    let url = `/shipments?page=${page}&limit=${limit}`;
    const params = new URLSearchParams();
    
    if (status) params.append('status', status);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    
    if (params.toString()) {
      url += `&${params.toString()}`;
    }
    
    return apiService.request(url);
  },

  // Get active shipments
  getActiveShipments: async () => {
    return apiService.request('/shipments/active');
  },

  // Get shipment by ID
  getShipmentById: async (id) => {
    return apiService.request(`/shipments/${id}`);
  },

  // Track shipment
  trackShipment: async (id) => {
    return apiService.request(`/shipments/${id}/track`);
  },

  // Create shipment
  createShipment: async (shipmentData) => {
    return apiService.request('/shipments', {
      method: 'POST',
      body: JSON.stringify(shipmentData),
    });
  },

  // Update location (for transporters)
  updateLocation: async (id, latitude, longitude, note = '') => {
    return apiService.request(`/shipments/${id}/location`, {
      method: 'PUT',
      body: JSON.stringify({ latitude, longitude, note }),
    });
  },

  // Update status (for transporters)
  updateStatus: async (id, status, notes = '') => {
    return apiService.request(`/shipments/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, notes }),
    });
  },

  // Upload proof of delivery
  uploadProofOfDelivery: async (id, formData) => {
    return apiService.uploadRequest(`/shipments/${id}/proof-of-delivery`, formData);
  },

  // Rate shipment
  rateShipment: async (id, rating, review = '') => {
    return apiService.request(`/shipments/${id}/rate`, {
      method: 'POST',
      body: JSON.stringify({ rating, review }),
    });
  },

  // Get shipment analytics
  getAnalytics: async (period = 'month') => {
    return apiService.request(`/shipments/analytics?period=${period}`);
  }
};