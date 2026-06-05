const { getIntegrationConfig } = require('./integrationSettingsService');

const DEFAULT_EMERGENCY_CONFIG = Object.freeze({
  supportPhone: '+263 77 123 4567',
  dispatchTimeoutMs: 10000,
  responderRadiusMeters: 50000,
  responderBroadcastLimit: 10,
  towAssistanceFee: 75,
  towBaseFee: 75,
  towPerKmFee: 2,
  mechanicAssistanceFee: 35,
  mechanicBaseFee: 35
});

const BASE_EMERGENCY_CONTACTS = Object.freeze({
  police: '+263 995',
  ambulance: '+263 994',
  fire: '+263 993'
});

function numberSetting(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function getEmergencyOperationalConfig() {
  const config = await getIntegrationConfig('emergencyDispatch') || {};
  return {
    ...config,
    supportPhone: config.supportPhone || DEFAULT_EMERGENCY_CONFIG.supportPhone,
    dispatchTimeoutMs: numberSetting(config.dispatchTimeoutMs || config.timeoutMs, DEFAULT_EMERGENCY_CONFIG.dispatchTimeoutMs),
    responderRadiusMeters: numberSetting(config.responderRadiusMeters, DEFAULT_EMERGENCY_CONFIG.responderRadiusMeters),
    responderBroadcastLimit: numberSetting(config.responderBroadcastLimit, DEFAULT_EMERGENCY_CONFIG.responderBroadcastLimit),
    towAssistanceFee: numberSetting(config.towAssistanceFee, DEFAULT_EMERGENCY_CONFIG.towAssistanceFee),
    towBaseFee: numberSetting(config.towBaseFee || config.towAssistanceFee, DEFAULT_EMERGENCY_CONFIG.towBaseFee),
    towPerKmFee: numberSetting(config.towPerKmFee, DEFAULT_EMERGENCY_CONFIG.towPerKmFee),
    mechanicAssistanceFee: numberSetting(config.mechanicAssistanceFee, DEFAULT_EMERGENCY_CONFIG.mechanicAssistanceFee),
    mechanicBaseFee: numberSetting(config.mechanicBaseFee || config.mechanicAssistanceFee, DEFAULT_EMERGENCY_CONFIG.mechanicBaseFee)
  };
}

function getEmergencyContacts(config = {}) {
  return {
    ...BASE_EMERGENCY_CONTACTS,
    support: config.supportPhone || DEFAULT_EMERGENCY_CONFIG.supportPhone
  };
}

function normalizeLocation(location = {}) {
  if (Array.isArray(location.coordinates) && location.coordinates.length === 2) {
    return {
      type: 'Point',
      coordinates: location.coordinates.map(Number),
      address: location.address,
      city: location.city,
      country: location.country || 'Zimbabwe'
    };
  }

  if (location.longitude !== undefined && location.latitude !== undefined) {
    return {
      type: 'Point',
      coordinates: [Number(location.longitude), Number(location.latitude)],
      address: location.address,
      city: location.city,
      country: location.country || 'Zimbabwe'
    };
  }

  return {
    type: 'Point',
    coordinates: [0, 0],
    address: location.address || 'Location not available',
    city: location.city,
    country: location.country || 'Zimbabwe'
  };
}

function hasUsableCoordinates(location = {}) {
  const coords = location.coordinates || [];
  return coords.length === 2 && (Number(coords[0]) !== 0 || Number(coords[1]) !== 0);
}

function createPaymentReference(prefix = 'SOS') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

module.exports = {
  DEFAULT_EMERGENCY_CONFIG,
  BASE_EMERGENCY_CONTACTS,
  numberSetting,
  getEmergencyOperationalConfig,
  getEmergencyContacts,
  normalizeLocation,
  hasUsableCoordinates,
  createPaymentReference
};
