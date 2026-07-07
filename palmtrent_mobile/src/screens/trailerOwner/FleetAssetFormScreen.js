import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
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

const assetTypes = [
  { value: 'trailer', label: 'Trailer' },
  { value: 'tractor_unit', label: 'Tractor Unit' },
  { value: 'truck', label: 'Truck' },
  { value: 'full_rig', label: 'Full Rig' }
];

const FleetAssetFormScreen = ({ navigation }) => {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    assetType: 'trailer',
    registrationNumber: '',
    assetName: '',
    make: '',
    model: '',
    year: '',
    capacityWeight: '',
    dailyRate: '',
    deposit: '',
    city: '',
    rentalMode: 'dry_rental'
  });

  const update = (field, value) => setForm(current => ({ ...current, [field]: value }));

  const submit = async () => {
    if (!form.registrationNumber.trim()) {
      Alert.alert('Missing registration', 'Enter the registration number for this asset.');
      return;
    }

    try {
      setSaving(true);
      const response = await apiService.createTrailer({
        assetType: form.assetType,
        registrationNumber: form.registrationNumber,
        assetName: form.assetName,
        year: Number(form.year) || undefined,
        capacity: {
          weight: {
            value: Number(form.capacityWeight) || 1,
            unit: 'kg'
          }
        },
        tractorUnit: {
          make: form.make,
          model: form.model
        },
        rentalSettings: {
          availableForRental: true,
          availableForShipmentWork: form.assetType !== 'trailer',
          rentalMode: form.rentalMode,
          dailyRate: Number(form.dailyRate) || 0,
          deposit: Number(form.deposit) || 0,
          pickupLocations: form.city ? [{ city: form.city, address: form.city }] : []
        },
        operatingAreas: form.city ? [{ city: form.city, country: 'Zimbabwe' }] : []
      });

      Alert.alert('Fleet asset saved', response.message || 'Your asset is now available in your fleet.', [
        { text: 'OK', onPress: () => navigation.navigate('TrailerList') }
      ]);
    } catch (error) {
      Alert.alert('Could not save asset', error.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Add Fleet Asset</Text>
          <Text style={styles.headerSubtitle}>Trailer, tractor unit, truck, or full rig</Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Asset Type</Text>
        <View style={styles.segment}>
          {assetTypes.map(type => (
            <TouchableOpacity
              key={type.value}
              style={[styles.segmentButton, form.assetType === type.value && styles.segmentButtonActive]}
              onPress={() => update('assetType', type.value)}
            >
              <Text style={[styles.segmentText, form.assetType === type.value && styles.segmentTextActive]}>
                {type.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Field label="Registration Number" value={form.registrationNumber} onChangeText={(value) => update('registrationNumber', value)} />
        <Field label="Display Name" value={form.assetName} onChangeText={(value) => update('assetName', value)} placeholder="Volvo FH + Flatbed" />
        <View style={styles.row}>
          <Field label="Make" value={form.make} onChangeText={(value) => update('make', value)} />
          <Field label="Model" value={form.model} onChangeText={(value) => update('model', value)} />
        </View>
        <View style={styles.row}>
          <Field label="Year" value={form.year} onChangeText={(value) => update('year', value)} keyboardType="numeric" />
          <Field label="Capacity KG" value={form.capacityWeight} onChangeText={(value) => update('capacityWeight', value)} keyboardType="numeric" />
        </View>
        <View style={styles.row}>
          <Field label="Daily Rate" value={form.dailyRate} onChangeText={(value) => update('dailyRate', value)} keyboardType="numeric" />
          <Field label="Deposit" value={form.deposit} onChangeText={(value) => update('deposit', value)} keyboardType="numeric" />
        </View>
        <Field label="City" value={form.city} onChangeText={(value) => update('city', value)} />

        <Text style={styles.label}>Rental Mode</Text>
        <View style={styles.segment}>
          {['dry_rental', 'operated_rental', 'per_trip', 'per_km'].map(mode => (
            <TouchableOpacity
              key={mode}
              style={[styles.segmentButton, form.rentalMode === mode && styles.segmentButtonActive]}
              onPress={() => update('rentalMode', mode)}
            >
              <Text style={[styles.segmentText, form.rentalMode === mode && styles.segmentTextActive]}>
                {mode.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.saveButton} onPress={submit} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Fleet Asset'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const Field = ({ label, ...props }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} placeholderTextColor="#9ca3af" {...props} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f7fa' },
  header: { backgroundColor: '#0C2D48', padding: 20, paddingTop: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: 'white', fontSize: 22, fontWeight: '700' },
  headerSubtitle: { color: '#cbd5e1', marginTop: 2 },
  content: { padding: 16 },
  field: { marginBottom: 14, flex: 1 },
  label: { color: '#334155', fontWeight: '600', marginBottom: 6, textTransform: 'capitalize' },
  input: { backgroundColor: 'white', borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb', padding: 12, fontSize: 15 },
  row: { flexDirection: 'row', gap: 10 },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  segmentButton: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 8, backgroundColor: 'white', borderWidth: 1, borderColor: '#d1d5db' },
  segmentButtonActive: { backgroundColor: '#0C2D48', borderColor: '#0C2D48' },
  segmentText: { color: '#334155', fontWeight: '600', textTransform: 'capitalize' },
  segmentTextActive: { color: 'white' },
  saveButton: { backgroundColor: '#0C2D48', borderRadius: 8, padding: 15, alignItems: 'center', marginVertical: 24 },
  saveButtonText: { color: 'white', fontWeight: '700', fontSize: 16 }
});

export default FleetAssetFormScreen;
