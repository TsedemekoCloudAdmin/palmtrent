import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const DriverMarketplaceScreen = ({ navigation, route }) => {
  const vehicleId = route?.params?.vehicleId;
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [assigningId, setAssigningId] = useState(null);
  const [city, setCity] = useState('');

  const loadDrivers = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);

      const response = await apiService.searchMarketplaceDrivers({
        availableOnly: 'true',
        city: city.trim(),
      });
      setDrivers(response.data || []);
    } catch (error) {
      Alert.alert('Driver marketplace', error.message || 'Unable to load marketplace drivers.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [city]);

  useEffect(() => {
    loadDrivers();
  }, [loadDrivers]);

  const assignDriver = async (driver) => {
    if (!vehicleId) return;
    setAssigningId(driver._id);
    try {
      const response = await apiService.assignDriverToVehicle(vehicleId, driver._id);
      if (!response.success) {
        throw new Error(response.message || 'Unable to assign driver.');
      }
      Alert.alert('Driver assigned', `${driver.fullName} was assigned to the vehicle.`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      Alert.alert('Assignment failed', error.message || 'Unable to assign driver.');
    } finally {
      setAssigningId(null);
    }
  };

  // Any vehicle owner can hire a marketplace driver by contacting them directly.
  const contactDriver = (driver) => {
    const digits = String(driver.phone || '').replace(/[^0-9]/g, '');
    if (!digits) {
      Alert.alert('No contact number', 'This driver has not shared a phone number yet.');
      return;
    }
    Alert.alert(`Hire ${driver.fullName || 'this driver'}`, 'Reach out to discuss hiring.', [
      { text: 'Call', onPress: () => Linking.openURL(`tel:${driver.phone}`) },
      { text: 'WhatsApp', onPress: () => Linking.openURL(`https://wa.me/${digits}`) },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const renderDriver = ({ item }) => (
    <View style={styles.driverCard}>
      <View style={styles.driverTop}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.fullName?.charAt(0)?.toUpperCase() || 'D'}</Text>
        </View>
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{item.fullName}</Text>
          <Text style={styles.driverMeta}>
            Class {item.licenseClass || 'N/A'} • {item.experience || 0} yrs
          </Text>
        </View>
        <View style={styles.availableBadge}>
          <Text style={styles.availableText}>Available</Text>
        </View>
      </View>

      {!!item.marketplace?.headline && <Text style={styles.headline}>{item.marketplace.headline}</Text>}

      <View style={styles.detailRow}>
        <MaterialIcons name="place" size={16} color="#64748b" />
        <Text style={styles.detailText}>{(item.marketplace?.preferredLocations || []).join(', ') || 'Any location'}</Text>
      </View>
      <View style={styles.detailRow}>
        <MaterialIcons name="payments" size={16} color="#64748b" />
        <Text style={styles.detailText}>
          USD {Number(item.marketplace?.expectedRate?.amount || 0).toFixed(2)} / {item.marketplace?.expectedRate?.period || 'daily'}
        </Text>
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.contactButton} onPress={() => contactDriver(item)}>
          <MaterialIcons name="call" size={18} color="#0C2D48" />
          <Text style={styles.contactButtonText}>Contact to Hire</Text>
        </TouchableOpacity>
        {vehicleId && (
          <TouchableOpacity
            style={[styles.assignButton, assigningId === item._id && styles.disabledButton]}
            onPress={() => assignDriver(item)}
            disabled={Boolean(assigningId)}
          >
            {assigningId === item._id ? <ActivityIndicator color="white" /> : <MaterialIcons name="person-add" size={19} color="white" />}
            <Text style={styles.assignButtonText}>Assign to Vehicle</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Hire a Driver</Text>
          <Text style={styles.headerText}>Find and hire available verified drivers for your vehicles.</Text>
        </View>
      </View>

      <View style={styles.searchBlock}>
        <View style={styles.searchInput}>
          <MaterialIcons name="search" size={20} color="#64748b" />
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="Filter by city or area"
            placeholderTextColor="#94a3b8"
            returnKeyType="search"
            onSubmitEditing={() => loadDrivers()}
          />
        </View>
        <TouchableOpacity style={styles.filterButton} onPress={() => loadDrivers()}>
          <MaterialIcons name="tune" size={21} color="white" />
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
              <MaterialIcons name="person-search" size={56} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No available drivers</Text>
              <Text style={styles.emptyText}>Try another area or check again later.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { backgroundColor: '#0C2D48', paddingHorizontal: 18, paddingTop: 46, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backButton: { padding: 4 },
  headerContent: { flex: 1 },
  headerTitle: { color: 'white', fontSize: 23, fontWeight: '800' },
  headerText: { color: '#dbeafe', fontSize: 14, marginTop: 4 },
  searchBlock: { flexDirection: 'row', gap: 10, padding: 16 },
  searchInput: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: 'white', borderWidth: 1, borderColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  input: { flex: 1, paddingHorizontal: 8, color: '#0f172a', fontSize: 15 },
  filterButton: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#0C2D48', alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingTop: 0, paddingBottom: 28 },
  driverCard: { backgroundColor: 'white', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  driverTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#0C2D48', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontSize: 18, fontWeight: '800' },
  driverInfo: { flex: 1 },
  driverName: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  driverMeta: { color: '#64748b', fontSize: 13, marginTop: 2 },
  availableBadge: { backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  availableText: { color: '#166534', fontSize: 11, fontWeight: '800' },
  headline: { color: '#334155', fontSize: 14, lineHeight: 20, marginTop: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  detailText: { flex: 1, color: '#475569', fontSize: 13 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  contactButton: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: '#eef2f7', borderWidth: 1, borderColor: '#0C2D48', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  contactButtonText: { color: '#0C2D48', fontSize: 14, fontWeight: '800' },
  assignButton: { flex: 1, minHeight: 46, borderRadius: 14, backgroundColor: '#F37021', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  assignButtonText: { color: 'white', fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800', marginTop: 12 },
  emptyText: { color: '#64748b', fontSize: 14, marginTop: 6 },
});

export default DriverMarketplaceScreen;
