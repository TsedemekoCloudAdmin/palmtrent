import apiService from './apiService';
import { shipmentAPI } from './shipmentAPI';
import { bookingAPI } from './bookingAPI';
import { corporateAPI } from './corporateAPI';
import { transporterAPI } from './transporterAPI';

// Export all API modules
export {
  shipmentAPI,
  bookingAPI,
  corporateAPI,
  transporterAPI
};

// Export the main apiService instance
export default apiService;