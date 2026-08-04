// Mapbox setup for the mobile app — rendered through react-native-webview using
// Mapbox GL JS (loaded from Mapbox's CDN). This avoids the native @rnmapbox/maps
// SDK (which needs a downloads token + native build) and works in any Expo build.
//
// Only ONE token is required: a PUBLIC token (pk.*) set in app.json under
// expo.extra.mapboxPublicToken, used at runtime to render tiles.
import Constants from 'expo-constants';

const token = Constants.expoConfig?.extra?.mapboxPublicToken;

const MAPBOX_GL_VERSION = 'v3.7.0';

export const getMapboxToken = () => token;

export const isMapboxConfigured = () =>
  Boolean(token && !String(token).includes('PLACEHOLDER'));

// Kept for backwards compatibility with callers that used the native init.
// The WebView map needs no global initialization, so this is a no-op that just
// reports whether a usable token is present.
export const initMapbox = () => isMapboxConfigured();

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : null);

// Convert a { latitude, longitude } coord into a [lng, lat] pair, or null.
const toLngLat = (coord) => {
  if (!coord) return null;
  const lng = num(coord.longitude ?? coord.lng);
  const lat = num(coord.latitude ?? coord.lat);
  if (lng === null || lat === null) return null;
  return [lng, lat];
};

/**
 * Build the self-contained HTML document for a tracking map.
 * @param {object} opts
 * @param {object} opts.center       { latitude, longitude } initial center
 * @param {object} [opts.pickup]     { latitude, longitude } pickup marker
 * @param {object} [opts.delivery]   { latitude, longitude } delivery marker
 * @param {object} [opts.vehicle]    { latitude, longitude } current vehicle marker
 * @param {number} [opts.zoom]       initial zoom level
 * @returns {string} HTML string for a WebView `source={{ html }}`
 *
 * The document exposes window.updateVehicle(lng, lat) so the RN side can move the
 * vehicle marker and re-center the camera via WebView.injectJavaScript without a
 * full reload.
 */
