import React, { useState, useEffect } from 'react';
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
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { MapView, Camera, PointAnnotation } from '@rnmapbox/maps';
import { initMapbox, isMapboxConfigured } from '../../services/mapboxConfig';
import apiService from '../../services/apiService';

// Configure the Mapbox access token once for this screen's map.
initMapbox();

const { width, height } = Dimensions.get('window');

const TrailerTrackingScreen = ({ navigation, route }) => {
  const { trailer, rentalId } = route.params || {};
  const [trackingData, setTrackingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [region, setRegion] = useState({
    latitude: -17.8292,
    longitude: 31.0522,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  useEffect(() => {
    loadTracking();
  }, [rentalId, trailer?._id]);

  const resolveRentalId = async () => {
    if (rentalId) return rentalId;
    if (trailer?.currentRental) return trailer.currentRental;
    if (!trailer?._id) return null;

    const response = await apiService.getActiveRentals();
    const activeRental = (response.data || []).find(item =>
      item.trailer?._id === trailer._id ||
      item.trailer === trailer._id ||
      item.vehicle?._id === trailer._id
    );
    return activeRental?._id || null;
  };

  const loadTracking = async () => {
    try {
      setLoading(true);
      setError('');
      const activeRentalId = await resolveRentalId();
      if (!activeRentalId) {
        setTrackingData(null);
        setError('No active rental tracking record was found for this asset.');
        return;
      }

      const response = await apiService.getRentalTracking(activeRentalId);
      const data = response.data;
      setTrackingData(data);

      if (data?.currentLocation?.latitude && data?.currentLocation?.longitude) {
        setRegion(prev => ({
          ...prev,
          latitude: data.currentLocation.latitude,
          longitude: data.currentLocation.longitude
        }));
      }
    } catch (err) {
      setError(err.message || 'Unable to load trailer tracking.');
    } finally {
      setLoading(false);
    }
  };

  const refreshLocation = () => {
    loadTracking();
  };

  const contactDriver = () => {
    const phone = trackingData?.renter?.phone || trackingData?.owner?.phone;
    if (!phone) {
      Alert.alert('No phone number', 'No contact number is available for this rental.');
      return;
    }
    Linking.openURL(`tel:${phone}`);
  };

  const formatTimeAgo = (date) => {
    if (!date) return 'unknown';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const currentLocation = trackingData?.currentLocation;
  const progress = `${trackingData?.route?.progress || 0}%`;

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track {trackingData?.asset?.name || trailer?.name || trailer?.assetName || 'Asset'}</Text>
        <Text style={styles.headerSubtitle}>Live Location Tracking</Text>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.centerStateText}>Loading tracking...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <MaterialIcons name="location-off" size={48} color="#9ca3af" />
          <Text style={styles.centerStateTitle}>Tracking unavailable</Text>
          <Text style={styles.centerStateText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refreshLocation}>
            <MaterialIcons name="refresh" size={18} color="white" />
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Map View */}
        <View style={styles.mapContainer}>
          {isMapboxConfigured() ? (
            <MapView style={styles.map} styleURL="mapbox://styles/mapbox/streets-v12">
              <Camera
                centerCoordinate={[
                  currentLocation?.longitude ?? region.longitude,
                  currentLocation?.latitude ?? region.latitude
                ]}
                zoomLevel={currentLocation?.latitude ? 12 : 9}
                animationDuration={600}
              />
              {currentLocation?.latitude && currentLocation?.longitude && (
                <PointAnnotation
                  id="asset"
                  coordinate={[currentLocation.longitude, currentLocation.latitude]}
                  title={trackingData?.asset?.name || trailer?.name}
                >
                  <View style={styles.marker}>
                    <MaterialIcons name="local-shipping" size={24} color="#0C2D48" />
                  </View>
                </PointAnnotation>
              )}
            </MapView>
          ) : (
            <View style={[styles.map, styles.mapUnavailable]}>
              <MaterialIcons name="map" size={40} color="#0C2D48" />
              <Text style={styles.mapUnavailableText}>Map unavailable — Mapbox token not configured.</Text>
            </View>
          )}

          {/* Refresh Button */}
          <TouchableOpacity style={styles.refreshButton} onPress={refreshLocation}>
            <MaterialIcons name="refresh" size={24} color="#0C2D48" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          {/* Tracking Status */}
          <View style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <View style={styles.statusIndicator}>
                <View style={[styles.statusDot, styles.statusActive]} />
                <Text style={styles.statusText}>Live Tracking Active</Text>
              </View>
              <Text style={styles.lastUpdate}>Updated {formatTimeAgo(trackingData.lastUpdate)}</Text>
            </View>
            
            <View style={styles.locationInfo}>
              <MaterialIcons name="location-on" size={20} color="#F37021" />
              <View style={styles.locationTexts}>
                <Text style={styles.locationAddress}>{currentLocation?.address || 'No location reported yet'}</Text>
                {currentLocation?.latitude && currentLocation?.longitude && (
                  <Text style={styles.locationCoordinates}>
                    {currentLocation.latitude.toFixed(6)}, {currentLocation.longitude.toFixed(6)}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Tracking Details */}
          <View style={styles.detailsGrid}>
            <DetailCard
              icon="battery-full"
              title="Battery"
              value={trackingData.batteryLevel == null ? 'N/A' : `${trackingData.batteryLevel}%`}
              color="#16a34a"
            />
            <DetailCard
              icon="speed"
              title="Speed"
              value={trackingData.speed == null ? 'N/A' : `${trackingData.speed} km/h`}
              color="#F37021"
            />
            <DetailCard
              icon="schedule"
              title="Status"
              value={trackingData.status}
              color="#0C2D48"
            />
            <DetailCard
              icon="timer"
              title="Est. Return"
              value={trackingData.estimatedReturn ? new Date(trackingData.estimatedReturn).toLocaleString() : 'N/A'}
              color="#7c3aed"
            />
          </View>

          {/* Route Information */}
          <View style={styles.routeCard}>
            <Text style={styles.cardTitle}>Route Information</Text>
            <View style={styles.routeProgress}>
              <View style={styles.routePoints}>
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, styles.routeStart]} />
                  <Text style={styles.routeLabel}>Pickup</Text>
                  <Text style={styles.routeValue}>{trackingData.route?.from || 'Pickup'}</Text>
                </View>
                <View style={styles.routeLine} />
                <View style={styles.routePoint}>
                  <View style={[styles.routeDot, styles.routeEnd]} />
                  <Text style={styles.routeLabel}>Delivery</Text>
                  <Text style={styles.routeValue}>{trackingData.route?.to || 'Return'}</Text>
                </View>
              </View>
              <View style={styles.progressBar}>
                <View 
                  style={[styles.progressFill, { width: progress }]} 
                />
              </View>
              <Text style={styles.progressText}>Journey: {progress} complete</Text>
            </View>
          </View>

          {/* Quick Actions */}
          <View style={styles.actionsCard}>
            <Text style={styles.cardTitle}>Quick Actions</Text>
            <View style={styles.actionButtons}>
              <TouchableOpacity style={styles.actionButton} onPress={contactDriver}>
                <MaterialIcons name="phone" size={24} color="#0C2D48" />
                <Text style={styles.actionButtonText}>Call Driver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <MaterialIcons name="message" size={24} color="#0C2D48" />
                <Text style={styles.actionButtonText}>Message</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <MaterialIcons name="notifications" size={24} color="#0C2D48" />
                <Text style={styles.actionButtonText}>Set Alert</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <MaterialIcons name="share" size={24} color="#0C2D48" />
                <Text style={styles.actionButtonText}>Share Location</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Location History */}
          <View style={styles.historyCard}>
            <Text style={styles.cardTitle}>Recent Locations</Text>
            <View style={styles.historyList}>
              {(trackingData.history || []).map(item => (
                <LocationHistoryItem
                  key={item._id || item.timestamp}
                  time={formatTimeAgo(item.timestamp)}
                  address={item.location?.address || 'Location update'}
                  status={item.speed > 0 ? 'Moving' : 'Stopped'}
                />
              ))}
              {!trackingData.history?.length && (
                <Text style={styles.emptyHistory}>No location history has been reported yet.</Text>
              )}
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>
      )}
    </SafeAreaView>
  );
};

