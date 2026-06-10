import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, SafeAreaView, StatusBar,
  ActivityIndicator, Alert, Image, Modal, TextInput, RefreshControl
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import apiService from '../../services/apiService';
import useAuth from '../../hook/useAuth';

const STATUS_LABELS = {
  created: 'Created', loaded: 'Loaded', in_transit: 'In transit', arrived: 'Arrived',
  awaiting_collection: 'Awaiting collection', awaiting_delivery: 'Arranging delivery',
  out_for_delivery: 'Out for delivery', collected: 'Collected', delivered: 'Delivered', cancelled: 'Cancelled'
};

const fmt = (d) => (d ? new Date(d).toLocaleString() : '');

const CourierDetailScreen = ({ navigation, route }) => {
  const { id } = route.params || {};
  const { user } = useAuth();
  const isAgent = ['clerk', 'admin'].includes(user?.userType);

  const [shipment, setShipment] = useState(null);
  const [label, setLabel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [collectModal, setCollectModal] = useState(false);
  const [shareModal, setShareModal] = useState(false);
  const [collectForm, setCollectForm] = useState({ name: '', idNumber: '', idPhotoUrl: '', facePhotoUrl: '' });
  const [shareForm, setShareForm] = useState({ phone: '' });

  const load = useCallback(async () => {
    try {
      const r = await apiService.getCourierShipment(id);
      setShipment(r.data);
      setLabel(r.label);
    } catch (e) {
      Alert.alert('Courier', e.message || 'Could not load shipment.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const act = async (fn, confirm) => {
    if (confirm && !(await new Promise((res) => Alert.alert('Confirm', confirm, [
      { text: 'Cancel', style: 'cancel', onPress: () => res(false) },
      { text: 'Yes', onPress: () => res(true) }
    ])))) return;
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      Alert.alert('Courier', e.message || 'Action failed.');
    } finally {
      setBusy(false);
    }
  };

  const capture = async (key) => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return Alert.alert('Camera', 'Camera permission is required.');
    const result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    if (result.canceled) return;
    const asset = result.assets[0];
    try {
      setBusy(true);
      const up = await apiService.uploadFile(asset.uri, `courier-${key}.jpg`, 'image/jpeg');
      const url = up?.data?.url || up?.url || up?.data?.fileUrl;
      if (url) setCollectForm((p) => ({ ...p, [key]: url }));
      else Alert.alert('Upload', 'Photo upload did not return a URL.');
    } catch (e) {
      Alert.alert('Upload', e.message || 'Could not upload photo.');
    } finally {
      setBusy(false);
    }
  };

  const submitCollect = async () => {
    if (!collectForm.name.trim() || (!collectForm.idNumber.trim() && !collectForm.idPhotoUrl && !collectForm.facePhotoUrl)) {
      return Alert.alert('Collection', 'Collector name and an ID number or photo are required.');
    }
    await act(async () => {
      await apiService.courierCollect(id, collectForm);
      setCollectModal(false);
    });
  };

  const submitShare = async () => {
    if (!shareForm.phone.trim()) return Alert.alert('Share', 'Enter the phone number of a PalmTrent user.');
    await act(async () => {
      await apiService.shareCourierShipment(id, { phone: shareForm.phone.trim() });
      setShareModal(false);
      setShareForm({ phone: '' });
      Alert.alert('Shared', 'They can now track this shipment in the app.');
    });
  };

  if (loading || !shipment) {
    return <SafeAreaView style={styles.container}><View style={styles.center}><ActivityIndicator color="#0C2D48" /></View></SafeAreaView>;
  }

  const agentActions = [];
  if (isAgent) {
    if (shipment.status === 'created') agentActions.push({ label: 'Mark Loaded on Bus', icon: 'inventory', fn: () => apiService.courierLoad(id) });
    if (shipment.status === 'loaded') agentActions.push({ label: 'Mark In Transit', icon: 'directions-bus', fn: () => apiService.courierDepart(id) });
    if (['loaded', 'in_transit'].includes(shipment.status)) agentActions.push({ label: 'Scan Arrival', icon: 'qr-code-scanner', fn: () => apiService.courierArrive(id) });
    if (shipment.status === 'awaiting_collection') agentActions.push({ label: 'Record Collection', icon: 'how-to-reg', modal: 'collect' });
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><MaterialIcons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>{shipment.reference}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>
        <View style={styles.statusPill}><Text style={styles.statusText}>{STATUS_LABELS[shipment.status] || shipment.status}</Text></View>

        {/* Label */}
        {label && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Shipping Label</Text>
            {label.qrImageUrl ? <Image source={{ uri: label.qrImageUrl }} style={styles.qr} resizeMode="contain" /> : null}
            <Text style={styles.code}>{label.code}</Text>
            <Text style={styles.muted}>{label.origin || '—'}  →  {label.destination || '—'}</Text>
            <Text style={styles.muted}>{label.packageCount} item(s) · {label.totalWeight || 0} kg · {shipment.deliveryPreference === 'delivery' ? 'Deliver to address' : 'Collect at depot'}</Text>
            <TouchableOpacity style={styles.labelBtn} onPress={() => navigation.navigate('CourierLabel', { id: shipment._id, label })}>
              <MaterialIcons name="print" size={20} color="#fff" />
              <Text style={styles.labelBtnText}>View / Print Full Label</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Parties */}
        <View style={styles.card}>
          <Row label="Sender" value={`${shipment.sender?.name} · ${shipment.sender?.phone}`} />
          <Row label="Recipient" value={`${shipment.recipient?.name} · ${shipment.recipient?.phone}`} />
          {shipment.deliveryPreference === 'delivery' && <Row label="Deliver to" value={shipment.deliveryAddress?.address} />}
          {shipment.pricing?.amount ? <Row label="Charged" value={`$${shipment.pricing.amount} (${shipment.pricing.paymentStatus})`} /> : null}
          {shipment.bus?.plateNumber ? <Row label="Bus" value={`${shipment.bus.operator || ''} ${shipment.bus.plateNumber}`} /> : null}
          {shipment.handover?.name ? <Row label="Collected by" value={`${shipment.handover.name}${shipment.handover.idNumber ? ` (ID ${shipment.handover.idNumber})` : ''}`} /> : null}
        </View>

        {/* Timeline */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tracking</Text>
          {[...(shipment.statusHistory || [])].reverse().map((h, i) => (
            <View key={i} style={styles.timelineRow}>
              <View style={styles.dot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.tlStatus}>{STATUS_LABELS[h.status] || h.status}</Text>
                {h.note ? <Text style={styles.muted}>{h.note}</Text> : null}
                <Text style={styles.tlTime}>{fmt(h.at)}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Agent actions */}
        {agentActions.map((a) => (
          <TouchableOpacity key={a.label} style={styles.actionBtn} disabled={busy}
            onPress={() => (a.modal === 'collect' ? setCollectModal(true) : act(a.fn, `${a.label}?`))}>
            <MaterialIcons name={a.icon} size={20} color="#fff" />
            <Text style={styles.actionText}>{a.label}</Text>
          </TouchableOpacity>
        ))}

        {(shipment.status === 'awaiting_delivery' || shipment.status === 'out_for_delivery') && (
          <View style={styles.infoBox}><MaterialIcons name="local-shipping" size={20} color="#0C2D48" /><Text style={styles.infoText}>Broadcast to available transporters for last-mile delivery.</Text></View>
        )}

        {/* Sender / sharing actions */}
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => setShareModal(true)}>
          <MaterialIcons name="share" size={18} color="#0C2D48" /><Text style={styles.secondaryText}>Share with an app user</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => promptAddContact(id, load)}>
          <MaterialIcons name="sms" size={18} color="#0C2D48" /><Text style={styles.secondaryText}>Add SMS contact</Text>
        </TouchableOpacity>

        {isAgent && !['delivered', 'collected', 'cancelled'].includes(shipment.status) && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => act(() => apiService.courierCancel(id, { reason: 'Cancelled by agent' }), 'Cancel this shipment?')}>
            <Text style={styles.cancelText}>Cancel shipment</Text>
          </TouchableOpacity>
        )}
        <View style={{ height: 30 }} />
      </ScrollView>

      {/* Collect modal */}
      <Modal visible={collectModal} transparent animationType="slide" onRequestClose={() => setCollectModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Record Collection</Text>
            <Text style={styles.muted}>Capture the collector's identity for records and disputes.</Text>
            <TextInput style={styles.input} placeholder="Collector full name *" value={collectForm.name} onChangeText={(v) => setCollectForm((p) => ({ ...p, name: v }))} />
            <TextInput style={styles.input} placeholder="ID / passport number" value={collectForm.idNumber} onChangeText={(v) => setCollectForm((p) => ({ ...p, idNumber: v }))} />
            <View style={styles.captureRow}>
              <TouchableOpacity style={[styles.captureBtn, collectForm.idPhotoUrl && styles.captureDone]} onPress={() => capture('idPhotoUrl')}>
                <MaterialIcons name={collectForm.idPhotoUrl ? 'check' : 'badge'} size={18} color={collectForm.idPhotoUrl ? '#16a34a' : '#0C2D48'} />
                <Text style={styles.captureText}>ID photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.captureBtn, collectForm.facePhotoUrl && styles.captureDone]} onPress={() => capture('facePhotoUrl')}>
                <MaterialIcons name={collectForm.facePhotoUrl ? 'check' : 'face'} size={18} color={collectForm.facePhotoUrl ? '#16a34a' : '#0C2D48'} />
                <Text style={styles.captureText}>Face photo</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.sheetBtn, styles.cancel2]} onPress={() => setCollectModal(false)}><Text style={styles.cancel2Text}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, styles.save2]} onPress={submitCollect} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.save2Text}>Confirm Handover</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Share modal */}
      <Modal visible={shareModal} transparent animationType="slide" onRequestClose={() => setShareModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Share Shipment</Text>
            <Text style={styles.muted}>They must have a PalmTrent account. They'll be able to track it and get notifications.</Text>
            <TextInput style={styles.input} placeholder="Their phone (+263...)" keyboardType="phone-pad" value={shareForm.phone} onChangeText={(v) => setShareForm({ phone: v })} />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.sheetBtn, styles.cancel2]} onPress={() => setShareModal(false)}><Text style={styles.cancel2Text}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, styles.save2]} onPress={submitShare} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.save2Text}>Share</Text>}</TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const promptAddContact = (id, reload) => {
  Alert.prompt?.('Add SMS contact', 'Enter the phone number', async (phone) => {
    if (!phone) return;
    try { await apiService.addCourierContact(id, { phone }); reload(); } catch (e) { Alert.alert('Courier', e.message); }
  });
  // Android has no Alert.prompt; fall back to a simple notice.
  if (!Alert.prompt) Alert.alert('Add SMS contact', 'Adding extra contacts is available on the shipment share sheet.');
};

