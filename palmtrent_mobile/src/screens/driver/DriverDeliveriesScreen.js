// The driver's operational home: the job(s) they are currently assigned to
// carry. Lets the driver see the vehicle, see/track the shipment, advance its
// status through the delivery lifecycle, share their live location, capture
// proof of delivery, and raise an SOS.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import apiService from '../../services/apiService';
import socketService from '../../services/socketService';
import SOSButton from '../components/SOSButton';
import { vehicleLabel } from '../../utils/labels';

const bookingIdOf = (shipment) => shipment?.booking?._id || shipment?.booking || shipment?.bookingReference;

// Statuses during which the driver's position should be streamed automatically —
// the moment the trip is under way, the shipper must see live movement without
// the driver having to remember to tap "Go live".
const AUTO_TRACK_STATUSES = ['en_route_pickup', 'picked_up', 'in_transit', 'arrived_delivery'];

// Maps the current shipment status to the next forward action a driver can take.
// Mirrors the backend shipment transition rules.
const NEXT_ACTION = {
  assigned: { label: 'Start Pickup Trip', next: 'en_route_pickup', icon: 'navigation' },
  en_route_pickup: { label: 'Confirm Pickup', next: 'picked_up', icon: 'inventory' },
  picked_up: { label: 'Start Transit', next: 'in_transit', icon: 'local-shipping' },
  in_transit: { label: 'Arrived at Delivery', next: 'arrived_delivery', icon: 'place' },
  arrived_delivery: { label: 'Confirm Delivery', next: 'delivered', icon: 'check-circle' }
};

