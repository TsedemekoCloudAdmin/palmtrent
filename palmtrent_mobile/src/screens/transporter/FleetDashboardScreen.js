import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  RefreshControl,
  FlatList,
  Alert
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import apiService from '../../services/apiService';

const FleetDashboardScreen = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalVehicles: 0,
    activeVehicles: 0,
    availableVehicles: 0,
    totalDrivers: 0,
    activeDrivers: 0,
    activeJobs: 0,
    monthlyEarnings: 0,
    rentalEarnings: 0
  });
  const [vehicles, setVehicles] = useState([]);
  const [drivers, setDrivers] = useState([]);

  const loadData = async () => {
    try {
      const [vehiclesRes, driversRes, statsRes] = await Promise.all([
        apiService.getVehicles('limit=5'),
        apiService.getDrivers('limit=5'),
        apiService.getDashboardStats()
      ]);

      if (vehiclesRes.success) setVehicles(vehiclesRes.data);
      if (driversRes.success) setDrivers(driversRes.data);
      if (statsRes.success) setStats(statsRes.data);
    } catch (error) {
      console.error('Load data error:', error);
      Alert.alert('Error', 'Failed to load fleet data');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return '#16a34a';
      case 'on_duty': return '#0C2D48';
      case 'on_leave': return '#f59e0b';
      case 'maintenance': return '#dc2626';
      case 'rented': return '#7c3aed';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'available': return 'Available';
      case 'on_duty': return 'On Duty';
      case 'on_leave': return 'On Leave';
      case 'maintenance': return 'Maintenance';
      case 'rented': return 'Rented Out';
      default: return status;
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'bakkie': return '🚐';
      case 'truck': return '🚚';
      case 'tractor': return '🚛';
      default: return '🚗';
    }
  };

  const renderVehicleItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.vehicleCard}
      onPress={() => navigation.navigate('VehicleDetails', { vehicleId: item._id })}
    >
      <View style={styles.vehicleHeader}>
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleIcon}>{getCategoryIcon(item.category)}</Text>
          <View>
            <Text style={styles.vehicleReg}>{item.registrationNumber}</Text>
            <Text style={styles.vehicleType}>{item.make} {item.model}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.vehicleDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Capacity:</Text>
          <Text style={styles.detailValue}>{item.capacity?.weight?.value} {item.capacity?.weight?.unit}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Driver:</Text>
          <Text style={styles.detailValue}>
            {item.assignedDriver?.fullName || 'Unassigned'}
          </Text>
        </View>
        {item.pricing?.availableForRental && (
          <View style={styles.rentalBadge}>
            <MaterialIcons name="attach-money" size={12} color="#7c3aed" />
            <Text style={styles.rentalText}>Available for Rent</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderDriverItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.driverCard}
      onPress={() => navigation.navigate('DriverDetails', { driverId: item._id })}
    >
      <View style={styles.driverHeader}>
        <View style={styles.driverAvatar}>
          <Text style={styles.avatarText}>
            {item.fullName?.charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{item.fullName}</Text>
          <Text style={styles.driverPhone}>{item.phone}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusText(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.driverDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>License:</Text>
          <Text style={styles.detailValue}>{item.licenseNumber}</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Experience:</Text>
          <Text style={styles.detailValue}>{item.experience} years</Text>
        </View>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Vehicle:</Text>
          <Text style={styles.detailValue}>
            {item.assignedVehicle?.registrationNumber || 'Unassigned'}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // Render overview content without nested FlatLists
  const renderOverviewContent = () => (
    <View style={styles.overview}>
      {/* Quick Actions */}
      <View style={styles.actionsGrid}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('AddVehicle')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#dbeafe' }]}>
            <MaterialIcons name="local-shipping" size={24} color="#0C2D48" />
          </View>
          <Text style={styles.actionText}>Add Vehicle</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('AddDriver')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#dcfce7' }]}>
            <MaterialIcons name="person-add" size={24} color="#16a34a" />
          </View>
          <Text style={styles.actionText}>Add Driver</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('VehicleRental')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#f3e8ff' }]}>
            <MaterialIcons name="attach-money" size={24} color="#7c3aed" />
          </View>
          <Text style={styles.actionText}>Rent Vehicle</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => navigation.navigate('AvailableJobs')}
        >
          <View style={[styles.actionIcon, { backgroundColor: '#fef3c7' }]}>
            <MaterialIcons name="work" size={24} color="#d97706" />
          </View>
          <Text style={styles.actionText}>Find Jobs</Text>
        </TouchableOpacity>
      </View>

      {/* Recent Vehicles */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Vehicles</Text>
          <TouchableOpacity onPress={() => setActiveTab('vehicles')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        {vehicles.map((item) => (
          <View key={item._id}>
            {renderVehicleItem({ item })}
          </View>
        ))}
      </View>

      {/* Recent Drivers */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Drivers</Text>
          <TouchableOpacity onPress={() => setActiveTab('drivers')}>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        {drivers.map((item) => (
          <View key={item._id}>
            {renderDriverItem({ item })}
          </View>
        ))}
      </View>
    </View>
  );

  // Render vehicles tab with proper FlatList
  const renderVehiclesTab = () => (
    <FlatList
      style={styles.tabContent}
      data={vehicles}
      renderItem={renderVehicleItem}
      keyExtractor={item => item._id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListHeaderComponent={
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Vehicles</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => navigation.navigate('AddVehicle')}
          >
            <MaterialIcons name="add" size={20} color="white" />
            <Text style={styles.addButtonText}>Add Vehicle</Text>
          </TouchableOpacity>
        </View>
      }
      contentContainerStyle={styles.flatListContent}
    />
  );

  // Render drivers tab with proper FlatList
  const renderDriversTab = () => (
    <FlatList
      style={styles.tabContent}
      data={drivers}
      renderItem={renderDriverItem}
      keyExtractor={item => item._id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListHeaderComponent={
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Drivers</Text>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => navigation.navigate('AddDriver')}
          >
            <MaterialIcons name="add" size={20} color="white" />
            <Text style={styles.addButtonText}>Add Driver</Text>
          </TouchableOpacity>
        </View>
      }
      contentContainerStyle={styles.flatListContent}
    />
  );

  // Render rentals tab
  const renderRentalsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Vehicle Rentals</Text>
      <TouchableOpacity
        style={styles.addButton}
        onPress={() => navigation.navigate('MyRentals')}
      >
        <MaterialIcons name="assignment" size={20} color="white" />
        <Text style={styles.addButtonText}>Open Rentals</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Fleet Management</Text>
        </View>

        {/* Quick Stats 
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.totalVehicles}</Text>
            <Text style={styles.statLabel}>Total Vehicles</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.activeVehicles}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{stats.totalDrivers}</Text>
            <Text style={styles.statLabel}>Drivers</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>${stats.monthlyEarnings}</Text>
            <Text style={styles.statLabel}>Earnings</Text>
          </View>
        </View>*/}
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        {['overview', 'vehicles', 'drivers', 'rentals'].map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.activeTab]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'overview' && (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {renderOverviewContent()}
        </ScrollView>
      )}

      {activeTab === 'vehicles' && renderVehiclesTab()}
      {activeTab === 'drivers' && renderDriversTab()}
      {activeTab === 'rentals' && (
        <ScrollView style={styles.content}>
          {renderRentalsTab()}
        </ScrollView>
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
    padding: 20,
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  settingsButton: {
    padding: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: 'white',
    fontSize: 12,
    opacity: 0.8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#0C2D48',
  },
  tabText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#0C2D48',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  overview: {
    padding: 16,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    width: '48%',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  seeAllText: {
    color: '#0C2D48',
    fontWeight: '500',
  },
  tabContent: {
    flex: 1,
  },
  flatListContent: {
    padding: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C2D48',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  vehicleCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  vehicleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  vehicleIcon: {
    fontSize: 24,
  },
  vehicleReg: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  vehicleType: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
  vehicleDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  rentalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
    marginTop: 4,
  },
  rentalText: {
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '500',
  },
  driverCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  driverHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0C2D48',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  driverPhone: {
    fontSize: 14,
    color: '#6b7280',
  },
  driverDetails: {
    gap: 6,
  },
  comingSoon: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 16,
    marginTop: 40,
  },
});

export default FleetDashboardScreen;
