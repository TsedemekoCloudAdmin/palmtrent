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

const TrailerRentalScreen = ({ navigation, route }) => {
  const { job } = route.params || {};
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState(null);
  const [trailers, setTrailers] = useState([]);

  const fetchAvailableTrailers = useCallback(async () => {
    try {
      const response = await apiService.request('/rentals/available?itemType=trailer');
      if (response.success) {
        setTrailers(response.trailers || response.data || []);
      } else {
        setTrailers([]);
      }
    } catch (error) {
      console.error('Fetch trailers error:', error);
      setTrailers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableTrailers();
  }, [fetchAvailableTrailers]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAvailableTrailers();
  }, [fetchAvailableTrailers]);

  const handleRentTrailer = async () => {
    if (!selectedTrailer) {
      Alert.alert('Select Trailer', 'Please select a trailer to rent');
      return;
    }

    Alert.alert(
      'Confirm Rental',
      `Rent ${selectedTrailer.trailerType || 'this trailer'} for $${selectedTrailer.rentalSettings?.dailyRate || 0}/day?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Rent Now',
          onPress: async () => {
            setRequesting(true);
            try {
              // Calculate dates - if we have a job, use job dates
              const startDate = job?.route?.pickup?.date || new Date().toISOString();
              const endDate = job?.route?.delivery?.date || new Date(Date.now() + 86400000).toISOString();

              const response = await apiService.request('/rentals/request', {
                method: 'POST',
                body: JSON.stringify({
                  itemType: 'trailer',
                  itemId: selectedTrailer._id,
                  startDate,
                  endDate,
                  rateType: 'daily'
                })
              });

              if (response.success) {
                Alert.alert(
                  'Rental Requested',
                  'Your trailer rental request has been submitted. The owner will respond shortly.',
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
          <Text style={styles.headerTitle}>Rent a Trailer</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading available trailers...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
        <Text style={styles.headerTitle}>Rent a Trailer</Text>
        <Text style={styles.headerSubtitle}>I have truck, need trailer</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0C2D48']} />
        }
      >
        <View style={styles.content}>
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Text style={styles.infoTitle}>How it works</Text>
            <View style={styles.infoList}>
              <Text style={styles.infoItem}>1. Select a trailer near your location</Text>
              <Text style={styles.infoItem}>2. Rental fee is deducted from your earnings</Text>
              <Text style={styles.infoItem}>3. Damage deposit held in escrow</Text>
              <Text style={styles.infoItem}>4. Return trailer after delivery</Text>
            </View>
          </View>

          {/* Available Trailers */}
          <Text style={styles.sectionTitle}>
            Available Trailers ({trailers.length})
          </Text>

          {trailers.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="local-shipping" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No trailers available</Text>
              <Text style={styles.emptySubtitle}>
                Check back later or expand your search area
              </Text>
            </View>
          ) : (
            <View style={styles.trailersList}>
              {trailers.map((trailer) => (
                <TrailerCard
                  key={trailer._id}
                  trailer={trailer}
                  selected={selectedTrailer?._id === trailer._id}
                  onSelect={() => setSelectedTrailer(trailer)}
                />
              ))}
            </View>
          )}

          {/* Rental Terms */}
          {selectedTrailer && (
            <View style={styles.termsCard}>
              <Text style={styles.termsTitle}>Rental Terms</Text>
              <View style={styles.termsList}>
                <View style={styles.termRow}>
                  <Text style={styles.termLabel}>Daily rate</Text>
                  <Text style={styles.termValue}>
                    ${selectedTrailer.rentalSettings?.dailyRate || 0}/day
                  </Text>
                </View>
                {selectedTrailer.rentalSettings?.weeklyRate > 0 && (
                  <View style={styles.termRow}>
                    <Text style={styles.termLabel}>Weekly rate</Text>
                    <Text style={styles.termValue}>
                      ${selectedTrailer.rentalSettings.weeklyRate}/week
                    </Text>
                  </View>
                )}
                <View style={styles.termRow}>
                  <Text style={styles.termLabel}>Damage deposit</Text>
                  <Text style={styles.termValue}>
                    ${selectedTrailer.rentalSettings?.deposit || 200} (refundable)
                  </Text>
                </View>
                <View style={styles.termRow}>
                  <Text style={styles.termLabel}>Rental period</Text>
                  <Text style={styles.termValue}>Pickup to return</Text>
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

      {/* Bottom Action */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={[
            styles.rentButton,
            (!selectedTrailer || requesting) && styles.rentButtonDisabled
          ]}
          onPress={handleRentTrailer}
          disabled={!selectedTrailer || requesting}
        >
          {requesting ? (
            <View style={styles.buttonContent}>
              <ActivityIndicator size="small" color="white" />
              <Text style={styles.rentButtonText}>Requesting...</Text>
            </View>
          ) : (
            <Text style={styles.rentButtonText}>
              {selectedTrailer
                ? `Rent for $${selectedTrailer.rentalSettings?.dailyRate || 0}/day`
                : 'Select a Trailer'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const TrailerCard = ({ trailer, selected, onSelect }) => (
  <TouchableOpacity
    style={[styles.trailerCard, selected && styles.trailerCardSelected]}
    onPress={onSelect}
    activeOpacity={0.7}
  >
    <View style={styles.trailerHeader}>
      <View style={styles.trailerType}>
        <MaterialIcons name="local-shipping" size={20} color="#F37021" />
        <Text style={styles.trailerTypeText}>
          {trailer.trailerType || 'Trailer'}
        </Text>
      </View>
      {trailer.rating?.average > 0 && (
        <View style={styles.rating}>
          <MaterialIcons name="star" size={16} color="#F37021" />
          <Text style={styles.ratingText}>{trailer.rating.average.toFixed(1)}</Text>
        </View>
      )}
    </View>

    <Text style={styles.capacity}>
      {trailer.capacity?.weight?.value
        ? `${trailer.capacity.weight.value} ${trailer.capacity.weight.unit || 'kg'}`
        : 'Capacity not specified'}
    </Text>

    <View style={styles.trailerDetails}>
      {trailer.owner?.fullName && (
        <View style={styles.detailRow}>
          <MaterialIcons name="business" size={16} color="#F37021" />
          <Text style={styles.detailText}>{trailer.owner.fullName}</Text>
        </View>
      )}
      {trailer.operatingAreas?.[0]?.city && (
        <View style={styles.detailRow}>
          <MaterialIcons name="location-on" size={16} color="#F37021" />
          <Text style={styles.detailText}>{trailer.operatingAreas[0].city}</Text>
        </View>
      )}
      {trailer.features && (
        <View style={styles.featuresRow}>
          {trailer.features.refrigeration && (
            <View style={styles.featureBadge}>
              <MaterialIcons name="ac-unit" size={12} color="#0C2D48" />
              <Text style={styles.featureText}>Refrigerated</Text>
            </View>
          )}
          {trailer.features.liftGate && (
            <View style={styles.featureBadge}>
              <MaterialIcons name="upload" size={12} color="#0C2D48" />
              <Text style={styles.featureText}>Lift Gate</Text>
            </View>
          )}
          {trailer.features.gps && (
            <View style={styles.featureBadge}>
              <MaterialIcons name="gps-fixed" size={12} color="#0C2D48" />
              <Text style={styles.featureText}>GPS</Text>
            </View>
          )}
        </View>
      )}
    </View>

    <View style={styles.trailerFooter}>
      <Text style={styles.rate}>
        ${trailer.rentalSettings?.dailyRate || 0}/day
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
  trailersList: {
    gap: 12,
    marginBottom: 24,
  },
  trailerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  trailerCardSelected: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  trailerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  trailerType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trailerTypeText: {
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
  capacity: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  trailerDetails: {
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
  trailerFooter: {
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

export default TrailerRentalScreen;
