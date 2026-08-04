// src/services/locationService.js
// Location service using Mapbox API through backend
import * as Location from 'expo-location';
import apiService from './apiService';

export const locationService = {
  /**
   * Get current location using device GPS (Expo Location)
   * @returns {Promise<{latitude: number, longitude: number, accuracy: number}>}
   */
  getCurrentLocation: async () => {
    try {
      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      // Get current position with high accuracy
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        timeout: 15000,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        altitude: location.coords.altitude,
        heading: location.coords.heading,
        speed: location.coords.speed,
        timestamp: location.timestamp,
      };
    } catch (error) {
      console.error('Location error:', error);
      throw new Error(`Failed to get location: ${error.message}`);
    }
  },

  /**
   * Get the device's current position and the street address it maps to.
   * Used to pre-fill the pickup address when the booking form opens.
   *
   * @returns {Promise<{latitude: number, longitude: number, address: string, isCoordinateOnly: boolean}>}
   */
  getCurrentLocationWithAddress: async () => {
    const enabled = await locationService.isLocationEnabled();
    if (!enabled) {
      throw new Error('Location services are turned off on this device.');
    }

    const granted = await locationService.requestPermission();
    if (!granted) {
      throw new Error('Location permission was not granted.');
    }

    const position = await locationService.getCurrentLocation();
    const place = await locationService.reverseGeocode(position.latitude, position.longitude);
    const address = place.fullAddress || place.address || '';

    return {
      ...position,
      address,
      city: place.city,
      country: place.country,
      // reverseGeocode falls back to a raw "lat, lng" string when no provider
      // could name the place — the coordinates are still good, the label isn't.
      isCoordinateOnly: /^-?\d+\.\d+,\s*-?\d+\.\d+$/.test(address.trim()),
    };
  },

  /**
   * Watch location changes (for live tracking)
   * @param {function} callback - Called with location updates
   * @param {object} options - Watch options
   * @returns {Promise<object>} - Location subscription to remove later
   */
  watchLocation: async (callback, options = {}) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission not granted');
      }

      const subscription = await Location.watchPositionAsync(
        {
          accuracy: options.accuracy || Location.Accuracy.High,
          distanceInterval: options.distanceInterval || 10, // meters
          timeInterval: options.timeInterval || 5000, // milliseconds
        },
        (location) => {
          callback({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy,
            heading: location.coords.heading,
            speed: location.coords.speed,
            timestamp: location.timestamp,
          });
        }
      );

      return subscription;
    } catch (error) {
      console.error('Watch location error:', error);
      throw error;
    }
  },

  /**
   * Stop watching location
   * @param {object} subscription - Location subscription to remove
   */
  stopWatchingLocation: (subscription) => {
    if (subscription && subscription.remove) {
      subscription.remove();
    }
  },

  /**
   * Reverse geocoding - get address from coordinates (using Mapbox via backend)
   * @param {number} latitude
   * @param {number} longitude
   * @returns {Promise<object>}
   */
  reverseGeocode: async (latitude, longitude) => {
    try {
      const response = await apiService.request(
        `/routes/reverse-geocode?lat=${latitude}&lng=${longitude}`
      );

      if (response.success) {
        return {
          address: response.data.address,
          placeName: response.data.placeName,
          city: response.data.city,
          region: response.data.region,
          country: response.data.country,
          countryCode: response.data.countryCode,
          fullAddress: response.data.address,
          source: response.data.source,
        };
      }

      throw new Error('Reverse geocode failed');
    } catch (error) {
      console.error('Reverse geocode error:', error);
      // Fallback
      return {
        address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
        city: 'Unknown',
        country: 'Unknown',
        fullAddress: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      };
    }
  },

  /**
   * Geocode - get coordinates from address (using Mapbox via backend)
   * @param {string} address
   * @returns {Promise<object>}
   */
  geocode: async (address) => {
    try {
      const response = await apiService.request(
        `/routes/geocode?address=${encodeURIComponent(address)}`
      );

      if (response.success) {
        return {
          // The full canonical address returned by Mapbox (e.g. place_name)
          address: response.data.address || response.data.placeName || address,
          placeName: response.data.placeName,
          coordinates: response.data.coordinates,
          context: response.data.context,
          allResults: response.data.allResults,
          source: response.data.source,
        };
      }

      throw new Error('Geocode failed');
    } catch (error) {
      console.error('Geocode error:', error);
      throw error;
    }
  },

  /**
   * Calculate distance and route between two points (using Mapbox via backend)
   * @param {string} pickupLocation - Pickup address
   * @param {string} deliveryLocation - Delivery address
   * @param {object} pickupCoords - Optional pickup coordinates {lat, lng}
   * @param {object} deliveryCoords - Optional delivery coordinates {lat, lng}
   * @returns {Promise<object>}
   */
  calculateRoute: async (pickupLocation, deliveryLocation, pickupCoords = null, deliveryCoords = null) => {
    try {
      const response = await apiService.request('/routes/calculate', {
        method: 'POST',
        body: JSON.stringify({
          pickupLocation,
          deliveryLocation,
          pickupCoords,
          deliveryCoords,
        }),
      });

      if (response.success) {
        return {
          distance: response.data.distance,
          distanceText: response.data.distanceText,
          duration: response.data.duration,
          durationMinutes: response.data.durationMinutes,
          route: response.data.route,
          coordinates: response.data.coordinates,
          geometry: response.data.geometry, // GeoJSON for map display
          legs: response.data.legs, // Turn-by-turn directions
          source: response.data.source,
          note: response.data.note,
        };
      }

      throw new Error('Route calculation failed');
    } catch (error) {
      console.error('Route calculation error:', error);
      // Fallback to basic estimate
      return {
        distance: 200,
        distanceText: '~200 km',
        duration: '3-4 hours',
        durationMinutes: 210,
        route: `${pickupLocation} → ${deliveryLocation}`,
        source: 'estimated',
        note: 'Distance could not be calculated accurately. Please verify.',
      };
    }
  },

  /**
   * Search locations / autocomplete (using Mapbox via backend)
   * Returns the full place_name (e.g. "19 Mashingwe, New Mabvuku, Harare, Zimbabwe")
   * including street-level results, not just city/suburb names.
   */
  searchLocations: async (query) => {
    try {
      if (!query || query.length < 2) {
        return [];
      }

      const response = await apiService.request(
        `/routes/search?query=${encodeURIComponent(query)}`
      );

      if (response.success) {
        return response.data.map((loc) => ({
          id: loc.id || `${loc.lat}_${loc.lng}`,
          // Use the full place name so "19 Mashingwe, New Mabvuku, Harare, Zimbabwe"
          // is preserved exactly — never truncated to just the suburb or city.
          address: loc.address || loc.placeName || loc.name || '',
          fullAddress: loc.address || loc.placeName || '',
          city: loc.city || loc.context?.city || '',
          latitude: loc.lat ?? loc.coordinates?.latitude,
          longitude: loc.lng ?? loc.coordinates?.longitude,
          type: loc.type,
          // 'exact' | 'street' | 'area' — how precisely this could be mapped.
          precision: loc.precision,
          approximate: Boolean(loc.approximate),
          source: loc.source,
        }));
      }

      return [];
    } catch (error) {
      console.error('Location search error:', error);
      return [];
    }
  },

  /**
   * Optimize route for multiple stops (using Mapbox via backend)
   * @param {object} origin - Starting point {latitude, longitude}
   * @param {array} stops - Array of stops [{latitude, longitude}, ...]
   * @param {object} options - Optimization options
   * @returns {Promise<object>}
   */
  optimizeRoute: async (origin, stops, options = {}) => {
    try {
      const response = await apiService.request('/routes/optimize', {
        method: 'POST',
        body: JSON.stringify({
          origin: { latitude: origin.latitude, longitude: origin.longitude },
          stops: stops.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
          options,
        }),
      });

      if (response.success) {
        return {
          optimizedOrder: response.data.optimizedOrder,
          distance: response.data.distance,
          duration: response.data.duration,
          geometry: response.data.geometry,
          legs: response.data.legs,
        };
      }

      throw new Error('Route optimization failed');
    } catch (error) {
      console.error('Route optimization error:', error);
      throw error;
    }
  },

  /**
   * Get distance matrix between multiple points (using Mapbox via backend)
   * @param {array} origins - Array of origin coordinates
   * @param {array} destinations - Array of destination coordinates
   * @returns {Promise<object>}
   */
  getDistanceMatrix: async (origins, destinations) => {
    try {
      const response = await apiService.request('/routes/distance-matrix', {
        method: 'POST',
        body: JSON.stringify({
          origins: origins.map((o) => ({ latitude: o.latitude, longitude: o.longitude })),
          destinations: destinations.map((d) => ({ latitude: d.latitude, longitude: d.longitude })),
        }),
      });

      if (response.success) {
        return response.data;
      }

      throw new Error('Distance matrix calculation failed');
    } catch (error) {
      console.error('Distance matrix error:', error);
      throw error;
    }
  },

  /**
   * Check if location services are enabled
   * @returns {Promise<boolean>}
   */
  isLocationEnabled: async () => {
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      return enabled;
    } catch (error) {
      console.error('Check location enabled error:', error);
      return false;
    }
  },

  /**
   * Get location permission status
   * @returns {Promise<string>}
   */
  getPermissionStatus: async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status;
    } catch (error) {
      console.error('Get permission status error:', error);
      return 'undetermined';
    }
  },

  /**
   * Request location permission
   * @returns {Promise<boolean>}
   */
  requestPermission: async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Request permission error:', error);
      return false;
    }
  },

  /**
   * Request background location permission (for live tracking)
   * @returns {Promise<boolean>}
   */
  requestBackgroundPermission: async () => {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Request background permission error:', error);
      return false;
    }
  },
};

export default locationService;