const STATUS_LABEL = (status) => String(status || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

const DriverDeliveriesScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shipments, setShipments] = useState([]);
  const [busyId, setBusyId] = useState('');
  const [liveId, setLiveId] = useState('');
  const watchRef = useRef(null);

  // Connect the socket once so live location broadcasts have a channel, and stop
  // any active location watch when the screen unmounts.
  useEffect(() => {
    if (!socketService.getConnectionStatus().isConnected) {
      socketService.connect();
    }
    return () => {
      if (watchRef.current) {
        watchRef.current.remove();
        watchRef.current = null;
      }
    };
  }, []);

  const stopLiveTracking = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    setLiveId('');
  }, []);

  const startLiveTracking = async (shipment, { silent = false } = {}) => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      if (!silent) {
        Alert.alert('Location', 'Location permission is required to broadcast your position.');
      }
      return;
    }
    if (!socketService.getConnectionStatus().isConnected) {
      await socketService.connect();
    }
    const bookingId = bookingIdOf(shipment);
    // Replace any previous watch before starting a new one.
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    // Send an immediate fix so trackers don't wait for the first movement.
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      .then((position) => {
        socketService.updateLocation(
          position.coords.latitude,
          position.coords.longitude,
          bookingId,
          position.coords.heading || 0,
          position.coords.speed || 0
        );
      })
      .catch(() => {});
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 25 },
      (position) => {
        socketService.updateLocation(
          position.coords.latitude,
          position.coords.longitude,
          bookingId,
          position.coords.heading || 0,
          position.coords.speed || 0
        );
      }
    );
    setLiveId(shipment._id);
    if (!silent) {
      Alert.alert('Live tracking on', 'Your location is now shared live with the shipper and transporter.');
    }
  };

  const toggleLiveTracking = (shipment) => {
    if (liveId === shipment._id) {
      stopLiveTracking();
    } else {
      startLiveTracking(shipment).catch((error) => {
        Alert.alert('Live tracking', error.message || 'Could not start live tracking.');
      });
    }
  };

  const loadData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true); else setLoading(true);
      const response = await apiService.getDriverShipments('active');
      setShipments(response.data || []);
    } catch (error) {
      Alert.alert('Deliveries', error.message || 'Unable to load your deliveries.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-start live tracking when a delivery is under way, and stop it when the
  // tracked shipment is no longer active. The manual "Go live" toggle remains as
  // an override.
  useEffect(() => {
    if (liveId) {
      const stillActive = shipments.some(
        (shipment) => shipment._id === liveId && AUTO_TRACK_STATUSES.includes(shipment.status)
      );
      if (!stillActive) stopLiveTracking();
      return;
    }

    const activeShipment = shipments.find((shipment) => AUTO_TRACK_STATUSES.includes(shipment.status));
    if (activeShipment) {
      startLiveTracking(activeShipment, { silent: true }).catch((error) => {
        console.error('Auto live tracking error:', error);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipments, liveId]);

  const advanceStatus = async (shipment) => {
    const action = NEXT_ACTION[shipment.status];
    if (!action) return;
    setBusyId(shipment._id);
    try {
      const response = await apiService.updateStatus(shipment._id, action.next, `${action.label} by driver`);
      if (response.success) {
        Alert.alert('Updated', `${action.label} confirmed.`);
        loadData(true);
      } else {
        Alert.alert('Update failed', response.message || 'Could not update the delivery.');
      }
    } catch (error) {
      Alert.alert('Update failed', error.message || 'Could not update the delivery.');
    } finally {
      setBusyId('');
    }
  };

  const shareLocation = async (shipment) => {
    setBusyId(shipment._id);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location', 'Location permission is required to share your position.');
        return;
      }
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const response = await apiService.updateLocation(
        shipment._id,
        position.coords.latitude,
        position.coords.longitude,
        'Driver location update'
      );
      // Also push it live over the socket so trackers see it immediately.
      socketService.updateLocation(
        position.coords.latitude,
        position.coords.longitude,
        bookingIdOf(shipment),
        position.coords.heading || 0,
        position.coords.speed || 0
      );
      if (response.success) {
        Alert.alert('Location shared', 'Your current location was sent to the shipper and transporter.');
      } else {
        Alert.alert('Location', response.message || 'Could not share your location.');
      }
    } catch (error) {
      Alert.alert('Location', error.message || 'Could not share your location.');
    } finally {
      setBusyId('');
    }
  };

  const captureProof = async (shipment) => {
    setBusyId(shipment._id);
    try {
      if (Platform.OS !== 'web') {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Camera', 'Camera access is required to capture delivery proof.');
          return;
        }
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8
      });
      if (result.canceled) return;

      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      const formData = new FormData();
      formData.append('files', {
        uri,
        name: `pod-${Date.now()}.jpg`,
        type: 'image/jpeg'
      });

      const response = await apiService.uploadProofOfDelivery(shipment._id, formData);
      if (response.success) {
        Alert.alert('Proof uploaded', 'Delivery proof was attached to this shipment.');
        loadData(true);
      } else {
        Alert.alert('Upload failed', response.message || 'Could not upload delivery proof.');
      }
    } catch (error) {
      Alert.alert('Upload failed', error.message || 'Could not upload delivery proof.');
    } finally {
      setBusyId('');
    }
  };

  const callContact = (phone) => {
    if (!phone) return;
    Linking.openURL(`tel:${phone}`).catch(() => {});
  };

  const renderShipment = (shipment) => {
    const action = NEXT_ACTION[shipment.status];
    const inDeliveryPhase = ['in_transit', 'arrived_delivery', 'delivered'].includes(shipment.status);
    const vehicle = shipment.vehicle || {};
    const busy = busyId === shipment._id;

    return (
      <View key={shipment._id} style={styles.card}>
        <View style={styles.cardTop}>
          <Text style={styles.reference}>{shipment.bookingReference || shipment.shipmentId || 'Delivery'}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{STATUS_LABEL(shipment.status)}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeRow}>
          <MaterialIcons name="trip-origin" size={18} color="#16a34a" />
          <Text style={styles.routeText}>{shipment.route?.pickup?.address || shipment.origin || 'Pickup location'}</Text>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routeRow}>
          <MaterialIcons name="place" size={18} color="#dc2626" />
          <Text style={styles.routeText}>{shipment.route?.delivery?.address || shipment.destination || 'Delivery location'}</Text>
        </View>

        {/* Vehicle */}
        <View style={styles.metaRow}>
          <MaterialIcons name="local-shipping" size={18} color="#0C2D48" />
          <Text style={styles.metaText}>
            {vehicle.registrationNumber ? vehicleLabel(vehicle) : 'Vehicle not set'}
          </Text>
        </View>

        {/* Transporter contact */}
        {shipment.transporter && (
          <TouchableOpacity style={styles.metaRow} onPress={() => callContact(shipment.transporter.phone)}>
            <MaterialIcons name="phone" size={18} color="#0C2D48" />
            <Text style={styles.metaText}>
              {shipment.transporter.fullName || 'Transporter'}{shipment.transporter.phone ? ` · ${shipment.transporter.phone}` : ''}
            </Text>
          </TouchableOpacity>
        )}

        {/* Primary status action */}
        {action && (
          <TouchableOpacity style={[styles.primaryButton, busy && styles.disabled]} onPress={() => advanceStatus(shipment)} disabled={busy}>
            {busy ? <ActivityIndicator color="white" /> : <MaterialIcons name={action.icon} size={20} color="white" />}
            <Text style={styles.primaryButtonText}>{action.label}</Text>
          </TouchableOpacity>
        )}

        {/* Secondary actions */}
        <View style={styles.secondaryRow}>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('TrackShipment', { shipmentId: shipment._id, bookingId: bookingIdOf(shipment) })}
          >
            <MaterialIcons name="map" size={18} color="#0C2D48" />
            <Text style={styles.secondaryText}>Track</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('Chat', {
              bookingId: bookingIdOf(shipment),
              recipientName: shipment.shipper?.fullName || shipment.transporter?.fullName || 'Booking chat'
            })}
          >
            <MaterialIcons name="chat" size={18} color="#0C2D48" />
            <Text style={styles.secondaryText}>Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, liveId === shipment._id && styles.secondaryButtonActive]}
            onPress={() => toggleLiveTracking(shipment)}
          >
            <MaterialIcons name={liveId === shipment._id ? 'gps-fixed' : 'gps-not-fixed'} size={18} color={liveId === shipment._id ? '#16a34a' : '#0C2D48'} />
            <Text style={[styles.secondaryText, liveId === shipment._id && styles.secondaryTextActive]}>
              {liveId === shipment._id ? 'Live: on' : 'Go live'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={() => shareLocation(shipment)} disabled={busy}>
            <MaterialIcons name="my-location" size={18} color="#0C2D48" />
            <Text style={styles.secondaryText}>Share location</Text>
          </TouchableOpacity>

          {inDeliveryPhase && (
            <TouchableOpacity style={styles.secondaryButton} onPress={() => captureProof(shipment)} disabled={busy}>
              <MaterialIcons name="photo-camera" size={18} color="#0C2D48" />
              <Text style={styles.secondaryText}>Add proof</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top','left','right']} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#F37021" />
          <Text style={styles.loadingText}>Loading your deliveries...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top','left','right']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>My Deliveries</Text>
          <Text style={styles.headerText}>Track the load you are carrying and update its progress.</Text>
        </View>

        <View style={styles.sosCard}>
          <View style={styles.sosInfo}>
            <MaterialIcons name="emergency" size={22} color="#dc2626" />
            <Text style={styles.sosText}>In trouble on the road? Send an SOS for help.</Text>
          </View>
          <SOSButton />
        </View>

        {shipments.length === 0 ? (
          <View style={styles.emptyCard}>
            <MaterialIcons name="local-shipping" size={40} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No active deliveries</Text>
            <Text style={styles.emptyText}>When a transporter assigns you to a job it will appear here.</Text>
          </View>
        ) : (
          shipments.map(renderShipment)
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  content: { padding: 16, paddingBottom: 34 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#475569', fontSize: 15 },
  header: { backgroundColor: '#0C2D48', borderRadius: 22, padding: 20, marginBottom: 16 },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: '800' },
  headerText: { color: '#dbeafe', fontSize: 14, lineHeight: 20, marginTop: 6 },
  sosCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#fecaca', marginBottom: 14, gap: 12 },
  sosInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sosText: { flex: 1, color: '#7f1d1d', fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  reference: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  statusBadge: { backgroundColor: '#e0f2fe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: '#075985', fontSize: 12, fontWeight: '800' },
  routeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  routeText: { flex: 1, color: '#334155', fontSize: 14 },
  routeConnector: { width: 1, height: 14, backgroundColor: '#cbd5e1', marginLeft: 8, marginVertical: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  metaText: { flex: 1, color: '#475569', fontSize: 14 },
  primaryButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#F37021', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 },
  primaryButtonText: { color: 'white', fontSize: 15, fontWeight: '800' },
  disabled: { opacity: 0.65 },
  secondaryRow: { flexDirection: 'row', gap: 10, marginTop: 12, flexWrap: 'wrap' },
  secondaryButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  secondaryButtonActive: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  secondaryText: { color: '#0C2D48', fontSize: 13, fontWeight: '700' },
  secondaryTextActive: { color: '#16a34a' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 18, padding: 28, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  emptyTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800', marginTop: 12 },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center', marginTop: 6, lineHeight: 20 },
});

export default DriverDeliveriesScreen;
