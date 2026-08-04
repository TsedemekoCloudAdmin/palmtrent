/**
 * Address Search Service
 *
 * Resolves the free-text pickup/delivery addresses shippers type into real
 * coordinates.
 *
 * Mapbox on its own is not enough here: its address layer barely covers
 * Zimbabwean high-density suburbs, so a perfectly valid address like
 * "19 Mashingwe St, Mabvuku, Harare, Zimbabwe" comes back with zero features.
 * OpenStreetMap (queried through Nominatim) does have those streets, so both
 * providers are consulted and their results merged.
 *
 * When the exact query finds nothing the query is progressively relaxed —
 * street abbreviations are expanded, the country suffix is dropped, then the
 * house number, then the street itself — and the house number is re-attached to
 * whichever street matched, so the shipper still sees the address they typed
 * even when only the street could be located.
 */

const axios = require('axios');
const mapboxService = require('./mapboxService');

// Countries PalmTrent operates in / routes through.
const SEARCH_COUNTRY_CODES = ['zw', 'za', 'bw', 'zm', 'mz', 'na'];

const COUNTRY_ALIASES = {
  zimbabwe: 'zw',
  zim: 'zw',
  zw: 'zw',
  'south africa': 'za',
  rsa: 'za',
  za: 'za',
  botswana: 'bw',
  bw: 'bw',
  zambia: 'zm',
  zm: 'zm',
  mozambique: 'mz',
  mz: 'mz',
  namibia: 'na',
  na: 'na',
  malawi: 'mw',
  mw: 'mw'
};

// Abbreviations people actually type into the booking form.
const STREET_SUFFIXES = {
  st: 'Street',
  str: 'Street',
  rd: 'Road',
  ave: 'Avenue',
  av: 'Avenue',
  dr: 'Drive',
  drv: 'Drive',
  cres: 'Crescent',
  cr: 'Crescent',
  cl: 'Close',
  ln: 'Lane',
  hwy: 'Highway',
  blvd: 'Boulevard',
  ext: 'Extension'
};

// Results scoring more than this below the best one are noise (a same-sounding
// place in another province) rather than a genuine alternative.
const SCORE_SPREAD = 0.35;

// Nominatim's usage policy allows at most 1 request/second from an application.
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_REVERSE_URL = 'https://nominatim.openstreetmap.org/reverse';
const NOMINATIM_MIN_INTERVAL_MS = 1100;
const NOMINATIM_TIMEOUT_MS = 6000;

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 500;