// Detail Card Component
const DetailCard = ({ icon, title, value, color }) => (
  <View style={styles.detailCard}>
    <MaterialIcons name={icon} size={20} color={color} />
    <Text style={styles.detailTitle}>{title}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

// Location History Item Component
const LocationHistoryItem = ({ time, address, status }) => (
  <View style={styles.historyItem}>
    <View style={styles.historyIcon}>
      <MaterialIcons 
        name={status === 'Moving' ? 'play-arrow' : 'pause'} 
        size={16} 
        color="#6b7280" 
      />
    </View>
    <View style={styles.historyContent}>
      <Text style={styles.historyTime}>{time}</Text>
      <Text style={styles.historyAddress}>{address}</Text>
    </View>
    <Text style={styles.historyStatus}>{status}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 45,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  centerStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 12,
    marginBottom: 8,
  },
  centerStateText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#0C2D48',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  mapContainer: {
    height: 300,
    position: 'relative',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapUnavailable: {
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  mapUnavailableText: {
    color: '#0C2D48',
    fontSize: 13,
    textAlign: 'center',
  },
  refreshButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'white',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  marker: {
    backgroundColor: 'white',
    padding: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#0C2D48',
  },
  content: {
    padding: 16,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: '#16a34a',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  lastUpdate: {
    fontSize: 12,
    color: '#6b7280',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationTexts: {
    flex: 1,
  },
  locationAddress: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  locationCoordinates: {
    fontSize: 12,
    color: '#6b7280',
  },
  detailsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  detailCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flex: 1,
    minWidth: '47%',
    alignItems: 'center',
  },
  detailTitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 8,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  routeCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  routeProgress: {
    gap: 16,
  },
  routePoints: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  routePoint: {
    alignItems: 'center',
    flex: 1,
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 4,
  },
  routeStart: {
    backgroundColor: '#16a34a',
  },
  routeEnd: {
    backgroundColor: '#0C2D48',
  },
  routeLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  routeValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    textAlign: 'center',
  },
  routeLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginTop: 5,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0C2D48',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  actionsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    flex: 1,
    minWidth: '47%',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionButtonText: {
    fontSize: 12,
    color: '#0C2D48',
    fontWeight: '500',
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  historyList: {
    gap: 12,
  },
  emptyHistory: {
    fontSize: 13,
    color: '#6b7280',
    textAlign: 'center',
    paddingVertical: 12,
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  historyIcon: {
    marginRight: 12,
  },
  historyContent: {
    flex: 1,
  },
  historyTime: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  historyAddress: {
    fontSize: 14,
    color: '#374151',
  },
  historyStatus: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  bottomPadding: {
    height: 20,
  },
});

export default TrailerTrackingScreen;
