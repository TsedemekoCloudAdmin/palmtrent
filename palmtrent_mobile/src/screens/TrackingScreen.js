import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Modal,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { WebView } from 'react-native-webview';
import { isMapboxConfigured, buildTrackingMapHtml } from '../services/mapboxConfig';
import useAuth from '../hook/useAuth';
import apiService from '../services/apiService';
import socketService from '../services/socketService';
import { vehicleSubLabel } from '../utils/labels';

const { width } = Dimensions.get('window');

// Convert a GeoJSON [lng, lat] pair into a { latitude, longitude } map coord,
// ignoring unset [0,0] placeholders.
const toLatLng = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
  const [lng, lat] = coordinates;
  if (!lat || !lng) return null;
  return { latitude: lat, longitude: lng };
};

// Straight-line distance between two { latitude, longitude } points in km.
const haversineKm = (a, b) => {
  if (!a || !b) return 0;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
};

// Statuses in which the cargo is physically moving toward the destination.
const CARGO_MOVING_STATUSES = ['picked_up', 'in_transit', 'arrived_delivery'];
const CARGO_DELIVERED_STATUSES = ['delivered', 'completed'];

// Compute covered / remaining / percent from the vehicle's actual position when
// coordinates are available. Falls back to zero-progress before pickup and full
// progress after delivery; never fabricates distance from a status table.
const computeTripMetrics = ({ status, distance, pickupCoords, deliveryCoords, currentCoords }) => {
  const total = distance || (pickupCoords && deliveryCoords ? haversineKm(pickupCoords, deliveryCoords) : 0);

  if (CARGO_DELIVERED_STATUSES.includes(status)) {
    return { distance: total, covered: total, remaining: 0, progress: 100 };
  }

  if (CARGO_MOVING_STATUSES.includes(status) && currentCoords && pickupCoords && deliveryCoords && total > 0) {
    const fromPickup = haversineKm(pickupCoords, currentCoords);
    const toDelivery = haversineKm(currentCoords, deliveryCoords);
    const travelled = fromPickup + toDelivery;
    const ratio = travelled > 0 ? Math.min(Math.max(fromPickup / travelled, 0), 1) : 0;
    const covered = total * ratio;
    return {
      distance: total,
      covered,
      remaining: Math.max(total - covered, 0),
      progress: Math.round(ratio * 100)
    };
  }

  // No live position yet (or trip not started): nothing has been covered.
  return { distance: total, covered: 0, remaining: total, progress: 0 };
};

// Human-readable "current location" line derived from the freshest data we have.
const describeCurrentLocation = (shipment) => {
  const current = toLatLng(shipment.currentLocation?.coordinates);
  if (current) {
    return `${current.latitude.toFixed(5)}, ${current.longitude.toFixed(5)}`;
  }
  const lastTracked = Array.isArray(shipment.tracking) && shipment.tracking.length > 0
    ? toLatLng(shipment.tracking[shipment.tracking.length - 1]?.location?.coordinates)
    : null;
  if (lastTracked) {
    return `${lastTracked.latitude.toFixed(5)}, ${lastTracked.longitude.toFixed(5)}`;
  }
  return 'Waiting for the driver’s live location…';
};

// Forward status actions the transporter can take from the tracking screen.
const TRANSPORTER_NEXT_ACTION = {
  assigned: { label: 'Start Pickup Trip', next: 'en_route_pickup' },
  transporter_assigned: { label: 'Start Pickup Trip', next: 'en_route_pickup' },
  en_route_pickup: { label: 'Mark Picked Up', next: 'picked_up' },
  picked_up: { label: 'Start Transit', next: 'in_transit' },
  in_transit: { label: 'Arrived at Delivery', next: 'arrived_delivery' }
};

// Status Step Component for waiting states
const StatusStep = ({ label, completed, active }) => (
  <View style={statusStepStyles.container}>
    <View style={[
      statusStepStyles.dot,
      completed && statusStepStyles.dotCompleted,
      active && statusStepStyles.dotActive
    ]}>
      {completed && <MaterialIcons name="check" size={12} color="white" />}
    </View>
    <Text style={[
      statusStepStyles.label,
      completed && statusStepStyles.labelCompleted,
      active && statusStepStyles.labelActive
    ]}>
      {label}
    </Text>
  </View>
);

const statusStepStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  dotCompleted: {
    backgroundColor: '#16a34a',
  },
  dotActive: {
    backgroundColor: '#0C2D48',
  },
  label: {
    fontSize: 14,
    color: '#6b7280',
  },
  labelCompleted: {
    color: '#16a34a',
  },
  labelActive: {
    color: '#0C2D48',
    fontWeight: '600',
  },
});

