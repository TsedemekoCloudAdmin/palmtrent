import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../../hook/useAuth';
import apiService from '../../services/apiService';

const FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'cancelled', label: 'Cancelled' }
];

const STATUS_CONFIG = {
  pending: { color: '#f59e0b', bg: '#fef3c7', icon: 'schedule', label: 'Pending' },
  pending_payment: { color: '#f59e0b', bg: '#fef3c7', icon: 'payment', label: 'Awaiting Payment' },
  payment_confirmed: { color: '#3b82f6', bg: '#dbeafe', icon: 'verified', label: 'Payment Confirmed' },
  finding_transporter: { color: '#8b5cf6', bg: '#ede9fe', icon: 'search', label: 'Finding Transporter' },
  confirmed: { color: '#3b82f6', bg: '#dbeafe', icon: 'check-circle', label: 'Confirmed' },
  assigned: { color: '#8b5cf6', bg: '#ede9fe', icon: 'person', label: 'Assigned' },
  transporter_assigned: { color: '#8b5cf6', bg: '#ede9fe', icon: 'person', label: 'Transporter Assigned' },
  en_route_pickup: { color: '#06b6d4', bg: '#cffafe', icon: 'directions', label: 'En Route to Pickup' },
  pickup_started: { color: '#06b6d4', bg: '#cffafe', icon: 'local-shipping', label: 'Pickup Started' },
  picked_up: { color: '#06b6d4', bg: '#cffafe', icon: 'inventory', label: 'Picked Up' },
  in_transit: { color: '#0ea5e9', bg: '#e0f2fe', icon: 'directions', label: 'In Transit' },
  arrived_delivery: { color: '#10b981', bg: '#d1fae5', icon: 'place', label: 'At Delivery Location' },
  delivered: { color: '#10b981', bg: '#d1fae5', icon: 'where-to-vote', label: 'Delivered' },
  completed: { color: '#059669', bg: '#a7f3d0', icon: 'verified', label: 'Completed' },
  cancelled: { color: '#ef4444', bg: '#fee2e2', icon: 'cancel', label: 'Cancelled' },
  disputed: { color: '#dc2626', bg: '#fecaca', icon: 'report', label: 'Disputed' },
  active: { color: '#3b82f6', bg: '#dbeafe', icon: 'check-circle', label: 'Active' }
};

