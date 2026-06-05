import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const FleetRentalRequestsScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [rentals, setRentals] = useState([]);
  const [assets, setAssets] = useState([]);
  const [inspectionModal, setInspectionModal] = useState(null);
  const [walkInVisible, setWalkInVisible] = useState(false);
  const [walkInForm, setWalkInForm] = useState({
    itemId: '',
    itemType: 'vehicle',
    fullName: '',
    phone: '',
    email: '',
    nationalId: '',
    licenseNumber: '',
    licenseExpiry: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    pickupAddress: '',
    returnAddress: '',
    paymentMethod: 'cash',
  });
  const [inspectionForm, setInspectionForm] = useState({
    odometerReading: '',
    fuelLevel: 'full',
    notes: '',
    signature: '',
    photos: '',
    damageDescription: '',
    damageFees: '',
    cleaningFees: '',
    lateFees: '',
    extraKmFees: '',
  });

  const loadRentals = useCallback(async () => {
    try {
      const [listingResponse, rentalResponse, trailerResponse, vehicleResponse] = await Promise.all([
        apiService.getMyRentalListings(),
        apiService.getMyRentals(),
        apiService.getTrailerOwnerTrailers().catch(() => ({ data: [] })),
        apiService.getMyVehicles().catch(() => ({ data: [] })),
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
      const trailerAssets = (trailerResponse.data || []).map(asset => ({
        ...asset,
        itemType: asset.assetType || 'trailer',
        label: `${asset.assetName || asset.registrationNumber} (${asset.assetType || 'trailer'})`
      }));
      const vehicleAssets = (vehicleResponse.data || []).map(asset => ({
        ...asset,
        itemType: 'vehicle',
        label: `${asset.registrationNumber} (${asset.make?.name || asset.make || 'vehicle'} ${asset.model?.name || asset.model || ''})`
      }));
      setAssets([...vehicleAssets, ...trailerAssets].filter(asset => asset.rentalSettings?.availableForRental !== false));
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

  const updateWalkIn = (field, value) => setWalkInForm(prev => ({ ...prev, [field]: value }));
  const updateInspection = (field, value) => setInspectionForm(prev => ({ ...prev, [field]: value }));

  const openInspection = (rental, type) => {
    setInspectionModal({ rental, type });
    setInspectionForm({
      odometerReading: '',
      fuelLevel: type === 'pickup' ? 'full' : (rental.pickup?.fuelLevel || 'full'),
      notes: '',
      signature: '',
      photos: '',
      damageDescription: '',
      damageFees: '',
      cleaningFees: '',
      lateFees: '',
      extraKmFees: '',
    });
  };

  const submitWalkInRental = async () => {
    const asset = assets.find(item => item._id === walkInForm.itemId);
    if (!asset || !walkInForm.fullName.trim() || !walkInForm.phone.trim()) {
      Alert.alert('Missing details', 'Select an asset and enter the customer name and phone.');
      return;
    }

    try {
      const response = await apiService.createWalkInRental({
        itemType: asset.itemType || 'vehicle',
        itemId: asset._id,
        startDate: walkInForm.startDate,
        endDate: walkInForm.endDate,
        pickupLocation: { address: walkInForm.pickupAddress },
        returnLocation: { address: walkInForm.returnAddress || walkInForm.pickupAddress },
        paymentMethod: walkInForm.paymentMethod,
        customer: {
          fullName: walkInForm.fullName,
          phone: walkInForm.phone,
          email: walkInForm.email,
          nationalId: walkInForm.nationalId,
          licenseNumber: walkInForm.licenseNumber,
          licenseExpiry: walkInForm.licenseExpiry,
        },
      });
      if (!response.success) throw new Error(response.message || 'Could not create walk-in rental.');
      setWalkInVisible(false);
      await loadRentals();
      Alert.alert('Walk-in rental created', response.message || 'Rental is ready for the next step.');
    } catch (error) {
      Alert.alert('Walk-in failed', error.message || 'Could not create walk-in rental.');
    }
  };

  const submitInspection = async () => {
    if (!inspectionModal) return;
    const { rental, type } = inspectionModal;
    const payload = {
      odometerReading: inspectionForm.odometerReading ? Number(inspectionForm.odometerReading) : undefined,
      fuelLevel: inspectionForm.fuelLevel,
      notes: inspectionForm.notes,
      signature: inspectionForm.signature,
      photos: inspectionForm.photos.split(',').map(item => item.trim()).filter(Boolean),
      conditionChecklist: [
        { item: 'Exterior', status: inspectionForm.damageDescription ? 'issue' : 'ok', notes: inspectionForm.damageDescription },
        { item: 'Fuel', status: inspectionForm.fuelLevel ? 'ok' : 'issue', notes: inspectionForm.fuelLevel },
        { item: 'Odometer', status: inspectionForm.odometerReading ? 'ok' : 'not_applicable', notes: inspectionForm.odometerReading },
      ],
    };

    if (type === 'return') {
      payload.damages = inspectionForm.damageDescription
        ? [{ description: inspectionForm.damageDescription, severity: 'minor', estimatedCost: Number(inspectionForm.damageFees || 0), photos: payload.photos }]
        : [];
      payload.damageFees = Number(inspectionForm.damageFees || 0);
      payload.cleaningFees = Number(inspectionForm.cleaningFees || 0);
      payload.lateFees = Number(inspectionForm.lateFees || 0);
      payload.extraKmFees = Number(inspectionForm.extraKmFees || 0);
    }

    try {
      if (type === 'pickup') await apiService.confirmRentalPickup(rental._id, payload);
      if (type === 'return') await apiService.confirmRentalReturn(rental._id, payload);
      setInspectionModal(null);
      await loadRentals();
      Alert.alert('Rental updated', type === 'pickup' ? 'Vehicle handover completed.' : 'Vehicle return completed.');
    } catch (error) {
      Alert.alert('Inspection failed', error.message || 'Could not submit inspection.');
    }
  };

  const runAction = async (rental, action) => {
    try {
      if (action === 'approve') await apiService.approveRental(rental._id);
      if (action === 'reject') await apiService.rejectRental(rental._id, 'Rejected on mobile');
      if (action === 'pickup' || action === 'return') {
        openInspection(rental, action);
        return;
      }
      await loadRentals();
    } catch (error) {
      Alert.alert('Error', error.message || 'Could not update rental');
    }
  };

  const payRental = async (rental) => {
    try {
      const response = await apiService.initiateRentalPayment(rental._id);
      const redirectUrl = response.data?.redirectUrl;
      if (redirectUrl) await Linking.openURL(redirectUrl);
      Alert.alert(
        redirectUrl ? 'Payment Link Opened' : 'Payment Started',
        redirectUrl
          ? 'The payment page opened. You can also share the link with the customer from the browser.'
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
          <TouchableOpacity style={styles.walkInButton} onPress={() => setWalkInVisible(true)}>
            <Text style={styles.walkInButtonText}>Walk-in</Text>
          </TouchableOpacity>
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
              {rental.rentalRole === 'owner' && rental.status === 'approved' && <Action label="Create Payment Link" onPress={() => payRental(rental)} primary />}
              {rental.rentalRole === 'owner' && rental.status === 'payment_pending' && <Action label="Check Payment" onPress={() => checkPayment(rental)} primary />}
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

      <Modal visible={walkInVisible} transparent animationType="slide" onRequestClose={() => setWalkInVisible(false)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Walk-in Rental</Text>
              <TouchableOpacity onPress={() => setWalkInVisible(false)}><MaterialIcons name="close" size={24} color="#334155" /></TouchableOpacity>
            </View>
            <Text style={styles.label}>Asset</Text>
            <View style={styles.assetPicker}>
              {assets.map(asset => (
                <TouchableOpacity
                  key={asset._id}
                  style={[styles.assetOption, walkInForm.itemId === asset._id && styles.assetOptionActive]}
                  onPress={() => setWalkInForm(prev => ({ ...prev, itemId: asset._id, itemType: asset.itemType || 'vehicle' }))}
                >
                  <Text style={[styles.assetOptionText, walkInForm.itemId === asset._id && styles.assetOptionTextActive]}>{asset.label}</Text>
                </TouchableOpacity>
              ))}
              {!assets.length && <Text style={styles.emptyText}>No rentable assets available.</Text>}
            </View>
            <Input label="Customer full name" value={walkInForm.fullName} onChangeText={(value) => updateWalkIn('fullName', value)} />
            <Input label="Phone" value={walkInForm.phone} onChangeText={(value) => updateWalkIn('phone', value)} keyboardType="phone-pad" />
            <Input label="Email" value={walkInForm.email} onChangeText={(value) => updateWalkIn('email', value)} keyboardType="email-address" autoCapitalize="none" />
            <Input label="National ID" value={walkInForm.nationalId} onChangeText={(value) => updateWalkIn('nationalId', value)} />
            <Input label="License Number" value={walkInForm.licenseNumber} onChangeText={(value) => updateWalkIn('licenseNumber', value)} />
            <Input label="License Expiry" value={walkInForm.licenseExpiry} onChangeText={(value) => updateWalkIn('licenseExpiry', value)} placeholder="YYYY-MM-DD" />
            <Input label="Start Date" value={walkInForm.startDate} onChangeText={(value) => updateWalkIn('startDate', value)} placeholder="YYYY-MM-DD" />
            <Input label="End Date" value={walkInForm.endDate} onChangeText={(value) => updateWalkIn('endDate', value)} placeholder="YYYY-MM-DD" />
            <Input label="Pickup Address" value={walkInForm.pickupAddress} onChangeText={(value) => updateWalkIn('pickupAddress', value)} />
            <Input label="Return Address" value={walkInForm.returnAddress} onChangeText={(value) => updateWalkIn('returnAddress', value)} />
            <Text style={styles.label}>Payment Method</Text>
            <View style={styles.paymentSelector}>
              <TouchableOpacity
                style={[styles.paymentOption, walkInForm.paymentMethod === 'cash' && styles.paymentOptionActive]}
                onPress={() => updateWalkIn('paymentMethod', 'cash')}
              >
                <Text style={[styles.paymentOptionText, walkInForm.paymentMethod === 'cash' && styles.paymentOptionTextActive]}>Cash collected</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.paymentOption, walkInForm.paymentMethod === 'clicknpay' && styles.paymentOptionActive]}
                onPress={() => updateWalkIn('paymentMethod', 'clicknpay')}
              >
                <Text style={[styles.paymentOptionText, walkInForm.paymentMethod === 'clicknpay' && styles.paymentOptionTextActive]}>Pay online</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.modalActions}>
              <Action label="Cancel" onPress={() => setWalkInVisible(false)} />
              <Action label="Create Rental" onPress={submitWalkInRental} primary />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(inspectionModal)} transparent animationType="slide" onRequestClose={() => setInspectionModal(null)}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{inspectionModal?.type === 'pickup' ? 'Vehicle Handover' : 'Vehicle Return'}</Text>
              <TouchableOpacity onPress={() => setInspectionModal(null)}><MaterialIcons name="close" size={24} color="#334155" /></TouchableOpacity>
            </View>
            <Input label="Odometer Reading" value={inspectionForm.odometerReading} onChangeText={(value) => updateInspection('odometerReading', value)} keyboardType="numeric" />
            <Input label="Fuel Level" value={inspectionForm.fuelLevel} onChangeText={(value) => updateInspection('fuelLevel', value)} placeholder="empty, quarter, half, three_quarters, full" />
            <Input label="Inspection Notes" value={inspectionForm.notes} onChangeText={(value) => updateInspection('notes', value)} multiline />
            <Input label="Signature / Name" value={inspectionForm.signature} onChangeText={(value) => updateInspection('signature', value)} />
            <Input label="Photo URLs (comma separated)" value={inspectionForm.photos} onChangeText={(value) => updateInspection('photos', value)} />
            {inspectionModal?.type === 'return' && (
              <>
                <Input label="Damage Description" value={inspectionForm.damageDescription} onChangeText={(value) => updateInspection('damageDescription', value)} multiline />
                <Input label="Damage Fees" value={inspectionForm.damageFees} onChangeText={(value) => updateInspection('damageFees', value)} keyboardType="numeric" />
                <Input label="Cleaning Fees" value={inspectionForm.cleaningFees} onChangeText={(value) => updateInspection('cleaningFees', value)} keyboardType="numeric" />
                <Input label="Late Fees" value={inspectionForm.lateFees} onChangeText={(value) => updateInspection('lateFees', value)} keyboardType="numeric" />
                <Input label="Extra KM Fees" value={inspectionForm.extraKmFees} onChangeText={(value) => updateInspection('extraKmFees', value)} keyboardType="numeric" />
              </>
            )}
            <View style={styles.modalActions}>
              <Action label="Cancel" onPress={() => setInspectionModal(null)} />
              <Action label={inspectionModal?.type === 'pickup' ? 'Complete Handover' : 'Complete Return'} onPress={submitInspection} primary />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
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

const Input = ({ label, ...props }) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} placeholderTextColor="#94a3b8" {...props} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { backgroundColor: '#0C2D48', padding: 20, paddingTop: 52 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1 },
  headerTitle: { color: 'white', fontSize: 24, fontWeight: '700' },
  headerSubtitle: { color: '#cbd5e1', marginTop: 4 },
  walkInButton: { minHeight: 38, borderRadius: 12, backgroundColor: '#F37021', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  walkInButtonText: { color: 'white', fontWeight: '800', fontSize: 12 },
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
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.58)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { color: '#0f172a', fontSize: 20, fontWeight: '800' },
  inputGroup: { marginBottom: 12 },
  label: { color: '#334155', fontSize: 13, fontWeight: '800', marginBottom: 6 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, color: '#0f172a', fontSize: 15 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap' },
  assetPicker: { gap: 8, marginBottom: 12 },
  assetOption: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 11 },
  assetOptionActive: { backgroundColor: '#0C2D48', borderColor: '#0C2D48' },
  assetOptionText: { color: '#334155', fontWeight: '700' },
  assetOptionTextActive: { color: 'white' },
  paymentSelector: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  paymentOption: { flex: 1, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, padding: 11, alignItems: 'center' },
  paymentOptionActive: { backgroundColor: '#0C2D48', borderColor: '#0C2D48' },
  paymentOptionText: { color: '#334155', fontWeight: '800' },
  paymentOptionTextActive: { color: 'white' },
  empty: { alignItems: 'center', padding: 30 },
  emptyTitle: { color: '#0f172a', fontSize: 18, fontWeight: '700', marginTop: 12 },
  emptyText: { color: '#64748b', textAlign: 'center', marginTop: 6 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }
});

export default FleetRentalRequestsScreen;
