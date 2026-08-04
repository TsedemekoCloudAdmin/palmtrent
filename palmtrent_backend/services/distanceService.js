/**
 * Distance Calculation Service
 *
 * Provides accurate distance and duration calculations using:
 * 1. Mapbox API (primary)
 * 2. Google Maps Distance Matrix API (fallback)
 * 3. OpenRouteService API (fallback)
 * 4. Haversine formula (final fallback)
 */

const axios = require('axios');
const mapboxService = require('./mapboxService');
const addressSearchService = require('./addressSearchService');

const allowEstimatedDistanceFallback = () => process.env.NODE_ENV !== 'production' ||
  process.env.ALLOW_ESTIMATED_DISTANCE_IN_PRODUCTION === 'true';

const allowLocationSearchFallback = () => process.env.NODE_ENV !== 'production' ||
  process.env.ALLOW_LOCATION_FALLBACK_IN_PRODUCTION === 'true';

// Zimbabwe city coordinates for fallback calculations
const CITY_COORDINATES = {
  'harare': { lat: -17.8292, lng: 31.0522 },
  'bulawayo': { lat: -20.1539, lng: 28.5833 },
  'mutare': { lat: -18.9707, lng: 32.6709 },
  'gweru': { lat: -19.4500, lng: 29.8167 },
  'masvingo': { lat: -20.0744, lng: 30.8328 },
  'chitungwiza': { lat: -18.0127, lng: 31.0755 },
  'kwekwe': { lat: -18.9167, lng: 29.8167 },
  'kadoma': { lat: -18.3333, lng: 29.9167 },
  'marondera': { lat: -18.1833, lng: 31.5500 },
  'chinhoyi': { lat: -17.3500, lng: 30.2000 },
  'bindura': { lat: -17.3000, lng: 31.3333 },
  'victoria falls': { lat: -17.9333, lng: 25.8333 },
  'kariba': { lat: -16.5167, lng: 28.8000 },
  'hwange': { lat: -18.3667, lng: 26.5000 },
  'beitbridge': { lat: -22.2167, lng: 30.0000 },
  'plumtree': { lat: -20.4833, lng: 27.8167 },
  // Regional cities
  'johannesburg': { lat: -26.2041, lng: 28.0473 },
  'durban': { lat: -29.8587, lng: 31.0218 },
  'cape town': { lat: -33.9249, lng: 18.4241 },
  'pretoria': { lat: -25.7479, lng: 28.2293 },
  'lusaka': { lat: -15.3875, lng: 28.3228 },
  'gaborone': { lat: -24.6282, lng: 25.9231 },
  'maputo': { lat: -25.9692, lng: 32.5732 },
  'beira': { lat: -19.8436, lng: 34.8389 }
};

// Road distance factors (accounts for road winding vs straight line)
const ROAD_FACTORS = {
  'urban': 1.3,      // Within city
  'intercity': 1.4,  // Between cities in same country
  'crossborder': 1.5 // Cross-border routes
};

class DistanceService {
  constructor() {
    this.googleApiKey = process.env.GOOGLE_MAPS_API_KEY;
    this.openRouteApiKey = process.env.OPENROUTE_API_KEY;
  }

  /**
   * Calculate distance between two locations
   * @param {Object} origin - { address, lat, lng }
   * @param {Object} destination - { address, lat, lng }
   * @returns {Object} { distance, duration, route }
   */
  async calculateDistance(origin, destination) {
    try {
      // Try Mapbox API first (primary)
      const mapboxResult = await this.calculateWithMapbox(origin, destination);
      if (mapboxResult) return mapboxResult;

      // Fallback to Google Maps API
      if (this.googleApiKey) {
        const googleResult = await this.calculateWithGoogle(origin, destination);
        if (googleResult) return googleResult;
      }

      // Fallback to OpenRouteService
      if (this.openRouteApiKey) {
        const orsResult = await this.calculateWithOpenRoute(origin, destination);
        if (orsResult) return orsResult;
      }

      if (!allowEstimatedDistanceFallback()) {
        throw new Error('A configured distance provider is required in production');
      }

      // Final fallback to coordinate-based calculation
      return this.calculateWithCoordinates(origin, destination);
    } catch (error) {
      console.error('Distance calculation error:', error);
      if (!allowEstimatedDistanceFallback()) {
        throw error;
      }
      return this.calculateWithCoordinates(origin, destination);
    }
  }

