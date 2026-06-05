import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
  Alert
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const getRecordLabel = (value, fallback = 'N/A') => {
  if (!value) return fallback;
  if (typeof value === 'object') return value.name || value.label || fallback;
  return String(value);
};

const VehicleRentalScreen = ({ navigation, route }) => {
  const { job } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicles, setVehicles] = useState([]);

  const fetchAvailableVehicles = useCallback(async () => {
    try {
      const startDate = job?.route?.pickup?.date || new Date().toISOString();
      const endDate = job?.route?.delivery?.date || new Date(Date.now() + 86400000).toISOString();
      const params = new URLSearchParams({
        itemType: 'small_vehicle',
        startDate,
        endDate,
        rateType: 'daily'
      });
      const response = await apiService.request(`/rentals/available?${params.toString()}`);
      if (response.success) {
        setVehicles(response.vehicles || response.data || []);
      } else {
        setVehicles([]);
      }
    } catch (error) {
      console.error('Fetch vehicles error:', error);
      setVehicles([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [job]);

  useEffect(() => {
    fetchAvailableVehicles();
  }, [fetchAvailableVehicles]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAvailableVehicles();
  }, [fetchAvailableVehicles]);

  const handleRentVehicle = async () => {
    if (!selectedVehicle) {
      Alert.alert('Select Vehicle', 'Please select a vehicle to rent');
      return;
    }

    Alert.alert(
      'Confirm Rental',
      `Rent ${selectedVehicle.make} ${selectedVehicle.model} for ${selectedVehicle.quote ? `$${Number(selectedVehicle.quote.total || 0).toFixed(2)} total` : `$${selectedVehicle.rentalSettings?.dailyRate || 0}/day`}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rent Now',
          onPress: async () => {
            setRequesting(true);
            try {
              const startDate = job?.route?.pickup?.date || new Date().toISOString();
              const endDate = job?.route?.delivery?.date || new Date(Date.now() + 86400000).toISOString();

              const response = await apiService.request('/rentals/request', {
                method: 'POST',
                body: JSON.stringify({
                  itemType: selectedVehicle.itemType || 'small_vehicle',
                  itemId: selectedVehicle._id,
                  startDate,
                  endDate,
                  rateType: 'daily'
                })
              });

              if (response.success) {
                Alert.alert(
                  'Rental Requested',
                  'Your vehicle rental request has been submitted. The owner will respond shortly.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        if (job) {
                          navigation.navigate('JobDetails', { job, rentalId: response.data?._id });
                        } else {
                          navigation.navigate('MyRentals');
                        }
                      }
                    }
                  ]
                );
              } else {
                Alert.alert('Error', response.message || 'Failed to submit rental request');
              }
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to submit rental request');
            } finally {
              setRequesting(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rent a Vehicle</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading available vehicles...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rent a Vehicle</Text>
        <Text style={styles.headerSubtitle}>Compare available cars, bakkies, vans, and SUVs</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0C2D48']} />
        }
      >
        <View style={styles.content}>
          <View style={styles.infoBanner}>
            <Text style={styles.infoTitle}>How it works</Text>
            <View style={styles.infoList}>
              <Text style={styles.infoItem}>1. Browse vehicles available for your dates</Text>
              <Text style={styles.infoItem}>2. Compare renter prices before requesting</Text>
              <Text style={styles.infoItem}>3. Pay after the owner approves the rental</Text>
              <Text style={styles.infoItem}>4. Return the vehicle at the agreed handover point</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>
            Available Vehicles ({vehicles.length})
          </Text>

          {vehicles.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="directions-car" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No vehicles available</Text>
              <Text style={styles.emptySubtitle}>
                Check back later or expand your search area
              </Text>
            </View>
          ) : (
            <View style={styles.vehiclesList}>
              {vehicles.map((vehicle) => (
                <VehicleCard
                  key={vehicle._id}
                  vehicle={vehicle}
                  selected={selectedVehicle?._id === vehicle._id}
                  onSelect={() => setSelectedVehicle(vehicle)}
                />
              ))}
            </View>
          )}

          {selectedVehicle && (
            <View style={styles.termsCard}>
              <Text style={styles.termsTitle}>Rental Terms</Text>
              <View style={styles.termsList}>
                <View style={styles.termRow}>
                  <Text style={styles.termLabel}>Estimated total</Text>
                  <Text style={styles.termValue}>
                    {selectedVehicle.quote ? `$${Number(selectedVehicle.quote.total || 0).toFixed(2)}` : 'Select dates for quote'}
                  </Text>
                </View>
                <View style={styles.termRow}>
                  <Text style={styles.termLabel}>Daily rate</Text>
                  <Text style={styles.termValue}>
                    ${selectedVehicle.rentalSettings?.dailyRate || 0}/day
                  </Text>
                </View>
                {selectedVehicle.rentalSettings?.weeklyRate > 0 && (
                  <View style={styles.termRow}>
                    <Text style={styles.termLabel}>Weekly rate</Text>
                    <Text style={styles.termValue}>
                      ${selectedVehicle.rentalSettings.weeklyRate}/week
                    </Text>
                  </View>
                )}
                <View style={styles.termRow}>
                  <Text style={styles.termLabel}>Deposit</Text>
                  <Text style={styles.termValue}>
                    ${selectedVehicle.rentalSettings?.deposit || 500} (refundable)
                  </Text>
                </View>
                <View style={styles.termRow}>
                  <Text style={styles.termLabel}>Fuel policy</Text>
                  <Text style={styles.termValue}>Return with same level</Text>
                </View>
                <View style={styles.termRow}>
                  <Text style={styles.termLabel}>Platform fee</Text>
                  <Text style={styles.termValue}>10%</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>

      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[
            styles.rentButton,
            (!selectedVehicle || requesting) && styles.rentButtonDisabled
          ]}
          onPress={handleRentVehicle}
          disabled={!selectedVehicle || requesting}
        >
          {requesting ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.rentButtonText}>Requesting...</Text>
            </View>
          ) : (
            <Text style={styles.rentButtonText}>
              {selectedVehicle
                ? `Request ${selectedVehicle.quote ? `$${Number(selectedVehicle.quote.total || 0).toFixed(2)}` : 'Rental'}`
                : 'Select a Vehicle'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const VehicleCard = ({ vehicle, selected, onSelect }) => (
  <TouchableOpacity
    style={[styles.vehicleCard, selected && styles.vehicleCardSelected]}
    onPress={onSelect}
    activeOpacity={0.7}
  >
    <View style={styles.vehicleHeader}>
      <View style={styles.vehicleType}>
        <MaterialIcons name="directions-car" size={20} color="#F37021" />
        <Text style={styles.vehicleTypeText}>
          {vehicle.makeName || getRecordLabel(vehicle.make)} {vehicle.modelName || getRecordLabel(vehicle.model)}
        </Text>
      </View>
      {vehicle.rating?.average > 0 && (
        <View style={styles.rating}>
          <MaterialIcons name="star" size={16} color="#F37021" />
          <Text style={styles.ratingText}>{vehicle.rating.average.toFixed(1)}</Text>
        </View>
      )}
    </View>

    <Text style={styles.vehicleInfo}>
      {vehicle.vehicleTypeName || getRecordLabel(vehicle.vehicleType)} | {vehicle.year} | {vehicle.registrationNumber}
    </Text>

    <Text style={styles.capacity}>
      {vehicle.capacity?.weight?.value
        ? `${vehicle.capacity.weight.value} ${vehicle.capacity.weight.unit || 'tonnes'}`
        : 'Capacity not specified'}
    </Text>

    <View style={styles.vehicleDetails}>
      {vehicle.owner?.fullName && (
        <View style={styles.detailRow}>
          <MaterialIcons name="business" size={16} color="#F37021" />
          <Text style={styles.detailText}>{vehicle.owner.fullName}</Text>
        </View>
      )}
      {vehicle.operatingAreas?.[0]?.city && (
        <View style={styles.detailRow}>
          <MaterialIcons name="location-on" size={16} color="#F37021" />
          <Text style={styles.detailText}>{vehicle.operatingAreas[0].city}</Text>
        </View>
      )}
      {vehicle.features && (
        <View style={styles.featuresRow}>
          {vehicle.features.airConditioning && (
            <View style={styles.featureBadge}>
              <MaterialIcons name="ac-unit" size={12} color="#0C2D48" />
              <Text style={styles.featureText}>A/C</Text>
            </View>
          )}
          {vehicle.features.gpsTracking && (
            <View style={styles.featureBadge}>
              <MaterialIcons name="gps-fixed" size={12} color="#0C2D48" />
              <Text style={styles.featureText}>GPS</Text>
            </View>
          )}
          {vehicle.features.refrigeration && (
            <View style={styles.featureBadge}>
              <MaterialIcons name="kitchen" size={12} color="#0C2D48" />
              <Text style={styles.featureText}>Refrigerated</Text>
            </View>
          )}
        </View>
      )}
    </View>

    <View style={styles.vehicleFooter}>
      <Text style={styles.rate}>
        {vehicle.quote ? `$${Number(vehicle.quote.total || 0).toFixed(2)} total` : `$${vehicle.rentalSettings?.dailyRate || 0}/day`}
      </Text>
      {selected && (
        <MaterialIcons name="check-circle" size={24} color="#16a34a" />
      )}
    </View>
  </TouchableOpacity>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  infoBanner: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 12,
  },
  infoList: {
    gap: 8,
  },
  infoItem: {
    fontSize: 14,
    color: '#374151',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  vehiclesList: {
    gap: 12,
    marginBottom: 24,
  },
  vehicleCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  vehicleCardSelected: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  vehicleType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  vehicleTypeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  vehicleInfo: {
    fontSize: 12,
    color: '#9ca3af',
    marginBottom: 4,
  },
  capacity: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  vehicleDetails: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#374151',
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  featureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  featureText: {
    fontSize: 12,
    color: '#0C2D48',
  },
  vehicleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  rate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  termsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    marginBottom: 24,
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  termsList: {
    gap: 12,
  },
  termRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  termLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  termValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  bottomPadding: {
    height: 100,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
  },
  rentButton: {
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rentButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rentButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default VehicleRentalScreen;
