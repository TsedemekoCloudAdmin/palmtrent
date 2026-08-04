const distanceService = require('../services/distanceService');
const mapboxService = require('../services/mapboxService');
const addressSearchService = require('../services/addressSearchService');

const allowLocationFallback = () => process.env.NODE_ENV !== 'production' ||
  process.env.ALLOW_LOCATION_FALLBACK_IN_PRODUCTION === 'true';

/**
 * @desc    Calculate route distance and duration between two points
 * @route   POST /api/v1/routes/calculate
 * @access  Private
 */
exports.calculateRoute = async (req, res) => {
  try {
    const { pickupLocation, deliveryLocation, pickupCoords, deliveryCoords } = req.body;

    if (!pickupLocation || !deliveryLocation) {
      return res.status(400).json({
        success: false,
        message: 'Pickup and delivery locations are required'
      });
    }

    // Build origin and destination objects
    const origin = {
      address: pickupLocation,
      lat: pickupCoords?.lat || pickupCoords?.latitude,
      lng: pickupCoords?.lng || pickupCoords?.longitude
    };

    const destination = {
      address: deliveryLocation,
      lat: deliveryCoords?.lat || deliveryCoords?.latitude,
      lng: deliveryCoords?.lng || deliveryCoords?.longitude
    };

    // Calculate distance using the service
    const result = await distanceService.calculateDistance(origin, destination);

    res.json({
      success: true,
      data: {
        distance: result.distance,
        distanceText: result.distanceText || `${result.distance} km`,
        duration: result.duration,
        durationMinutes: result.durationMinutes,
        route: result.route,
        pickupLocation,
        deliveryLocation,
        coordinates: result.coordinates,
        geometry: result.geometry, // GeoJSON route geometry for map display
        legs: result.legs, // Turn-by-turn directions
        source: result.source,
        note: result.note
      }
    });
  } catch (error) {
    console.error('Route calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating route'
    });
  }
};

/**
 * @desc    Search for locations
 * @route   GET /api/v1/routes/search
 * @access  Private
 */
exports.searchLocation = async (req, res) => {
  try {
    const { query, country = 'Zimbabwe' } = req.query;

    if (!query || query.length < 2) {
      return res.json({
        success: true,
        data: []
      });
    }

    const results = await distanceService.searchLocations(query, country);

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Location search error:', error);
    res.status(500).json({
      success: false,
      message: 'Error searching locations'
    });
  }
};

/**
 * @desc    Get place details by placeId
 * @route   GET /api/v1/routes/place/:placeId
 * @access  Private
 */
exports.getPlaceDetails = async (req, res) => {
  try {
    const { placeId } = req.params;

    if (!placeId) {
      return res.status(400).json({
        success: false,
        message: 'Place ID is required'
      });
    }

    const details = await distanceService.getPlaceDetails(placeId);

    if (!details) {
      return res.status(404).json({
        success: false,
        message: 'Place not found'
      });
    }

    res.json({
      success: true,
      data: details
    });
  } catch (error) {
    console.error('Place details error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching place details'
    });
  }
};

/**
 * @desc    Reverse geocode coordinates to address
 * @route   GET /api/v1/routes/reverse-geocode
 * @access  Private
 */
