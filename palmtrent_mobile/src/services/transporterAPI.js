import apiService from './apiService';

export const transporterAPI = {
  // Available jobs
  getAvailableJobs: async (filters = {}) => {
    const { page = 1, limit = 10, vehicleType, maxDistance, minPrice } = filters;
    
    let url = `/bookings/jobs/available?page=${page}&limit=${limit}`;
    const params = new URLSearchParams();
    
    if (vehicleType) params.append('vehicleType', vehicleType);
    if (maxDistance) params.append('maxDistance', maxDistance);
    if (minPrice) params.append('minPrice', minPrice);
    
    if (params.toString()) {
      url += `&${params.toString()}`;
    }
    
    return apiService.request(url);
  },

  // Job actions
  acceptJob: async (shipmentId) => {
    return apiService.request(`/bookings/jobs/${shipmentId}/accept`, {
      method: 'POST',
    });
  },

  rejectJob: async (shipmentId, reason = '') => {
    return apiService.request(`/bookings/jobs/${shipmentId}/decline`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Earnings
  getEarnings: async (period = 'month') => {
    return apiService.request(`/transporter/earnings?period=${period}`);
  },

  getEarningStats: async () => {
    return apiService.request('/transporter/earnings/stats');
  },

  // Performance
  getPerformance: async () => {
    return apiService.request('/transporter/performance');
  },

  // Vehicle management
  getVehicles: async () => {
    return apiService.request('/transporter/vehicles');
  },

  addVehicle: async (vehicleData) => {
    return apiService.request('/transporter/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicleData),
    });
  },

  updateVehicle: async (vehicleId, vehicleData) => {
    return apiService.request(`/transporter/vehicles/${vehicleId}`, {
      method: 'PUT',
      body: JSON.stringify(vehicleData),
    });
  },

  updateVehicleStatus: async (vehicleId, status) => {
    return apiService.request(`/transporter/vehicles/${vehicleId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }
};
