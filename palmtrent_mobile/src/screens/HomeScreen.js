// src/screens/HomeScreen.js
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../hook/useAuth';
import { 
  useTransporterDashboardStats,
  useTransporterRecentActivity,
  useTransporterAvailableJobs,
  useShipperDashboardStats,
  useShipperRecentActivity,
  useTrailerOwnerDashboardStats,
  useTrailerOwnerRecentActivity
} from '../hook/useApi';

const HomeScreen = ({ navigation }) => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  // Determine user type
  const isCorporate = user?.userType === 'corporate';
  const isTransporter = user?.userType === 'transporter';
  const isTrailerOwner = user?.userType === 'trailer_owner';
  const isShipper = user?.userType === 'shipper' || isCorporate;

  // Fetch data based on user type
  const { 
    data: transporterStats, 
    loading: transporterStatsLoading,
    refresh: refreshTransporterStats 
  } = useTransporterDashboardStats(isTransporter);

  const { 
    data: transporterActivity,
    loading: transporterActivityLoading,
    refresh: refreshTransporterActivity 
  } = useTransporterRecentActivity(5, isTransporter);

  const { 
    data: availableJobs,
    loading: jobsLoading,
    refresh: refreshJobs 
  } = useTransporterAvailableJobs({}, isTransporter);

  const { 
    data: shipperStats,
    loading: shipperStatsLoading,
    refresh: refreshShipperStats 
  } = useShipperDashboardStats(isShipper && !isCorporate);

  const { 
    data: shipperActivity,
    loading: shipperActivityLoading,
    refresh: refreshShipperActivity 
  } = useShipperRecentActivity(5, isShipper && !isCorporate);

  const { 
    data: trailerStats,
    loading: trailerStatsLoading,
    refresh: refreshTrailerStats 
  } = useTrailerOwnerDashboardStats(isTrailerOwner);

  const { 
    data: trailerActivity,
    loading: trailerActivityLoading,
    refresh: refreshTrailerActivity 
  } = useTrailerOwnerRecentActivity(5, isTrailerOwner);

  // Also fetch corporate stats if corporate user
  const { 
    data: corporateStats,
    loading: corporateStatsLoading,
    refresh: refreshCorporateStats 
  } = useShipperDashboardStats(isCorporate);

  const { 
    data: corporateActivity,
    loading: corporateActivityLoading,
    refresh: refreshCorporateActivity 
  } = useShipperRecentActivity(5, isCorporate);

  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const navigateToBooking = useCallback(() => {
    navigation.navigate('Booking');
  }, [navigation]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isTransporter) {
        await Promise.all([
          refreshTransporterStats(),
          refreshTransporterActivity(),
          refreshJobs()
        ]);
      } else if (isTrailerOwner) {
        await Promise.all([
          refreshTrailerStats(),
          refreshTrailerActivity()
        ]);
      } else if (isCorporate) {
        await Promise.all([
          refreshCorporateStats(),
          refreshCorporateActivity()
        ]);
      } else if (isShipper) {
        await Promise.all([
          refreshShipperStats(),
          refreshShipperActivity()
        ]);
      }
    } catch (error) {
      console.error('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [
    isTransporter, isTrailerOwner, isCorporate, isShipper,
    refreshTransporterStats, refreshTransporterActivity, refreshJobs,
    refreshTrailerStats, refreshTrailerActivity,
    refreshCorporateStats, refreshCorporateActivity,
    refreshShipperStats, refreshShipperActivity
  ]);

  const isLoading = authLoading || 
    (isTransporter && (transporterStatsLoading || transporterActivityLoading)) ||
    (isTrailerOwner && (trailerStatsLoading || trailerActivityLoading)) ||
    (isCorporate && (corporateStatsLoading || corporateActivityLoading)) ||
    (isShipper && !isCorporate && (shipperStatsLoading || shipperActivityLoading));

  // Get stats based on user type
  const stats = useMemo(() => {
    if (isTrailerOwner) {
      return trailerStats || {
        totalTrailers: 0,
        available: 0,
        rented: 0,
        maintenance: 0,
        monthlyEarnings: 0,
        pendingPayouts: 0,
        utilizationRate: '0%'
      };
    } else if (isTransporter) {
      return transporterStats || {
        activeJobs: 0,
        pendingPayment: 0,
        earnings: 0,
        totalTrips: 0,
        rating: 0
      };
    } else if (isCorporate) {
      return corporateStats || {
        activeJobs: 0,
        pendingPayment: 0,
        spending: 0,
        totalShipments: 0
      };
    } else if (isShipper) {
      return shipperStats || {
        activeJobs: 0,
        pendingPayment: 0,
        spending: 0,
        totalShipments: 0
      };
    }
    return { activeJobs: 0, pendingPayment: 0, earnings: 0 };
  }, [isTrailerOwner, isTransporter, isCorporate, isShipper, trailerStats, transporterStats, corporateStats, shipperStats]);

  // Get recent activity based on user type
  const recentActivity = useMemo(() => {
    if (isTrailerOwner) {
      return trailerActivity || [];
    } else if (isTransporter) {
      return transporterActivity || [];
    } else if (isCorporate) {
      return corporateActivity || [];
    } else if (isShipper) {
      return shipperActivity || [];
    }
    return [];
  }, [isTrailerOwner, isTransporter, isCorporate, isShipper, trailerActivity, transporterActivity, corporateActivity, shipperActivity]);

  // Check if we should show stats
  const shouldShowStats = isTrailerOwner || isTransporter || isCorporate;

  if (isLoading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0C2D48" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header with reduced padding for stats card overlap */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.fullName || 'User'}</Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={styles.logoutButton}
              onPress={handleLogout}
              disabled={authLoading}
            >
              <MaterialIcons name="logout" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.ratingContainer}>
          <MaterialIcons name="star" size={16} color="#fbbf24" />
          <Text style={styles.ratingText}>
            {isTransporter ? stats.rating?.toFixed(1) || '0.0' : '4.8'}
          </Text>
          <Text style={styles.tripsText}>
            • {isTrailerOwner 
              ? `${stats.totalTrailers || 0} trailers` 
              : isTransporter 
                ? `${stats.totalTrips || 0} trips`
                : `${stats.totalShipments || 0} shipments`}
          </Text>
          <Text style={styles.userTypeBadge}>
            {isTrailerOwner ? 'Trailer Owner' :
             isTransporter ? 'Transporter' : 
             isCorporate ? 'Corporate' : 'Shipper'}
          </Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Stats Card - Only show for trailer owners, transporters, and corporate users */}
        {shouldShowStats && (
          <View style={styles.statsContainer}>
            {isTrailerOwner ? (
              <View style={styles.statsCard}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, styles.blueText]}>{stats.totalTrailers}</Text>
                  <Text style={styles.statLabel}>Total Trailers</Text>
                </View>
                <View style={[styles.statItem, styles.statDivider]}>
                  <Text style={[styles.statNumber, styles.greenText]}>${stats.monthlyEarnings}</Text>
                  <Text style={styles.statLabel}>This Month</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, styles.orangeText]}>{stats.rented}</Text>
                  <Text style={styles.statLabel}>Rented Out</Text>
                </View>
              </View>
            ) : (
              <View style={styles.statsCard}>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, styles.blueText]}>{stats.activeJobs}</Text>
                  <Text style={styles.statLabel}>Active Jobs</Text>
                </View>
                <View style={[styles.statItem, styles.statDivider]}>
                  <Text style={[styles.statNumber, styles.greenText]}>
                    ${isTransporter ? stats.earnings : stats.spending}
                  </Text>
                  <Text style={styles.statLabel}>This Month</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statNumber, styles.orangeText]}>{stats.pendingPayment}</Text>
                  <Text style={styles.statLabel}>Pending</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Main Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          {isTrailerOwner ? (
            <View style={styles.actionsContainer}>
              <ActionButton
                icon="add"
                title="Add Trailer"
                subtitle="Register a new trailer to your fleet"
                color="blue"
                onPress={() => navigation.navigate('TrailerOwnerRegistration')}
              />
              <ActionButton
                icon="local-shipping"
                title="My Trailers"
                subtitle="View and manage your trailer fleet"
                color="green"
                onPress={() => navigation.navigate('TrailerList')}
              />
              <ActionButton
                icon="trending-up"
                title="View Earnings"
                subtitle="Track your rental income and payouts"
                color="purple"
                onPress={() => console.log('View Earnings')}
              />
              <ActionButton
                icon="build"
                title="Maintenance"
                subtitle="Schedule and track maintenance"
                color="blue"
                badge={stats.maintenance > 0 ? `${stats.maintenance}` : undefined}
                onPress={() => navigation.navigate('TrailerRental')}
              />
            </View>
          ) : isShipper && !isCorporate ? (
            <View style={styles.actionsContainer}>
              <ActionButton
                icon="inventory"
                title="Book Transport"
                subtitle="Find a transporter for your cargo"
                color="blue"
                onPress={navigateToBooking}
              />
              <ActionButton
                icon="location-on"
                title="Track Shipment"
                subtitle="View live location of your goods"
                color="green"
                onPress={() => console.log('Track Shipment')}
              />
              <ActionButton
                icon="trending-up"
                title="My Bookings"
                subtitle="View all your transport bookings"
                color="purple"
                onPress={() => console.log('My Bookings')}
              />
            </View>
          ) : isTransporter ? (
            <View style={styles.actionsContainer}>
              <ActionButton
                icon="local-shipping"
                title="Available Jobs"
                subtitle="Browse and accept new jobs"
                color="blue"
                badge={availableJobs?.length ? `${availableJobs.length} new` : undefined}
               onPress={() => navigation.navigate('AvailableJobs')}
              />
              <ActionButton
                icon="location-on"
                title="Active Deliveries"
                subtitle="Track your ongoing deliveries"
                color="green"
                onPress={() => navigation.navigate('ActiveDeliveries')}
              />
              <ActionButton
                icon="trending-up"
                title="My Earnings"
                subtitle="View payment history and earnings"
                color="purple"
                onPress={() => navigation.navigate('MyEarnings')}
              />
               <ActionButton
                icon="local-shipping"
                title="Fleet Management"
                subtitle="Manage vehicles and drivers"
                color="orange"
                onPress={() => navigation.navigate('FleetDashboard')}
              />
            </View>
          ) : (
            <View style={styles.actionsContainer}>
              <ActionButton
                icon="inventory"
                title="Book Transport"
                subtitle="Find a transporter for your cargo"
                color="blue"
                onPress={navigateToBooking}
              />
              <ActionButton
                icon="location-on"
                title="Track Shipments"
                subtitle="View live location of your shipments"
                color="green"
                onPress={() => console.log('Track Shipments')}
              />
              <ActionButton
                icon="trending-up"
                title="Analytics"
                subtitle="View company shipping analytics"
                color="purple"
                onPress={() => console.log('Analytics')}
              />
            </View>
          )}
        </View>

        {/* Recent Activity */}
        {recentActivity.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activitiesContainer}>
              {recentActivity.map((activity) => (
                <ActivityCard
                  key={activity.id}
                  title={activity.title}
                  status={activity.status}
                  date={activity.date}
                  amount={activity.amount}
                  statusColor={
                    activity.status?.toLowerCase().includes('completed') ||
                    activity.status?.toLowerCase().includes('delivered')
                      ? 'green' 
                      : 'blue'
                  }
                  onPress={() => console.log('Activity Details', activity.id)}
                />
              ))}
            </View>
          </View>
        )}
        
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ActionButton Component
const ActionButton = React.memo(({ icon, title, subtitle, color, badge, onPress }) => {
  const colorStyles = {
    blue: { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' },
    green: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
    purple: { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' },
     orange: { backgroundColor: '#ffcd91', borderColor: '#ffcd91' }
  };

  const iconColors = {
    blue: '#0C2D48',
    green: '#16a34a',
    purple: '#7c3aed',
    orange: '#F37021',
  };

  return (
    <TouchableOpacity 
      style={[styles.actionButton, colorStyles[color]]}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.actionIcon}>
        <MaterialIcons name={icon} size={24} color={iconColors[color]} />
      </View>
      <View style={styles.actionContent}>
        <View style={styles.actionTitleRow}>
          <Text style={[styles.actionTitle, { color: iconColors[color] }]}>{title}</Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.actionSubtitle}>{subtitle}</Text>
      </View>
    </TouchableOpacity>
  );
});

