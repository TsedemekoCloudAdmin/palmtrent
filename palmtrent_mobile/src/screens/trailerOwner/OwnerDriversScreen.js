import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const OwnerDriversScreen = ({ navigation }) => {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadDrivers = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);
      const response = await apiService.getDrivers('limit=50');
      setDrivers(response.data || []);
    } catch (error) {
      Alert.alert('Drivers', error.message || 'Unable to load drivers.');
      setDrivers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const renderDriver = ({ item }) => (
    <TouchableOpacity
      style={styles.driverCard}
      onPress={() => navigation.navigate('DriverDetails', { driverId: item._id })}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.fullName?.charAt(0)?.toUpperCase() || 'D'}</Text>
      </View>
      <View style={styles.driverInfo}>
        <Text style={styles.driverName}>{item.fullName}</Text>
        <Text style={styles.driverMeta}>{item.phone || 'No phone'} • Class {item.licenseClass || 'N/A'}</Text>
        <Text style={styles.driverMeta}>{item.assignedVehicle?.registrationNumber || 'No vehicle assigned'}</Text>
      </View>
      <View style={styles.statusBadge}>
        <Text style={styles.statusText}>{item.status || 'available'}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Drivers</Text>
          <Text style={styles.headerText}>Add and manage drivers for your rental fleet.</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddDriver')}>
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F37021" />
        </View>
      ) : (
        <FlatList
          data={drivers}
          renderItem={renderDriver}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDrivers(true)} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="badge" size={56} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No drivers yet</Text>
              <Text style={styles.emptyText}>Add drivers who can be assigned to vehicles and rentals.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('AddDriver')}>
                <MaterialIcons name="person-add" size={19} color="white" />
                <Text style={styles.primaryButtonText}>Add Driver</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#0C2D48', paddingHorizontal: 20, paddingTop: 50, paddingBottom: 24, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: '800' },
  headerText: { color: '#dbeafe', fontSize: 14, marginTop: 4 },
  addButton: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F37021', alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 30 },
  driverCard: { backgroundColor: 'white', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#0C2D48', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 18, fontWeight: '800' },
  driverInfo: { flex: 1 },
  driverName: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  driverMeta: { color: '#64748b', fontSize: 13, marginTop: 3 },
  statusBadge: { backgroundColor: '#fff7ed', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  statusText: { color: '#9a3412', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginTop: 12 },
  emptyText: { color: '#64748b', marginTop: 6, marginBottom: 16, textAlign: 'center' },
  primaryButton: { minHeight: 46, borderRadius: 14, backgroundColor: '#F37021', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  primaryButtonText: { color: 'white', fontWeight: '800' },
});

export default OwnerDriversScreen;