export const buildTrackingMapHtml = ({ center, pickup, delivery, vehicle, zoom = 12 } = {}) => {
  const centerLngLat = toLngLat(center) || toLngLat(pickup) || toLngLat(delivery) || [31.0335, -17.8252]; // Harare fallback
  const pickupLngLat = toLngLat(pickup);
  const deliveryLngLat = toLngLat(delivery);
  const vehicleLngLat = toLngLat(vehicle);

  const data = JSON.stringify({
    token: token || '',
    center: centerLngLat,
    zoom,
    pickup: pickupLngLat,
    delivery: deliveryLngLat,
    vehicle: vehicleLngLat
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://api.mapbox.com/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; }
    .veh { width: 30px; height: 30px; border-radius: 15px; background: #0C2D48; border: 3px solid #fff;
           box-shadow: 0 0 0 2px rgba(12,45,72,0.3); display: flex; align-items: center; justify-content: center; }
    .veh:after { content: ''; width: 10px; height: 10px; border-radius: 5px; background: #fff; }
    .pin { width: 18px; height: 18px; border-radius: 9px; border: 3px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,0.2); }
    .pin-pickup { background: #16a34a; }
    .pin-delivery { background: #dc2626; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var CFG = ${data};
    var vehMarker = null;
    var map = null;
    function makeEl(cls) { var d = document.createElement('div'); d.className = cls; return d; }
    try {
      mapboxgl.accessToken = CFG.token;
      map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: CFG.center,
        zoom: CFG.zoom
      });
      map.on('load', function () {
        if (CFG.pickup) new mapboxgl.Marker(makeEl('pin pin-pickup')).setLngLat(CFG.pickup).addTo(map);
        if (CFG.delivery) new mapboxgl.Marker(makeEl('pin pin-delivery')).setLngLat(CFG.delivery).addTo(map);
        if (CFG.pickup && CFG.delivery) {
          map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: {
            type: 'LineString', coordinates: [CFG.pickup, CFG.delivery] } } });
          map.addLayer({ id: 'route', type: 'line', source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#0C2D48', 'line-width': 3, 'line-dasharray': [2, 2] } });
        }
        if (CFG.vehicle) { vehMarker = new mapboxgl.Marker(makeEl('veh')).setLngLat(CFG.vehicle).addTo(map); }
      });
    } catch (e) {
      document.body.innerHTML = '<div style="padding:16px;font-family:sans-serif;color:#6b7280">Unable to load map.</div>';
    }
    window.updateVehicle = function (lng, lat) {
      if (!map) return;
      var pos = [Number(lng), Number(lat)];
      if (!isFinite(pos[0]) || !isFinite(pos[1])) return;
      if (vehMarker) { vehMarker.setLngLat(pos); }
      else { vehMarker = new mapboxgl.Marker(makeEl('veh')).setLngLat(pos).addTo(map); }
      map.easeTo({ center: pos, duration: 600 });
    };
    true;
  </script>
</body>
</html>`;
};

/**
 * Build the HTML for the pin-drop location picker.
 *
 * The pin is a fixed overlay at the centre of the screen and the map moves
 * underneath it — the same gesture ride-hailing apps use. That matters here
 * because most streets in Zimbabwe's high-density suburbs are not in any
 * geocoder: dropping a pin produces exact coordinates for an address no
 * provider can find by name.
 *
 * Messages posted to React Native:
 *   { type: 'ready' }                     map finished loading
 *   { type: 'moving' }                    user started dragging
 *   { type: 'moved', lat, lng }           gesture settled on a position
 *   { type: 'error', message }            map could not start
 *
 * Exposes window.recenter(lng, lat) so RN can jump the map to a fresh GPS fix.
 *
 * @param {object} opts
 * @param {object} [opts.center] { latitude, longitude } initial centre
 * @param {number} [opts.zoom]
 * @returns {string} HTML string for a WebView `source={{ html }}`
 */
export const buildLocationPickerHtml = ({ center, zoom = 16, reportOnLoad = true } = {}) => {
  const data = JSON.stringify({
    token: token || '',
    center: toLngLat(center) || [31.0335, -17.8252], // Harare fallback
    zoom,
    // False when RN is about to recentre on a GPS fix — stops the fallback
    // centre being reported and reverse-geocoded for nothing.
    reportOnLoad: reportOnLoad !== false
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link href="https://api.mapbox.com/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.css" rel="stylesheet" />
  <script src="https://api.mapbox.com/mapbox-gl-js/${MAPBOX_GL_VERSION}/mapbox-gl.js"></script>
  <style>
    body, html, #map { margin: 0; padding: 0; height: 100%; width: 100%; overflow: hidden; }
    /* The pin never moves — the map does. Sits above the map, ignores taps. */
    #pin { position: absolute; left: 50%; top: 50%; width: 32px; height: 44px;
           margin-left: -16px; margin-top: -44px; pointer-events: none; z-index: 5; }
    #pin .head { width: 32px; height: 32px; border-radius: 16px; background: #0C2D48;
                 border: 4px solid #fff; box-sizing: border-box;
                 box-shadow: 0 2px 6px rgba(0,0,0,0.35); }
    #pin .stem { width: 3px; height: 12px; background: #0C2D48; margin: 0 auto;
                 box-shadow: 0 1px 3px rgba(0,0,0,0.35); }
    /* Grows while dragging so it reads as "floating" above the ground. */
    #shadow { position: absolute; left: 50%; top: 50%; width: 12px; height: 5px;
              margin-left: -6px; margin-top: -3px; border-radius: 50%;
              background: rgba(0,0,0,0.28); z-index: 4; pointer-events: none;
              transition: transform 140ms ease-out; }
    #pin { transition: transform 140ms ease-out; }
    body.dragging #pin { transform: translateY(-8px); }
    body.dragging #shadow { transform: scale(1.5); }
    #err { padding: 16px; font-family: sans-serif; color: #6b7280; }
  </style>
</head>
<body>
  <div id="map"></div>
  <div id="shadow"></div>
  <div id="pin"><div class="head"></div><div class="stem"></div></div>
  <script>
    var CFG = ${data};
    var map = null;

    function send(payload) {
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    }

    function report() {
      if (!map) return;
      var c = map.getCenter();
      send({ type: 'moved', lat: c.lat, lng: c.lng });
    }

    try {
      mapboxgl.accessToken = CFG.token;
      map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/mapbox/streets-v12',
        center: CFG.center,
        zoom: CFG.zoom,
        attributionControl: false
      });

      map.on('load', function () {
        send({ type: 'ready' });
        if (CFG.reportOnLoad) report();
      });
      map.on('movestart', function () {
        document.body.classList.add('dragging');
        send({ type: 'moving' });
      });
      map.on('moveend', function () {
        document.body.classList.remove('dragging');
        report();
      });
    } catch (e) {
      document.body.innerHTML = '<div id="err">Unable to load the map.</div>';
      send({ type: 'error', message: String(e && e.message ? e.message : e) });
    }

    window.recenter = function (lng, lat, zoomTo) {
      if (!map) return;
      var pos = [Number(lng), Number(lat)];
      if (!isFinite(pos[0]) || !isFinite(pos[1])) return;
      map.easeTo({ center: pos, zoom: Number(zoomTo) || map.getZoom(), duration: 500 });
    };
    true;
  </script>
</body>
</html>`;
};
