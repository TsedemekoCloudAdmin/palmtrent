import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Dimensions,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../services/apiService';

const { width } = Dimensions.get('window');

// Helper function to format time
const formatTimeAgo = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
};

const NotificationScreen = ({ navigation, onNavigate }) => {
  const [filter, setFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiService.get('/notifications');
      if (response.success) {
        setNotifications(response.data || []);
        setUnreadCount(response.unreadCount || 0);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await apiService.post('/notifications/mark-all-read');
      if (response.success) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleMarkAsRead = async (notificationId) => {
    try {
      const response = await apiService.post(`/notifications/${notificationId}/read`);
      if (response.success) {
        setNotifications(prev => prev.map(n =>
          n._id === notificationId ? { ...n, read: true } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  };

  const filteredNotifications = filter === 'all'
    ? notifications
    : notifications.filter(n => !n.read);

  const navigateTo = (screen, params = {}) => {
    if (onNavigate) {
      onNavigate(screen, params);
    } else if (navigation) {
      navigation.navigate(screen, params);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'booking_confirmed': return 'check-circle';
      case 'transporter_assigned': return 'local-shipping';
      case 'pickup_started': return 'directions-car';
      case 'in_transit': return 'local-shipping';
      case 'delivery_completed': return 'inventory';
      case 'payment_received':
      case 'payment_released': return 'attach-money';
      case 'rating_received': return 'star';
      case 'claim_update': return 'gavel';
      case 'system_message': return 'info';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'booking_confirmed': return '#0C2D48';
      case 'transporter_assigned': return '#0C2D48';
      case 'pickup_started':
      case 'in_transit': return '#3b82f6';
      case 'delivery_completed': return '#16a34a';
      case 'payment_received':
      case 'payment_released': return '#16a34a';
      case 'rating_received': return '#f59e0b';
      case 'claim_update': return '#dc2626';
      case 'system_message': return '#6b7280';
      default: return '#6b7280';
    }
  };

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Notifications</Text>
          {unreadCount > 0 && (
            <TouchableOpacity style={styles.markAllButton} onPress={handleMarkAllAsRead}>
              <Text style={styles.markAllText}>Mark all as read</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.filterContainer}>
          <FilterButton
            label="All"
            count={notifications.length}
            active={filter === 'all'}
            onPress={() => setFilter('all')}
          />
          <FilterButton
            label="Unread"
            count={unreadCount}
            active={filter === 'unread'}
            onPress={() => setFilter('unread')}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#0C2D48" />
          </View>
        ) : filteredNotifications.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="notifications-off" size={64} color="#d1d5db" />
            <Text style={styles.emptyTitle}>No notifications</Text>
            <Text style={styles.emptySubtitle}>
              {filter === 'unread' ? 'No unread notifications' : 'You\'re all caught up!'}
            </Text>
          </View>
        ) : (
          <View style={styles.notificationsList}>
            {filteredNotifications.map((notif) => (
              <NotificationItem
                key={notif._id}
                notification={{
                  ...notif,
                  message: notif.body,
                  time: formatTimeAgo(notif.createdAt)
                }}
                icon={getNotificationIcon(notif.type)}
                color={getNotificationColor(notif.type)}
                onPress={() => {
                  if (!notif.read) {
                    handleMarkAsRead(notif._id);
                  }
                }}
              />
            ))}
          </View>
        )}

        {/* Reduced bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper Components
const FilterButton = ({ label, count, active, onPress }) => (
  <TouchableOpacity
    style={[
      styles.filterButton,
      active && styles.filterButtonActive
    ]}
    onPress={onPress}
  >
    <Text style={[
      styles.filterButtonText,
      active && styles.filterButtonTextActive
    ]}>
      {label}
    </Text>
    {count > 0 && (
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

const NotificationItem = ({ notification, icon, color, onPress }) => (
  <TouchableOpacity
    style={[
      styles.notificationItem,
      !notification.read && styles.notificationItemUnread
    ]}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.notificationIcon, { backgroundColor: `${color}20` }]}>
      <MaterialIcons name={icon} size={20} color={color} />
    </View>

    <View style={styles.notificationContent}>
      <View style={styles.notificationHeader}>
        <Text style={styles.notificationTitle}>{notification.title}</Text>
        {!notification.read && (
          <View style={styles.unreadIndicator} />
        )}
      </View>
      <Text style={styles.notificationMessage}>{notification.message}</Text>
      <Text style={styles.notificationTime}>{notification.time}</Text>
    </View>
  </TouchableOpacity>
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
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  markAllButton: {
    padding: 4,
  },
  markAllText: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  filterButtonActive: {
    backgroundColor: 'white',
  },
  filterButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#0C2D48',
  },
  filterCount: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 4,
  },
  filterCountActive: {
    backgroundColor: '#0C2D48',
  },
  filterCountText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  filterCountTextActive: {
    color: 'white',
  },
  loadingState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 16,
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
  notificationsList: {
    padding: 16,
    gap: 8,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  notificationItemUnread: {
    backgroundColor: '#dbeafe',
    borderColor: '#93c5fd',
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  unreadIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0C2D48',
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: '#9ca3af',
  },
  bottomPadding: {
    height: 20,
  },
});

export default NotificationScreen;