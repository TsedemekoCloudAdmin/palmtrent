import apiService from './apiService';

export const bookingAPI = {
  // Get all bookings with filtering
  getAllBookings: async (filters = {}) => {
    const { page = 1, limit = 10, status, bookingType, dateFrom, dateTo } = filters;
    
    let url = `/bookings?page=${page}&limit=${limit}`;
    const params = new URLSearchParams();
    
    if (status) params.append('status', status);
    if (bookingType) params.append('bookingType', bookingType);
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    
    if (params.toString()) {
      url += `&${params.toString()}`;
    }
    
    return apiService.request(url);
  },

  // Get booking by ID
  getBookingById: async (id) => {
    return apiService.request(`/bookings/${id}`);
  },

  // Create new booking
  createBooking: async (bookingData) => {
    return apiService.request('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  },

  // Update booking
  updateBooking: async (id, bookingData) => {
    return apiService.request(`/bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(bookingData),
    });
  },

  // Confirm booking (move to payment)
  confirmBooking: async (id) => {
    return apiService.request(`/bookings/${id}/confirm-booking`, {
      method: 'POST',
    });
  },

  // Confirm payment
  confirmPayment: async (id, paymentData) => {
    return apiService.request(`/bookings/${id}/confirm-payment`, {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  },

  // Cancel booking
  cancelBooking: async (id, reason) => {
    return apiService.request(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Calculate pricing
  calculatePricing: async (bookingData) => {
    return apiService.request('/bookings/calculate-pricing', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    });
  },

  // Get booking statistics
  getStats: async (period = 'month') => {
    return apiService.request(`/bookings/stats?period=${period}`);
  }
};
