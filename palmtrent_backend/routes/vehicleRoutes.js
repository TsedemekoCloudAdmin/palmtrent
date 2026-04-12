const express = require('express');
const router = express.Router();
const {
  calculateRoute,
  searchLocation,
  getPlaceDetails,
  reverseGeocode,
  geocode,
  optimizeRoute,
  getDistanceMatrix
} = require('../controllers/routesController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Route calculation (Mapbox Directions API)
router.post('/calculate', calculateRoute);

// Location search / autocomplete (Mapbox Geocoding API)
router.get('/search', searchLocation);

// Geocode address to coordinates (Mapbox Geocoding API)
router.get('/geocode', geocode);

// Place details by Google Place ID (legacy - for backwards compatibility)
router.get('/place/:placeId', getPlaceDetails);

// Reverse geocoding - coordinates to address (Mapbox Geocoding API)
router.get('/reverse-geocode', reverseGeocode);

// Route optimization for multiple stops (Mapbox Optimization API)
router.post('/optimize', optimizeRoute);

// Distance matrix between multiple points (Mapbox Matrix API)
router.post('/distance-matrix', getDistanceMatrix);

module.exports = router;