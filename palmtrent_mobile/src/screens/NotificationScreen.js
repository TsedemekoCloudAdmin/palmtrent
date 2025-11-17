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

const { width } = Dimensions.get('window');

const NotificationScreen = ({ navigation, onNavigate }) => {
  const [filter, setFilter] = useState('all');

  const notifications = [
    {
      id: 1,
      type: 'job',
      title: 'New job available',
      message: 'Harare → Bulawayo • $400',
      time: '5 mins ago',
      read: false
    },
    {
      id: 2,
      type: 'payment',
      title: 'Payment received',
      message: '$400 deposited to your account',
      time: '1 hour ago',
      read: false
    },
    {
      id: 3,
      type: 'rating',
      title: 'New rating received',
      message: 'John Moyo rated you 5 stars',
      time: '2 hours ago',
      read: true
    },
    {
      id: 4,
      type: 'system',
      title: 'Document expiring soon',
      message: 'Your VID certificate expires in 30 days',
      time: '1 day ago',
      read: true
    }
  ];

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
      case 'job': return 'local-shipping';
      case 'payment': return 'attach-money';
      case 'rating': return 'star';
      case 'system': return 'info';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type) => {
    switch (type) {
      case 'job': return '#0C2D48';
      case 'payment': return '#16a34a';
      case 'rating': return '#f59e0b';
      case 'system': return '#dc2626';
      default: return '#6b7280';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Notifications</Text>
          <TouchableOpacity style={styles.markAllButton}>
            <Text style={styles.markAllText}>Mark all as read</Text>
          </TouchableOpacity>
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
            count={notifications.filter(n => !n.read).length}
            active={filter === 'unread'}
            onPress={() => setFilter('unread')}
          />
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {filteredNotifications.length === 0 ? (
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
                key={notif.id} 
                notification={notif}
                icon={getNotificationIcon(notif.type)}
                color={getNotificationColor(notif.type)}
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

const NotificationItem = ({ notification, icon, color }) => (
  <TouchableOpacity style={[
    styles.notificationItem,
    !notification.read && styles.notificationItemUnread
  ]}>
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