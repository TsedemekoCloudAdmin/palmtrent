jest.mock('../services/integrationSettingsService', () => ({
  getIntegrationConfig: jest.fn()
}));

const { getIntegrationConfig } = require('../services/integrationSettingsService');
const {
  DEFAULT_EMERGENCY_CONFIG,
  getEmergencyOperationalConfig,
  getEmergencyContacts,
  normalizeLocation,
  hasUsableCoordinates,
  createPaymentReference
} = require('../services/emergencyConfigService');

describe('emergencyConfigService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('falls back to production-safe emergency defaults when no DB settings exist', async () => {
    getIntegrationConfig.mockResolvedValue(null);

    const config = await getEmergencyOperationalConfig();

    expect(config).toEqual(expect.objectContaining(DEFAULT_EMERGENCY_CONFIG));
    expect(getEmergencyContacts(config)).toEqual(expect.objectContaining({
      police: '+263 995',
      ambulance: '+263 994',
      fire: '+263 993',
      support: DEFAULT_EMERGENCY_CONFIG.supportPhone
    }));
  });

  test('coerces positive numeric settings and ignores unsafe values', async () => {
    getIntegrationConfig.mockResolvedValue({
      supportPhone: '+263 77 000 0000',
      dispatchTimeoutMs: '15000',
      responderRadiusMeters: '-1',
      towBaseFee: '100',
      towPerKmFee: '3.5',
      mechanicBaseFee: '0'
    });

    const config = await getEmergencyOperationalConfig();

    expect(config.supportPhone).toBe('+263 77 000 0000');
    expect(config.dispatchTimeoutMs).toBe(15000);
    expect(config.responderRadiusMeters).toBe(DEFAULT_EMERGENCY_CONFIG.responderRadiusMeters);
    expect(config.towBaseFee).toBe(100);
    expect(config.towPerKmFee).toBe(3.5);
    expect(config.mechanicBaseFee).toBe(DEFAULT_EMERGENCY_CONFIG.mechanicBaseFee);
  });

  test('normalizes supported location shapes for geospatial queries', () => {
    expect(normalizeLocation({
      longitude: '31.0522',
      latitude: '-17.8292',
      address: 'Harare CBD'
    })).toEqual({
      type: 'Point',
      coordinates: [31.0522, -17.8292],
      address: 'Harare CBD',
      city: undefined,
      country: 'Zimbabwe'
    });

    expect(hasUsableCoordinates({ coordinates: [31.0522, -17.8292] })).toBe(true);
    expect(hasUsableCoordinates({ coordinates: [0, 0] })).toBe(false);
  });

  test('creates SOS payment references with the requested prefix', () => {
    expect(createPaymentReference('SOS-FRT')).toMatch(/^SOS-FRT-[a-z0-9]+-[A-Z0-9]{6}$/);
  });
});