  /**
   * Mapbox Directions API (primary)
   */
  async calculateWithMapbox(origin, destination) {
    try {
      const [originCoords, destCoords] = await Promise.all([
        this.resolveCoordinates(origin),
        this.resolveCoordinates(destination)
      ]);

      if (!originCoords || !destCoords) return null;

      const result = await mapboxService.calculateRoute(
        { latitude: originCoords.lat, longitude: originCoords.lng },
        { latitude: destCoords.lat, longitude: destCoords.lng }
      );

      // An estimated fallback route is not a Mapbox answer — let the caller try
      // the other providers before settling for an estimate.
      if (!result.success || result.data.isFallback) return null;

      return {
        distance: parseFloat(result.data.distance.kilometers),
        distanceText: `${result.data.distance.kilometers} km`,
        duration: result.data.duration.formatted,
        durationMinutes: result.data.duration.minutes,
        route: `${origin.address || 'Origin'} → ${destination.address || 'Destination'}`,
        source: 'mapbox',
        coordinates: {
          origin: originCoords,
          destination: destCoords
        },
        geometry: result.data.geometry,
        legs: result.data.legs
      };
    } catch (error) {
      console.error('Mapbox API error:', error.message);
      return null;
    }
  }

  /**
   * Coordinates for a location, geocoding the address when the caller did not
   * send any. Uses the full multi-provider address search so street addresses
   * resolve, not just the handful of cities in CITY_COORDINATES.
   */
  async resolveCoordinates(location) {
    if (location?.lat && location?.lng) {
      return { lat: location.lat, lng: location.lng };
    }
    if (!location?.address) return null;

    try {
      const resolved = await addressSearchService.resolveAddress(location.address);
      if (resolved) {
        return {
          lat: resolved.coordinates.latitude,
          lng: resolved.coordinates.longitude
        };
      }
    } catch (error) {
      console.error('Address resolution error:', error.message);
    }

    // Last resort: the city centre. Deliberately checked after geocoding, since
    // "19 Mashingwe Street, Mabvuku, Harare" contains "harare" and would
    // otherwise collapse to the Harare CBD.
    return this.parseCoordinates(location);
  }

  /**
   * Google Maps Distance Matrix API
   */
  async calculateWithGoogle(origin, destination) {
    try {
      const originStr = origin.lat && origin.lng
        ? `${origin.lat},${origin.lng}`
        : origin.address;
      const destStr = destination.lat && destination.lng
        ? `${destination.lat},${destination.lng}`
        : destination.address;

      const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
        params: {
          origins: originStr,
          destinations: destStr,
          key: this.googleApiKey,
          units: 'metric',
          mode: 'driving'
        },
        timeout: 10000
      });

      if (response.data.status === 'OK' &&
          response.data.rows[0]?.elements[0]?.status === 'OK') {
        const element = response.data.rows[0].elements[0];
        const distanceKm = element.distance.value / 1000;
        const durationSeconds = element.duration.value;

        return {
          distance: Math.round(distanceKm),
          distanceText: element.distance.text,
          duration: this.formatDuration(durationSeconds),
          durationMinutes: Math.round(durationSeconds / 60),
          route: `${origin.address || originStr} → ${destination.address || destStr}`,
          source: 'google_maps',
          coordinates: {
            origin: this.parseCoordinates(origin),
            destination: this.parseCoordinates(destination)
          }
        };
      }

