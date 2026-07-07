// Central Mapbox GL setup for the mobile app.
//
// Two tokens are required (see https://docs.mapbox.com/):
// - A PUBLIC token (pk.*) set in app.json under expo.extra.mapboxPublicToken —
//   used at runtime to render map tiles.
// - A DOWNLOADS token (sk.* with DOWNLOADS:READ scope) set in the @rnmapbox/maps
//   plugin config in app.json — used at build time to fetch the native SDK.
// Replace the *_PLACEHOLDER values in app.json with real tokens before building.
import Mapbox from '@rnmapbox/maps';
import Constants from 'expo-constants';

const token = Constants.expoConfig?.extra?.mapboxPublicToken;

let initialized = false;

export const isMapboxConfigured = () =>
  Boolean(token && !String(token).includes('PLACEHOLDER'));

// Idempotent — safe to call from every screen that renders a map.
export const initMapbox = () => {
  if (!initialized && isMapboxConfigured()) {
    Mapbox.setAccessToken(token);
    initialized = true;
  }
  return isMapboxConfigured();
};

export default Mapbox;