exports.reverseGeocode = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: 'Latitude and longitude are required'
      });
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);

    // Prefers whichever provider can name the actual street at these
    // coordinates, so "use my current location" yields a usable pickup address.
    const result = await addressSearchService.reverseLookup(latitude, longitude);
    if (result) {
      return res.json({
        success: true,
        data: {
          address: result.address,
          placeName: result.placeName,
          city: result.city || result.placeName,
          region: result.region,
          country: result.country || 'Zimbabwe',
          countryCode: result.countryCode,
          lat: latitude,
          lng: longitude,
          source: result.source
        }
      });
    }

    if (!allowLocationFallback()) {
      return res.status(503).json({
        success: false,
        message: 'Reverse geocoding provider is not configured'
      });
    }

    // Fallback to city lookup
    let closestCity = 'Unknown Location';
    let minDistance = Infinity;

    const cities = {
      'Harare, Zimbabwe': { lat: -17.8292, lng: 31.0522 },
      'Bulawayo, Zimbabwe': { lat: -20.1539, lng: 28.5833 },
      'Mutare, Zimbabwe': { lat: -18.9707, lng: 32.6709 },
      'Gweru, Zimbabwe': { lat: -19.4500, lng: 29.8167 },
      'Masvingo, Zimbabwe': { lat: -20.0744, lng: 30.8328 },
      'Chitungwiza, Zimbabwe': { lat: -18.0127, lng: 31.0755 }
    };

    for (const [cityName, coords] of Object.entries(cities)) {
      const distance = Math.sqrt(
        Math.pow(latitude - coords.lat, 2) +
        Math.pow(longitude - coords.lng, 2)
      );
      if (distance < minDistance) {
        minDistance = distance;
        closestCity = cityName;
      }
    }

    res.json({
      success: true,
      data: {
        address: closestCity,
        city: closestCity.split(',')[0],
        country: 'Zimbabwe',
        lat: latitude,
        lng: longitude,
        source: 'fallback'
      }
    });
  } catch (error) {
    console.error('Reverse geocode error:', error);
    res.status(500).json({
      success: false,
      message: 'Error reverse geocoding'
    });
  }
};

/**
 * @desc    Geocode an address to coordinates
 * @route   GET /api/v1/routes/geocode
 * @access  Private
 */
exports.geocode = async (req, res) => {
  try {
    const { address } = req.query;

    if (!address) {
      return res.status(400).json({
        success: false,
        message: 'Address is required'
      });
    }

    // Multi-provider lookup that relaxes the query until it matches, so
    // street addresses Mapbox has never heard of still resolve.
    const resolved = await addressSearchService.resolveAddress(address);

    if (resolved) {
      return res.json({
        success: true,
        data: {
          address: resolved.address,
          placeName: resolved.placeName,
          coordinates: resolved.coordinates,
          context: resolved.context,
          allResults: resolved.allResults,
          // The house number could not be pinned down; the street was.
          approximate: resolved.approximate,
          source: resolved.source
        }
      });
    }

    const result = await mapboxService.geocode(address);

    if (result.success) {
      res.json({
        success: true,
        data: {
          address: result.data.address,
          placeName: result.data.placeName,
          coordinates: result.data.coordinates,
          context: result.data.context,
          allResults: result.data.allResults,
          source: result.data.isFallback ? 'fallback' : 'mapbox'
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: result.message || 'Address not found'
      });
    }
  } catch (error) {
    console.error('Geocode error:', error);
    res.status(500).json({
      success: false,
      message: 'Error geocoding address'
    });
  }
};

/**
 * @desc    Optimize route for multiple stops
 * @route   POST /api/v1/routes/optimize
 * @access  Private
 */
exports.optimizeRoute = async (req, res) => {
  try {
    const { origin, stops, options } = req.body;

    if (!origin || !stops || !Array.isArray(stops) || stops.length < 1) {
      return res.status(400).json({
        success: false,
        message: 'Origin and at least one stop are required'
      });
    }

    const result = await mapboxService.optimizeRoute(origin, stops, options || {});

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Could not optimize route'
      });
    }
  } catch (error) {
    console.error('Route optimization error:', error);
    res.status(500).json({
      success: false,
      message: 'Error optimizing route'
    });
  }
};

/**
 * @desc    Get distance matrix between multiple origins and destinations
 * @route   POST /api/v1/routes/distance-matrix
 * @access  Private
 */
exports.getDistanceMatrix = async (req, res) => {
  try {
    const { origins, destinations } = req.body;

    if (!origins || !destinations || !Array.isArray(origins) || !Array.isArray(destinations)) {
      return res.status(400).json({
        success: false,
        message: 'Origins and destinations arrays are required'
      });
    }

    const result = await mapboxService.getDistanceMatrix(origins, destinations);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message || 'Could not calculate distance matrix'
      });
    }
  } catch (error) {
    console.error('Distance matrix error:', error);
    res.status(500).json({
      success: false,
      message: 'Error calculating distance matrix'
    });
  }
};
