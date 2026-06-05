jest.mock('../services/monetizationService', () => ({
  getCommissionRule: jest.fn()
}));

const monetizationService = require('../services/monetizationService');
const {
  calculateRoadsideProviderFees,
  calculateRoadsideAssistanceCharge,
  calculateDistanceKm,
  buildRoadsideQuote
} = require('../services/roadsideQuoteService');

describe('roadsideQuoteService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    monetizationService.getCommissionRule.mockResolvedValue({
      platformFeeRate: 0.1,
      minimumFee: 5
    });
  });

  test('calculates platform fee and provider earnings from the configured commission rule', async () => {
    await expect(calculateRoadsideProviderFees(80, 'digital')).resolves.toEqual({
      platformFee: 8,
      providerEarnings: 72
    });

    expect(monetizationService.getCommissionRule).toHaveBeenCalledWith({
      target: 'roadside_assistance',
      audience: 'roadside_provider',
      paymentMethod: 'digital'
    });
  });

  test('uses base towing or mechanic fee for initial roadside assistance charge', async () => {
    await expect(calculateRoadsideAssistanceCharge(
      {},
      { serviceTypes: ['tow_truck'] },
      'digital',
      { towBaseFee: 100, mechanicBaseFee: 40 }
    )).resolves.toEqual(expect.objectContaining({
      amount: 100,
      currency: 'USD',
      platformFee: 10,
      providerEarnings: 90
    }));

    await expect(calculateRoadsideAssistanceCharge(
      {},
      { serviceTypes: ['mechanic'] },
      'digital',
      { towBaseFee: 100, mechanicBaseFee: 40 }
    )).resolves.toEqual(expect.objectContaining({
      amount: 40,
      platformFee: 5,
      providerEarnings: 35
    }));
  });

  test('calculates distance between coordinate pairs in kilometres', () => {
    expect(calculateDistanceKm([0, 0], [0, 1])).toBeCloseTo(111.19, 1);
    expect(calculateDistanceKm(null, [0, 1])).toBe(0);
  });

  test('requires distance or destination coordinates for towing quotes', async () => {
    await expect(buildRoadsideQuote(
      { location: { coordinates: [31.0522, -17.8292] } },
      { serviceTypes: ['tow_truck'] },
      { serviceType: 'tow_truck' },
      { towBaseFee: 75, towPerKmFee: 2 }
    )).rejects.toThrow('towing quote must include the distance');
  });

  test('builds base towing quote with distance and provider fees', async () => {
    const result = await buildRoadsideQuote(
      { location: { coordinates: [31.0522, -17.8292] } },
      { serviceTypes: ['tow_truck'] },
      {
        serviceType: 'tow_truck',
        distanceKm: 12,
        destination: { address: 'Workshop' }
      },
      { towBaseFee: 75, towPerKmFee: 2 }
    );

    expect(result.quote).toEqual(expect.objectContaining({
      serviceType: 'tow_truck',
      pricingMode: 'base',
      distanceKm: 12,
      baseFee: 75,
      distanceFee: 24,
      towingFee: 99,
      total: 99,
      currency: 'USD',
      submittedAt: expect.any(Date)
    }));
    expect(result.quote.quoteReference).toMatch(/^SOS-QTE-/);
    expect(result.fees).toEqual({
      platformFee: 9.9,
      providerEarnings: 89.1
    });
  });

  test('builds custom mechanic quote without distance fee', async () => {
    const result = await buildRoadsideQuote(
      { location: { coordinates: [31.0522, -17.8292] } },
      { serviceTypes: ['mechanic'] },
      {
        serviceType: 'mechanic',
        pricingMode: 'custom',
        calloutFee: 20,
        labourFee: 35,
        partsEstimate: 10
      },
      { mechanicBaseFee: 35 }
    );

    expect(result.quote).toEqual(expect.objectContaining({
      serviceType: 'mechanic',
      pricingMode: 'custom',
      distanceKm: 0,
      baseFee: 35,
      distanceFee: 0,
      towingFee: 0,
      total: 100
    }));
    expect(result.fees).toEqual({
      platformFee: 10,
      providerEarnings: 90
    });
  });
});