const cache = new Map();

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cached = async (provider, query, loader) => {
  const key = `${provider}:${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.data;
  }

  const data = await loader();

  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Map preserves insertion order, so the first key is the oldest entry.
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, { at: Date.now(), data });
  return data;
};

// ============ Query normalisation ============

const titleCaseToken = (token) => token.charAt(0).toUpperCase() + token.slice(1);

/**
 * Expand street abbreviations inside one comma-separated part of an address.
 * The first token is left alone so a suburb literally called "St Marys" or a
 * house number is never rewritten.
 */
const normalizePart = (part) => {
  const tokens = part.split(/\s+/).filter(Boolean);

  return tokens
    .map((token, index) => {
      if (index === 0) return token;
      const bare = token.replace(/\.$/, '').toLowerCase();
      const expanded = STREET_SUFFIXES[bare];
      return expanded || token;
    })
    .join(' ');
};

const splitParts = (raw) =>
  String(raw)
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map(normalizePart);

/**
 * Build progressively looser versions of the typed address, most specific
 * first. Each variant records the house number it dropped (if any) so the
 * caller can put it back on the matched street.
 */
const buildVariants = (raw) => {
  const cleaned = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];

  const parts = splitParts(cleaned);
  if (!parts.length) return [];

  // Strip a trailing country name — Mapbox and Nominatim are already scoped by
  // country code, and an extra "Zimbabwe" on the end hurts more than it helps.
  const lastPart = parts[parts.length - 1].toLowerCase();
  const countryCode = COUNTRY_ALIASES[lastPart] || null;
  const core = countryCode && parts.length > 1 ? parts.slice(0, -1) : parts;

  const houseMatch = core[0] ? core[0].match(/^(\d+[a-zA-Z]?)\s+(.+)$/) : null;
  const houseNumber = houseMatch ? houseMatch[1] : null;

  const variants = [];
  const add = (partsList, precision) => {
    const query = partsList.filter(Boolean).join(', ');
    if (!query) return;
    if (variants.some((variant) => variant.query.toLowerCase() === query.toLowerCase())) return;
    variants.push({ query, precision, countryCode, houseNumber });
  };

  // When the country was recognised it is passed to the providers as a country
  // code, so repeating it inside the query string only costs a round trip.
  if (!countryCode) add(parts, 'exact');
  add(core, 'exact');
  if (houseMatch) {
    // "19 Mashingwe Street, Mabvuku, Harare" -> "Mashingwe Street, Mabvuku, Harare"
    add([houseMatch[2], ...core.slice(1)], 'street');
  }
  if (core.length > 1) {
    // Neither Mapbox nor OpenStreetMap maps the streets of Zimbabwe's
    // high-density suburbs, so the suburb is often the most precise thing that
    // can be located at all.
    add(core.slice(1), 'area');
  }

  return variants;
};

/**
 * Break the typed address into the pieces used for matching and ranking: the
 * street line, the town it is in, and the country if one was named.
 */
const buildQueryProfile = (rawQuery) => {
  const parts = splitParts(String(rawQuery || '').replace(/\s+/g, ' ').trim());
  if (!parts.length) return null;

  const lastPart = parts[parts.length - 1].toLowerCase();
  const countryCode = COUNTRY_ALIASES[lastPart] || null;
  const core = countryCode && parts.length > 1 ? parts.slice(0, -1) : parts;

  const text = core[0];
  if (!text) return null;

  const houseMatch = text.match(/^(\d+[a-zA-Z]?)\s+(.+)$/);
  const streetText = houseMatch ? houseMatch[2] : text;

  return {
    text,
    countryCode,
    houseNumber: houseMatch ? houseMatch[1] : null,
    tokens: scoreTokens(rawQuery),
    streetTokens: scoreTokens(streetText),
    // The last part before the country — "Harare" in "… , Mabvuku, Harare".
    cityTokens: scoreTokens(core[core.length - 1])
  };
};

const countriesFor = (countryCode) =>
  (countryCode ? [countryCode] : SEARCH_COUNTRY_CODES).map((code) => code.toUpperCase());

// ============ Providers ============

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const searchWithMapbox = async (query, countryCode) => {
  try {
    const result = await mapboxService.searchLocations(query, {
      countries: countriesFor(countryCode),
      limit: 8
    });

    if (!result || !result.success || !Array.isArray(result.data)) return [];

    return result.data
      .map((feature) => {
        const lat = toNumber(feature.coordinates?.latitude);
        const lng = toNumber(feature.coordinates?.longitude);
        if (lat === null || lng === null) return null;

        return {
          address: feature.address || feature.placeName || query,
          placeName: feature.placeName || '',
          city: feature.context?.city || feature.context?.locality || '',
          region: feature.context?.region || '',
          country: feature.context?.country || '',
          countryCode: feature.context?.countryCode || '',
          lat,
          lng,
          type: feature.type || 'location',
          relevance: toNumber(feature.relevance) ?? 0.5,
          // getFallbackSearch() marks its hard-coded city list this way; those
          // are city centres, not the address that was asked for.
          source: feature.isFallback ? 'estimated' : 'mapbox',
          approximate: Boolean(feature.isFallback)
        };
      })
      .filter(Boolean);
  } catch (error) {
    console.error('Mapbox address search error:', error.message);
    return [];
  }
};

let nominatimQueue = Promise.resolve();
let lastNominatimAt = 0;

/** Serialise Nominatim calls to at most one per NOMINATIM_MIN_INTERVAL_MS. */
const scheduleNominatim = (task) => {
  const run = nominatimQueue.then(async () => {
    const waitFor = NOMINATIM_MIN_INTERVAL_MS - (Date.now() - lastNominatimAt);
    if (waitFor > 0) await sleep(waitFor);
    lastNominatimAt = Date.now();
    return task();
  });

  // Keep the chain alive even if this task rejects.
  nominatimQueue = run.then(() => undefined, () => undefined);
  return run;
};

const nominatimUserAgent = () =>
  process.env.NOMINATIM_USER_AGENT ||
  `PalmTrent-Transport/1.0 (${process.env.NOMINATIM_CONTACT_EMAIL || 'support@palmtrent.com'})`;

const searchWithNominatim = async (query, countryCode) =>
  scheduleNominatim(async () => {
    try {
      const response = await axios.get(NOMINATIM_URL, {
        params: {
          q: query,
          format: 'jsonv2',
          addressdetails: 1,
          limit: 8,
          countrycodes: (countryCode ? [countryCode] : SEARCH_COUNTRY_CODES).join(',')
        },
        headers: { 'User-Agent': nominatimUserAgent() },
        timeout: NOMINATIM_TIMEOUT_MS
      });

      if (!Array.isArray(response.data)) return [];

      return response.data
        .map((result) => {
          const lat = toNumber(result.lat);
          const lng = toNumber(result.lon);
          if (lat === null || lng === null) return null;

          const details = result.address || {};
          return {
            address: result.display_name,
            placeName: result.name || String(result.display_name).split(',')[0],
            city: details.city || details.town || details.village || details.municipality || '',
            region: details.state || '',
            country: details.country || '',
            countryCode: (details.country_code || '').toUpperCase(),
            lat,
            lng,
            type: result.type || 'location',
            // Nominatim's importance is 0..1 but skews low; treat it as a mild
            // signal rather than a Mapbox-style relevance score.
            relevance: Math.min(1, (toNumber(result.importance) ?? 0.2) + 0.5),
            source: 'nominatim',
            approximate: false
          };
        })
        .filter(Boolean);
    } catch (error) {
      console.error('Nominatim address search error:', error.message);
      return [];
    }
  });

// ============ Merging and ranking ============

const normalizeAddressKey = (address) =>
  String(address || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const coordKey = (result) => `${result.lat.toFixed(4)},${result.lng.toFixed(4)}`;

const IGNORED_SCORE_TOKENS = new Set([
  ...Object.keys(COUNTRY_ALIASES),
  ...Object.values(STREET_SUFFIXES).map((suffix) => suffix.toLowerCase()),
  ...Object.keys(STREET_SUFFIXES)
]);

const scoreTokens = (raw) =>
  String(raw || '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !IGNORED_SCORE_TOKENS.has(token));

const scoreResult = (result, profile) => {
  const haystack = normalizeAddressKey(result.address);
  const tokens = profile?.tokens || [];
  const matched = tokens.filter((token) => haystack.includes(token)).length;

  let score = tokens.length ? matched / tokens.length : 0.5;
  score += (result.relevance || 0) * 0.2;

  if (result.precision === 'exact') score += 0.15;
  else if (result.precision === 'street') score += 0.05;
  else if (result.precision === 'area') score -= 0.05;

  if (result.approximate) score -= 0.1;
  if (result.source === 'estimated') score -= 0.4;

  // A street with the right name in the wrong town is worse than useless — the
  // region is full of streets named after the same people.
  if (profile?.cityTokens.length && !profile.cityTokens.every((token) => haystack.includes(token))) {
    score -= 0.5;
  }

  const resultCountry = (result.countryCode || '').toLowerCase();
  if (resultCountry) {
    if (profile?.countryCode) {
      if (resultCountry !== profile.countryCode) score -= 0.5;
    } else if (resultCountry !== 'zw') {
      // No country was named, and this is a Zimbabwean operator.
      score -= 0.4;
    }
  }

  return score;
};

/**
 * Reconcile a provider's answer with what the shipper actually typed.
 *
 * Neither provider maps the streets of Zimbabwe's high-density suburbs, so
 * "19 Mashingwe Street, Mabvuku, Harare" comes back as plain "Mabvuku, Harare".
 * Dropping the shipper's text would leave the driver with a suburb and nothing
 * else, so it is kept and the result is marked as coarser than it reads:
 *
 *   exact  - the provider matched the street (and number, if one was given)
 *   street - the street matched, the house number is not mapped
 *   area   - only the suburb/city matched; the street line is the shipper's own
 */
/**
 * Does this result name both the street and the town the shipper typed? A hit
 * on the street alone is not enough — "Samora Machel Street, Durban" must not
 * count as having found "Samora Machel Avenue, Harare".
 */
const matchesTypedAddress = (result, profile) => {
  if (!profile || !profile.streetTokens.length) return true;
  const haystack = normalizeAddressKey(result.address);
  return [...profile.streetTokens, ...profile.cityTokens].every((token) =>
    haystack.includes(token)
  );
};

const alignToTypedAddress = (result, lead) => {
  if (!lead || !lead.text) return { ...result, precision: 'exact' };

  const haystack = normalizeAddressKey(result.address);
  const streetMatched =
    lead.streetTokens.length > 0 && lead.streetTokens.every((token) => haystack.includes(token));

  if (!streetMatched) {
    return {
      ...result,
      address: `${lead.text}, ${result.address}`,
      approximate: true,
      precision: 'area'
    };
  }

  const numberMatched =
    !lead.houseNumber || new RegExp(`(^|\\s)${lead.houseNumber}(\\s|$)`).test(haystack);

  if (!numberMatched) {
    return {
      ...result,
      address: `${lead.houseNumber} ${result.address}`,
      approximate: true,
      precision: 'street'
    };
  }

  return { ...result, precision: 'exact' };
};

/**
 * Search for addresses across every configured provider, relaxing the query
 * until something is found.
 *
 * @param {string} rawQuery - Address as typed by the user
 * @param {object} options  - { limit }
 * @returns {Promise<Array>} Ranked, de-duplicated matches
 */
const searchAddresses = async (rawQuery, options = {}) => {
  const limit = options.limit || 8;
  const variants = buildVariants(rawQuery);
  if (!variants.length) return [];

  const collected = [];
  const seenCoords = new Set();
  const seenAddresses = new Set();

  const collect = (results, variant) => {
    for (const result of results) {
      const byCoord = coordKey(result);
      const byAddress = normalizeAddressKey(result.address);
      if (seenCoords.has(byCoord) || seenAddresses.has(byAddress)) continue;

      seenCoords.add(byCoord);
      seenAddresses.add(byAddress);
      collected.push({ ...result, precision: variant.precision });
    }
  };

  const profile = buildQueryProfile(rawQuery);

  // Mapbox is not rate limited, so every variant goes out at once.
  const mapboxRounds = await Promise.all(
    variants.map((variant) =>
      cached('mapbox', variant.query, () => searchWithMapbox(variant.query, variant.countryCode))
    )
  );
  mapboxRounds.forEach((results, index) => collect(results, variants[index]));

  // Only pay for OpenStreetMap when nothing Mapbox returned actually names the
  // street that was typed. Its calls are throttled to one per second, so they
  // are fired together and the area-level variant is skipped — Mapbox already
  // covers suburbs and cities well.
  if (!collected.some((result) => matchesTypedAddress(result, profile))) {
    const osmVariants = variants.filter((variant) => variant.precision !== 'area');
    const osmRounds = await Promise.all(
      osmVariants.map((variant) =>
        cached('nominatim', variant.query, () =>
          searchWithNominatim(variant.query, variant.countryCode)
        )
      )
    );
    osmRounds.forEach((results, index) => collect(results, osmVariants[index]));
  }

  // Rank on what the providers actually returned, then restore the shipper's
  // own wording — otherwise every result would score alike once the typed
  // street line is pasted back on.
  const ranked = collected
    .map((result) => ({ result, score: scoreResult(result, profile) }))
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return [];

  const floor = ranked[0].score - SCORE_SPREAD;
  return ranked
    .filter((entry, index) => index === 0 || entry.score >= floor)
    .slice(0, limit)
    .map(({ result }) => {
      const aligned = alignToTypedAddress(result, profile);
      return {
        ...aligned,
        coordinates: { latitude: aligned.lat, longitude: aligned.lng }
      };
    });
};

/**
 * Resolve a single address to its best match.
 *
 * @param {string} rawQuery
 * @returns {Promise<object|null>}
 */
const resolveAddress = async (rawQuery) => {
  const results = await searchAddresses(rawQuery, { limit: 5 });
  if (!results.length) return null;

  const [best] = results;
  return {
    address: best.address,
    placeName: best.placeName,
    coordinates: { latitude: best.lat, longitude: best.lng },
    context: {
      city: best.city,
      region: best.region,
      country: best.country,
      countryCode: best.countryCode
    },
    approximate: Boolean(best.approximate),
    source: best.source,
    allResults: results.map((result) => ({
      address: result.address,
      placeName: result.placeName,
      coordinates: result.coordinates,
      approximate: Boolean(result.approximate),
      source: result.source
    }))
  };
};

// ============ Reverse lookup ============

/** How specific an address string is, used to pick the better of two answers. */
const detailLevel = (address) =>
  String(address || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean).length;

const reverseWithNominatim = async (latitude, longitude) =>
  scheduleNominatim(async () => {
    try {
      const response = await axios.get(NOMINATIM_REVERSE_URL, {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'jsonv2',
          addressdetails: 1,
          zoom: 18
        },
        headers: { 'User-Agent': nominatimUserAgent() },
        timeout: NOMINATIM_TIMEOUT_MS
      });

      const result = response.data;
      if (!result || !result.display_name) return null;

      const details = result.address || {};
      const houseAndRoad = [details.house_number, details.road].filter(Boolean).join(' ');

      return {
        address: result.display_name,
        placeName: houseAndRoad || result.name || details.suburb || '',
        city: details.city || details.town || details.village || details.municipality || '',
        region: details.state || '',
        country: details.country || '',
        countryCode: (details.country_code || '').toUpperCase(),
        hasStreet: Boolean(details.road),
        source: 'nominatim'
      };
    } catch (error) {
      console.error('Nominatim reverse lookup error:', error.message);
      return null;
    }
  });

/**
 * Turn coordinates into the most specific address available.
 *
 * Mapbox usually answers a Zimbabwean coordinate with nothing more precise than
 * "Harare, Zimbabwe", which is useless as a pickup address, so OpenStreetMap is
 * consulted whenever the Mapbox answer has no street in it.
 *
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<object|null>}
 */
const reverseLookup = async (latitude, longitude) => {
  let best = null;

  try {
    const result = await mapboxService.reverseGeocode(latitude, longitude);
    if (result?.success && result.data?.address && !result.data.isFallback) {
      best = {
        address: result.data.address,
        placeName: result.data.placeName || '',
        city: result.data.context?.city || '',
        region: result.data.context?.region || '',
        country: result.data.context?.country || '',
        countryCode: result.data.context?.countryCode || '',
        hasStreet: /^\d/.test(result.data.address),
        source: 'mapbox'
      };
    }
  } catch (error) {
    console.error('Mapbox reverse lookup error:', error.message);
  }

  if (best?.hasStreet && detailLevel(best.address) >= 3) return best;

  const osm = await reverseWithNominatim(latitude, longitude);
  if (!osm) return best;
  if (!best) return osm;

  // Prefer whichever answer actually names a street, then whichever is richer.
  if (osm.hasStreet && !best.hasStreet) return osm;
  if (best.hasStreet && !osm.hasStreet) return best;
  return detailLevel(osm.address) > detailLevel(best.address) ? osm : best;
};

module.exports = {
  searchAddresses,
  resolveAddress,
  reverseLookup,
  // Exported for tests.
  buildVariants
};
