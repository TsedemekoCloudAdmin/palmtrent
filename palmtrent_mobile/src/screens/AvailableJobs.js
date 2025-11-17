import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../hook/useAuth';

const { width } = Dimensions.get('window');

const AvailableJobsScreen = ({ navigation, onNavigate }) => {
  const { user } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState('all');
  
  const jobs = [
    {
      id: 'PT-2025-001234',
      route: { from: 'Harare', to: 'Bulawayo' },
      distance: 440,
      cargo: '5 tonnes maize in bags',
      earnings: 400,
      shipper: { name: 'John Moyo', rating: 4.8, trips: 45 },
      pickup: { date: 'Tomorrow', time: '6-12 PM' },
      payment: 'digital',
      expiresIn: 28,
      recommended: true,
      returnLoads: 2
    },
    {
      id: 'PT-2025-001235',
      route: { from: 'Harare', to: 'Mutare' },
      distance: 265,
      cargo: 'Furniture (3 tonnes)',
      earnings: 280,
      shipper: { name: 'Sarah Dube', rating: 4.6, trips: 23 },
      pickup: { date: 'Today', time: '2-6 PM' },
      payment: 'digital',
      expiresIn: 45,
      recommended: false,
      returnLoads: 1
    },
    {
      id: 'PT-2025-001236',
      route: { from: 'Harare', to: 'Gweru' },
      distance: 280,
      cargo: 'Building materials (4 tonnes)',
      earnings: 320,
      shipper: { name: 'Mike Chikwanha', rating: 4.9, trips: 67 },
      pickup: { date: 'Tomorrow', time: '8 AM' },
      payment: 'cash_pickup',
      expiresIn: 15,
      recommended: false,
      returnLoads: 0
    }
  ];

  const navigateTo = (screen, params = {}) => {
    if (onNavigate) {
      onNavigate(screen, params);
    } else if (navigation) {
      navigation.navigate(screen, params);
    }
  };

  const filteredJobs = jobs.filter(job => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'today') return job.pickup.date === 'Today';
    if (selectedFilter === 'recommended') return job.recommended;
    if (selectedFilter === 'high_pay') return job.earnings >= 350;
    return true;
  });

  const filters = [
    { id: 'all', label: 'All Jobs', count: jobs.length },
    { id: 'recommended', label: 'Recommended', count: jobs.filter(j => j.recommended).length, icon: 'star' },
    { id: 'today', label: 'Today', count: jobs.filter(j => j.pickup.date === 'Today').length },
    { id: 'high_pay', label: 'High Pay', count: jobs.filter(j => j.earnings >= 350).length, icon: 'attach-money' }
  ];

  const handleAcceptJob = (job) => {
    navigateTo('JobDetails', { job });
  };

  const handleViewDetails = (job) => {
    navigateTo('JobDetails', { job });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Available Jobs</Text>
          <Text style={styles.headerSubtitle}>{jobs.length} jobs in your area</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Quick Stats */}
        <View style={styles.section}>
          <View style={styles.statsCard}>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.blueText]}>{jobs.length}</Text>
              <Text style={styles.statLabel}>Available</Text>
            </View>
            <View style={[styles.statItem, styles.statDivider]}>
              <Text style={[styles.statNumber, styles.greenText]}>
                ${jobs.filter(j => j.recommended).length * 400}
              </Text>
              <Text style={styles.statLabel}>Potential</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statNumber, styles.orangeText]}>
                {jobs.filter(j => j.pickup.date === 'Today').length}
              </Text>
              <Text style={styles.statLabel}>Today</Text>
            </View>
          </View>
        </View>

        {/* Filters */}
        <View style={styles.section}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filtersContainer}
            contentContainerStyle={styles.filtersContent}
          >
            {filters.map((filter) => (
              <FilterChip
                key={filter.id}
                label={filter.label}
                active={selectedFilter === filter.id}
                count={filter.count}
                icon={filter.icon}
                onPress={() => setSelectedFilter(filter.id)}
              />
            ))}
          </ScrollView>
        </View>

        {/* Jobs List */}
        <View style={styles.section}>
          {filteredJobs.length > 0 ? (
            <View style={styles.jobsList}>
              {filteredJobs.map((job) => (
                <JobCard 
                  key={job.id} 
                  job={job}
                  onAccept={() => handleAcceptJob(job)}
                  onViewDetails={() => handleViewDetails(job)}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="inventory" size={64} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No jobs match your filters</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your filters to see more jobs</Text>
              <TouchableOpacity 
                style={styles.clearFiltersButton}
                onPress={() => setSelectedFilter('all')}
              >
                <Text style={styles.clearFiltersText}>Clear Filters</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Reduced bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Filter Chip Component
const FilterChip = ({ label, active, count, icon, onPress }) => (
  <TouchableOpacity
    style={[
      styles.filterChip,
      active && styles.filterChipActive
    ]}
    onPress={onPress}
  >
    {icon && (
      <MaterialIcons 
        name={icon} 
        size={16} 
        color={active ? 'white' : '#0C2D48'} 
      />
    )}
    <Text style={[
      styles.filterChipText,
      active && styles.filterChipTextActive
    ]}>
      {label}
    </Text>
    {count !== undefined && (
      <View style={[
        styles.filterCount,
        active && styles.filterCountActive
      ]}>
        <Text style={[
          styles.filterCountText,
          active && styles.filterCountTextActive
        ]}>
          {count}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

// Job Card Component
const JobCard = ({ job, onAccept, onViewDetails }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.jobCard}>
      {/* Header */}
      <View style={styles.jobHeader}>
        <View style={styles.jobIdContainer}>
          <Text style={styles.jobId}>{job.id}</Text>
          {job.recommended && (
            <View style={styles.recommendedBadge}>
              <MaterialIcons name="star" size={12} color="#92400e" />
              <Text style={styles.recommendedText}>Recommended</Text>
            </View>
          )}
        </View>
        <View style={styles.expiryBadge}>
          <MaterialIcons name="schedule" size={12} color="#dc2626" />
          <Text style={styles.expiryText}>{job.expiresIn}m left</Text>
        </View>
      </View>

      {/* Route */}
      <View style={styles.jobRow}>
        <MaterialIcons name="location-on" size={20} color="#6b7280" />
        <View style={styles.routeInfo}>
          <Text style={styles.routeText}>
            {job.route.from} → {job.route.to}
          </Text>
          <Text style={styles.routeDetails}>
            {job.distance} km • {Math.round(job.distance / 60)} hours
          </Text>
        </View>
      </View>

      {/* Cargo */}
      <View style={styles.jobRow}>
        <MaterialIcons name="inventory" size={20} color="#6b7280" />
        <Text style={styles.cargoText}>{job.cargo}</Text>
      </View>

      {/* Earnings */}
      <View style={styles.earningsCard}>
        <View style={styles.earningsLeft}>
          <MaterialIcons name="attach-money" size={24} color="#16a34a" />
          <View>
            <Text style={styles.earningsLabel}>Your Earnings</Text>
            <Text style={styles.earningsAmount}>${job.earnings}</Text>
          </View>
        </View>
        <View style={styles.paymentBadge}>
          <Text style={styles.paymentLabel}>Payment</Text>
          <View style={[
            styles.paymentType,
            job.payment === 'digital' ? styles.paymentDigital : styles.paymentCash
          ]}>
            <Text style={styles.paymentTypeText}>
              {job.payment === 'digital' ? '✓ Digital' : 'Cash Pickup'}
            </Text>
          </View>
        </View>
      </View>

      {/* Shipper Info */}
      <View style={styles.shipperCard}>
        <View style={styles.shipperAvatar}>
          <Text style={styles.shipperInitial}>
            {job.shipper.name.charAt(0)}
          </Text>
        </View>
        <View style={styles.shipperInfo}>
          <Text style={styles.shipperName}>{job.shipper.name}</Text>
          <View style={styles.shipperRating}>
            <MaterialIcons name="star" size={14} color="#fbbf24" />
            <Text style={styles.ratingText}>{job.shipper.rating}</Text>
            <Text style={styles.tripsText}>• {job.shipper.trips} trips</Text>
          </View>
        </View>
      </View>

      {/* Pickup Time */}
      <View style={styles.jobRow}>
        <MaterialIcons name="schedule" size={20} color="#6b7280" />
        <View>
          <Text style={styles.pickupLabel}>Pickup</Text>
          <Text style={styles.pickupTime}>
            {job.pickup.date} • {job.pickup.time}
          </Text>
        </View>
      </View>

      {/* Return Loads */}
      {job.returnLoads > 0 && (
        <View style={styles.returnLoadsCard}>
          <MaterialIcons name="trending-up" size={16} color="#7c3aed" />
          <Text style={styles.returnLoadsText}>
            {job.returnLoads} return load{job.returnLoads > 1 ? 's' : ''} available
          </Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <TouchableOpacity 
          style={styles.detailsButton}
          onPress={onViewDetails}
        >
          <Text style={styles.detailsButtonText}>View Details</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.acceptButton}
          onPress={onAccept}
        >
          <Text style={styles.acceptButtonText}>Accept Job</Text>
          <MaterialIcons name="arrow-forward" size={16} color="white" />
        </TouchableOpacity>
      </View>

      {/* Expanded Details */}
      {expanded && (
        <View style={styles.expandedDetails}>
          <DetailRow label="Cargo Value" value="$10,000 (Insured ✓)" />
          <DetailRow label="Special Instructions" value="Keep dry, covered load" />
          <DetailRow label="Loading" value="Shipper will load" />
          <DetailRow label="Offloading" value="Recipient will offload" />
          <DetailRow label="Toll Fees" value="$12 (2 gates)" />
          <DetailRow label="Payment Release" value="24 hours after delivery" />
          
          <TouchableOpacity style={styles.viewMapButton}>
            <Text style={styles.viewMapText}>📍 View Route Map</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

// Detail Row Component
const DetailRow = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

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
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    marginTop: -10,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#e5e7eb',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  blueText: {
    color: '#0C2D48',
  },
  greenText: {
    color: '#16a34a',
  },
  orangeText: {
    color: '#ea580c',
  },
  filtersContainer: {
    marginBottom: 8,
  },
  filtersContent: {
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginLeft: 4,
  },
  filterChipTextActive: {
    color: 'white',
  },
  filterCount: {
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  filterCountActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterCountText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterCountTextActive: {
    color: 'white',
  },
  jobsList: {
    gap: 16,
  },
  jobCard: {
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
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  jobIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  jobId: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#6b7280',
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  recommendedText: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: '500',
  },
  expiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  expiryText: {
    fontSize: 12,
    color: '#dc2626',
    fontWeight: '500',
  },
  jobRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  routeInfo: {
    flex: 1,
  },
  routeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  routeDetails: {
    fontSize: 14,
    color: '#6b7280',
  },
  cargoText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  earningsCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  earningsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  earningsLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  earningsAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  paymentBadge: {
    alignItems: 'flex-end',
  },
  paymentLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  paymentType: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paymentDigital: {
    backgroundColor: '#dbeafe',
  },
  paymentCash: {
    backgroundColor: '#fed7aa',
  },
  paymentTypeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  shipperCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 12,
  },
  shipperAvatar: {
    width: 40,
    height: 40,
    backgroundColor: '#0C2D48',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shipperInitial: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shipperInfo: {
    flex: 1,
  },
  shipperName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 2,
  },
  shipperRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  tripsText: {
    fontSize: 12,
    color: '#6b7280',
  },
  pickupLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  pickupTime: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  returnLoadsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    borderRadius: 6,
    padding: 8,
    marginBottom: 12,
    gap: 8,
  },
  returnLoadsText: {
    fontSize: 14,
    color: '#7c3aed',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  detailsButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#0C2D48',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C2D48',
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#0C2D48',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  acceptButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  expandedDetails: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  viewMapButton: {
    alignSelf: 'flex-start',
  },
  viewMapText: {
    color: '#0C2D48',
    fontSize: 14,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
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
    marginTop: 4,
    textAlign: 'center',
  },
  clearFiltersButton: {
    marginTop: 16,
  },
  clearFiltersText: {
    color: '#0C2D48',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 20, // Reduced from 80 since no bottom nav
  },
});

export default AvailableJobsScreen;