const HistoryScreen = ({ navigation }) => {
  const { user, token } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [filteredBookings, setFilteredBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    cancelled: 0
  });

  const fetchBookings = useCallback(async () => {
    try {
      let response;
      let bookingData = [];

      // Fetch different endpoints based on user type
      if (user?.userType === 'transporter') {
        // For transporters, fetch their accepted jobs
        response = await apiService.request('/transporter/my-jobs');
        if (response.success) {
          // Transform shipment data to match booking card format
          const shipments = response.data || [];
          bookingData = shipments.map(shipment => ({
            _id: shipment._id,
            bookingId: shipment.booking?._id || shipment.booking,
            shipmentId: shipment._id,
            bookingReference: shipment.bookingReference,
            status: shipment.status,
            pickupLocation: { address: shipment.route?.pickup?.address || shipment.origin },
            deliveryLocation: { address: shipment.route?.delivery?.address || shipment.destination },
            cargoDetails: shipment.cargoDetails,
            cargoType: shipment.cargoDetails?.type,
            weight: shipment.cargoDetails?.weight,
            totalPrice: shipment.transporterEarnings || shipment.pricing?.totals?.transporterTotal,
            price: shipment.amount,
            createdAt: shipment.createdAt,
            shipper: shipment.shipper
          }));
        }
      } else if (user?.userType === 'driver') {
        // For drivers, fetch the shipments assigned to them (full history)
        response = await apiService.getDriverShipments('all');
        if (response.success) {
          const shipments = response.data || [];
          bookingData = shipments.map(shipment => ({
            _id: shipment._id,
            bookingId: shipment.booking?._id || shipment.booking,
            shipmentId: shipment._id,
            bookingReference: shipment.bookingReference,
            status: shipment.status,
            pickupLocation: { address: shipment.route?.pickup?.address || shipment.origin },
            deliveryLocation: { address: shipment.route?.delivery?.address || shipment.destination },
            cargoDetails: shipment.cargoDetails,
            cargoType: shipment.cargoDetails?.type,
            weight: shipment.cargoDetails?.weight,
            createdAt: shipment.createdAt,
            shipper: shipment.shipper
          }));
        }
      } else if (user?.userType === 'trailer_owner') {
        // For trailer owners, fetch their rentals
        response = await apiService.request('/rentals/my-rentals');
        if (response.success) {
          const rentals = response.data || [];
          bookingData = rentals.map(rental => ({
            _id: rental._id,
            bookingReference: rental.rentalReference || rental._id?.slice(-8).toUpperCase(),
            status: rental.status,
            pickupLocation: { address: rental.pickupLocation || 'N/A' },
            deliveryLocation: { address: rental.returnLocation || 'N/A' },
            cargoDetails: { cargoType: 'Trailer Rental' },
            cargoType: { name: rental.trailer?.trailerType || 'Trailer' },
            totalPrice: rental.totalPrice,
            createdAt: rental.createdAt,
            renter: rental.renter
          }));
        }
      } else {
        // For shippers (default), fetch their bookings
        response = await apiService.getMyBookings({ limit: 50 });
        if (response.success) {
          const bookings = response.data || [];
          // Transform booking data to ensure consistent price field
          bookingData = bookings.map(booking => ({
            ...booking,
            // Extract price from nested pricing object if not at top level
            totalPrice: booking.totalPrice || booking.pricing?.totals?.total || booking.totalAmount || booking.price || 0
          }));
        }
      }

      setBookings(bookingData);

      // Calculate stats
      const completed = bookingData.filter(b => b.status === 'completed').length;
      const inProgress = bookingData.filter(b =>
        ['pending', 'confirmed', 'assigned', 'pickup_started', 'picked_up', 'in_transit', 'delivered', 'en_route_pickup', 'arrived_delivery'].includes(b.status)
      ).length;
      const cancelled = bookingData.filter(b => b.status === 'cancelled').length;

      setStats({
        total: bookingData.length,
        completed,
        inProgress,
        cancelled
      });
    } catch (error) {
      console.error('Error fetching history:', error);
      Alert.alert('Error', 'Failed to load history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token, user?.userType]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    filterBookings(activeFilter);
  }, [bookings, activeFilter]);

  const filterBookings = (filter) => {
    let filtered = [...bookings];

    switch (filter) {
      case 'completed':
        filtered = bookings.filter(b => b.status === 'completed');
        break;
      case 'in_progress':
        filtered = bookings.filter(b =>
          ['pending', 'confirmed', 'assigned', 'pickup_started', 'picked_up', 'in_transit', 'delivered', 'en_route_pickup', 'arrived_delivery', 'active'].includes(b.status)
        );
        break;
      case 'cancelled':
        filtered = bookings.filter(b => b.status === 'cancelled');
        break;
      default:
        // all - no filter
        break;
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    setFilteredBookings(filtered);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  const handleBookingPress = (booking) => {
    // For transporter/driver rows, _id is the shipment id; use the real booking
    // id so JobDetails (which fetches /bookings/:id) can load.
    navigation.navigate('JobDetails', {
      bookingId: booking.bookingId || booking._id,
      shipmentId: booking.shipmentId
    });
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return `$${parseFloat(amount || 0).toFixed(2)}`;
  };

  const getStatusConfig = (status) => {
    return STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  };

  const renderBookingCard = ({ item }) => {
    const statusConfig = getStatusConfig(item.status);

    return (
      <TouchableOpacity
        style={styles.bookingCard}
        onPress={() => handleBookingPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.referenceContainer}>
            <MaterialIcons name="confirmation-number" size={16} color="#6b7280" />
            <Text style={styles.referenceText}>
              {item.bookingReference || item._id?.slice(-8).toUpperCase()}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <MaterialIcons name={statusConfig.icon} size={14} color={statusConfig.color} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.label}
            </Text>
          </View>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.pickupLocation?.address || 'Pickup location'}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.locationRow}>
            <View style={[styles.locationDot, { backgroundColor: '#ef4444' }]} />
            <Text style={styles.locationText} numberOfLines={1}>
              {item.deliveryLocation?.address || 'Delivery location'}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailItem}>
            <MaterialIcons name="inventory-2" size={16} color="#6b7280" />
            <Text style={styles.detailText}>
              {item.cargoDetails?.cargoType || item.cargoType?.name || 'General'}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <MaterialIcons name="scale" size={16} color="#6b7280" />
            <Text style={styles.detailText}>
              {item.cargoDetails?.weight || item.weight || 0} kg
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.dateContainer}>
            <MaterialIcons name="event" size={14} color="#9ca3af" />
            <Text style={styles.dateText}>{formatDate(item.createdAt)}</Text>
          </View>
          <Text style={styles.priceText}>{formatCurrency(item.totalPrice || item.price)}</Text>
        </View>

        {item.transporter && (
          <View style={styles.transporterInfo}>
            <MaterialIcons name="local-shipping" size={14} color="#6b7280" />
            <Text style={styles.transporterText}>
              {item.transporter.fullName || item.transporter.name || 'Transporter assigned'}
            </Text>
            {(item.transporter.rating?.average ?? (typeof item.transporter.rating === 'number' ? item.transporter.rating : null)) != null && (
              <View style={styles.ratingContainer}>
                <MaterialIcons name="star" size={12} color="#f59e0b" />
                <Text style={styles.ratingText}>
                  {Number(item.transporter.rating?.average ?? item.transporter.rating).toFixed(1)}
                </Text>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const getItemLabel = () => {
    if (user?.userType === 'transporter') return 'jobs';
    if (user?.userType === 'trailer_owner') return 'rentals';
    return 'bookings';
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="history" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>
        {user?.userType === 'transporter' ? 'No Jobs Found' :
         user?.userType === 'trailer_owner' ? 'No Rentals Found' : 'No Bookings Found'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {activeFilter === 'all'
          ? `Your ${getItemLabel()} history will appear here`
          : `No ${activeFilter.replace('_', ' ')} ${getItemLabel()}`
        }
      </Text>
      {user?.userType === 'shipper' && (
        <TouchableOpacity
          style={styles.createBookingBtn}
          onPress={() => navigation.navigate('CreateBooking')}
        >
          <MaterialIcons name="add" size={20} color="white" />
          <Text style={styles.createBookingText}>Create New Booking</Text>
        </TouchableOpacity>
      )}
      {user?.userType === 'transporter' && (
        <TouchableOpacity
          style={styles.createBookingBtn}
          onPress={() => navigation.navigate('AvailableJobs')}
        >
          <MaterialIcons name="search" size={20} color="white" />
          <Text style={styles.createBookingText}>Find Available Jobs</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {user?.userType === 'transporter' ? 'Job History' :
           user?.userType === 'trailer_owner' ? 'Rental History' : 'Booking History'}
        </Text>
        <Text style={styles.headerSubtitle}>
          {stats.total} total {user?.userType === 'transporter' ? 'jobs' :
           user?.userType === 'trailer_owner' ? 'rentals' : 'bookings'}
        </Text>
      </View>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: '#d1fae5' }]}>
          <MaterialIcons name="verified" size={24} color="#059669" />
          <Text style={[styles.statNumber, { color: '#059669' }]}>{stats.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
          <MaterialIcons name="local-shipping" size={24} color="#3b82f6" />
          <Text style={[styles.statNumber, { color: '#3b82f6' }]}>{stats.inProgress}</Text>
          <Text style={styles.statLabel}>In Progress</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: '#fee2e2' }]}>
          <MaterialIcons name="cancel" size={24} color="#ef4444" />
          <Text style={[styles.statNumber, { color: '#ef4444' }]}>{stats.cancelled}</Text>
          <Text style={styles.statLabel}>Cancelled</Text>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterTab,
                activeFilter === tab.key && styles.filterTabActive
              ]}
              onPress={() => setActiveFilter(tab.key)}
            >
              <Text style={[
                styles.filterTabText,
                activeFilter === tab.key && styles.filterTabTextActive
              ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Bookings List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading bookings...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredBookings}
          keyExtractor={(item) => item._id}
          renderItem={renderBookingCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#0C2D48']}
              tintColor="#0C2D48"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: -20,
    marginBottom: 16,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 2,
  },
  filterContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  filterTabActive: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  filterTabText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  filterTabTextActive: {
    color: 'white',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  bookingCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  referenceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  referenceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  routeContainer: {
    marginBottom: 12,
    paddingLeft: 4,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  locationDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  locationText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#e5e7eb',
    marginLeft: 4,
    marginVertical: 2,
  },
  cardDetails: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#6b7280',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  priceText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  transporterInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  transporterText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
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
  createBookingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C2D48',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  createBookingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default HistoryScreen;