// ActivityCard Component
const ActivityCard = React.memo(({ title, status, date, amount, statusColor, onPress }) => {
  const statusStyle = statusColor === 'green' ? styles.statusGreen : styles.statusBlue;
  const amountStyle = statusColor === 'green' ? styles.amountGreen : styles.amountBlue;
  const statusTextStyle = statusColor === 'green' ? styles.statusGreenText : styles.statusBlueText;

  return (
    <TouchableOpacity 
      style={styles.activityCard}
      activeOpacity={0.7}
      onPress={onPress}
    >
      <View style={styles.activityHeader}>
        <View style={styles.activityInfo}>
          <Text style={styles.activityTitle}>{title}</Text>
          <Text style={styles.activityDate}>{date}</Text>
        </View>
        <Text style={[styles.activityAmount, amountStyle]}>{amount}</Text>
      </View>
      <View style={styles.activityStatus}>
        <View style={[styles.statusBadge, statusStyle]}>
          <Text style={[styles.statusText, statusTextStyle]}>{status}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingTop: 0, // Remove top padding to allow proper overlap
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 50,
    paddingBottom: 40, // Reduced from 70 to allow overlap
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    zIndex: 1, // Lower zIndex than stats
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoutButton: {
    padding: 8,
  },
  welcomeText: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  userName: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  tripsText: {
    color: 'white',
    fontSize: 14,
    opacity: 0.75,
  },
  userTypeBadge: {
    color: 'white',
    fontSize: 12,
    backgroundColor: '#F37021',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  // OVERLAP MODIFICATIONS - Only these styles are changed for the overlap effect
  statsContainer: {
    position: 'relative',
    paddingHorizontal: 16,
    marginTop: 5, // Increased negative margin to overlap header
    marginBottom: 16,
    zIndex: 10, // Higher zIndex to appear above header
  },
  statsCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  // END OF OVERLAP MODIFICATIONS
  
  // Everything below remains exactly the same as your original code
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
    textAlign: 'center',
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
  section: {
    padding: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  actionsContainer: {
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
  },
  actionIcon: {
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  badge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  activitiesContainer: {
    gap: 12,
  },
  activityCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  activityDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  activityAmount: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  amountGreen: {
    color: '#16a34a',
  },
  amountBlue: {
    color: '#0C2D48',
  },
  activityStatus: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusGreen: {
    backgroundColor: '#dcfce7',
  },
  statusBlue: {
    backgroundColor: '#dbeafe',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusGreenText: {
    color: '#166534',
  },
  statusBlueText: {
    color: '#1e40af',
  },
  bottomPadding: {
    height: 20,
  },
});

export default HomeScreen;