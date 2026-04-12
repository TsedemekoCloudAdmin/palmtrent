/**
 * Mapbox Service
 *
 * Provides location services including:
 * - Geocoding (address to coordinates)
 * - Reverse geocoding (coordinates to address)
 * - Route calculation with distance and duration
 * - Location search/autocomplete
 *
 * Falls back to estimate-based calculations when Mapbox is not configured.
 */

// Try to load Mapbox SDK - gracefully handle if not installed
let mbxGeocoding = null;
let mbxDirections = null;
let mbxOptimization = null;
let mapboxAvailable = false;

try {
  mbxGeocoding = require('@mapbox/mapbox-sdk/services/geocoding');
  mbxDirections = require('@mapbox/mapbox-sdk/services/directions');
  mbxOptimization = require('@mapbox/mapbox-sdk/services/optimization');
  mapboxAvailable = true;
} catch (error) {
  console.warn('Mapbox SDK not installed. Running in fallback mode.');
  console.warn('To enable Mapbox, run: npm install @mapbox/mapbox-sdk');
}

// Initialize Mapbox clients
const MAPBOX_ACCESS_TOKEN = process.env.MAPBOX_ACCESS_TOKEN;

let geocodingClient = null;
let directionsClient = null;
let optimizationClient = null;

const initializeClients = () => {
  if (!mapboxAvailable) {
    console.warn('Mapbox SDK not available. Using fallback location services.');
    return false;
  }

  if (!MAPBOX_ACCESS_TOKEN || MAPBOX_ACCESS_TOKEN === 'your_mapbox_access_token') {
    console.warn('MAPBOX_ACCESS_TOKEN not set or using placeholder. Mapbox services will use fallback mode.');
    console.warn('Get a free token at: https://account.mapbox.com/access-tokens/');
    return false;
  }

  try {
    geocodingClient = mbxGeocoding({ accessToken: MAPBOX_ACCESS_TOKEN });
    directionsClient = mbxDirections({ accessToken: MAPBOX_ACCESS_TOKEN });
    optimizationClient = mbxOptimization({ accessToken: MAPBOX_ACCESS_TOKEN });
    console.log('Mapbox services initialized successfully.');
    return true;
  } catch (error) {
    console.error('Failed to initialize Mapbox clients:', error.message);
    return false;
  }
};

// Initialize on module load
const isInitialized = initializeClients();

/**
 * Geocode an address to coordinates
 * @param {string} address - The address to geocode
 * @param {object} options - Additional options
 * @returns {Promise<object>} - Geocoded location with coordinates
 */
const geocode = async (address, options = {}) => {
  if (!isInitialized) {
    return getFallbackGeocode(address);
  }

  try {
    const response = await geocodingClient.forwardGeocode({
      query: address,
      countries: options.countries || ['ZW', 'ZA', 'BW', 'ZM', 'MZ', 'NA'], // Zimbabwe and neighboring countries
      limit: options.limit || 5,
      types: options.types || ['address', 'place', 'locality', 'neighborhood', 'poi'],
      language: ['en']
    }).send();

    if (response.body.features && response.body.features.length > 0) {
      const feature = response.body.features[0];
      return {
        success: true,
        data: {
          coordinates: {
            longitude: feature.center[0],
            latitude: feature.center[1]
          },
          address: feature.place_name,
          placeName: feature.text,
          context: parseContext(feature.context),
          relevance: feature.relevance,
          allResults: response.body.features.map(f => ({
            coordinates: { longitude: f.center[0], latitude: f.center[1] },
            address: f.place_name,
            placeName: f.text,
            relevance: f.relevance
          }))
        }
      };
    }

    return {
      success: false,
      message: 'No results found for the given address'
    };
  } catch (error) {
    console.error('Geocoding error:', error);
    return {
      success: false,
      message: 'Geocoding failed',
      error: error.message
    };
  }
};

/**
 * Reverse geocode coordinates to an address
 * @param {number} latitude - Latitude
 * @param {number} longitude - Longitude
 * @returns {Promise<object>} - Address information
 */
