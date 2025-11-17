// src/screens/HomeScreen.js
import React, { useState } from 'react';
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

const mockStats = {
  activeJobs: 3,
  pendingPayment: 2,
  earnings: 1250.00
};

// Trailer Owner Mock Data
const trailerOwnerStats = {
  totalTrailers: 8,
  available: 5,
  rented: 2,
  maintenance: 1,
  monthlyEarnings: 3240,
  pendingPayouts: 1200,
  utilizationRate: '75%'
};

const upcomingReturns = [
  {
    id: 1,
    trailer: 'Flatbed TR-001',
    customer: 'John Transport',
    returnDate: 'Today, 5:00 PM',
    amount: 240
  },
  {
    id: 2,
    trailer: 'Lowboy TR-004',
    customer: 'Construction Co Ltd',
    returnDate: 'Tomorrow, 10:00 AM',
    amount: 1400
  }
];

const trailerActivity = [
  {
    id: 1,
    title: 'Flatbed TR-001',
    status: 'Rental Started',
    date: '2 hours ago',
    amount: '$240'
  },
  {
    id: 2,
    title: 'Enclosed TR-002',
    status: 'Rental Completed',
    date: '1 day ago',
    amount: '$360'
  }
];

const HomeScreen = ({ navigation }) => {
  const { user, signOut, isLoading } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  const handleLogout = async () => {
    await signOut();
  };

  const navigateToBooking = () => {
    navigation.navigate('Booking');
  };

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 2000);
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0C2D48" />
        <Text>Loading...</Text>
      </View>
    );
  }

  const isTrailerOwner = user?.userType === 'trailer_owner';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
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
              disabled={isLoading}
            >
              <MaterialIcons name="logout" size={20} color="white" />
            </TouchableOpacity>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.fullName?.charAt(0) || 'U'}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={styles.ratingContainer}>
          <MaterialIcons name="star" size={16} color="#fbbf24" />
          <Text style={styles.ratingText}>4.8</Text>
          <Text style={styles.tripsText}>
            • {isTrailerOwner ? '8 trailers' : '45 trips'}
          </Text>
          <Text style={styles.userTypeBadge}>
            {isTrailerOwner ? 'Trailer Owner' :
             user?.userType === 'transporter' ? 'Transporter' : 'Shipper'}
          </Text>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Quick Stats */}
        {isTrailerOwner ? (
          <View style={styles.statsContainer}>
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, styles.blueText]}>{trailerOwnerStats.totalTrailers}</Text>
                <Text style={styles.statLabel}>Total Trailers</Text>
              </View>
              <View style={[styles.statItem, styles.statDivider]}>
                <Text style={[styles.statNumber, styles.greenText]}>${trailerOwnerStats.monthlyEarnings}</Text>
                <Text style={styles.statLabel}>This Month</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, styles.orangeText]}>{trailerOwnerStats.rented}</Text>
                <Text style={styles.statLabel}>Rented Out</Text>
              </View>
            </View>
          </View>
        ) : user?.userType === 'transporter' && (
          <View style={styles.statsContainer}>
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, styles.blueText]}>{mockStats.activeJobs}</Text>
                <Text style={styles.statLabel}>Active Jobs</Text>
              </View>
              <View style={[styles.statItem, styles.statDivider]}>
                <Text style={[styles.statNumber, styles.greenText]}>${mockStats.earnings}</Text>
                <Text style={styles.statLabel}>This Month</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statNumber, styles.orangeText]}>{mockStats.pendingPayment}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
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
                badge={`${trailerOwnerStats.maintenance}`}
                onPress={() => navigation.navigate('TrailerRental')}
              />
            </View>
          ) : user?.userType === 'shipper' ? (
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
          ) : (
            <View style={styles.actionsContainer}>
              <ActionButton
                icon="local-shipping"
                title="Available Jobs"
                subtitle="Browse and accept new jobs"
                color="blue"
                badge="5 new"
                onPress={() => console.log('Available Jobs')}
              />
              <ActionButton
                icon="location-on"
                title="Active Deliveries"
                subtitle="Track your ongoing deliveries"
                color="green"
                onPress={() => console.log('Active Deliveries')}
              />
              <ActionButton
                icon="trending-up"
                title="My Earnings"
                subtitle="View payment history and earnings"
                color="purple"
                onPress={() => console.log('My Earnings')}
              />
            </View>
          )}
        </View>

        {/* Recent Activity */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isTrailerOwner ? 'Recent Activity' : 'Recent Activity'}
          </Text>
          <View style={styles.activitiesContainer}>
            {isTrailerOwner ? (
              <>
                {trailerActivity.map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    title={activity.title}
                    status={activity.status}
                    date={activity.date}
                    amount={activity.amount}
                    statusColor={activity.status.includes('Completed') ? 'green' : 'blue'}
                    onPress={() => console.log('Activity Details')}
                  />
                ))}
              </>
            ) : (
              <>
                <ActivityCard
                  title="Harare → Bulawayo"
                  status="Completed"
                  date="2 hours ago"
                  amount="$400"
                  statusColor="green"
                  onPress={() => console.log('Trip Details')}
                />
                <ActivityCard
                  title="Mutare → Harare"
                  status="In Transit"
                  date="5 hours ago"
                  amount="$350"
                  statusColor="blue"
                  onPress={() => console.log('Trip Details')}
                />
              </>
            )}
          </View>
        </View>

        {/* Upcoming Returns - Only for Trailer Owners */}
        {isTrailerOwner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Returns</Text>
            <View style={styles.activitiesContainer}>
              {upcomingReturns.map((item) => (
                <ActivityCard
                  key={item.id}
                  title={item.trailer}
                  status={item.customer}
                  date={item.returnDate}
                  amount={`$${item.amount}`}
                  statusColor="blue"
                  onPress={() => console.log('Return Details')}
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
const ActionButton = ({ icon, title, subtitle, color, badge, onPress }) => {
  const colorStyles = {
    blue: { backgroundColor: '#dbeafe', borderColor: '#bfdbfe' },
    green: { backgroundColor: '#dcfce7', borderColor: '#bbf7d0' },
    purple: { backgroundColor: '#f3e8ff', borderColor: '#e9d5ff' }
  };

  const iconColors = {
    blue: '#0C2D48',
    green: '#16a34a',
    purple: '#7c3aed'
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
};

// ActivityCard Component
const ActivityCard = ({ title, status, date, amount, statusColor, onPress }) => {
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
        <View>
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
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: 'white',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#0C2D48',
    fontSize: 18,
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
  statsContainer: {
    paddingHorizontal: 16,
    marginTop: -10,
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