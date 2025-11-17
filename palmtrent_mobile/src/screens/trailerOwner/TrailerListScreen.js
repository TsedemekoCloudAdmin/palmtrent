import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  RefreshControl
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const TrailerListScreen = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'available', 'rented', 'maintenance'

  // Mock data - in real app, this would come from API
  const trailers = [
    {
      id: 1,
      name: 'Flatbed TR-001',
      type: 'Flatbed',
      capacity: '10 tonnes',
      status: 'rented',
      location: 'With Customer - Bulawayo',
      dailyRate: 80,
      nextAvailable: '2024-01-20',
      condition: 'Excellent',
      features: ['GPS Tracking', 'Tarpaulin Cover'],
      image: null
    },
    {
      id: 2,
      name: 'Enclosed TR-002',
      type: 'Enclosed',
      capacity: '8 tonnes',
      status: 'available',
      location: 'Msasa Depot',
      dailyRate: 120,
      nextAvailable: 'Now',
      condition: 'Excellent',
      features: ['GPS Tracking', 'Side Loading'],
      image: null
    },
    {
      id: 3,
      name: 'Refrigerated TR-003',
      type: 'Refrigerated',
      capacity: '12 tonnes',
      status: 'maintenance',
      location: 'Workshop',
      dailyRate: 150,
      nextAvailable: '2024-01-25',
      condition: 'Good',
      features: ['GPS Tracking', 'Refrigeration'],
      image: null
    },
    {
      id: 4,
      name: 'Lowboy TR-004',
      type: 'Lowboy',
      capacity: '15 tonnes',
      status: 'available',
      location: 'Southerton Yard',
      dailyRate: 200,
      nextAvailable: 'Now',
      condition: 'Excellent',
      features: ['GPS Tracking', 'Heavy Duty'],
      image: null
    },
    {
      id: 5,
      name: 'Dump TR-005',
      type: 'Dump',
      capacity: '14 tonnes',
      status: 'rented',
      location: 'With Customer - Harare',
      dailyRate: 180,
      nextAvailable: '2024-01-19',
      condition: 'Good',
      features: ['GPS Tracking', 'Hydraulic Lift'],
      image: null
    }
  ];

  const onRefresh = () => {
    setRefreshing(true);
    // Simulate API call
    setTimeout(() => setRefreshing(false), 2000);
  };

  const navigateTo = (screen, params = {}) => {
    if (navigation) {
      navigation.navigate(screen, params);
    }
  };

  // Filter trailers based on search and filter
  const filteredTrailers = trailers.filter(trailer => {
    const matchesSearch = trailer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         trailer.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || trailer.status === filter;
    return matchesSearch && matchesFilter;
  });

  const getStatusCount = (status) => {
    return trailers.filter(trailer => trailer.status === status).length;
  };

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
        <Text style={styles.headerTitle}>My Trailer Fleet</Text>
        <Text style={styles.headerSubtitle}>{trailers.length} trailers in total</Text>
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
                placeholder="Search trailers..."
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
              onPress={() => navigateTo('TrailerOwnerRegistration')}
            >
              <MaterialIcons name="add" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Filter Tabs */}
          <View style={styles.filterTabs}>
            <FilterTab
              label="All"
              count={trailers.length}
              isActive={filter === 'all'}
              onPress={() => setFilter('all')}
            />
            <FilterTab
              label="Available"
              count={getStatusCount('available')}
              isActive={filter === 'available'}
              onPress={() => setFilter('available')}
            />
            <FilterTab
              label="Rented"
              count={getStatusCount('rented')}
              isActive={filter === 'rented'}
              onPress={() => setFilter('rented')}
            />
            <FilterTab
              label="Maintenance"
              count={getStatusCount('maintenance')}
              isActive={filter === 'maintenance'}
              onPress={() => setFilter('maintenance')}
            />
          </View>

          {/* Stats Summary */}
          <View style={styles.statsSummary}>
            <StatItem value={getStatusCount('available')} label="Available" color="#16a34a" />
            <StatItem value={getStatusCount('rented')} label="Rented Out" color="#F37021" />
            <StatItem value={getStatusCount('maintenance')} label="Maintenance" color="#dc2626" />
          </View>

          {/* Trailer List */}
          <View style={styles.trailerList}>
            <Text style={styles.sectionTitle}>
              {filter === 'all' ? 'All Trailers' : 
               filter === 'available' ? 'Available Trailers' :
               filter === 'rented' ? 'Rented Trailers' : 'Under Maintenance'}
              ({filteredTrailers.length})
            </Text>
            
            {filteredTrailers.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="local-shipping" size={64} color="#d1d5db" />
                <Text style={styles.emptyStateTitle}>No trailers found</Text>
                <Text style={styles.emptyStateSubtitle}>
                  {searchQuery ? 'Try adjusting your search terms' : `No ${filter} trailers at the moment`}
                </Text>
              </View>
            ) : (
              filteredTrailers.map((trailer) => (
                <TrailerListItem 
                  key={trailer.id} 
                  trailer={trailer}
                  onPress={() => navigateTo('TrailerDetail', { trailer })}
                />
              ))
            )}
          </View>

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
const TrailerListItem = ({ trailer, onPress }) => (
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
        <Text style={styles.trailerName}>{trailer.name}</Text>
        <View style={[styles.statusBadge, styles[`status${trailer.status.charAt(0).toUpperCase() + trailer.status.slice(1)}`]]}>
          <Text style={styles.statusText}>{trailer.status}</Text>
        </View>
      </View>
      <Text style={styles.trailerType}>{trailer.type} • {trailer.capacity}</Text>
      <Text style={styles.trailerLocation}>{trailer.location}</Text>
      
      {/* Features */}
      {trailer.features.length > 0 && (
        <View style={styles.featuresContainer}>
          {trailer.features.slice(0, 2).map((feature, index) => (
            <View key={index} style={styles.featureTag}>
              <Text style={styles.featureText}>{feature}</Text>
            </View>
          ))}
          {trailer.features.length > 2 && (
            <View style={styles.featureTag}>
              <Text style={styles.featureText}>+{trailer.features.length - 2}</Text>
            </View>
          )}
        </View>
      )}
      
      <View style={styles.trailerFooter}>
        <Text style={styles.trailerRate}>${trailer.dailyRate}/day</Text>
        <Text style={styles.availableDate}>
          {trailer.status === 'available' ? 'Available Now' : 
           trailer.status === 'rented' ? `Returns: ${trailer.nextAvailable}` :
           `Available: ${trailer.nextAvailable}`}
        </Text>
      </View>
    </View>
    <MaterialIcons name="chevron-right" size={24} color="#9ca3af" />
  </TouchableOpacity>
);

// Helper function to get status color
const getStatusColor = (status) => {
  switch (status) {
    case 'available': return '#16a34a';
    case 'rented': return '#F37021';
    case 'maintenance': return '#dc2626';
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
  bottomPadding: {
    height: 20,
  },
});

export default TrailerListScreen;