import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../../hook/useAuth';
import apiService from '../../services/apiService';

const PendingJobsScreen = ({ navigation }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState('all'); // all, assigned, en_route_pickup, picked_up

  const fetchPendingJobs = useCallback(async () => {
    try {
      // Fetch jobs that are assigned but not yet completed
      const response = await apiService.get('/transporter/my-jobs?status=assigned,en_route_pickup,picked_up,in_transit');

      if (response.success) {
        setJobs(response.data || []);
      } else {
        setJobs([]);
      }
    } catch (error) {
      console.error('Fetch pending jobs error:', error);
      setJobs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingJobs();
  }, [fetchPendingJobs]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPendingJobs();
  }, [fetchPendingJobs]);

  const handleStartPickup = async (job) => {
    Alert.alert(
      'Start Pickup',
      'Are you ready to head to the pickup location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start',
          onPress: async () => {
            try {
              const response = await apiService.post(`/transporter/shipments/${job._id}/start-pickup`);
              if (response.success) {
                Alert.alert('Success', 'Pickup started! Navigate to the pickup location.');
                fetchPendingJobs();
              } else {
                Alert.alert('Error', response.message || 'Failed to start pickup');
              }
            } catch (error) {
              Alert.alert('Error', error.message || 'Failed to start pickup');
            }
          }
        }
      ]
    );
  };

  const handleConfirmPickup = (job) => {
    navigation.navigate('PickupChecklist', {
      shipmentId: job._id,
      job: job
    });
  };

  const handleStartTransit = async (job) => {
    try {
      const response = await apiService.post(`/transporter/shipments/${job._id}/start-transit`);
      if (response.success) {
        Alert.alert('Success', 'Transit started! Safe travels.');
        fetchPendingJobs();
      } else {
        Alert.alert('Error', response.message || 'Failed to start transit');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to start transit');
    }
  };

  const handleViewDetails = (job) => {
    navigation.navigate('JobDetails', { jobId: job._id, job });
  };

  const handleNavigate = (job) => {
    navigation.navigate('Tracking', { shipmentId: job._id });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'assigned': return '#0C2D48';
      case 'en_route_pickup': return '#f59e0b';
      case 'picked_up': return '#16a34a';
      case 'in_transit': return '#7c3aed';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'assigned': return 'Waiting to Start';
      case 'en_route_pickup': return 'En Route to Pickup';
      case 'picked_up': return 'Picked Up';
      case 'in_transit': return 'In Transit';
      default: return status;
    }
  };

  const getNextAction = (status) => {
    switch (status) {
      case 'assigned': return { label: 'Start Pickup', action: handleStartPickup };
      case 'en_route_pickup': return { label: 'Confirm Pickup', action: handleConfirmPickup };
      case 'picked_up': return { label: 'Start Transit', action: handleStartTransit };
      case 'in_transit': return { label: 'View Tracking', action: handleNavigate };
      default: return null;
    }
  };

  const filteredJobs = jobs.filter(job => {
    if (filter === 'all') return true;
    return job.status === filter;
  });

  const filters = [
    { id: 'all', label: 'All', count: jobs.length },
    { id: 'assigned', label: 'Assigned', count: jobs.filter(j => j.status === 'assigned').length },
    { id: 'en_route_pickup', label: 'En Route', count: jobs.filter(j => j.status === 'en_route_pickup').length },
    { id: 'in_transit', label: 'In Transit', count: jobs.filter(j => j.status === 'in_transit').length }
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>My Jobs</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading your jobs...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>My Jobs</Text>
          <Text style={styles.headerSubtitle}>{jobs.length} active jobs</Text>
        </View>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <MaterialIcons name="refresh" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {filters.map((f) => (
          <TouchableOpacity
            key={f.id}
            style={[styles.filterTab, filter === f.id && styles.filterTabActive]}
            onPress={() => setFilter(f.id)}
          >
            <Text style={[styles.filterText, filter === f.id && styles.filterTextActive]}>
              {f.label}
            </Text>
            <View style={[styles.filterBadge, filter === f.id && styles.filterBadgeActive]}>
              <Text style={[styles.filterBadgeText, filter === f.id && styles.filterBadgeTextActive]}>
                {f.count}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0C2D48']} />
        }
      >
        {filteredJobs.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="local-shipping" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No jobs found</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'all'
                ? 'You have no active jobs. Check available jobs to start earning!'
                : `No jobs with status "${getStatusLabel(filter)}"`}
            </Text>
            {filter === 'all' && (
              <TouchableOpacity
                style={styles.browseButton}
                onPress={() => navigation.navigate('AvailableJobs')}
              >
                <Text style={styles.browseButtonText}>Browse Available Jobs</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.jobsList}>
            {filteredJobs.map((job) => (
              <JobCard
                key={job._id}
                job={job}
                onViewDetails={() => handleViewDetails(job)}
                onAction={getNextAction(job.status)}
                getStatusColor={getStatusColor}
                getStatusLabel={getStatusLabel}
              />
            ))}
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Job Card Component
const JobCard = ({ job, onViewDetails, onAction, getStatusColor, getStatusLabel }) => {
  const formatDate = (dateStr) => {
    if (!dateStr) return 'TBD';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const statusColor = getStatusColor(job.status);
  const nextAction = onAction;

  return (
    <View style={styles.jobCard}>
      {/* Header */}
      <View style={styles.jobHeader}>
        <View>
          <Text style={styles.bookingRef}>{job.bookingReference || job._id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '20' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {getStatusLabel(job.status)}
            </Text>
          </View>
        </View>
        <View style={styles.earningsContainer}>
          <Text style={styles.earningsLabel}>Earnings</Text>
          <Text style={styles.earningsAmount}>
            ${job.pricing?.totals?.transporterTotal || job.transporterEarnings || 0}
          </Text>
        </View>
      </View>

      {/* Route */}
      <View style={styles.routeContainer}>
        <View style={styles.routePoint}>
          <View style={styles.routeDotGreen} />
          <View style={styles.routeInfo}>
            <Text style={styles.routeLabel}>Pickup</Text>
            <Text style={styles.routeAddress}>
              {job.route?.pickup?.city || job.route?.pickup?.address || 'N/A'}
            </Text>
            <Text style={styles.routeDate}>
              {formatDate(job.route?.pickup?.date || job.schedule?.pickupDate)}
            </Text>
          </View>
        </View>

        <View style={styles.routeLine} />

        <View style={styles.routePoint}>
          <View style={styles.routeDotRed} />
          <View style={styles.routeInfo}>
            <Text style={styles.routeLabel}>Delivery</Text>
            <Text style={styles.routeAddress}>
              {job.route?.delivery?.city || job.route?.delivery?.address || 'N/A'}
            </Text>
            <Text style={styles.routeDate}>
              {formatDate(job.route?.delivery?.date || job.schedule?.deliveryDate)}
            </Text>
          </View>
        </View>
      </View>

      {/* Cargo Info */}
      {job.cargoDetails && (
        <View style={styles.cargoInfo}>
          <MaterialIcons name="inventory" size={16} color="#6b7280" />
          <Text style={styles.cargoText}>
            {job.cargoDetails.description || `${job.cargoDetails.weight || 0} kg cargo`}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={onViewDetails}
        >
          <MaterialIcons name="info" size={18} color="#0C2D48" />
          <Text style={styles.detailsButtonText}>Details</Text>
        </TouchableOpacity>

        {nextAction && (
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: statusColor }]}
            onPress={() => nextAction.action(job)}
          >
            <Text style={styles.actionButtonText}>{nextAction.label}</Text>
            <MaterialIcons name="arrow-forward" size={18} color="white" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 20,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
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
    marginTop: 2,
  },
  refreshButton: {
    padding: 8,
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
  filterContainer: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    gap: 6,
  },
  filterTabActive: {
    backgroundColor: '#0C2D48',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  filterTextActive: {
    color: 'white',
  },
  filterBadge: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  filterBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
  },
  filterBadgeTextActive: {
    color: 'white',
  },
  scrollView: {
    flex: 1,
  },
  jobsList: {
    padding: 16,
    gap: 16,
  },
  jobCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  bookingRef: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#6b7280',
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  earningsContainer: {
    alignItems: 'flex-end',
  },
  earningsLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  earningsAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  routeContainer: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  routeDotGreen: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#16a34a',
    marginTop: 4,
  },
  routeDotRed: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#dc2626',
    marginTop: 4,
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#d1d5db',
    marginLeft: 5,
    marginVertical: 4,
  },
  routeInfo: {
    flex: 1,
  },
  routeLabel: {
    fontSize: 11,
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  routeAddress: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  routeDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  cargoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  cargoText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  detailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#0C2D48',
    borderRadius: 8,
    gap: 6,
  },
  detailsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0C2D48',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
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
  browseButton: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#0C2D48',
    borderRadius: 8,
  },
  browseButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  bottomPadding: {
    height: 20,
  },
});

export default PendingJobsScreen;