const reverseGeocode = async (latitude, longitude) => {
  if (!isInitialized) {
    return getFallbackReverseGeocode(latitude, longitude);
  }

  try {
    const response = await geocodingClient.reverseGeocode({
      query: [longitude, latitude],
      types: ['address', 'place', 'locality', 'neighborhood'],
      language: ['en']
    }).send();

    if (response.body.features && response.body.features.length > 0) {
      const feature = response.body.features[0];
      return {
        success: true,
        data: {
          address: feature.place_name,
          placeName: feature.text,
          coordinates: {
            longitude: feature.center[0],
            latitude: feature.center[1]
          },
          context: parseContext(feature.context)
        }
      };
    }

    return {
      success: false,
      message: 'No address found for the given coordinates'
    };
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    return {
      success: false,
      message: 'Reverse geocoding failed',
      error: error.message
    };
  }
};

/**
 * Calculate route between two or more points
 * @param {object} origin - Origin coordinates { latitude, longitude }
 * @param {object} destination - Destination coordinates { latitude, longitude }
 * @param {array} waypoints - Optional waypoints
 * @param {object} options - Route options
 * @returns {Promise<object>} - Route information with distance and duration
 */
const calculateRoute = async (origin, destination, waypoints = [], options = {}) => {
  if (!isInitialized) {
    return getFallbackRoute(origin, destination);
  }

  try {
    // Build coordinates array
    const coordinates = [
      { coordinates: [origin.longitude, origin.latitude] },
      ...waypoints.map(wp => ({ coordinates: [wp.longitude, wp.latitude] })),
      { coordinates: [destination.longitude, destination.latitude] }
    ];

    const response = await directionsClient.getDirections({
      profile: options.profile || 'driving-traffic', // driving, driving-traffic, walking, cycling
      waypoints: coordinates,
      geometries: 'geojson',
      overview: options.overview || 'full',
      steps: options.steps !== false,
      annotations: ['duration', 'distance', 'speed'],
      language: 'en'
    }).send();

    if (response.body.routes && response.body.routes.length > 0) {
      const route = response.body.routes[0];

      return {
        success: true,
        data: {
          distance: {
            meters: route.distance,
            kilometers: (route.distance / 1000).toFixed(2),
            miles: (route.distance / 1609.34).toFixed(2)
          },
          duration: {
            seconds: route.duration,
            minutes: Math.round(route.duration / 60),
            hours: (route.duration / 3600).toFixed(2),
            formatted: formatDuration(route.duration)
          },
          geometry: route.geometry,
          legs: route.legs.map(leg => ({
            distance: leg.distance,
            duration: leg.duration,
            summary: leg.summary,
            steps: leg.steps?.map(step => ({
              instruction: step.maneuver?.instruction,
              distance: step.distance,
              duration: step.duration,
              name: step.name
            }))
          })),
          trafficDuration: route.duration_typical || route.duration,
          alternatives: response.body.routes.slice(1).map(alt => ({
            distance: alt.distance,
            duration: alt.duration
          }))
        }
      };
    }

    return {
      success: false,
      message: 'No route found between the given points'
    };
  } catch (error) {
    console.error('Route calculation error:', error);
    return {
      success: false,
      message: 'Route calculation failed',
      error: error.message
    };
  }
};

/**
 * Calculate route from addresses (geocodes first, then calculates route)
 * @param {string} originAddress - Origin address
 * @param {string} destinationAddress - Destination address
 * @param {array} waypointAddresses - Optional waypoint addresses
 * @returns {Promise<object>} - Complete route information
 */
