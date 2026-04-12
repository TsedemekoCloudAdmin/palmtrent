import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../services/apiService';

const ActivityHistoryScreen = ({ navigation }) => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');

  const filters = [
    { key: 'all', label: 'All' },
    { key: 'booking', label: 'Bookings' },
    { key: 'payment', label: 'Payments' },
    { key: 'rating', label: 'Ratings' },
    { key: 'account', label: 'Account' },
  ];

  const fetchActivities = useCallback(async () => {
    try {
      const response = await apiService.request('/auth/activity-history');
      if (response.success) {
        setActivities(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
      // Use mock data if API not available
      setActivities(getMockActivities());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivities();
  };

  const getMockActivities = () => [
    {
      id: '1',
      type: 'booking',
      title: 'Booking Created',
      description: 'New booking #BK-001234 from Harare to Bulawayo',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      icon: 'local-shipping',
      color: '#0C2D48',
    },
    {
      id: '2',
      type: 'payment',
      title: 'Payment Received',
      description: 'Payment of $150.00 for booking #BK-001234',
      timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      icon: 'payment',
      color: '#16a34a',
    },
    {
      id: '3',
      type: 'booking',
      title: 'Delivery Completed',
      description: 'Booking #BK-001230 delivered successfully',
      timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      icon: 'check-circle',
      color: '#16a34a',
    },
    {
      id: '4',
      type: 'rating',
      title: 'Rating Received',
      description: 'You received a 5-star rating from John Moyo',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      icon: 'star',
      color: '#F37021',
    },
    {
      id: '5',
      type: 'account',
      title: 'Profile Updated',
      description: 'Your phone number was updated',
      timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      icon: 'person',
      color: '#7c3aed',
    },
    {
      id: '6',
      type: 'booking',
      title: 'Booking Cancelled',
      description: 'Booking #BK-001225 was cancelled',
      timestamp: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
      icon: 'cancel',
      color: '#dc2626',
    },
    {
      id: '7',
      type: 'payment',
      title: 'Withdrawal Processed',
      description: 'Withdrawal of $500.00 to EcoCash',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      icon: 'account-balance-wallet',
      color: '#16a34a',
    },
    {
      id: '8',
      type: 'account',
      title: 'Password Changed',
      description: 'Your password was changed successfully',
      timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      icon: 'lock',
      color: '#7c3aed',
    },
  ];

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
  };

  const filteredActivities = filter === 'all'
    ? activities
    : activities.filter(a => a.type === filter);

  const renderActivity = ({ item }) => (
    <View style={styles.activityItem}>
      <View style={[styles.iconContainer, { backgroundColor: item.color + '15' }]}>
        <MaterialIcons name={item.icon || 'history'} size={24} color={item.color || '#6b7280'} />
      </View>
      <View style={styles.activityContent}>
        <Text style={styles.activityTitle}>{item.title}</Text>
        <Text style={styles.activityDescription}>{item.description}</Text>
        <Text style={styles.activityTime}>{formatTimestamp(item.timestamp)}</Text>
      </View>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <MaterialIcons name="history" size={64} color="#d1d5db" />
      <Text style={styles.emptyTitle}>No Activity Yet</Text>
      <Text style={styles.emptyText}>
        Your activity history will appear here once you start using PalmTrent.
      </Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialIcons name="arrow-back" size={24} color="#0C2D48" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Activity History</Text>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="#0C2D48" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Activity History</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          data={filters}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterTab,
                filter === item.key && styles.filterTabActive,
              ]}
              onPress={() => setFilter(item.key)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === item.key && styles.filterTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          contentContainerStyle={styles.filterList}
        />
      </View>

      <FlatList
        data={filteredActivities}
        renderItem={renderActivity}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#0C2D48']}
          />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0C2D48',
  },
  placeholder: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    backgroundColor: 'white',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterList: {
    paddingHorizontal: 12,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 4,
    backgroundColor: '#f1f5f9',
  },
  filterTabActive: {
    backgroundColor: '#0C2D48',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  filterTextActive: {
    color: 'white',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  activityItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  activityDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default ActivityHistoryScreen;
