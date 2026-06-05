const monetizationService = require('./monetizationService');
const {
  DEFAULT_EMERGENCY_CONFIG,
  numberSetting,
  createPaymentReference
} = require('./emergencyConfigService');

async function calculateRoadsideProviderFees(amount, paymentMethod = 'digital') {
  const safeAmount = Number.isFinite(Number(amount)) && Number(amount) > 0 ? Number(amount) : 0;
  const rule = await monetizationService.getCommissionRule({
    target: 'roadside_assistance',
    audience: 'roadside_provider',
    paymentMethod
  });
  const rate = Number(rule?.platformFeeRate || 0.15);
  const minimumFee = Number(rule?.minimumFee || 0);
  const platformFee = Math.min(safeAmount, Math.max(minimumFee, safeAmount * rate));
  const providerEarnings = Math.max(0, safeAmount - platformFee);

  return {
    platformFee: Number(platformFee.toFixed(2)),
    providerEarnings: Number(providerEarnings.toFixed(2))
  };
}

async function calculateRoadsideAssistanceCharge(emergency, responder, paymentMethod = 'digital', config = {}) {
  const serviceTypes = responder?.serviceTypes || [];
  const isTow = serviceTypes.includes('tow_truck') || serviceTypes.includes('accident_recovery');
  const towFee = numberSetting(config.towBaseFee || config.towAssistanceFee, DEFAULT_EMERGENCY_CONFIG.towBaseFee);
  const mechanicFee = numberSetting(config.mechanicBaseFee || config.mechanicAssistanceFee, DEFAULT_EMERGENCY_CONFIG.mechanicBaseFee);
  const amount = Number((isTow ? towFee : mechanicFee).toFixed(2));
  const fees = await calculateRoadsideProviderFees(amount, paymentMethod);

  return {
    amount,
    currency: 'USD',
    ...fees,
    notes: 'Roadside assistance is billed as a separate SOS charge and does not reduce the original booking or freight allocation unless the transporter chooses freight allocation.'
  };
}

function toMoney(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : 0;
}

function getResponderServiceType(responder, requestedServiceType) {
  const allowed = ['tow_truck', 'mechanic', 'battery', 'fuel', 'tyre', 'lockout', 'accident_recovery', 'other'];
  if (allowed.includes(requestedServiceType)) return requestedServiceType;
  const serviceTypes = responder?.serviceTypes || [];
  return serviceTypes.includes('tow_truck') || serviceTypes.includes('accident_recovery')
    ? 'tow_truck'
    : (serviceTypes[0] || 'mechanic');
}

function getCoordinatePair(value = {}) {
  if (Array.isArray(value.coordinates) && value.coordinates.length === 2) {
    const coords = value.coordinates.map(Number);
    if (coords.every(Number.isFinite)) return coords;
  }
  if (value.longitude !== undefined && value.latitude !== undefined) {
    const coords = [Number(value.longitude), Number(value.latitude)];
    if (coords.every(Number.isFinite)) return coords;
  }
  return null;
}

function calculateDistanceKm(fromCoords, toCoords) {
  if (!fromCoords || !toCoords) return 0;
  const [lon1, lat1] = fromCoords.map(Number);
  const [lon2, lat2] = toCoords.map(Number);
  if (![lon1, lat1, lon2, lat2].every(Number.isFinite)) return 0;

  const radiusKm = 6371;
  const toRadians = degrees => degrees * Math.PI / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) ** 2;
  return Number((radiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
}

async function buildRoadsideQuote(emergency, responder, payload = {}, config = {}) {
  const serviceType = getResponderServiceType(responder, payload.serviceType);
  const isTow = ['tow_truck', 'accident_recovery'].includes(serviceType);
  const pricingMode = payload.pricingMode === 'custom' ? 'custom' : 'base';
  const destination = payload.destination || {};
  const destinationCoords = getCoordinatePair(destination);
  const emergencyCoords = getCoordinatePair(emergency.location);
  const distanceKm = Number(payload.distanceKm || calculateDistanceKm(emergencyCoords, destinationCoords) || 0);
  const safeDistanceKm = Number.isFinite(distanceKm) && distanceKm > 0 ? Number(distanceKm.toFixed(2)) : 0;
  const towBaseFee = numberSetting(config.towBaseFee || config.towAssistanceFee, DEFAULT_EMERGENCY_CONFIG.towBaseFee);
  const towPerKmFee = numberSetting(config.towPerKmFee, DEFAULT_EMERGENCY_CONFIG.towPerKmFee);
  const mechanicBaseFee = numberSetting(config.mechanicBaseFee || config.mechanicAssistanceFee, DEFAULT_EMERGENCY_CONFIG.mechanicBaseFee);
  const baseFee = isTow ? towBaseFee : mechanicBaseFee;
  const distanceFee = isTow ? Number((safeDistanceKm * towPerKmFee).toFixed(2)) : 0;
  const calloutFee = toMoney(payload.calloutFee);
  const labourFee = toMoney(payload.labourFee);
  const partsEstimate = toMoney(payload.partsEstimate);
  const towingFee = isTow ? Number((baseFee + distanceFee).toFixed(2)) : 0;
  const baseTotal = isTow ? towingFee : baseFee;
  const customTotal = toMoney(payload.total || payload.amount);
  const total = pricingMode === 'custom'
    ? Math.max(baseTotal, customTotal || Number((baseTotal + calloutFee + labourFee + partsEstimate).toFixed(2)))
    : Number(baseTotal.toFixed(2));

  if (isTow && safeDistanceKm <= 0) {
    throw new Error('A towing quote must include the distance in kilometres or destination coordinates.');
  }

  const fees = await calculateRoadsideProviderFees(total, 'digital');
  return {
    quote: {
      quoteReference: createPaymentReference('SOS-QTE'),
      serviceType,
      pricingMode,
      destination: {
        address: destination.address,
        coordinates: destinationCoords || undefined
      },
      distanceKm: safeDistanceKm,
      baseFee: Number(baseFee.toFixed(2)),
      distanceFee,
      calloutFee,
      labourFee,
      partsEstimate,
      towingFee,
      total,
      currency: 'USD',
      notes: payload.notes,
      submittedAt: new Date()
    },
    fees
  };
}

module.exports = {
  calculateRoadsideProviderFees,
  calculateRoadsideAssistanceCharge,
  toMoney,
  getResponderServiceType,
  getCoordinatePair,
  calculateDistanceKm,
  buildRoadsideQuote
};