const calculateRouteFromAddresses = async (originAddress, destinationAddress, waypointAddresses = []) => {
  try {
    // Geocode origin
    const originResult = await geocode(originAddress);
    if (!originResult.success) {
      return { success: false, message: `Could not find origin address: ${originAddress}` };
    }

    // Geocode destination
    const destinationResult = await geocode(destinationAddress);
    if (!destinationResult.success) {
      return { success: false, message: `Could not find destination address: ${destinationAddress}` };
    }

    // Geocode waypoints if any
    const waypoints = [];
    for (const address of waypointAddresses) {
      const wpResult = await geocode(address);
      if (wpResult.success) {
        waypoints.push({
          latitude: wpResult.data.coordinates.latitude,
          longitude: wpResult.data.coordinates.longitude,
          address: wpResult.data.address
        });
      }
    }

    // Calculate route
    const routeResult = await calculateRoute(
      {
        latitude: originResult.data.coordinates.latitude,
        longitude: originResult.data.coordinates.longitude
      },
      {
        latitude: destinationResult.data.coordinates.latitude,
        longitude: destinationResult.data.coordinates.longitude
      },
      waypoints
    );

    if (!routeResult.success) {
      return routeResult;
    }

    return {
      success: true,
      data: {
        origin: {
          address: originResult.data.address,
          coordinates: originResult.data.coordinates
        },
        destination: {
          address: destinationResult.data.address,
          coordinates: destinationResult.data.coordinates
        },
        waypoints: waypoints,
        route: routeResult.data
      }
    };
  } catch (error) {
    console.error('Route from addresses error:', error);
    return {
      success: false,
      message: 'Failed to calculate route from addresses',
      error: error.message
    };
  }
};

/**
 * Search for locations (autocomplete)
 * @param {string} query - Search query
 * @param {object} options - Search options
 * @returns {Promise<object>} - Search results
 */
const searchLocations = async (query, options = {}) => {
  if (!isInitialized) {
    return getFallbackSearch(query);
  }

  try {
    const searchOptions = {
      query: query,
      countries: options.countries || ['ZW', 'ZA', 'BW', 'ZM', 'MZ', 'NA'],
      limit: options.limit || 10,
      types: options.types || ['address', 'place', 'locality', 'neighborhood', 'poi'],
      language: ['en'],
      autocomplete: true
    };

    // Add proximity bias if provided
    if (options.proximity) {
      searchOptions.proximity = [options.proximity.longitude, options.proximity.latitude];
    }

    // Add bounding box if provided
    if (options.bbox) {
      searchOptions.bbox = options.bbox;
    }

    const response = await geocodingClient.forwardGeocode(searchOptions).send();

    return {
      success: true,
      data: response.body.features.map(feature => ({
        id: feature.id,
        address: feature.place_name,
        placeName: feature.text,
        coordinates: {
          longitude: feature.center[0],
          latitude: feature.center[1]
        },
        type: feature.place_type?.[0],
        context: parseContext(feature.context),
        relevance: feature.relevance
      }))
    };
  } catch (error) {
    console.error('Location search error:', error);
    return {
      success: false,
      message: 'Location search failed',
      error: error.message
    };
  }
};

/**
 * Calculate distance matrix between multiple points
 * @param {array} origins - Array of origin coordinates
 * @param {array} destinations - Array of destination coordinates
 * @returns {Promise<object>} - Distance matrix
 */
const getDistanceMatrix = async (origins, destinations) => {
  if (!isInitialized) {
    return getFallbackDistanceMatrix(origins, destinations);
  }

  try {
    const results = [];

    for (const origin of origins) {
      const row = [];
      for (const destination of destinations) {
        const routeResult = await calculateRoute(origin, destination, [], { overview: 'simplified', steps: false });
        if (routeResult.success) {
          row.push({
            distance: routeResult.data.distance,
            duration: routeResult.data.duration
          });
        } else {
          row.push(null);
        }
      }
      results.push(row);
    }

    return {
      success: true,
      data: {
        matrix: results,
        origins: origins,
        destinations: destinations
      }
    };
  } catch (error) {
    console.error('Distance matrix error:', error);
    return {
      success: false,
      message: 'Distance matrix calculation failed',
      error: error.message
    };
  }
};