const Row = ({ label, value }) => (
  <View style={styles.kv}><Text style={styles.kvLabel}>{label}</Text><Text style={styles.kvValue}>{value || '—'}</Text></View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0C2D48', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  content: { padding: 16 },
  statusPill: { alignSelf: 'flex-start', backgroundColor: '#dbeafe', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6, marginBottom: 12 },
  statusText: { color: '#1e40af', fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#eef2f7' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  qr: { width: 180, height: 180, alignSelf: 'center', marginBottom: 8 },
  code: { textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#0C2D48', letterSpacing: 1 },
  labelBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F37021', minHeight: 46, borderRadius: 12, marginTop: 12 },
  labelBtnText: { color: '#fff', fontWeight: '800' },
  muted: { color: '#64748b', fontSize: 13, textAlign: 'center', marginTop: 2 },
  kv: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
  kvLabel: { color: '#64748b', fontSize: 13 },
  kvValue: { color: '#0f172a', fontSize: 13, fontWeight: '700', flexShrink: 1, textAlign: 'right', marginLeft: 12 },
  timelineRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F37021', marginTop: 4 },
  tlStatus: { fontWeight: '800', color: '#0f172a' },
  tlTime: { color: '#94a3b8', fontSize: 11, marginTop: 2 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0C2D48', minHeight: 50, borderRadius: 14, marginBottom: 10 },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#eff6ff', borderRadius: 12, padding: 12, marginBottom: 10 },
  infoText: { color: '#1e3a5f', flex: 1, fontSize: 13 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', minHeight: 46, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#cbd5e1' },
  secondaryText: { color: '#0C2D48', fontWeight: '700' },
  cancelBtn: { alignItems: 'center', paddingVertical: 14 },
  cancelText: { color: '#dc2626', fontWeight: '800' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a', marginBottom: 6 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, marginTop: 10, color: '#0f172a' },
  captureRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  captureBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1' },
  captureDone: { borderColor: '#16a34a', backgroundColor: '#f0fdf4' },
  captureText: { color: '#0C2D48', fontWeight: '700' },
  sheetActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  sheetBtn: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancel2: { backgroundColor: '#f3f4f6' },
  cancel2Text: { color: '#374151', fontWeight: '700' },
  save2: { backgroundColor: '#0C2D48' },
  save2Text: { color: '#fff', fontWeight: '700' }
});

export default CourierDetailScreen;
