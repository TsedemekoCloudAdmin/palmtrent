import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, StatusBar, ActivityIndicator, Alert, KeyboardAvoidingView, Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const emptyItem = () => ({ description: '', quantity: '1', weight: '' });

const CourierCreateScreen = ({ navigation }) => {
  const [depots, setDepots] = useState([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    originDepot: '', destinationDepot: '', originName: '', destinationName: '',
    senderName: '', senderPhone: '',
    recipientName: '', recipientPhone: '',
    deliveryPreference: 'collection',
    deliveryAddress: '', deliveryCity: '',
    amount: '', paymentReceived: true,
    busOperator: '', busPlate: '',
    altName: '', altPhone: ''
  });
  const [items, setItems] = useState([emptyItem()]);
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    apiService.getCourierDepots().then((r) => setDepots(r.data || [])).catch(() => {});
  }, []);

  // Live weight-based price (charged at the booking/loading point).
  useEffect(() => {
    const totalWeight = items.reduce((sum, it) => sum + (Number(it.weight) || 0) * (Number(it.quantity) || 1), 0);
    const handle = setTimeout(() => {
      apiService.courierQuote({ totalWeight, deliveryPreference: form.deliveryPreference })
        .then((r) => setQuote(r.data))
        .catch(() => {});
    }, 350);
    return () => clearTimeout(handle);
  }, [items, form.deliveryPreference]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setItem = (i, k, v) => setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [k]: v } : it)));
  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (i) => setItems((prev) => prev.filter((_, idx) => idx !== i));

  const pickDepot = (key, depot) => {
    set(key, depot._id);
    set(key === 'originDepot' ? 'originName' : 'destinationName', `${depot.name} (${depot.city})`);
  };

  const submit = async () => {
    if (!form.senderName.trim() || !form.senderPhone.trim()) return Alert.alert('Courier', 'Sender name and phone are required.');
    if (!form.recipientName.trim() || !form.recipientPhone.trim()) return Alert.alert('Courier', 'Recipient name and phone are required.');
    if (form.deliveryPreference === 'delivery' && !form.deliveryAddress.trim()) return Alert.alert('Courier', 'A delivery address is required.');
    const cleanItems = items.filter((it) => it.description.trim());
    if (!cleanItems.length) return Alert.alert('Courier', 'Add at least one item.');

    setSaving(true);
    try {
      const payload = {
        originDepot: form.originDepot || undefined,
        destinationDepot: form.destinationDepot || undefined,
        originName: form.originName || undefined,
        destinationName: form.destinationName || undefined,
        sender: { name: form.senderName.trim(), phone: form.senderPhone.trim() },
        recipient: { name: form.recipientName.trim(), phone: form.recipientPhone.trim() },
        alternateContacts: form.altPhone.trim() ? [{ name: form.altName.trim(), phone: form.altPhone.trim() }] : [],
        items: cleanItems.map((it) => ({ description: it.description.trim(), quantity: Number(it.quantity) || 1, weight: Number(it.weight) || 0 })),
        deliveryPreference: form.deliveryPreference,
        deliveryAddress: form.deliveryPreference === 'delivery' ? { address: form.deliveryAddress.trim(), city: form.deliveryCity.trim() } : undefined,
        pricing: { amount: Number(form.amount) || 0, paymentStatus: form.paymentReceived ? 'paid' : 'unpaid' },
        bus: { operator: form.busOperator.trim(), plateNumber: form.busPlate.trim() }
      };
      const response = await apiService.createCourierShipment(payload);
      if (response.success) {
        navigation.replace('CourierDetail', { id: response.data._id });
      } else {
        Alert.alert('Courier', response.message || 'Could not create shipment.');
      }
    } catch (e) {
      Alert.alert('Courier', e.message || 'Could not create shipment.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><MaterialIcons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>New Courier Shipment</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.section}>Route</Text>
          <DepotPicker label="Origin depot" depots={depots} selected={form.originDepot} onPick={(d) => pickDepot('originDepot', d)} />
          <Input label="Origin name (if not a depot)" value={form.originName} onChangeText={(v) => set('originName', v)} placeholder="e.g. Mbare Musika rank" />
          <DepotPicker label="Destination depot" depots={depots} selected={form.destinationDepot} onPick={(d) => pickDepot('destinationDepot', d)} />
          <Input label="Destination name" value={form.destinationName} onChangeText={(v) => set('destinationName', v)} placeholder="e.g. Bulawayo depot" />

          <Text style={styles.section}>Sender</Text>
          <Input label="Full name *" value={form.senderName} onChangeText={(v) => set('senderName', v)} />
          <Input label="Phone *" value={form.senderPhone} onChangeText={(v) => set('senderPhone', v)} keyboardType="phone-pad" placeholder="+263..." />

          <Text style={styles.section}>Recipient</Text>
          <Input label="Full name *" value={form.recipientName} onChangeText={(v) => set('recipientName', v)} />
          <Input label="Phone *" value={form.recipientPhone} onChangeText={(v) => set('recipientPhone', v)} keyboardType="phone-pad" placeholder="+263..." />

          <Text style={styles.section}>At destination</Text>
          <View style={styles.toggleRow}>
            {['collection', 'delivery'].map((opt) => (
              <TouchableOpacity key={opt} style={[styles.toggle, form.deliveryPreference === opt && styles.toggleActive]} onPress={() => set('deliveryPreference', opt)}>
                <Text style={[styles.toggleText, form.deliveryPreference === opt && styles.toggleTextActive]}>
                  {opt === 'collection' ? 'Collect at depot' : 'Deliver to address'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {form.deliveryPreference === 'delivery' && (
            <>
              <Input label="Delivery address *" value={form.deliveryAddress} onChangeText={(v) => set('deliveryAddress', v)} />
              <Input label="City" value={form.deliveryCity} onChangeText={(v) => set('deliveryCity', v)} />
            </>
          )}

          <Text style={styles.section}>Items</Text>
          {items.map((it, i) => (
            <View key={i} style={styles.itemCard}>
              <Input label={`Item ${i + 1} description`} value={it.description} onChangeText={(v) => setItem(i, 'description', v)} placeholder="e.g. Box of clothes" />
              <View style={styles.row}>
                <View style={{ flex: 1 }}><Input label="Qty" value={it.quantity} onChangeText={(v) => setItem(i, 'quantity', v)} keyboardType="numeric" /></View>
                <View style={{ width: 10 }} />
                <View style={{ flex: 1 }}><Input label="Weight (kg)" value={it.weight} onChangeText={(v) => setItem(i, 'weight', v)} keyboardType="numeric" /></View>
              </View>
              {items.length > 1 && (
                <TouchableOpacity onPress={() => removeItem(i)} style={styles.removeItem}><Text style={styles.removeItemText}>Remove item</Text></TouchableOpacity>
              )}
            </View>
          ))}
          <TouchableOpacity onPress={addItem} style={styles.addItem}><MaterialIcons name="add" size={18} color="#0C2D48" /><Text style={styles.addItemText}>Add another item</Text></TouchableOpacity>

          <Text style={styles.section}>Payment & bus</Text>
          {quote && (
            <View style={styles.quoteBox}>
              <View style={styles.quoteRow}><Text style={styles.quoteLabel}>Billable weight</Text><Text style={styles.quoteVal}>{quote.billableWeight} kg</Text></View>
              <View style={styles.quoteRow}><Text style={styles.quoteLabel}>Base + per-kg</Text><Text style={styles.quoteVal}>${quote.baseFee} + ${quote.weightCharge}</Text></View>
              {quote.deliverySurcharge ? <View style={styles.quoteRow}><Text style={styles.quoteLabel}>Delivery surcharge</Text><Text style={styles.quoteVal}>${quote.deliverySurcharge}</Text></View> : null}
              <View style={[styles.quoteRow, styles.quoteTotal]}><Text style={styles.quoteTotalLabel}>Charge</Text><Text style={styles.quoteTotalVal}>${form.amount ? Number(form.amount).toFixed(2) : quote.amount.toFixed(2)}</Text></View>
            </View>
          )}
          <Input label="Override amount (optional)" value={form.amount} onChangeText={(v) => set('amount', v)} keyboardType="numeric" placeholder={quote ? `${quote.amount}` : 'Auto from weight'} />
          <TouchableOpacity style={styles.checkRow} onPress={() => set('paymentReceived', !form.paymentReceived)}>
            <MaterialIcons name={form.paymentReceived ? 'check-box' : 'check-box-outline-blank'} size={22} color="#0C2D48" />
            <Text style={styles.checkText}>Payment collected at the counter</Text>
          </TouchableOpacity>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><Input label="Bus operator" value={form.busOperator} onChangeText={(v) => set('busOperator', v)} /></View>
            <View style={{ width: 10 }} />
            <View style={{ flex: 1 }}><Input label="Bus plate" value={form.busPlate} onChangeText={(v) => set('busPlate', v)} /></View>
          </View>

          <Text style={styles.section}>Extra SMS contact (optional)</Text>
          <Input label="Name" value={form.altName} onChangeText={(v) => set('altName', v)} />
          <Input label="Phone" value={form.altPhone} onChangeText={(v) => set('altPhone', v)} keyboardType="phone-pad" placeholder="+263..." />

          <TouchableOpacity style={styles.submit} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Create & Print Label</Text>}
          </TouchableOpacity>
          <View style={{ height: 30 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Input = ({ label, ...props }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput style={styles.input} placeholderTextColor="#94a3b8" {...props} />
  </View>
);

const DepotPicker = ({ label, depots, selected, onPick }) => {
  if (!depots.length) return null;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {depots.map((d) => (
          <TouchableOpacity key={d._id} style={[styles.depotChip, selected === d._id && styles.depotChipActive]} onPress={() => onPick(d)}>
            <Text style={[styles.depotChipText, selected === d._id && styles.depotChipTextActive]}>{d.name}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0C2D48', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  content: { padding: 16 },
  section: { fontSize: 14, fontWeight: '800', color: '#0C2D48', marginTop: 14, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  field: { marginBottom: 10 },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, color: '#0f172a', backgroundColor: '#fff' },
  row: { flexDirection: 'row' },
  toggleRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  toggle: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', backgroundColor: '#fff' },
  toggleActive: { backgroundColor: '#0C2D48', borderColor: '#0C2D48' },
  toggleText: { color: '#334155', fontWeight: '700' },
  toggleTextActive: { color: '#fff' },
  itemCard: { backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#eef2f7', marginBottom: 10 },
  removeItem: { alignSelf: 'flex-start' },
  removeItemText: { color: '#dc2626', fontWeight: '700', fontSize: 12 },
  addItem: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addItemText: { color: '#0C2D48', fontWeight: '800' },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  checkText: { color: '#0f172a', fontWeight: '600' },
  depotChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: '#cbd5e1', marginRight: 8, backgroundColor: '#fff' },
  depotChipActive: { backgroundColor: '#F37021', borderColor: '#F37021' },
  depotChipText: { color: '#334155', fontWeight: '700', fontSize: 13 },
  depotChipTextActive: { color: '#fff' },
  submit: { marginTop: 18, backgroundColor: '#F37021', minHeight: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  quoteBox: { backgroundColor: '#f1f5f9', borderRadius: 12, padding: 12, marginBottom: 10 },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  quoteLabel: { color: '#64748b', fontSize: 13 },
  quoteVal: { color: '#0f172a', fontSize: 13, fontWeight: '600' },
  quoteTotal: { borderTopWidth: 1, borderTopColor: '#cbd5e1', marginTop: 4, paddingTop: 8 },
  quoteTotalLabel: { color: '#0C2D48', fontSize: 15, fontWeight: '800' },
  quoteTotalVal: { color: '#0C2D48', fontSize: 18, fontWeight: '800' }
});

export default CourierCreateScreen;
