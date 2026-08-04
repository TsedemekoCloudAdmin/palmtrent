const axios = require('axios');

jest.mock('axios');
jest.mock('../services/mapboxService', () => ({
  searchLocations: jest.fn(),
  reverseGeocode: jest.fn()
}));

const mapboxService = require('../services/mapboxService');
const addressSearchService = require('../services/addressSearchService');

const nominatimHit = (overrides = {}) => ({
  lat: '-17.8399',
  lon: '31.1656',
  display_name: 'Mashingwe Street, Mabvuku, Harare, Zimbabwe',
  name: 'Mashingwe Street',
  type: 'residential',
  importance: 0.3,
  address: { road: 'Mashingwe Street', suburb: 'Mabvuku', city: 'Harare', country: 'Zimbabwe', country_code: 'zw' },
  ...overrides
});

describe('addressSearchService.buildVariants', () => {
  it('relaxes a full Zimbabwean street address step by step', () => {
    const variants = addressSearchService.buildVariants('19 Mashingwe St,Mabvuku,Harare, Zimbabwe');

    // The country is passed to the providers as a code, so it is dropped from
    // the query string rather than searched for twice.
    expect(variants.map((v) => v.query)).toEqual([
      '19 Mashingwe Street, Mabvuku, Harare',
      'Mashingwe Street, Mabvuku, Harare',
      'Mabvuku, Harare'
    ]);
    expect(variants.every((v) => v.countryCode === 'zw')).toBe(true);
    expect(variants.map((v) => v.precision)).toEqual(['exact', 'street', 'area']);
  });

  it('leaves a bare place name alone', () => {
    expect(addressSearchService.buildVariants('Bulawayo')).toEqual([
      { query: 'Bulawayo', precision: 'exact', countryCode: null, houseNumber: null }
    ]);
  });

  it('ignores blank input', () => {
    expect(addressSearchService.buildVariants('   ')).toEqual([]);
  });
});

describe('addressSearchService.searchAddresses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The service caches by query, so vary the suburb between tests.
    mapboxService.searchLocations.mockResolvedValue({ success: true, data: [] });
    axios.get.mockResolvedValue({ data: [] });
  });

  it('re-attaches the house number when only the street is mapped', async () => {
    axios.get.mockImplementation((url, config) => {
      // Only the house-number-free variant resolves.
      if (config.params.q === 'Mashingwe Street, Mabvuku, Harare') {
        return Promise.resolve({ data: [nominatimHit()] });
      }
      return Promise.resolve({ data: [] });
    });

    const results = await addressSearchService.searchAddresses('19 Mashingwe St, Mabvuku, Harare, Zimbabwe');

    expect(results).toHaveLength(1);
    expect(results[0].address).toBe('19 Mashingwe Street, Mabvuku, Harare, Zimbabwe');
    expect(results[0].coordinates).toEqual({ latitude: -17.8399, longitude: 31.1656 });
    expect(results[0].precision).toBe('street');
    expect(results[0].approximate).toBe(true);
  });

  it('keeps the typed street line when only the suburb exists on the map', async () => {
    // What Mapbox really answers for a Mabvuku street address: the suburb.
    mapboxService.searchLocations.mockResolvedValue({
      success: true,
      data: [{
        address: 'Mabvuku, Harare, Zimbabwe',
        placeName: 'Mabvuku',
        coordinates: { latitude: -17.8347, longitude: 31.1877 },
        type: 'locality',
        relevance: 0.537,
        context: { city: 'Harare', country: 'Zimbabwe', countryCode: 'ZW' }
      }]
    });
    axios.get.mockResolvedValue({ data: [] });

    const results = await addressSearchService.searchAddresses('21 Chidhau St, Mabvuku, Harare');

    // The shipper's own wording survives so the driver still has the street.
    expect(results[0].address).toBe('21 Chidhau Street, Mabvuku, Harare, Zimbabwe');
    expect(results[0].coordinates).toEqual({ latitude: -17.8347, longitude: 31.1877 });
    // ...but the coordinates are the suburb, and say so.
    expect(results[0].precision).toBe('area');
    expect(results[0].approximate).toBe(true);
  });

  it('does not call OpenStreetMap when Mapbox is confident', async () => {
    mapboxService.searchLocations.mockResolvedValue({
      success: true,
      data: [{
        address: 'Kwekwe, Midlands, Zimbabwe',
        placeName: 'Kwekwe',
        coordinates: { latitude: -18.9281, longitude: 29.8147 },
        type: 'place',
        relevance: 1,
        context: { city: 'Kwekwe', country: 'Zimbabwe', countryCode: 'ZW' }
      }]
    });

    const results = await addressSearchService.searchAddresses('Kwekwe');

    expect(axios.get).not.toHaveBeenCalled();
    expect(results[0].source).toBe('mapbox');
    expect(results[0].approximate).toBe(false);
  });

  it('ranks the result that matches the most of the typed address first', async () => {
    mapboxService.searchLocations.mockResolvedValue({
      success: true,
      data: [{
        address: 'Harare, Zimbabwe',
        placeName: 'Harare',
        coordinates: { latitude: -17.8292, longitude: 31.0522 },
        type: 'place',
        relevance: 0.6,
        context: { city: 'Harare' }
      }]
    });
    axios.get.mockResolvedValue({
      data: [nominatimHit({ display_name: 'Chizhanje Road, Mabvuku, Harare, Zimbabwe', lat: '-17.8401', lon: '31.1700' })]
    });

    const results = await addressSearchService.searchAddresses('Chizhanje Road, Mabvuku, Harare');

    expect(results[0].address).toBe('Chizhanje Road, Mabvuku, Harare, Zimbabwe');
  });

  it('returns nothing rather than throwing when every provider fails', async () => {
    mapboxService.searchLocations.mockRejectedValue(new Error('mapbox down'));
    axios.get.mockRejectedValue(new Error('nominatim down'));

    await expect(addressSearchService.searchAddresses('Nowhere Street, Ruwa')).resolves.toEqual([]);
  });
});

describe('addressSearchService.reverseLookup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('prefers the provider that can name the street', async () => {
    mapboxService.reverseGeocode.mockResolvedValue({
      success: true,
      data: { address: 'Harare, Zimbabwe', placeName: 'Harare', context: { city: 'Harare' } }
    });
    axios.get.mockResolvedValue({ data: nominatimHit() });

    const result = await addressSearchService.reverseLookup(-17.8399, 31.1656);

    expect(result.source).toBe('nominatim');
    expect(result.address).toBe('Mashingwe Street, Mabvuku, Harare, Zimbabwe');
  });

  it('keeps the Mapbox answer when OpenStreetMap has nothing', async () => {
    mapboxService.reverseGeocode.mockResolvedValue({
      success: true,
      data: { address: 'Harare, Zimbabwe', placeName: 'Harare', context: { city: 'Harare' } }
    });
    axios.get.mockResolvedValue({ data: {} });

    const result = await addressSearchService.reverseLookup(-17.8292, 31.0522);

    expect(result.source).toBe('mapbox');
    expect(result.address).toBe('Harare, Zimbabwe');
  });
});
