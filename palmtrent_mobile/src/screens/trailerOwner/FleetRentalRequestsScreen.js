import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const FleetRentalRequestsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rentals, setRentals] = useState([]);

  const loadRentals = useCallback(async () => {
    try {
      const [listingResponse, rentalResponse] = await Promise.all([
        apiService.getMyRentalListings(),
        apiService.getMyRentals()
      ]);
      const ownerListings = (listingResponse.data || []).map(rental => ({ ...rental, rentalRole: 'owner' }));
      const myRentals = (rentalResponse.data || []).map(rental => ({ ...rental, rentalRole: 'renter' }));
      const seen = new Set();
      setRentals([...ownerListings, ...myRentals].filter(rental => {
        const key = `${rental.rentalRole}-${rental._id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }));
    } catch (error) {
      Alert.alert('Error', error.message || 'Could not load rental requests');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadRentals();
  }, [loadRentals]);

  const onRefresh = () => {
    setRefreshing(true);
    loadRentals();
  };

  const runAction = async (rental, action) => {
    try {
      if (action === 'approve') await apiService.approveRental(rental._id);
      if (action === 'reject') await apiService.rejectRental(rental._id, 'Rejected on mobile');
      if (action === 'pickup') await apiService.confirmRentalPickup(rental._id, { notes: 'Pickup confirmed on mobile' });
      if (action === 'return') await apiService.confirmRentalReturn(rental._id, { notes: 'Return confirmed on mobile' });
      await loadRentals();
    } catch (error) {
      Alert.alert('Error', error.message || 'Could not update rental');
    }
  };

  const payRental = async (rental) => {
    try {
      const response = await apiService.initiateRentalPayment(rental._id);
      Alert.alert(
        'Payment Started',
        response.data?.redirectUrl
          ? `OpenAPI Africa payment link created:\n${response.data.redirectUrl}`
          : 'Payment has been initiated. Check status after completing payment.',
        [{ text: 'OK', onPress: loadRentals }]
      );
    } catch (error) {
      Alert.alert('Payment Error', error.message || 'Could not start rental payment');
    }
  };

  const checkPayment = async (rental) => {
    try {
      await apiService.checkRentalPaymentStatus(rental._id);
      await loadRentals();
    } catch (error) {
      Alert.alert('Payment Status', error.message || 'Could not check payment status');
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const canGoBack = navigation?.canGoBack?.();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
          {canGoBack ? (
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <MaterialIcons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
          ) : null}
          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Rental Requests</Text>
            <Text style={styles.headerSubtitle}>Approve, reject, pickup, and return fleet assets</Text>
          </View>
        </View>
      </View>
      <ScrollView
        style={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {rentals.map(rental => (
          <View key={`${rental.rentalRole}-${rental._id}`} style={styles.card}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.reference}>{rental.rentalReference}</Text>
                <Text style={styles.assetName}>
                  {rental.trailer?.assetName || rental.trailer?.registrationNumber || rental.vehicle?.registrationNumber || 'Fleet asset'}
                </Text>
              </View>
              <View style={styles.badgeColumn}>
                <View style={[styles.badge, styles[`status_${rental.status}`]]}>
                  <Text style={styles.badgeText}>{rental.status}</Text>
                </View>
                <View style={styles.roleBadge}>
                  <Text style={styles.roleBadgeText}>{rental.rentalRole === 'owner' ? 'Owner' : 'Renter'}</Text>
                </View>
              </View>
            </View>
            <View style={styles.metaRow}>
              <MaterialIcons name="person" size={16} color="#64748b" />
              <Text style={styles.metaText}>
                {rental.rentalRole === 'owner'
                  ? rental.renter?.fullName || 'Renter'
                  : rental.owner?.fullName || 'Owner'}
              </Text>
            </View>
            <View style={styles.metaRow}>
              <MaterialIcons name="attach-money" size={16} color="#64748b" />
              <Text style={styles.metaText}>${rental.pricing?.total || 0}</Text>
            </View>
            <View style={styles.actions}>
              {rental.rentalRole === 'owner' && rental.status === 'pending' && <Action label="Approve" onPress={() => runAction(rental, 'approve')} primary />}
              {rental.rentalRole === 'owner' && rental.status === 'pending' && <Action label="Reject" onPress={() => runAction(rental, 'reject')} />}
              {rental.rentalRole === 'owner' && ['approved', 'payment_pending'].includes(rental.status) && <Text style={styles.waitingText}>Awaiting renter payment</Text>}
              {rental.rentalRole === 'renter' && rental.status === 'approved' && <Action label="Pay Rental" onPress={() => payRental(rental)} primary />}
              {rental.rentalRole === 'renter' && rental.status === 'payment_pending' && <Action label="Check Payment" onPress={() => checkPayment(rental)} primary />}
              {rental.status === 'confirmed' && <Action label="Confirm Pickup" onPress={() => runAction(rental, 'pickup')} primary />}
              {rental.status === 'active' && <Action label="Confirm Return" onPress={() => runAction(rental, 'return')} primary />}
            </View>
          </View>
        ))}
        {!rentals.length && (
          <View style={styles.empty}>
            <MaterialIcons name="assignment" size={42} color="#94a3b8" />
            <Text style={styles.emptyTitle}>No rental requests yet</Text>
            <Text style={styles.emptyText}>Requests will appear here when someone rents one of your fleet assets.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const LoadingScreen = () => (
  <SafeAreaView style={styles.container}>
    <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#0C2D48" />
      <Text style={styles.metaText}>Loading rental requests...</Text>
    </View>
  </SafeAreaView>
);

const Action = ({ label, onPress, primary }) => (
  <TouchableOpacity style={[styles.actionButton, primary && styles.actionPrimary]} onPress={onPress}>
    <Text style={[styles.actionText, primary && styles.actionTextPrimary]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { backgroundColor: '#0C2D48', padding: 20, paddingTop: 52 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: '700' },
  headerSubtitle: { color: '#cbd5e1', marginTop: 4 },
  content: { padding: 16 },
  card: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  reference: { fontWeight: '700', color: '#0f172a', fontSize: 16 },
  assetName: { color: '#64748b', marginTop: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#e5e7eb', alignSelf: 'flex-start' },
  badgeColumn: { alignItems: 'flex-end', gap: 6 },
  badgeText: { color: '#334155', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#eff6ff' },
  roleBadgeText: { color: '#1d4ed8', fontSize: 11, fontWeight: '700' },
  status_approved: { backgroundColor: '#d1fae5' },
  status_confirmed: { backgroundColor: '#dbeafe' },
  status_active: { backgroundColor: '#dbeafe' },
  status_pending: { backgroundColor: '#fef3c7' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  metaText: { color: '#64748b' },
  actions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 14 },
  actionButton: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12 },
  actionPrimary: { backgroundColor: '#0C2D48', borderColor: '#0C2D48' },
  actionText: { color: '#334155', fontWeight: '700' },
  actionTextPrimary: { color: 'white' },
  waitingText: { color: '#64748b', fontWeight: '700', paddingVertical: 9 },
  empty: { alignItems: 'center', padding: 30 },
  emptyTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 6 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }
});

export default FleetRentalRequestsScreen;