const TrackingScreen = ({ navigation, onNavigate, route }) => {
  const { user } = useAuth();
  const shipmentId = route?.params?.shipmentId;
  const bookingId = route?.params?.bookingId;
  const rentalId = route?.params?.rentalId;

  const [jobDetails, setJobDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [liveLocation, setLiveLocation] = useState(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [vehicleOptions, setVehicleOptions] = useState([]);
  const [assigningVehicle, setAssigningVehicle] = useState(false);
  const mapRef = useRef(null);

  const isTrailerOwner = user?.userType === 'trailer_owner';

  const fetchShipmentData = useCallback(async () => {
    try {
      setError(null);
      let response;

      // Handle trailer owner - fetch rentals instead of shipments
      if (isTrailerOwner) {
        if (rentalId) {
          response = await apiService.request(`/rentals/${rentalId}`);
        } else {
          response = await apiService.request('/rentals/active');
        }

        if (response.success && response.data) {
          const rental = Array.isArray(response.data) ? response.data[0] : response.data;

          if (rental) {
            const progress = calculateRentalProgress(rental);

            setJobDetails({
              id: rental.rentalReference || rental._id?.slice(-8).toUpperCase(),
              rentalId: rental._id,
              status: rental.status,
              progress,
              isRental: true,
              renter: {
                name: rental.renter?.name || 'Renter',
                rating: rental.renter?.rating?.average || 4.5,
                phone: rental.renter?.phone || 'Not available'
              },
              trailer: {
                type: rental.trailer?.trailerType || 'Trailer',
                registration: rental.trailer?.registration || 'N/A',
                location: rental.trailer?.currentLocation?.address || 'Location updating...'
              },
              route: {
                from: rental.pickupLocation || 'Pickup Location',
                to: rental.returnLocation || 'Return Location',
                distance: 0,
                covered: 0,
                remaining: 0
              },
              timing: {
                started: formatTime(rental.startDate),
                eta: formatTime(rental.endDate),
                elapsed: calculateElapsed(rental.startDate)
              },
              currentLocation: rental.trailer?.currentLocation?.address || 'Location updating...',
              recentActivity: formatRentalActivityLog(rental),
              rawData: rental
            });
          } else {
            setJobDetails(null);
          }
        } else {
          setJobDetails(null);
        }
      } else {
        // Handle shipper/transporter - fetch shipments
        if (shipmentId) {
          response = await apiService.request(`/shipments/${shipmentId}`);
        } else if (bookingId) {
          response = await apiService.request(`/bookings/${bookingId}`);
        } else {
          response = await apiService.request('/shipments/active');
        }

        if (response.success && response.data) {
          const shipment = Array.isArray(response.data) ? response.data[0] : response.data;

          if (shipment) {
            const pickupCoords = toLatLng(shipment.route?.pickup?.coordinates?.coordinates);
            const deliveryCoords = toLatLng(shipment.route?.delivery?.coordinates?.coordinates);
            const currentCoords = toLatLng(shipment.currentLocation?.coordinates);
            const metrics = computeTripMetrics({
              status: shipment.status,
              distance: shipment.route?.distance || 0,
              pickupCoords,
              deliveryCoords,
              currentCoords
            });

            setJobDetails({
              id: shipment.bookingReference || shipment._id,
              shipmentId: shipment._id,
              bookingId: shipment.booking?._id || shipment.booking,
              status: shipment.status,
              progress: metrics.progress,
              isRental: false,
              weight: shipment.cargoDetails?.weight ?? null,
              cargoType: shipment.cargoDetails?.type || '',
              driver: {
                name: shipment.transporter?.fullName || shipment.transporter?.name || shipment.driver?.name || 'Transporter',
                rating: shipment.transporter?.rating?.average ?? 0,
                trips: shipment.transporter?.rating?.count ?? 0,
                phone: shipment.transporter?.phone || 'Not available',
                vehicle: shipment.vehicle?.registrationNumber || shipment.vehicle?.registration || 'Not assigned'
              },
              route: {
                from: shipment.route?.pickup?.address || shipment.route?.pickup?.city || 'Pickup',
                to: shipment.route?.delivery?.address || shipment.route?.delivery?.city || 'Delivery',
                distance: metrics.distance,
                covered: metrics.covered,
                remaining: metrics.remaining,
                pickupCoords,
                deliveryCoords
              },
              currentCoords,
              timing: {
                started: formatTime(shipment.timeline?.pickedUpAt),
                eta: calculateETA(shipment),
                elapsed: calculateElapsed(shipment.timeline?.pickedUpAt)
              },
              currentLocation: describeCurrentLocation(shipment),
              recentActivity: formatActivityLog(shipment),
              rawData: shipment
            });
          } else {
            setJobDetails(null);
          }
        } else {
          setJobDetails(null);
        }
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message || 'Failed to load tracking data');
      setJobDetails(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [shipmentId, bookingId, rentalId, isTrailerOwner]);

  const calculateRentalProgress = (rental) => {
    const statusProgress = {
      'pending': 10,
      'confirmed': 25,
      'active': 50,
      'returning': 75,
      'completed': 100,
      'cancelled': 0
    };
    return statusProgress[rental.status] || 0;
  };

  const formatRentalActivityLog = (rental) => {
    const activities = [];

    if (rental.completedAt) {
      activities.push({ time: formatTime(rental.completedAt), event: 'Rental completed', type: 'delivery' });
    }
    if (rental.status === 'active') {
      activities.push({ time: formatTime(rental.startDate), event: 'Rental started', type: 'pickup' });
    }
    if (rental.confirmedAt) {
      activities.push({ time: formatTime(rental.confirmedAt), event: 'Rental confirmed', type: 'assigned' });
    }
    if (rental.createdAt) {
      activities.push({ time: formatTime(rental.createdAt), event: 'Rental request created', type: 'pending' });
    }

    return activities.length > 0 ? activities : [
      { time: '--:--', event: 'Waiting for updates...', type: 'pending' }
    ];
  };

  useEffect(() => {
    fetchShipmentData();
    // Refresh every 30 seconds for live tracking
    const interval = setInterval(fetchShipmentData, 30000);
    return () => clearInterval(interval);
  }, [fetchShipmentData]);

  // Subscribe to real-time location updates over the socket for this job.
  useEffect(() => {
    const trackingKey = jobDetails?.bookingId || jobDetails?.shipmentId || shipmentId || bookingId;
    if (!trackingKey) return undefined;

    let active = true;
    const subscribe = async () => {
      if (!socketService.getConnectionStatus().isConnected) {
        await socketService.connect();
      }
      if (!active) return;
      socketService.subscribeToTracking(trackingKey, (data) => {
        if (data?.latitude != null && data?.longitude != null) {
          setLiveLocation({ latitude: data.latitude, longitude: data.longitude, timestamp: data.timestamp });
        }
      });
    };
    subscribe();

    return () => {
      active = false;
      socketService.unsubscribeFromTracking(trackingKey);
    };
  }, [jobDetails?.bookingId, jobDetails?.shipmentId, shipmentId, bookingId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchShipmentData();
  }, [fetchShipmentData]);

  // Recompute trip metrics live as socket location packets arrive, without
  // waiting for the next 30s REST refresh.
  const liveMetrics = useMemo(() => {
    if (!jobDetails || jobDetails.isRental) return null;
    return computeTripMetrics({
      status: jobDetails.status,
      distance: jobDetails.route?.distance || 0,
      pickupCoords: jobDetails.route?.pickupCoords,
      deliveryCoords: jobDetails.route?.deliveryCoords,
      currentCoords: liveLocation || jobDetails.currentCoords
    });
  }, [jobDetails, liveLocation]);

  const displayProgress = liveMetrics?.progress ?? jobDetails?.progress ?? 0;
  const displayCovered = liveMetrics?.covered ?? jobDetails?.route?.covered ?? 0;
  const displayRemaining = liveMetrics?.remaining ?? jobDetails?.route?.remaining ?? 0;

  const liveCoord = liveLocation || jobDetails?.currentCoords || null;
  const pickupCoords = jobDetails?.route?.pickupCoords || null;
  const deliveryCoords = jobDetails?.route?.deliveryCoords || null;

  // Build the map document once per route (not per GPS tick) so the WebView is
  // not reloaded on every location update; the vehicle marker is moved via
  // injectJavaScript instead. Keyed on the coordinate values.
  const mapCenter = liveCoord || pickupCoords || deliveryCoords;
  const mapHtml = useMemo(() => {
    if (!isMapboxConfigured() || !mapCenter) return null;
    return buildTrackingMapHtml({
      center: mapCenter,
      pickup: pickupCoords,
      delivery: deliveryCoords,
      vehicle: liveCoord,
      zoom: liveCoord ? 12 : 9
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pickupCoords?.latitude, pickupCoords?.longitude,
    deliveryCoords?.latitude, deliveryCoords?.longitude,
    Boolean(mapCenter)
  ]);

  // Push live vehicle position into the already-loaded map.
  useEffect(() => {
    if (mapRef.current && liveCoord) {
      mapRef.current.injectJavaScript(
        `window.updateVehicle && window.updateVehicle(${liveCoord.longitude}, ${liveCoord.latitude}); true;`
      );
    }
  }, [liveCoord?.latitude, liveCoord?.longitude]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const calculateETA = (shipment) => {
    if (shipment.schedule?.estimatedArrival) {
      return formatTime(shipment.schedule.estimatedArrival);
    }
    // Estimate based on distance (average 60 km/h)
    const distance = shipment.route?.distance || 0;
    const hours = distance / 60;
    const eta = new Date(Date.now() + hours * 60 * 60 * 1000);
    return formatTime(eta);
  };

  const calculateElapsed = (startTime) => {
    if (!startTime) return '--';
    const start = new Date(startTime);
    const now = new Date();
    const diffMs = now - start;
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const formatActivityLog = (shipment) => {
    const activities = [];
    const timeline = shipment.timeline || {};

    if (timeline.deliveredAt) {
      activities.push({ time: formatTime(timeline.deliveredAt), event: 'Delivery completed', type: 'delivery' });
    }
    if (timeline.arrivedDeliveryAt) {
      activities.push({ time: formatTime(timeline.arrivedDeliveryAt), event: 'Arrived at delivery location', type: 'arrival' });
    }
    if (timeline.inTransitAt) {
      activities.push({ time: formatTime(timeline.inTransitAt), event: 'In transit to destination', type: 'transit' });
    }
    if (timeline.pickedUpAt) {
      activities.push({ time: formatTime(timeline.pickedUpAt), event: 'Pickup completed', type: 'pickup' });
    }
    if (timeline.enRoutePickupAt) {
      activities.push({ time: formatTime(timeline.enRoutePickupAt), event: 'Transporter en route to pickup', type: 'enroute' });
    }
    if (timeline.transporterAssignedAt) {
      activities.push({ time: formatTime(timeline.transporterAssignedAt), event: 'Transporter assigned', type: 'assigned' });
    }

    return activities.length > 0 ? activities : [
      { time: '--:--', event: 'Waiting for updates...', type: 'pending' }
    ];
  };

  const navigateTo = (screen, params = {}) => {
    if (onNavigate) {
      onNavigate(screen, params);
    } else if (navigation) {
      navigation.navigate(screen, params);
    }
  };

  const handleCallDriver = () => {
    Alert.alert('Call Driver', `Call ${jobDetails.driver.phone}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', onPress: () => Linking.openURL(`tel:${jobDetails.driver.phone}`) }
    ]);
  };

  const handleMessageDriver = () => {
    // The chat API accepts a booking _id or a bookingReference, so fall back to
    // the reference when the shipment has no populated booking.
    navigateTo('Chat', {
      bookingId: jobDetails.bookingId ||
        jobDetails.rawData?.booking?._id ||
        jobDetails.rawData?.booking ||
        jobDetails.rawData?.bookingReference,
      recipientName: jobDetails.driver?.name
    });
  };

  const openVehicleAssign = async () => {
    setShowVehicleModal(true);
    try {
      const response = await apiService.getVehicles('status=available');
      setVehicleOptions(response.data || []);
    } catch (err) {
      Alert.alert('Vehicles', err.message || 'Could not load your vehicles.');
    }
  };

  const assignVehicle = async (vehicleId) => {
    if (!jobDetails?.shipmentId) return;
    setAssigningVehicle(true);
    try {
      const response = await apiService.assignVehicleToShipment(jobDetails.shipmentId, vehicleId);
      if (response.success) {
        Alert.alert('Vehicle assigned', 'The vehicle was assigned to this job.');
        setShowVehicleModal(false);
        fetchShipmentData();
      } else {
        Alert.alert('Assign failed', response.message || 'Could not assign the vehicle.');
      }
    } catch (err) {
      Alert.alert('Assign failed', err.message || 'Could not assign the vehicle.');
    } finally {
      setAssigningVehicle(false);
    }
  };

  // Transporter advances the shipment through its lifecycle (e.g. "Mark Picked Up").
  const advanceShipmentStatus = async (nextStatus, label) => {
    if (!jobDetails?.shipmentId) return;
    try {
      const response = await apiService.updateStatus(jobDetails.shipmentId, nextStatus, `${label} by transporter`);
      if (response.success) {
        Alert.alert('Updated', `${label} confirmed.`);
        fetchShipmentData();
      } else {
        Alert.alert('Update failed', response.message || 'Could not update the shipment.');
      }
    } catch (err) {
      Alert.alert('Update failed', err.message || 'Could not update the shipment.');
    }
  };

  const handleShareTracking = () => {
    Alert.alert('Share Tracking', 'Tracking link copied to clipboard!');
  };

  const handleReportIssue = () => {
    navigateTo('ReportIssue', { jobId: jobDetails.id });
  };

  const handleViewFullMap = () => {
    // Prefer the live socket position, then the last persisted position, then
    // the pickup point — so the button still works before the driver goes live.
    const coord = liveLocation || jobDetails?.currentCoords || jobDetails?.route?.pickupCoords;
    if (coord?.latitude != null && coord?.longitude != null) {
      const query = `${coord.latitude},${coord.longitude}`;
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${query}`)
        .catch(() => Alert.alert('Map', 'Unable to open the map.'));
    } else {
      Alert.alert('Live location', 'Waiting for the live location to come through. Try again shortly.');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'in_transit': return '#0C2D48';
      case 'completed': return '#16a34a';
      case 'pending': return '#ea580c';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'in_transit': return 'In Transit 🚛';
      case 'completed': return 'Completed ✅';
      case 'pending': return 'Pending ⏳';
      default: return status;
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'pickup': return 'check-circle';
      case 'stop': return 'access-time';
      case 'checkpoint': return 'verified';
      default: return 'info';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'pickup': return '#16a34a';
      case 'delivery': return '#16a34a';
      case 'stop': return '#ea580c';
      case 'checkpoint': return '#0C2D48';
      case 'transit': return '#0C2D48';
      case 'enroute': return '#f59e0b';
      case 'assigned': return '#8b5cf6';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <Text style={styles.jobId}>Tracking</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading tracking data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!jobDetails) {
    const isTransporter = user?.userType === 'transporter';

    const getEmptyTitle = () => {
      if (isTrailerOwner) return 'No Active Rentals';
      if (isTransporter) return 'No Active Deliveries';
      return 'No Active Shipments';
    };

    const getEmptySubtitle = () => {
      if (isTrailerOwner) return 'Your trailer rentals will appear here when they are active';
      if (isTransporter) return 'Accept a job from Available Jobs to start tracking your deliveries';
      return 'Your shipments will appear here once a transporter has been assigned and is in transit';
    };

    const getEmptyIcon = () => {
      if (isTrailerOwner) return 'rv-hookup';
      return 'local-shipping';
    };

    return (
      <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <View style={styles.headerWithBack}>
            {navigation && (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
            )}
            <Text style={styles.jobId}>{isTrailerOwner ? 'Rental Tracking' : 'Tracking'}</Text>
          </View>
        </View>
        <View style={styles.emptyContainer}>
          <MaterialIcons name={getEmptyIcon()} size={64} color="#d1d5db" />
          <Text style={styles.emptyTitle}>{getEmptyTitle()}</Text>
          <Text style={styles.emptySubtitle}>{getEmptySubtitle()}</Text>
          <TouchableOpacity style={styles.refreshButtonLarge} onPress={onRefresh}>
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
          {isTrailerOwner ? (
            <TouchableOpacity
              style={styles.viewJobsButton}
              onPress={() => navigation?.navigate('TrailerList')}
            >
              <Text style={styles.viewJobsButtonText}>View My Trailers</Text>
            </TouchableOpacity>
          ) : isTransporter ? (
            <TouchableOpacity
              style={styles.viewJobsButton}
              onPress={() => navigation?.navigate('AvailableJobs')}
            >
              <Text style={styles.viewJobsButtonText}>View Available Jobs</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.viewJobsButton}
              onPress={() => navigation?.navigate('BookingHistory')}
            >
              <Text style={styles.viewJobsButtonText}>View My Bookings</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  // Check if waiting for transporter
  const waitingStatuses = ['pending', 'payment_confirmed', 'finding_transporter'];
  if (waitingStatuses.includes(jobDetails.status)) {
    return (
      <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <View style={styles.headerWithBack}>
            {navigation && (
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <MaterialIcons name="arrow-back" size={24} color="white" />
              </TouchableOpacity>
            )}
            <View>
              <Text style={styles.jobIdLabel}>Booking</Text>
              <Text style={styles.jobId}>{jobDetails.id}</Text>
            </View>
          </View>
        </View>
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.waitingContainer}>
            <View style={styles.waitingCard}>
              <ActivityIndicator size="large" color="#0C2D48" />
              <Text style={styles.waitingTitle}>
                {jobDetails.status === 'finding_transporter'
                  ? 'Finding a Transporter'
                  : jobDetails.status === 'payment_confirmed'
                  ? 'Payment Confirmed'
                  : 'Booking Pending'
                }
              </Text>
              <Text style={styles.waitingSubtitle}>
                {jobDetails.status === 'finding_transporter'
                  ? 'We\'re matching your shipment with the best available transporter. This usually takes 1-2 hours.'
                  : jobDetails.status === 'payment_confirmed'
                  ? 'Your payment has been received. We\'re now looking for a transporter.'
                  : 'Your booking is being processed. Please complete payment to proceed.'
                }
              </Text>
            </View>

            {/* Route Preview */}
            <View style={[styles.card, { marginHorizontal: 16, marginTop: 16 }]}>
              <Text style={styles.cardTitle}>Route Details</Text>
              <View style={styles.routeItem}>
                <View style={[styles.routeDot, styles.routeDotStart]} />
                <View style={styles.routeContent}>
                  <Text style={styles.routeLabel}>PICKUP</Text>
                  <Text style={styles.routeText}>{jobDetails.route.from}</Text>
                </View>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeItem}>
                <View style={[styles.routeDot, styles.routeDotEnd]} />
                <View style={styles.routeContent}>
                  <Text style={styles.routeLabel}>DELIVERY</Text>
                  <Text style={styles.routeText}>{jobDetails.route.to}</Text>
                </View>
              </View>
              <View style={styles.distanceRow}>
                <MaterialIcons name="straighten" size={16} color="#6b7280" />
                <Text style={styles.distanceText}>{jobDetails.route.distance} km</Text>
              </View>
            </View>

            {/* Status Steps */}
            <View style={[styles.card, { marginHorizontal: 16, marginTop: 16 }]}>
              <Text style={styles.cardTitle}>Booking Status</Text>
              <View style={styles.statusSteps}>
                <StatusStep
                  label="Booking Created"
                  completed={true}
                  active={jobDetails.status === 'pending'}
                />
                <StatusStep
                  label="Payment Confirmed"
                  completed={jobDetails.status !== 'pending'}
                  active={jobDetails.status === 'payment_confirmed'}
                />
                <StatusStep
                  label="Finding Transporter"
                  completed={false}
                  active={jobDetails.status === 'finding_transporter'}
                />
                <StatusStep
                  label="Transporter Assigned"
                  completed={false}
                  active={false}
                />
              </View>
            </View>

            {/* Actions */}
            {jobDetails.status === 'pending' && (
              <TouchableOpacity
                style={[styles.actionButton, styles.payButton, { marginHorizontal: 16, marginTop: 16 }]}
                onPress={() => navigation?.navigate('MobileMoneyPayment', { bookingId: jobDetails.shipmentId })}
              >
                <MaterialIcons name="payment" size={20} color="white" />
                <Text style={styles.emergencyButtonText}>Complete Payment</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, styles.shareButton, { marginHorizontal: 16, marginTop: 16 }]}
              onPress={() => navigation?.navigate('JobDetails', { bookingId: jobDetails.shipmentId })}
            >
              <MaterialIcons name="info" size={20} color="#0C2D48" />
              <Text style={styles.shareButtonText}>View Booking Details</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.bottomPadding} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.jobIdLabel}>Job ID</Text>
            <Text style={styles.jobId}>{jobDetails.id}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(jobDetails.status) }]}>
            <Text style={styles.statusText}>{getStatusText(jobDetails.status)}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0C2D48']} />
        }
      >
        {/* Map Section */}
        <View style={styles.mapSection}>
          {!isMapboxConfigured() ? (
            <View style={styles.mapPlaceholder}>
              <MaterialIcons name="map" size={48} color="#0C2D48" />
              <Text style={styles.mapTitle}>Map unavailable</Text>
              <Text style={styles.mapSubtitle}>Mapbox access token is not configured.</Text>
            </View>
          ) : !mapHtml ? (
            <View style={styles.mapPlaceholder}>
              <MaterialIcons name="location-off" size={48} color="#0C2D48" />
              <Text style={styles.mapTitle}>Live GPS Tracking</Text>
              <Text style={styles.mapSubtitle}>Waiting for location…</Text>
            </View>
          ) : (
            <WebView
              ref={mapRef}
              style={styles.map}
              originWhitelist={['*']}
              source={{ html: mapHtml }}
              javaScriptEnabled
              domStorageEnabled
              scrollEnabled={false}
              onLoadEnd={() => {
                if (liveCoord) {
                  mapRef.current?.injectJavaScript(
                    `window.updateVehicle && window.updateVehicle(${liveCoord.longitude}, ${liveCoord.latitude}); true;`
                  );
                }
              }}
            />
          )}

          {/* Current Location Card */}
          <View style={styles.locationCard}>
            <View style={styles.locationHeader}>
              <MaterialIcons name="navigation" size={20} color="#0C2D48" />
              <Text style={styles.locationLabel}>Current Location</Text>
            </View>
            <Text style={styles.locationText}>
              {liveLocation
                ? `Live • ${Number(liveLocation.latitude).toFixed(5)}, ${Number(liveLocation.longitude).toFixed(5)}`
                : jobDetails.currentLocation}
            </Text>
            <TouchableOpacity style={styles.viewMapButton} onPress={handleViewFullMap}>
              <Text style={styles.viewMapText}>View Full Map</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Progress Section */}
        <View style={styles.section}>
          <View style={styles.card}>
            <View style={styles.progressHeader}>
              <Text style={styles.cardTitle}>Trip Progress</Text>
              <Text style={styles.progressPercentage}>{displayProgress}%</Text>
            </View>

            {/* Progress Bar */}
            <View style={styles.progressBar}>
              <View
                style={[styles.progressFill, { width: `${displayProgress}%` }]}
              />
            </View>

            <View style={styles.progressStats}>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{Number(displayCovered || 0).toFixed(2)} km</Text>
                <Text style={styles.progressStatLabel}>Covered</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{Number(displayRemaining || 0).toFixed(2)} km</Text>
                <Text style={styles.progressStatLabel}>Remaining</Text>
              </View>
              <View style={styles.progressStat}>
                <Text style={styles.progressStatValue}>{Number(jobDetails.route.distance || 0).toFixed(2)} km</Text>
                <Text style={styles.progressStatLabel}>Total</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Route Details */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Route Details</Text>
            
            {/* From Location */}
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, styles.routeDotStart]} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>FROM</Text>
                <Text style={styles.routeText}>{jobDetails.route.from}</Text>
                <Text style={styles.routeTime}>✓ Picked up at {jobDetails.timing.started}</Text>
              </View>
            </View>

            {/* Route Line */}
            <View style={styles.routeLine} />

            {/* To Location */}
            <View style={styles.routeItem}>
              <View style={[styles.routeDot, styles.routeDotEnd]} />
              <View style={styles.routeContent}>
                <Text style={styles.routeLabel}>TO</Text>
                <Text style={styles.routeText}>{jobDetails.route.to}</Text>
                <Text style={styles.routeTime}>⏰ ETA: {jobDetails.timing.eta}</Text>
              </View>
            </View>

            {/* Timing Stats */}
            <View style={styles.timingStats}>
              <View style={styles.timingStat}>
                <MaterialIcons name="schedule" size={16} color="#6b7280" />
                <Text style={styles.timingStatValue}>{jobDetails.timing.elapsed}</Text>
                <Text style={styles.timingStatLabel}>Elapsed</Text>
              </View>
              <View style={styles.timingStat}>
                <MaterialIcons name="timer" size={16} color="#6b7280" />
                <Text style={styles.timingStatValue}>{jobDetails.timing.eta}</Text>
                <Text style={styles.timingStatLabel}>ETA</Text>
              </View>
              <View style={styles.timingStat}>
                <MaterialIcons name="straighten" size={16} color="#6b7280" />
                <Text style={styles.timingStatValue}>{Number(jobDetails.route.distance || 0).toFixed(2)} km</Text>
                <Text style={styles.timingStatLabel}>Distance</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Driver Information */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Driver Information</Text>
            
            <View style={styles.driverProfile}>
              <View style={styles.driverAvatar}>
                <Text style={styles.driverInitial}>
                  {jobDetails.driver.name.charAt(0)}
                </Text>
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{jobDetails.driver.name}</Text>
                <View style={styles.ratingContainer}>
                  <MaterialIcons name="star" size={16} color="#fbbf24" />
                  <Text style={styles.ratingText}>{Number(jobDetails.driver.rating || 0).toFixed(1)}</Text>
                  <Text style={styles.ratingCount}>• {jobDetails.driver.trips || 0} trips</Text>
                </View>
              </View>
            </View>

            {/* Vehicle Info */}
            <View style={styles.vehicleCard}>
              <MaterialIcons name="local-shipping" size={20} color="#0C2D48" />
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleLabel}>VEHICLE</Text>
                <Text style={styles.vehicleText}>{jobDetails.driver.vehicle}</Text>
              </View>
              {user?.userType === 'transporter' && jobDetails.shipmentId && (
                <TouchableOpacity style={styles.assignVehicleButton} onPress={openVehicleAssign}>
                  <MaterialIcons name={jobDetails.driver.vehicle === 'Not assigned' ? 'add' : 'swap-horiz'} size={16} color="#0C2D48" />
                  <Text style={styles.assignVehicleText}>{jobDetails.driver.vehicle === 'Not assigned' ? 'Assign' : 'Change'}</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Contact Button (message only) */}
            <View style={styles.contactButtons}>
              <TouchableOpacity
                style={[styles.contactButton, styles.messageButton, { flex: 1 }]}
                onPress={handleMessageDriver}
              >
                <MaterialIcons name="message" size={20} color="white" />
                <Text style={styles.contactButtonText}>Message</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Recent Activity</Text>
            
            <View style={styles.activityList}>
              {jobDetails.recentActivity.map((activity, index) => (
                <View key={index} style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: `${getActivityColor(activity.type)}20` }]}>
                    <MaterialIcons 
                      name={getActivityIcon(activity.type)} 
                      size={16} 
                      color={getActivityColor(activity.type)} 
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityText}>{activity.event}</Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.actionButton, styles.shareButton]}
            onPress={handleShareTracking}
          >
            <MaterialIcons name="share" size={20} color="#0C2D48" />
            <Text style={styles.shareButtonText}>Share Tracking Link</Text>
          </TouchableOpacity>

          {/* Show Rate Driver button for shippers when delivery is completed */}
          {(jobDetails.status === 'completed' || jobDetails.status === 'delivered') && user?.userType === 'shipper' && (
            <TouchableOpacity
              style={[styles.actionButton, styles.rateButton]}
              onPress={() => navigateTo('Rating', {
                bookingId: jobDetails.shipmentId || jobDetails.rawData?._id,
                booking: jobDetails.rawData,
                userType: 'shipper'
              })}
            >
              <MaterialIcons name="star" size={20} color="white" />
              <Text style={styles.rateButtonText}>Rate Driver</Text>
            </TouchableOpacity>
          )}

          {/* Transporter status-advance action (e.g. Mark Picked Up) */}
          {user?.userType === 'transporter' && TRANSPORTER_NEXT_ACTION[jobDetails.status] && (
            <TouchableOpacity
              style={[styles.actionButton, styles.arriveButton]}
              onPress={() => {
                const action = TRANSPORTER_NEXT_ACTION[jobDetails.status];
                advanceShipmentStatus(action.next, action.label);
              }}
            >
              <MaterialIcons name="check-circle" size={20} color="white" />
              <Text style={styles.emergencyButtonText}>{TRANSPORTER_NEXT_ACTION[jobDetails.status].label}</Text>
            </TouchableOpacity>
          )}

          {/* Show delivery checklist when at/near delivery */}
          {user?.userType === 'transporter' && ['arrived_delivery', 'in_transit'].includes(jobDetails.status) && (
            <TouchableOpacity
              style={[styles.actionButton, styles.arriveButton]}
              onPress={() => navigateTo('DeliveryChecklist', { job: jobDetails })}
            >
              <MaterialIcons name="location-on" size={20} color="white" />
              <Text style={styles.emergencyButtonText}>Complete Delivery</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionButton, styles.emergencyButton]}
            onPress={handleReportIssue}
          >
            <MaterialIcons name="warning" size={20} color="white" />
            <Text style={styles.emergencyButtonText}>Report Issue / Emergency</Text>
          </TouchableOpacity>
        </View>

        {/* Reduced bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Assign / change vehicle modal */}
      <Modal visible={showVehicleModal} transparent animationType="slide" onRequestClose={() => setShowVehicleModal(false)}>
        <View style={styles.vehicleModalOverlay}>
          <View style={styles.vehicleModalContent}>
            <Text style={styles.vehicleModalTitle}>Assign Vehicle</Text>
            <FlatList
              data={vehicleOptions}
              keyExtractor={(item) => item._id}
              style={{ maxHeight: 320 }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.vehicleOption}
                  disabled={assigningVehicle}
                  onPress={() => assignVehicle(item._id)}
                >
                  <MaterialIcons name="local-shipping" size={20} color="#0C2D48" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.vehicleOptionTitle}>{item.registrationNumber}</Text>
                    <Text style={styles.vehicleOptionSub}>{vehicleSubLabel(item)}</Text>
                  </View>
                  {jobDetails.driver.vehicle === item.registrationNumber && (
                    <MaterialIcons name="check-circle" size={20} color="#16a34a" />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={styles.vehicleEmpty}>No available vehicles. Add or free up a vehicle in Fleet first.</Text>}
            />
            <TouchableOpacity style={styles.vehicleModalClose} onPress={() => setShowVehicleModal(false)}>
              <Text style={styles.vehicleModalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobIdLabel: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  jobId: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  mapSection: {
    position: 'relative',
    marginBottom: 16,
  },
  mapPlaceholder: {
    height: 200,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  map: {
    height: 220,
    width: '100%',
  },
  mapPin: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: 'white',
  },
  mapPinPickup: {
    backgroundColor: '#16a34a',
  },
  mapPinDelivery: {
    backgroundColor: '#dc2626',
  },
  assignVehicleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: '#0C2D48',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  assignVehicleText: {
    color: '#0C2D48',
    fontSize: 12,
    fontWeight: '700',
  },
  vehicleModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  vehicleModalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  vehicleModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 12,
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  vehicleOptionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1f2937',
  },
  vehicleOptionSub: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  vehicleEmpty: {
    color: '#64748b',
    fontSize: 14,
    paddingVertical: 20,
    textAlign: 'center',
  },
  vehicleModalClose: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
  },
  vehicleModalCloseText: {
    color: '#374151',
    fontWeight: '700',
  },
  marker: {
    backgroundColor: 'white',
    padding: 6,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: '#0C2D48',
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginTop: 8,
  },
  mapSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  locationCard: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  locationLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  locationText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  viewMapButton: {
    alignSelf: 'flex-start',
  },
  viewMapText: {
    color: '#0C2D48',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressPercentage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    marginBottom: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0C2D48',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressStat: {
    alignItems: 'center',
  },
  progressStatValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  progressStatLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  routeItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  routeDotStart: {
    backgroundColor: '#16a34a',
  },
  routeDotEnd: {
    backgroundColor: '#0C2D48',
  },
  routeContent: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  routeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  routeTime: {
    fontSize: 12,
    color: '#0C2D48',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e5e7eb',
    marginLeft: 5,
    marginBottom: 8,
  },
  timingStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  timingStat: {
    alignItems: 'center',
    flex: 1,
  },
  timingStatValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 4,
    marginBottom: 2,
  },
  timingStatLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  driverProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  driverAvatar: {
    width: 48,
    height: 48,
    backgroundColor: '#0C2D48',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverInitial: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  ratingCount: {
    fontSize: 14,
    color: '#6b7280',
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    gap: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  vehicleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  contactButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  contactButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  callButton: {
    backgroundColor: '#16a34a',
  },
  messageButton: {
    backgroundColor: '#0C2D48',
  },
  contactButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  activityList: {
    gap: 16,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  activityIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    marginBottom: 12,
    gap: 8,
  },
  shareButton: {
    borderWidth: 2,
    borderColor: '#0C2D48',
    backgroundColor: 'transparent',
  },
  arriveButton: {
    borderWidth: 2,
    borderColor: '#0C2D48',
    backgroundColor: '#0C2D48',
  },
  shareButtonText: {
    color: '#0C2D48',
    fontSize: 16,
    fontWeight: '600',
  },
  emergencyButton: {
    backgroundColor: '#dc2626',
  },
  rateButton: {
    backgroundColor: '#f59e0b',
  },
  rateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  emergencyButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20, // Reduced from 80 since no bottom nav
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  refreshButtonLarge: {
    marginTop: 24,
    backgroundColor: '#0C2D48',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  viewJobsButton: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#0C2D48',
  },
  viewJobsButtonText: {
    color: '#0C2D48',
    fontSize: 16,
    fontWeight: '600',
  },
  headerWithBack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  waitingContainer: {
    paddingTop: 16,
  },
  waitingCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  waitingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  waitingSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  statusSteps: {
    paddingLeft: 8,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  distanceText: {
    fontSize: 14,
    color: '#6b7280',
  },
  payButton: {
    backgroundColor: '#16a34a',
  },
});

export default TrackingScreen;
