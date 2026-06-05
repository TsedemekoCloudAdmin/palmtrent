import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import * as Location from 'expo-location';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const SERVICE_TYPES = [
  { id: 'tow_truck', label: 'Tow truck' },
  { id: 'mechanic', label: 'Mechanic' },
  { id: 'battery', label: 'Battery' },
  { id: 'fuel', label: 'Fuel' },
  { id: 'tyre', label: 'Tyre' },
  { id: 'lockout', label: 'Lockout' },
  { id: 'accident_recovery', label: 'Accident recovery' },
];

const ResponderPortalScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [requests, setRequests] = useState([]);
  const [quoteForms, setQuoteForms] = useState({});
  const [form, setForm] = useState({
    businessName: '',
    phone: '',
    alternatePhone: '',
    vehicleDescription: '',
    registrationNumber: '',
    serviceRadiusKm: '30',
    serviceTypes: ['tow_truck'],
  });

  const loadData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);
      const [profileResponse, requestsResponse] = await Promise.all([
        apiService.getResponderProfile(),
        apiService.getResponderRequests(),
      ]);
      const responder = profileResponse.data || null;
      setProfile(responder);
      setRequests(requestsResponse.data || []);
      if (responder) {
        setForm({
          businessName: responder.businessName || '',
          phone: responder.phone || '',
          alternatePhone: responder.alternatePhone || '',
          vehicleDescription: responder.vehicleDescription || '',
          registrationNumber: responder.registrationNumber || '',
          serviceRadiusKm: String(responder.serviceRadiusKm || 30),
          serviceTypes: responder.serviceTypes?.length ? responder.serviceTypes : ['tow_truck'],
        });
      }
    } catch (error) {
      Alert.alert('Roadside SOS', error.message || 'Unable to load responder workspace.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') throw new Error('Location permission is required to receive nearby SOS requests.');
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return {
      coordinates: [location.coords.longitude, location.coords.latitude],
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    };
  };

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const toggleService = (service) => {
    setForm(prev => ({
      ...prev,
      serviceTypes: prev.serviceTypes.includes(service)
        ? prev.serviceTypes.filter(item => item !== service)
        : [...prev.serviceTypes, service],
    }));
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const location = await getCurrentLocation();
      const response = await apiService.updateResponderProfile({
        ...form,
        serviceRadiusKm: Number(form.serviceRadiusKm || 30),
        location,
      });
      if (!response.success) throw new Error(response.message || 'Unable to save responder profile.');
      Alert.alert('Saved', 'Your roadside assistance profile was saved.');
      loadData(true);
    } catch (error) {
      Alert.alert('Save failed', error.message || 'Unable to save responder profile.');
    } finally {
      setSaving(false);
    }
  };

  const setAvailable = async (isAvailable) => {
    try {
      const location = isAvailable ? await getCurrentLocation() : undefined;
      const response = await apiService.updateResponderAvailability({ isAvailable, location });
      if (!response.success) throw new Error(response.message || 'Unable to update availability.');
      setProfile(response.data);
      loadData(true);
    } catch (error) {
      Alert.alert('Availability', error.message || 'Unable to update availability.');
    }
  };

  const updateQuoteField = (requestId, field, value) => {
    setQuoteForms(prev => ({
      ...prev,
      [requestId]: {
        serviceType: form.serviceTypes?.[0] || 'mechanic',
        distanceKm: '',
        total: '',
        notes: '',
        ...(prev[requestId] || {}),
        [field]: value,
      },
    }));
  };

  const respond = async (request, action) => {
    try {
      const response = await apiService.respondToEmergency(request._id, action);
      if (!response.success) throw new Error(response.message || 'Unable to update SOS request.');
      Alert.alert('SOS updated', response.message || 'Request updated.');
      loadData(true);
    } catch (error) {
      Alert.alert('SOS update failed', error.message || 'Unable to update SOS request.');
    }
  };

  const submitQuote = async (request, pricingMode) => {
    const quoteForm = quoteForms[request._id] || {};
    const serviceType = quoteForm.serviceType || form.serviceTypes?.[0] || 'mechanic';
    const isTow = ['tow_truck', 'accident_recovery'].includes(serviceType);
    const distanceKm = quoteForm.distanceKm ? Number(quoteForm.distanceKm) : 0;
    const total = quoteForm.total ? Number(quoteForm.total) : 0;

    if (isTow && (!Number.isFinite(distanceKm) || distanceKm <= 0)) {
      Alert.alert('Distance required', 'Towing and accident recovery quotes must include the distance in kilometres.');
      return;
    }

    if (pricingMode === 'custom' && (!Number.isFinite(total) || total <= 0)) {
      Alert.alert('Amount required', 'Enter the total custom quote amount.');
      return;
    }

    try {
      const response = await apiService.respondToEmergency(request._id, 'quote', quoteForm.notes || '', {
        serviceType,
        pricingMode,
        distanceKm,
        total,
        notes: quoteForm.notes,
      });
      if (!response.success) throw new Error(response.message || 'Unable to submit quote.');
      Alert.alert('Quote sent', 'Your quote was sent for approval. Accept dispatch only after it is approved.');
      loadData(true);
    } catch (error) {
      Alert.alert('Quote failed', error.message || 'Unable to submit quote.');
    }
  };

  const renderRequest = ({ item }) => {
    const responderEntry = (item.response?.responders || []).find(entry => entry.user);
    const quoteForm = quoteForms[item._id] || {};
    const currentServiceType = quoteForm.serviceType || form.serviceTypes?.[0] || 'mechanic';
    const isTowQuote = ['tow_truck', 'accident_recovery'].includes(currentServiceType);
    const status = responderEntry?.status || item.status;
    const quote = responderEntry?.quote;
    const canAccept = status === 'quote_accepted';
    const canProgress = ['accepted', 'on_scene'].includes(status);

    return (
      <View style={styles.requestCard}>
        <View style={styles.requestHeader}>
          <View>
            <Text style={styles.requestTitle}>{item.emergencyType?.replace(/_/g, ' ') || 'SOS'}</Text>
            <Text style={styles.requestMeta}>{item.triggeredBy?.fullName || 'Palmtrent user'} - {item.contactPhone || item.triggeredBy?.phone || 'No phone'}</Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{status}</Text>
          </View>
        </View>
        <Text style={styles.requestLocation}>{item.location?.address || item.location?.coordinates?.join(', ') || 'Location not supplied'}</Text>
        {quote?.total ? (
          <View style={styles.quoteSummary}>
            <Text style={styles.quoteSummaryTitle}>Quote {quote.quoteReference || ''}</Text>
            <Text style={styles.quoteSummaryText}>USD {Number(quote.total || 0).toFixed(2)} - {quote.serviceType?.replace(/_/g, ' ')}</Text>
            {quote.distanceKm ? <Text style={styles.quoteSummaryText}>{Number(quote.distanceKm).toFixed(1)} km towing distance</Text> : null}
          </View>
        ) : null}
        {['notified', 'quote_rejected'].includes(status) && (
          <View style={styles.quoteBox}>
            <Text style={styles.quoteTitle}>Submit quote before accepting</Text>
            <View style={styles.serviceGrid}>
              {SERVICE_TYPES.filter(service => form.serviceTypes.includes(service.id)).map(service => (
                <TouchableOpacity
                  key={service.id}
                  style={[styles.serviceChip, currentServiceType === service.id && styles.serviceChipActive]}
                  onPress={() => updateQuoteField(item._id, 'serviceType', service.id)}
                >
                  <Text style={[styles.serviceChipText, currentServiceType === service.id && styles.serviceChipTextActive]}>{service.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {isTowQuote && (
              <Field
                label="Distance to destination (km)"
                value={quoteForm.distanceKm || ''}
                onChangeText={(value) => updateQuoteField(item._id, 'distanceKm', value)}
                keyboardType="numeric"
              />
            )}
            <Field
              label="Custom total amount (USD)"
              value={quoteForm.total || ''}
              onChangeText={(value) => updateQuoteField(item._id, 'total', value)}
              keyboardType="numeric"
            />
            <Field
              label="Quote notes"
              value={quoteForm.notes || ''}
              onChangeText={(value) => updateQuoteField(item._id, 'notes', value)}
              multiline
            />
            <View style={styles.requestActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={() => submitQuote(item, 'base')}>
                <Text style={styles.secondaryButtonText}>Use Base Quote</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptButton} onPress={() => submitQuote(item, 'custom')}>
                <Text style={styles.acceptButtonText}>Send Custom Quote</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        {status === 'quote_submitted' && (
          <Text style={styles.waitingText}>Waiting for the transporter/requester to approve this quote.</Text>
        )}
        <View style={styles.requestActions}>
          <TouchableOpacity style={[styles.acceptButton, !canAccept && styles.disabledButton]} onPress={() => respond(item, 'accept')} disabled={!canAccept}>
            <Text style={styles.acceptButtonText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryButton, !canProgress && styles.disabledButton]} onPress={() => respond(item, 'on_scene')} disabled={!canProgress}>
            <Text style={styles.secondaryButtonText}>On Scene</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryButton, status !== 'on_scene' && styles.disabledButton]} onPress={() => respond(item, 'complete')} disabled={status !== 'on_scene'}>
            <Text style={styles.secondaryButtonText}>Complete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F37021" />
          <Text style={styles.loadingText}>Loading SOS workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isAvailable = profile?.availability?.isAvailable && profile?.availability?.status === 'available';

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <FlatList
        data={requests}
        keyExtractor={(item) => item._id}
        renderItem={renderRequest}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <MaterialIcons name="health-and-safety" size={34} color="#F37021" />
              <Text style={styles.headerTitle}>Roadside SOS</Text>
              <Text style={styles.headerText}>Stay available for nearby breakdown, tow, and mechanic requests.</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.availabilityRow}>
                <View>
                  <Text style={styles.sectionTitle}>Availability</Text>
                  <Text style={styles.mutedText}>{isAvailable ? 'You can receive nearby SOS requests.' : 'You are offline.'}</Text>
                </View>
                <Switch value={Boolean(isAvailable)} onValueChange={setAvailable} />
              </View>
              {profile?.verification?.status !== 'approved' && (
                <Text style={styles.warningText}>Your profile is pending Palmtrent verification before broadcasts are sent to you.</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Responder Profile</Text>
              <Field label="Business Name" value={form.businessName} onChangeText={(value) => updateField('businessName', value)} />
              <Field label="Phone" value={form.phone} onChangeText={(value) => updateField('phone', value)} keyboardType="phone-pad" />
              <Field label="Vehicle / Equipment" value={form.vehicleDescription} onChangeText={(value) => updateField('vehicleDescription', value)} />
              <Field label="Registration Number" value={form.registrationNumber} onChangeText={(value) => updateField('registrationNumber', value)} />
              <Field label="Service Radius KM" value={form.serviceRadiusKm} onChangeText={(value) => updateField('serviceRadiusKm', value)} keyboardType="numeric" />
              <View style={styles.serviceGrid}>
                {SERVICE_TYPES.map(service => (
                  <TouchableOpacity
                    key={service.id}
                    style={[styles.serviceChip, form.serviceTypes.includes(service.id) && styles.serviceChipActive]}
                    onPress={() => toggleService(service.id)}
                  >
                    <Text style={[styles.serviceChipText, form.serviceTypes.includes(service.id) && styles.serviceChipTextActive]}>{service.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={saveProfile} disabled={saving}>
                {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>Save Profile & Location</Text>}
              </TouchableOpacity>
            </View>

            <Text style={styles.requestsTitle}>SOS Requests</Text>
          </>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialIcons name="notifications-none" size={50} color="#cbd5e1" />
            <Text style={styles.emptyTitle}>No SOS requests yet</Text>
            <Text style={styles.emptyText}>Keep your availability on and location updated.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const Field = ({ label, ...props }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} placeholderTextColor="#94a3b8" {...props} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 12, color: '#475569' },
  content: { padding: 16, paddingBottom: 32 },
  header: { backgroundColor: '#0C2D48', borderRadius: 22, padding: 20, marginBottom: 14 },
  headerTitle: { color: 'white', fontSize: 25, fontWeight: '800', marginTop: 10 },
  headerText: { color: '#dbeafe', marginTop: 6, lineHeight: 20 },
  card: { backgroundColor: 'white', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, marginBottom: 14 },
  availabilityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800' },
  mutedText: { color: '#64748b', marginTop: 4 },
  warningText: { color: '#9a3412', backgroundColor: '#fff7ed', borderRadius: 12, padding: 10, marginTop: 12, fontWeight: '700' },
  field: { marginBottom: 12 },
  label: { color: '#334155', fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, color: '#0f172a' },
  serviceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  serviceChip: { borderRadius: 999, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, paddingVertical: 8 },
  serviceChipActive: { backgroundColor: '#0C2D48', borderColor: '#0C2D48' },
  serviceChipText: { color: '#334155', fontWeight: '700' },
  serviceChipTextActive: { color: 'white' },
  saveButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#F37021', alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: 'white', fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
  requestsTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 10 },
  requestCard: { backgroundColor: 'white', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 16, marginBottom: 12 },
  requestHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  requestTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800', textTransform: 'capitalize' },
  requestMeta: { color: '#64748b', marginTop: 3 },
  statusBadge: { backgroundColor: '#fff7ed', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'flex-start' },
  statusText: { color: '#9a3412', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  requestLocation: { color: '#334155', marginTop: 10, lineHeight: 19 },
  quoteBox: { backgroundColor: '#f8fafc', borderRadius: 14, borderWidth: 1, borderColor: '#e2e8f0', padding: 12, marginTop: 12 },
  quoteTitle: { color: '#0f172a', fontWeight: '800', marginBottom: 10 },
  quoteSummary: { backgroundColor: '#ecfdf5', borderRadius: 14, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#bbf7d0' },
  quoteSummaryTitle: { color: '#14532d', fontWeight: '800' },
  quoteSummaryText: { color: '#166534', marginTop: 3, fontWeight: '700', textTransform: 'capitalize' },
  waitingText: { color: '#9a3412', backgroundColor: '#fff7ed', borderRadius: 12, padding: 10, marginTop: 12, fontWeight: '700' },
  requestActions: { flexDirection: 'row', gap: 8, marginTop: 14 },
  acceptButton: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#16a34a', alignItems: 'center', justifyContent: 'center' },
  acceptButtonText: { color: 'white', fontWeight: '800' },
  secondaryButton: { flex: 1, minHeight: 42, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#334155', fontWeight: '800', fontSize: 12 },
  emptyState: { alignItems: 'center', paddingVertical: 42 },
  emptyTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800', marginTop: 10 },
  emptyText: { color: '#64748b', marginTop: 5 },
});

export default ResponderPortalScreen;
