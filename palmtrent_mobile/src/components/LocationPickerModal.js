// src/components/LocationPickerModal.js
//
// Pin-drop location picker.
//
// Typing an address does not work reliably in Zimbabwe — most streets in the
// high-density suburbs are in no geocoder, so "19 Mashingwe St, Mabvuku" cannot
// be looked up by name. Dropping a pin sidesteps that entirely: the shipper
// puts the marker on the actual gate and the transporter gets exact
// coordinates. The reverse-geocoded text is only a human-readable label.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { buildLocationPickerHtml, isMapboxConfigured } from '../services/mapboxConfig';
import locationService from '../services/locationService';

const ADDRESS_LOOKUP_DELAY_MS = 600;

/**
 * @param {object}   props
 * @param {boolean}  props.visible
 * @param {string}   props.title            e.g. "Set pickup point"
 * @param {object}   [props.initialCoords]  { latitude, longitude } to open at
 * @param {string}   [props.initialAddress] shown until the first lookup lands
 * @param {function} props.onCancel
 * @param {function} props.onConfirm        ({ latitude, longitude, address })
 */
const LocationPickerModal = ({
  visible,
  title = 'Set location',
  initialCoords = null,
  initialAddress = '',
  onCancel,
  onConfirm
}) => {
  const webRef = useRef(null);
  const lookupTimerRef = useRef(null);
  const lookupSeqRef = useRef(0);
  // A GPS fix that arrived before the map finished loading; applied on 'ready'.
  const pendingCenterRef = useRef(null);
  const mapReadyRef = useRef(false);

  const [mapHtml, setMapHtml] = useState(null);
  const [coords, setCoords] = useState(initialCoords);
  const [address, setAddress] = useState(initialAddress);
  const [addressLoading, setAddressLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [mapError, setMapError] = useState(null);

  const configured = isMapboxConfigured();

  // Build the document once per opening. Rebuilding on every pin move would
  // reload the WebView and throw away the shipper's pan/zoom.
  useEffect(() => {
    if (!visible) {
      setMapHtml(null);
      return;
    }

    setCoords(initialCoords);
    setAddress(initialAddress);
    setMapError(null);
    mapReadyRef.current = false;
    pendingCenterRef.current = null;

    setMapHtml(
      buildLocationPickerHtml({
        center: initialCoords,
        zoom: initialCoords ? 16 : 12,
        reportOnLoad: Boolean(initialCoords)
      })
    );

    // No starting point: ask the device where we are and fly there.
    if (!initialCoords) locateMe({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => () => clearTimeout(lookupTimerRef.current), []);

  const lookUpAddress = useCallback((latitude, longitude) => {
    clearTimeout(lookupTimerRef.current);
    setAddressLoading(true);

    lookupTimerRef.current = setTimeout(async () => {
      const seq = ++lookupSeqRef.current;
      try {
        const place = await locationService.reverseGeocode(latitude, longitude);
        if (seq !== lookupSeqRef.current) return; // pin moved again
        setAddress(place.fullAddress || place.address || '');
      } catch (error) {
        if (seq !== lookupSeqRef.current) return;
        setAddress('');
      } finally {
        if (seq === lookupSeqRef.current) setAddressLoading(false);
      }
    }, ADDRESS_LOOKUP_DELAY_MS);
  }, []);

  const recenterMap = useCallback((latitude, longitude) => {
    if (!mapReadyRef.current) {
      // The map is still loading — hold the fix and apply it on 'ready'.
      pendingCenterRef.current = { latitude, longitude };
      return;
    }
    webRef.current?.injectJavaScript(
      `window.recenter && window.recenter(${longitude}, ${latitude}, 16); true;`
    );
  }, []);

  const locateMe = useCallback(
    async ({ silent = false } = {}) => {
      setLocating(true);
      try {
        const position = await locationService.getCurrentLocationWithAddress();
        recenterMap(position.latitude, position.longitude);
        setCoords({ latitude: position.latitude, longitude: position.longitude });
        setAddress(position.address);
      } catch (error) {
        if (!silent) setMapError(error.message);
      } finally {
        setLocating(false);
      }
    },
    [recenterMap]
  );

  const handleMessage = useCallback(
    (event) => {
      let payload;
      try {
        payload = JSON.parse(event.nativeEvent.data);
      } catch (_) {
        return;
      }

      if (payload.type === 'ready') {
        mapReadyRef.current = true;
        const pending = pendingCenterRef.current;
        pendingCenterRef.current = null;
        if (pending) recenterMap(pending.latitude, pending.longitude);
        return;
      }

      if (payload.type === 'moving') {
        // Clear the stale label immediately so it can never be confirmed
        // against a position the shipper has already moved away from.
        clearTimeout(lookupTimerRef.current);
        lookupSeqRef.current += 1;
        setAddressLoading(true);
        return;
      }

      if (payload.type === 'moved') {
        setCoords({ latitude: payload.lat, longitude: payload.lng });
        lookUpAddress(payload.lat, payload.lng);
        return;
      }

      if (payload.type === 'error') {
        setMapError(payload.message || 'The map could not be loaded.');
      }
    },
    [lookUpAddress, recenterMap]
  );

  const confirm = () => {
    if (!coords) return;
    onConfirm({
      latitude: coords.latitude,
      longitude: coords.longitude,
      // Fall back to the coordinates so the field is never left blank.
      address:
        address ||
        `Pinned location (${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)})`
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <SafeAreaView edges={['top', 'left', 'right', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel} style={styles.headerButton} hitSlop={12}>
            <MaterialIcons name="close" size={24} color="#0C2D48" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={styles.headerButton} />
        </View>

        <View style={styles.mapArea}>
          {!configured || mapError ? (
            <View style={styles.mapFallback}>
              <MaterialIcons name="location-off" size={44} color="#9ca3af" />
              <Text style={styles.mapFallbackText}>
                {mapError || 'Map is unavailable. Type the address instead.'}
              </Text>
            </View>
          ) : (
            mapHtml && (
              <WebView
                ref={webRef}
                style={styles.map}
                originWhitelist={['*']}
                source={{ html: mapHtml }}
                javaScriptEnabled
                domStorageEnabled
                onMessage={handleMessage}
              />
            )
          )}

          <TouchableOpacity
            style={styles.locateButton}
            onPress={() => locateMe()}
            disabled={locating}
          >
            {locating ? (
              <ActivityIndicator size="small" color="#0C2D48" />
            ) : (
              <MaterialIcons name="my-location" size={22} color="#0C2D48" />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerHint}>Drag the map to place the pin</Text>

          <View style={styles.addressRow}>
            <MaterialIcons name="place" size={18} color="#0C2D48" />
            {addressLoading ? (
              <Text style={styles.addressPending}>Looking up address…</Text>
            ) : (
              <Text style={styles.addressText} numberOfLines={2}>
                {address || 'Move the map to choose a point'}
              </Text>
            )}
          </View>

          {coords && (
            <Text style={styles.coordText}>
              {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
            </Text>
          )}

          <TouchableOpacity
            style={[styles.confirmButton, !coords && styles.confirmButtonDisabled]}
            onPress={confirm}
            disabled={!coords}
          >
            <Text style={styles.confirmButtonText}>Confirm this point</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb'
  },
  headerButton: { width: 32, alignItems: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '600', color: '#0C2D48' },
  mapArea: { flex: 1 },
  map: { flex: 1 },
  mapFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  mapFallbackText: { textAlign: 'center', color: '#6b7280', fontSize: 14 },
  locateButton: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 8
  },
  footerHint: { fontSize: 12, color: '#9ca3af' },
  addressRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  addressText: { flex: 1, fontSize: 15, color: '#111827' },
  addressPending: { flex: 1, fontSize: 15, color: '#9ca3af' },
  coordText: { fontSize: 12, color: '#6b7280', marginLeft: 26 },
  confirmButton: {
    backgroundColor: '#0C2D48',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4
  },
  confirmButtonDisabled: { backgroundColor: '#9ca3af' },
  confirmButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});

export default LocationPickerModal;