/**
 * Optimize route for multiple stops
 * @param {object} origin - Starting point
 * @param {array} stops - Array of stops to visit
 * @param {object} options - Optimization options
 * @returns {Promise<object>} - Optimized route
 */
const optimizeRoute = async (origin, stops, options = {}) => {
  if (!isInitialized || !optimizationClient) {
    return { success: false, message: 'Optimization service not available' };
  }

  try {
    const waypoints = [
      { coordinates: [origin.longitude, origin.latitude] },
      ...stops.map(stop => ({ coordinates: [stop.longitude, stop.latitude] }))
    ];

    const response = await optimizationClient.getOptimization({
      profile: 'driving',
      waypoints: waypoints,
      source: 'first',
      destination: options.returnToStart ? 'last' : 'any',
      roundtrip: options.roundtrip || false,
      geometries: 'geojson',
      overview: 'full',
      steps: true
    }).send();

    if (response.body.trips && response.body.trips.length > 0) {
      const trip = response.body.trips[0];

      return {
        success: true,
        data: {
          optimizedOrder: response.body.waypoints.map((wp, idx) => ({
            originalIndex: wp.waypoint_index,
            name: wp.name,
            location: wp.location
          })),
          distance: {
            meters: trip.distance,
            kilometers: (trip.distance / 1000).toFixed(2)
          },
          duration: {
            seconds: trip.duration,
            formatted: formatDuration(trip.duration)
          },
          geometry: trip.geometry,
          legs: trip.legs
        }
      };
    }

    return {
      success: false,
      message: 'Could not optimize route'
    };
  } catch (error) {
    console.error('Route optimization error:', error);
    return {
      success: false,
      message: 'Route optimization failed',
      error: error.message
    };
  }
};

// ============ Helper Functions ============

/**
 * Parse Mapbox context array into structured object
 */
const parseContext = (context) => {
  if (!context) return {};

  const parsed = {};
  context.forEach(item => {
    if (item.id.startsWith('place')) {
      parsed.city = item.text;
    } else if (item.id.startsWith('region')) {
      parsed.region = item.text;
    } else if (item.id.startsWith('country')) {
      parsed.country = item.text;
      parsed.countryCode = item.short_code?.toUpperCase();
    } else if (item.id.startsWith('postcode')) {
      parsed.postcode = item.text;
    } else if (item.id.startsWith('locality')) {
      parsed.locality = item.text;
    } else if (item.id.startsWith('neighborhood')) {
      parsed.neighborhood = item.text;
    }
  });

  return parsed;
};

/**
 * Format duration in seconds to human-readable string
 */
