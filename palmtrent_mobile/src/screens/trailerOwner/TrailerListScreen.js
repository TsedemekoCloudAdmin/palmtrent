import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const TrailerListScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [trailers, setTrailers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    available: 0,
    rented: 0,
    inUse: 0,
    maintenance: 0
  });
  const [rentalMarketplaceNotice, setRentalMarketplaceNotice] = useState(null);
  const [error, setError] = useState(null);

  // Fetch trailers from API
  const fetchTrailers = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const params = new URLSearchParams();
      if (filter !== 'all') {
        params.append('status', filter);
      }
      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const response = await apiService.request(`/trailers/my-fleet?${params.toString()}`);

      if (response.success) {
        setTrailers(response.data || []);
        setStats(response.stats || {
          total: response.data?.length || 0,
          available: 0,
          rented: 0,
          maintenance: 0
        });
        setRentalMarketplaceNotice(response.rentalMarketplaceNotice || null);
      }
    } catch (err) {
      console.error('Error fetching trailers:', err);
      setError('Failed to load trailers. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, searchQuery]);

  useEffect(() => {
    fetchTrailers();
  }, [fetchTrailers]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchTrailers();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const onRefresh = () => {
    fetchTrailers(true);
  };

  const navigateTo = (screen, params = {}) => {
    if (navigation) {
      navigation.navigate(screen, params);
    }
  };

  const handleDeleteTrailer = (trailer) => {
    Alert.alert(
      'Delete Fleet Asset',
      `Are you sure you want to delete ${trailer.registrationNumber || 'this asset'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.request(`/trailers/${trailer._id}`, { method: 'DELETE' });
              Alert.alert('Success', 'Fleet asset deleted successfully');
              fetchTrailers();
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete fleet asset');
            }
          }
        }
      ]
    );
  };

  const handleStatusChange = async (trailer, newStatus) => {
    try {
      await apiService.request(`/trailers/${trailer._id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus })
      });
      fetchTrailers();
    } catch (err) {
      Alert.alert('Error', err.message || 'Failed to update status');
    }
  };

  // Get trailer display name
  const getTrailerName = (trailer) => {
    if (trailer.assetName) {
      return `${trailer.assetName} - ${trailer.registrationNumber}`;
    }
    if (trailer.trailerType?.name) {
      return `${trailer.trailerType.name} - ${trailer.registrationNumber}`;
    }
    return trailer.registrationNumber || 'Unknown Fleet Asset';
  };

  // Get trailer type name
  const getTrailerTypeName = (trailer) => {
    const assetLabels = {
      trailer: 'Trailer',
      tractor_unit: 'Tractor Unit',
      truck: 'Truck',
      full_rig: 'Full Rig'
    };
    return trailer.trailerType?.name || assetLabels[trailer.assetType] || 'Fleet Asset';
  };

  // Get capacity display
  const getCapacityDisplay = (trailer) => {
    if (trailer.capacity?.weight?.value) {
      return `${trailer.capacity.weight.value} ${trailer.capacity.weight.unit || 'kg'}`;
    }
    return 'N/A';
  };

  // Get features list
  const getFeatures = (trailer) => {
    const featuresList = [];
    if (trailer.features) {
      if (trailer.features.gps) featuresList.push('GPS Tracking');
      if (trailer.features.refrigeration) featuresList.push('Refrigeration');
      if (trailer.features.liftGate) featuresList.push('Lift Gate');
      if (trailer.features.loadingRamp) featuresList.push('Loading Ramp');
      if (trailer.features.tarpaulin) featuresList.push('Tarpaulin Cover');
      if (trailer.features.sideLoader) featuresList.push('Side Loading');
    }
    return featuresList;
  };

  // Get location display
  const getLocationDisplay = (trailer) => {
    if (trailer.operatingAreas && trailer.operatingAreas.length > 0) {
      const area = trailer.operatingAreas[0];
      return area.city || area.region || 'Location not set';
    }
    return 'Location not set';
  };

  // Get daily rate
  const getDailyRate = (trailer) => {
    return trailer.rentalSettings?.dailyRate || 0;
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
            <Text style={styles.backButtonText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Fleet</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading fleet assets...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
        <Text style={styles.headerTitle}>My Fleet</Text>
        <Text style={styles.headerSubtitle}>{stats.total || stats.totalAssets || 0} assets in total</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <View style={styles.content}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <View style={styles.searchInput}>
              <MaterialIcons name="search" size={20} color="#6b7280" />
              <TextInput
                style={styles.searchTextInput}
                placeholder="Search fleet assets..."
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <MaterialIcons name="close" size={20} color="#6b7280" />
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => navigateTo('AddFleetAsset')}
            >
              <MaterialIcons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.staffButton} onPress={() => navigateTo('RentalStaff')}>
            <View style={styles.staffButtonIcon}>
              <MaterialIcons name="groups" size={20} color="#0C2D48" />
            </View>
            <View style={styles.staffButtonTextBlock}>
              <Text style={styles.staffButtonTitle}>Manage Rental Staff</Text>
              <Text style={styles.staffButtonText}>Add assistants for walk-in clients and fleet rentals</Text>
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#94a3b8" />
          </TouchableOpacity>

          {rentalMarketplaceNotice && (
            <View style={styles.noticeBanner}>
              <MaterialIcons name="workspace-premium" size={20} color="#F37021" />
              <Text style={styles.noticeText}>{rentalMarketplaceNotice}</Text>
            </View>
          )}

          {/* Filter Tabs */}
          <View style={styles.filterTabs}>
            <FilterTab
              label="All"
              count={stats.total}
              isActive={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            <FilterTab
              label="Available"
              count={stats.available}
              isActive={filter === 'available'}
              onPress={() => setFilter('available')}
            />
            <FilterTab
              label="Rented"
              count={stats.rented}
              isActive={filter === 'rented'}
              onPress={() => setFilter('rented')}
            />
            <FilterTab
              label="Maintenance"
              count={stats.maintenance}
              isActive={filter === 'maintenance'}
              onPress={() => setFilter('maintenance')}
            />
          </View>

          {/* Stats Summary */}
          <View style={styles.statsSummary}>
            <StatItem value={stats.available} label="Available" color="#16a34a" />
            <StatItem value={stats.rented} label="Rented Out" color="#F37021" />
            <StatItem value={stats.maintenance} label="Maintenance" color="#dc2626" />
          </View>

          {/* Error State */}
          {error && (
            <View style={styles.errorContainer}>
              <MaterialIcons name="error-outline" size={48} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => fetchTrailers()}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Trailer List */}
          {!error && (
            <View style={styles.trailerList}>
              <Text style={styles.sectionTitle}>
                {filter === 'all' ? 'All Fleet Assets' :
                 filter === 'available' ? 'Available Assets' :
                 filter === 'rented' ? 'Rented Assets' : 'Under Maintenance'}
                ({trailers.length})
              </Text>

              {trailers.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="local-shipping" size={64} color="#d1d5db" />
                  <Text style={styles.emptyStateTitle}>No fleet assets found</Text>
                  <Text style={styles.emptyStateSubtitle}>
                    {searchQuery ? 'Try adjusting your search terms' :
                     filter !== 'all' ? `No ${filter} assets at the moment` :
                     'Add your first fleet asset to get started'}
                  </Text>
                  {filter === 'all' && !searchQuery && (
                    <TouchableOpacity
                      style={styles.addTrailerButton}
                      onPress={() => navigateTo('AddFleetAsset')}
                    >
                      <MaterialIcons name="add" size={20} color="white" />
                      <Text style={styles.addTrailerButtonText}>Add Asset</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                trailers.map((trailer) => (
                  <TrailerListItem
                    key={trailer._id}
                    trailer={trailer}
                    getTrailerName={getTrailerName}
                    getTrailerTypeName={getTrailerTypeName}
                    getCapacityDisplay={getCapacityDisplay}
                    getFeatures={getFeatures}
                    getLocationDisplay={getLocationDisplay}
                    getDailyRate={getDailyRate}
                    onPress={() => navigateTo('TrailerDetail', { trailerId: trailer._id })}
                    onDelete={() => handleDeleteTrailer(trailer)}
                    onStatusChange={(status) => handleStatusChange(trailer, status)}
                  />
                ))
              )}
            </View>
          )}

          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Filter Tab Component
const FilterTab = ({ label, count, isActive, onPress }) => (
  <TouchableOpacity
    style={[styles.filterTab, isActive && styles.filterTabActive]}
    onPress={onPress}
  >
    <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
      {label}
    </Text>
    <View style={[styles.countBadge, isActive && styles.countBadgeActive]}>
      <Text style={[styles.countText, isActive && styles.countTextActive]}>
        {count}
      </Text>
    </View>
  </TouchableOpacity>
);

// Stat Item Component
const StatItem = ({ value, label, color }) => (
  <View style={styles.statItem}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// Trailer List Item Component
const TrailerListItem = ({
  trailer,
  getTrailerName,
  getTrailerTypeName,
  getCapacityDisplay,
  getFeatures,
  getLocationDisplay,
  getDailyRate,
  onPress,
  onDelete,
  onStatusChange
}) => {
  const [showActions, setShowActions] = useState(false);
  const features = getFeatures(trailer);

  return (
    <TouchableOpacity style={styles.trailerListItem} onPress={onPress}>
      <View style={styles.trailerImage}>
        <MaterialIcons
          name="local-shipping"
          size={40}
          color={getStatusColor(trailer.status)}
        />
      </View>
      <View style={styles.trailerInfo}>
        <View style={styles.trailerHeader}>
          <Text style={styles.trailerName}>{getTrailerName(trailer)}</Text>
          <View style={[styles.statusBadge, styles[`status${trailer.status.charAt(0).toUpperCase() + trailer.status.slice(1)}`]]}>
            <Text style={styles.statusText}>{trailer.status}</Text>
          </View>
        </View>
        <Text style={styles.trailerType}>{getTrailerTypeName(trailer)} • {getCapacityDisplay(trailer)}</Text>
        <Text style={styles.trailerLocation}>{getLocationDisplay(trailer)}</Text>

        {/* Features */}
        {features.length > 0 && (
          <View style={styles.featuresContainer}>
            {features.slice(0, 2).map((feature, index) => (
              <View key={index} style={styles.featureTag}>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
            {features.length > 2 && (
              <View style={styles.featureTag}>
                <Text style={styles.featureText}>+{features.length - 2}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.trailerFooter}>
          <Text style={styles.trailerRate}>${getDailyRate(trailer)}/day</Text>
          <Text style={styles.availableDate}>
            {trailer.status === 'available' ? 'Available Now' :
             trailer.status === 'rented' ? 'Currently Rented' :
             trailer.status === 'maintenance' ? 'Under Maintenance' :
             'In Use'}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={(e) => {
              e.stopPropagation();
              setShowActions(!showActions);
            }}
          >
            <MaterialIcons name="more-vert" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {showActions && (
          <View style={styles.actionsMenu}>
            {trailer.status !== 'available' && trailer.status !== 'rented' && (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  setShowActions(false);
                  onStatusChange('available');
                }}
              >
                <MaterialIcons name="check-circle" size={16} color="#16a34a" />
                <Text style={styles.actionMenuText}>Set Available</Text>
              </TouchableOpacity>
            )}
            {trailer.status === 'available' && (
              <TouchableOpacity
                style={styles.actionMenuItem}
                onPress={() => {
                  setShowActions(false);
                  onStatusChange('maintenance');
                }}
              >
                <MaterialIcons name="build" size={16} color="#F37021" />
                <Text style={styles.actionMenuText}>Set Maintenance</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.actionMenuItem}
              onPress={() => {
                setShowActions(false);
                onDelete();
              }}
            >
              <MaterialIcons name="delete" size={16} color="#dc2626" />
              <Text style={[styles.actionMenuText, { color: '#dc2626' }]}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
    </TouchableOpacity>
  );
};

// Helper function to get status color
const getStatusColor = (status) => {
  switch (status) {
    case 'available': return '#16a34a';
    case 'rented': return '#F37021';
    case 'maintenance': return '#dc2626';
    case 'in_use': return '#2563eb';
    default: return '#6b7280';
  }
};

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
  content: {
    padding: 16,
  },
  noticeBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fed7aa',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: {
    flex: 1,
    color: '#9a3412',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  staffButton: {
    backgroundColor: 'white',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  staffButtonIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  staffButtonTextBlock: {
    flex: 1,
  },
  staffButtonTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  staffButtonText: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
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
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  errorText: {
    fontSize: 16,
    color: '#dc2626',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#0C2D48',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchTextInput: {
    flex: 1,
    paddingHorizontal: 8,
    fontSize: 16,
    color: '#1f2937',
  },
  addButton: {
    backgroundColor: '#0C2D48',
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  filterTabActive: {
    backgroundColor: '#0C2D48',
  },
  filterTabText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  filterTabTextActive: {
    color: 'white',
  },
  countBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  countBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  countText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6b7280',
  },
  countTextActive: {
    color: 'white',
  },
  statsSummary: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 20,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  trailerList: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  addTrailerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C2D48',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  addTrailerButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  trailerListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  trailerImage: {
    width: 60,
    height: 60,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  trailerInfo: {
    flex: 1,
  },
  trailerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  trailerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  statusAvailable: {
    backgroundColor: '#dcfce7',
  },
  statusRented: {
    backgroundColor: '#fef3c7',
  },
  statusMaintenance: {
    backgroundColor: '#fee2e2',
  },
  statusIn_use: {
    backgroundColor: '#dbeafe',
  },
  statusInactive: {
    backgroundColor: '#f3f4f6',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  trailerType: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  trailerLocation: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  featuresContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 8,
  },
  featureTag: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  featureText: {
    fontSize: 10,
    color: '#0C2D48',
    fontWeight: '500',
  },
  trailerFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  trailerRate: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C2D48',
  },
  availableDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  quickActions: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  actionButton: {
    padding: 4,
  },
  actionsMenu: {
    position: 'absolute',
    right: 0,
    top: 24,
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  actionMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 8,
  },
  actionMenuText: {
    fontSize: 14,
    color: '#374151',
  },
  bottomPadding: {
    height: 20,
  },
});

export default TrailerListScreen;