      return null;
    } catch (error) {
      console.error('Google Maps API error:', error.message);
      return null;
    }
  }

  /**
   * OpenRouteService API (free alternative)
   */
  async calculateWithOpenRoute(origin, destination) {
    try {
      const originCoords = this.parseCoordinates(origin);
      const destCoords = this.parseCoordinates(destination);

      if (!originCoords || !destCoords) return null;

      const response = await axios.get('https://api.openrouteservice.org/v2/directions/driving-hgv', {
        params: {
          api_key: this.openRouteApiKey,
          start: `${originCoords.lng},${originCoords.lat}`,
          end: `${destCoords.lng},${destCoords.lat}`
        },
        timeout: 10000
      });

      if (response.data.features && response.data.features[0]) {
        const segment = response.data.features[0].properties.segments[0];
        const distanceKm = segment.distance / 1000;
        const durationSeconds = segment.duration;

        return {
          distance: Math.round(distanceKm),
          distanceText: `${Math.round(distanceKm)} km`,
          duration: this.formatDuration(durationSeconds),
          durationMinutes: Math.round(durationSeconds / 60),
          route: `${origin.address} → ${destination.address}`,
          source: 'openroute',
          coordinates: { origin: originCoords, destination: destCoords }
        };
      }

      return null;
    } catch (error) {
      console.error('OpenRouteService API error:', error.message);
      return null;
    }
  }

  /**
   * Fallback calculation using coordinates and Haversine formula
   */
  calculateWithCoordinates(origin, destination) {
    const originCoords = this.parseCoordinates(origin);
    const destCoords = this.parseCoordinates(destination);

    if (!originCoords || !destCoords) {
      // Try to get coordinates from city names
      return this.calculateFromCityNames(origin.address, destination.address);
    }

    const haversineDistance = this.haversine(
      originCoords.lat, originCoords.lng,
      destCoords.lat, destCoords.lng
    );

    // Apply road factor
    const roadFactor = this.getRoadFactor(origin.address, destination.address);
    const roadDistance = Math.round(haversineDistance * roadFactor);

    // Estimate duration (average speed 60 km/h for trucks)
    const avgSpeedKmh = 60;
    const durationMinutes = Math.round((roadDistance / avgSpeedKmh) * 60);

    return {
      distance: roadDistance,
      distanceText: `${roadDistance} km`,
      duration: this.formatDuration(durationMinutes * 60),
      durationMinutes,
      route: `${origin.address} → ${destination.address}`,
      source: 'calculated',
      coordinates: { origin: originCoords, destination: destCoords },
      note: 'Estimated distance - actual road distance may vary'
    };
  }

  /**
   * Calculate distance from city names (fallback)
   */
  calculateFromCityNames(originAddress, destAddress) {
    const originCity = this.extractCity(originAddress);
    const destCity = this.extractCity(destAddress);

    const originCoords = CITY_COORDINATES[originCity];
    const destCoords = CITY_COORDINATES[destCity];

    if (!originCoords || !destCoords) {
      // Return a default estimate
      return {
        distance: 200,
        distanceText: '~200 km',
        duration: '3-4 hours',
        durationMinutes: 210,
        route: `${originAddress} → ${destAddress}`,
        source: 'estimated',
        note: 'Distance could not be calculated accurately. Please verify.'
      };
    }

    const haversineDistance = this.haversine(
      originCoords.lat, originCoords.lng,
      destCoords.lat, destCoords.lng
    );

    const roadFactor = this.getRoadFactor(originAddress, destAddress);
    const roadDistance = Math.round(haversineDistance * roadFactor);
    const avgSpeedKmh = 55;
    const durationMinutes = Math.round((roadDistance / avgSpeedKmh) * 60);

    return {
      distance: roadDistance,
      distanceText: `${roadDistance} km`,
      duration: this.formatDuration(durationMinutes * 60),
      durationMinutes,
      route: `${originAddress} → ${destAddress}`,
      source: 'city_lookup',
      coordinates: { origin: originCoords, destination: destCoords }
    };
  }

  /**
   * Haversine formula for great-circle distance
   */
  haversine(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  toRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Get road factor based on route type
   */
  getRoadFactor(originAddress, destAddress) {
    const origin = (originAddress || '').toLowerCase();
    const dest = (destAddress || '').toLowerCase();

    const crossBorderCountries = ['south africa', 'botswana', 'zambia', 'mozambique', 'namibia', 'malawi'];

    // Check if cross-border
    for (const country of crossBorderCountries) {
      if (origin.includes(country) || dest.includes(country)) {
        return ROAD_FACTORS.crossborder;
      }
    }

    // Check if same city (urban)
    const originCity = this.extractCity(origin);
    const destCity = this.extractCity(dest);

    if (originCity && originCity === destCity) {
      return ROAD_FACTORS.urban;
    }

    return ROAD_FACTORS.intercity;
  }

  /**
   * Extract city name from address
   */
  extractCity(address) {
    if (!address) return null;
    const lower = address.toLowerCase();

    for (const city of Object.keys(CITY_COORDINATES)) {
      if (lower.includes(city)) {
        return city;
      }
    }
    return null;
  }

  /**
   * Parse coordinates from origin/destination object
   */
  parseCoordinates(location) {
    if (location.lat && location.lng) {
      return { lat: location.lat, lng: location.lng };
    }

    // Try to extract from address if it's a known city
    const city = this.extractCity(location.address);
    if (city && CITY_COORDINATES[city]) {
      return CITY_COORDINATES[city];
    }

    return null;
  }

  /**
   * Format duration from seconds to human readable
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours === 0) {
      return `${minutes} mins`;
    } else if (minutes === 0) {
      return `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      // Return a range for longer trips
      if (hours >= 2) {
        return `${hours}-${hours + 1} hours`;
      }
      return `${hours} hr ${minutes} mins`;
    }
  }

  /**
   * Search for locations using geocoding
   */
  async searchLocations(query, country = 'Zimbabwe') {
    try {
      // Mapbox + OpenStreetMap, with the query progressively relaxed until
      // something matches. Both are real geocoders, so this runs in production.
      const results = await addressSearchService.searchAddresses(query);
      if (results.length > 0) {
        return results.map(loc => ({
          // Always return the full place name so street-level addresses like
          // "19 Mashingwe Street, Mabvuku, Harare, Zimbabwe" are preserved.
          address: loc.address,
          placeName: loc.placeName,
          city: loc.city || loc.placeName,
          lat: loc.lat,
          lng: loc.lng,
          coordinates: loc.coordinates,
          type: loc.type,
          // How much of the typed address could actually be placed on a map:
          // 'exact', 'street' (number not mapped) or 'area' (suburb only).
          precision: loc.precision,
          approximate: Boolean(loc.approximate),
          source: loc.source
        }));
      }

      // Google Places, if a key is configured.
      if (this.googleApiKey) {
        const googleResults = await this.searchWithGoogle(query, country);
        if (googleResults.length > 0) return googleResults;
      }

      if (!allowLocationSearchFallback()) {
        return [];
      }

      // Hard-coded city list — a guess, so it stays out of production.
      return this.searchLocal(query);
    } catch (error) {
      console.error('Location search error:', error);
      if (!allowLocationSearchFallback()) {
        throw error;
      }
      return this.searchLocal(query);
    }
  }

  /**
   * Google Places Autocomplete
   */
  async searchWithGoogle(query, country) {
    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/autocomplete/json', {
        params: {
          input: query,
          key: this.googleApiKey,
          types: 'geocode|establishment',
          components: `country:zw|country:za|country:bw|country:zm|country:mz`,
          language: 'en'
        },
        timeout: 5000
      });

      if (response.data.status === 'OK') {
        return response.data.predictions.map(prediction => ({
          // Google returns the full description e.g. "19 Mashingwe, New Mabvuku, Harare, Zimbabwe"
          address: prediction.description,
          placeName: prediction.structured_formatting?.main_text || prediction.description,
          placeId: prediction.place_id,
          city: prediction.structured_formatting?.secondary_text || '',
          // Coordinates are not in autocomplete — caller must fetch via /routes/place/:placeId
          lat: null,
          lng: null,
          coordinates: null,
          type: prediction.types?.[0] || 'location',
          source: 'google'
        }));
      }

      return [];
    } catch (error) {
      console.error('Google Places error:', error.message);
      return [];
    }
  }

  /**
   * Local search fallback
   */
  searchLocal(query) {
    const lowerQuery = query.toLowerCase();
    const results = [];

    // Search Zimbabwe cities
    const zimbabweCities = [
      { name: 'Harare', region: 'Harare Province' },
      { name: 'Bulawayo', region: 'Bulawayo Province' },
      { name: 'Chitungwiza', region: 'Harare Province' },
      { name: 'Mutare', region: 'Manicaland' },
      { name: 'Gweru', region: 'Midlands' },
      { name: 'Kwekwe', region: 'Midlands' },
      { name: 'Kadoma', region: 'Mashonaland West' },
      { name: 'Masvingo', region: 'Masvingo Province' },
      { name: 'Chinhoyi', region: 'Mashonaland West' },
      { name: 'Marondera', region: 'Mashonaland East' },
      { name: 'Norton', region: 'Mashonaland West' },
      { name: 'Bindura', region: 'Mashonaland Central' },
      { name: 'Beitbridge', region: 'Matabeleland South' },
      { name: 'Victoria Falls', region: 'Matabeleland North' },
      { name: 'Hwange', region: 'Matabeleland North' },
      { name: 'Kariba', region: 'Mashonaland West' },
      { name: 'Ruwa', region: 'Mashonaland East' },
      { name: 'Epworth', region: 'Harare Province' },
      { name: 'Rusape', region: 'Manicaland' },
      { name: 'Chegutu', region: 'Mashonaland West' }
    ];

    // Common locations within cities
    const locations = [
      'City Centre', 'CBD', 'Industrial Area', 'Bus Terminus',
      'Market', 'Airport', 'Border Post', 'Depot'
    ];

    for (const city of zimbabweCities) {
      if (city.name.toLowerCase().includes(lowerQuery)) {
        // Add base city
        results.push({
          address: `${city.name}, ${city.region}, Zimbabwe`,
          city: city.name,
          type: 'city',
          source: 'local',
          ...CITY_COORDINATES[city.name.toLowerCase()]
        });

        // Add common locations
        for (const loc of locations.slice(0, 3)) {
          results.push({
            address: `${loc}, ${city.name}, Zimbabwe`,
            city: city.name,
            type: 'location',
            source: 'local'
          });
        }
      }
    }

    return results.slice(0, 8);
  }

  /**
   * Get place details (for coordinates)
   */
  async getPlaceDetails(placeId) {
    if (!this.googleApiKey) return null;

    try {
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/details/json', {
        params: {
          place_id: placeId,
          key: this.googleApiKey,
          fields: 'geometry,formatted_address,name'
        },
        timeout: 5000
      });

      if (response.data.status === 'OK') {
        const result = response.data.result;
        return {
          address: result.formatted_address,
          name: result.name,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng
        };
      }

      return null;
    } catch (error) {
      console.error('Place details error:', error.message);
      return null;
    }
  }
}

module.exports = new DistanceService();