const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} mins`;
};

// ============ Fallback Functions (when Mapbox is not configured) ============

const getFallbackGeocode = (address) => {
  // Zimbabwe major cities fallback coordinates
  const cities = {
    'harare': { lat: -17.8292, lng: 31.0522 },
    'bulawayo': { lat: -20.1325, lng: 28.5804 },
    'mutare': { lat: -18.9707, lng: 32.6709 },
    'gweru': { lat: -19.4500, lng: 29.8167 },
    'kwekwe': { lat: -18.9281, lng: 29.8147 },
    'kadoma': { lat: -18.3333, lng: 29.9167 },
    'masvingo': { lat: -20.0744, lng: 30.8328 },
    'chinhoyi': { lat: -17.3667, lng: 30.2000 },
    'victoria falls': { lat: -17.9243, lng: 25.8572 },
    'beitbridge': { lat: -22.2167, lng: 30.0000 }
  };

  const lowerAddress = address.toLowerCase();
  for (const [city, coords] of Object.entries(cities)) {
    if (lowerAddress.includes(city)) {
      return {
        success: true,
        data: {
          coordinates: { latitude: coords.lat, longitude: coords.lng },
          address: address,
          placeName: city.charAt(0).toUpperCase() + city.slice(1)
        }
      };
    }
  }

  // Default to Harare center
  return {
    success: true,
    data: {
      coordinates: { latitude: -17.8292, longitude: 31.0522 },
      address: address,
      placeName: address
    }
  };
};

const getFallbackReverseGeocode = (latitude, longitude) => {
  return {
    success: true,
    data: {
      address: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      coordinates: { latitude, longitude }
    }
  };
};

const getFallbackRoute = (origin, destination) => {
  // Calculate straight-line distance using Haversine formula
  const R = 6371; // Earth's radius in km
  const dLat = (destination.latitude - origin.latitude) * Math.PI / 180;
  const dLon = (destination.longitude - origin.longitude) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(origin.latitude * Math.PI / 180) * Math.cos(destination.latitude * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straightLineDistance = R * c;

  // Estimate road distance (typically 1.3-1.5x straight line)
  const roadDistance = straightLineDistance * 1.4;
  // Estimate duration based on average speed of 60 km/h
  const durationSeconds = (roadDistance / 60) * 3600;

  return {
    success: true,
    data: {
      distance: {
        meters: Math.round(roadDistance * 1000),
        kilometers: roadDistance.toFixed(2),
        miles: (roadDistance * 0.621371).toFixed(2)
      },
      duration: {
        seconds: Math.round(durationSeconds),
        minutes: Math.round(durationSeconds / 60),
        hours: (durationSeconds / 3600).toFixed(2),
        formatted: formatDuration(durationSeconds)
      },
      isEstimate: true,
      estimateNote: 'Distance and duration are estimates. Configure Mapbox for accurate routing.'
    }
  };
};

const getFallbackSearch = (query) => {
  const cities = [
    { name: 'Harare', lat: -17.8292, lng: 31.0522, type: 'city' },
    { name: 'Bulawayo', lat: -20.1325, lng: 28.5804, type: 'city' },
    { name: 'Mutare', lat: -18.9707, lng: 32.6709, type: 'city' },
    { name: 'Gweru', lat: -19.4500, lng: 29.8167, type: 'city' },
    { name: 'Kwekwe', lat: -18.9281, lng: 29.8147, type: 'city' },
    { name: 'Kadoma', lat: -18.3333, lng: 29.9167, type: 'city' },
    { name: 'Masvingo', lat: -20.0744, lng: 30.8328, type: 'city' },
    { name: 'Chinhoyi', lat: -17.3667, lng: 30.2000, type: 'city' },
    { name: 'Victoria Falls', lat: -17.9243, lng: 25.8572, type: 'city' },
    { name: 'Beitbridge', lat: -22.2167, lng: 30.0000, type: 'city' },
    { name: 'Johannesburg, South Africa', lat: -26.2041, lng: 28.0473, type: 'city' },
    { name: 'Pretoria, South Africa', lat: -25.7461, lng: 28.1881, type: 'city' },
    { name: 'Durban, South Africa', lat: -29.8587, lng: 31.0218, type: 'city' },
    { name: 'Lusaka, Zambia', lat: -15.3875, lng: 28.3228, type: 'city' },
    { name: 'Gaborone, Botswana', lat: -24.6282, lng: 25.9231, type: 'city' },
    { name: 'Maputo, Mozambique', lat: -25.9692, lng: 32.5732, type: 'city' }
  ];

  const lowerQuery = query.toLowerCase();
  const results = cities
    .filter(city => city.name.toLowerCase().includes(lowerQuery))
    .map(city => ({
      address: city.name,
      placeName: city.name,
      coordinates: { latitude: city.lat, longitude: city.lng },
      type: city.type
    }));

  return {
    success: true,
    data: results.slice(0, 10)
  };
};

const getFallbackDistanceMatrix = (origins, destinations) => {
  const matrix = origins.map(origin =>
    destinations.map(destination => {
      const result = getFallbackRoute(origin, destination);
      return result.success ? result.data : null;
    })
  );

  return {
    success: true,
    data: { matrix, isEstimate: true }
  };
};

module.exports = {
  geocode,
  reverseGeocode,
  calculateRoute,
  calculateRouteFromAddresses,
  searchLocations,
  getDistanceMatrix,
  optimizeRoute,
  isInitialized
};
