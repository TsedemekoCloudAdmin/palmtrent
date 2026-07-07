import React, { useState, useEffect } from 'react';
import {
  View, Text, Image, ScrollView, StyleSheet, StatusBar,
  TouchableOpacity, ActivityIndicator, Alert, TextInput
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Print from 'expo-print';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

// Big, high-contrast HTML label sized for a 100x150mm thermal label printer.
// Printing goes through the OS print framework (AirPrint / Android Print
// Service / Mopria / Save-as-PDF), so it works with any printer the device
// can reach via a print service.
const escapeHtml = (t) => String(t == null ? '' : t).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

const buildLabelHtml = (label, copies = 1) => {
  const n = Math.max(1, Math.min(50, Number(copies) || 1));
  const isDelivery = label.deliveryPreference === 'delivery';
  const oneLabel = (i) => `<div class="border" style="page-break-after:${i < n - 1 ? 'always' : 'auto'}">
      <div class="head"><span class="brand">PALMTRENT</span><span class="tag">${isDelivery ? 'DELIVER' : 'COLLECT'}</span></div>
      ${label.qrImageUrl ? `<div><img class="qr" src="${escapeHtml(label.qrImageUrl)}"/></div>` : ''}
      <div class="ref">${escapeHtml(label.code)}</div>
      <div class="copy">ITEM ${i + 1} OF ${n}</div>
      <div class="route">${escapeHtml((label.origin || '').toUpperCase())}<div class="arrow">&#8595;</div>${escapeHtml((label.destination || '').toUpperCase())}</div>
      <div class="to">${escapeHtml(label.recipient)}<div class="phone">${escapeHtml(label.recipientPhone)}</div></div>
      <div class="meta">${escapeHtml(label.packageCount || 1)} ITEMS &middot; ${escapeHtml(label.totalWeight || 0)} KG</div>
      <div class="from">FROM: ${escapeHtml(label.sender)}</div>
    </div>`;
  let body = '';
  for (let i = 0; i < n; i += 1) body += oneLabel(i);
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"/><style>
    @page { size: 100mm 150mm; margin: 5mm; }
    * { box-sizing: border-box; }
    body { font-family: Arial, Helvetica, sans-serif; color:#000; margin:0; }
    .border { border:5px solid #0C2D48; border-radius:10px; padding:16px; text-align:center; }
    .head { display:flex; justify-content:space-between; align-items:center; }
    .brand { font-size:30px; font-weight:900; letter-spacing:3px; color:#0C2D48; }
    .tag { font-size:24px; font-weight:900; color:#fff; padding:6px 18px; border-radius:8px; background:${isDelivery ? '#F37021' : '#0C2D48'}; }
    .qr { width:240px; height:240px; margin:8px 0; }
    .ref { font-size:50px; font-weight:900; letter-spacing:3px; margin:6px 0; }
    .copy { font-size:22px; font-weight:900; color:#F37021; margin-bottom:6px; }
    .route { font-size:30px; font-weight:900; color:#0C2D48; line-height:1.2; }
    .arrow { font-size:34px; font-weight:900; }
    .to { font-size:36px; font-weight:900; border-top:4px solid #000; padding-top:12px; margin-top:12px; }
    .phone { font-size:28px; font-weight:800; color:#0C2D48; }
    .meta { font-size:24px; font-weight:900; border-top:4px solid #000; padding-top:12px; margin-top:12px; }
    .from { font-size:18px; font-weight:700; margin-top:12px; text-align:left; }
  </style></head><body>${body}</body></html>`;
};

// A large, high-contrast label intended to be printed (or displayed full-screen
// and photographed) and stuck on every item in the shipment. Big bold fonts so
// it scans and reads from a distance on a busy depot floor.
const CourierLabelScreen = ({ navigation, route }) => {
  const { id, label: passedLabel } = route.params || {};
  const [label, setLabel] = useState(passedLabel || null);
  const [loading, setLoading] = useState(!passedLabel);
  const [printing, setPrinting] = useState(false);
  const [zebraIp, setZebraIp] = useState('');
  const [sendingZebra, setSendingZebra] = useState(false);
  const [copies, setCopies] = useState(1);

  useEffect(() => {
    AsyncStorage.getItem('palmtrent_zebra_ip').then((v) => v && setZebraIp(v)).catch(() => {});
  }, []);

  // Default the copy count to the number of packages (one label per item).
  useEffect(() => {
    if (label?.packageCount) setCopies(label.packageCount);
  }, [label]);

  const changeCopies = (delta) => setCopies((c) => Math.max(1, Math.min(50, (Number(c) || 1) + delta)));

  const sendToZebra = async () => {
    if (!zebraIp.trim()) return Alert.alert('Zebra', 'Enter the printer IP address.');
    setSendingZebra(true);
    try {
      await AsyncStorage.setItem('palmtrent_zebra_ip', zebraIp.trim());
      const r = await apiService.courierPrintZpl(id, { printerIp: zebraIp.trim(), copies });
      Alert.alert('Zebra', r.message || 'Sent to printer');
    } catch (e) {
      Alert.alert('Zebra', e.message || 'Could not reach the printer.');
    } finally {
      setSendingZebra(false);
    }
  };

  const print = async () => {
    if (!label) return;
    setPrinting(true);
    try {
      // Opens the OS print dialog → choose any connected/Wi-Fi/Bluetooth label
      // printer with a print service, or save as PDF.
      await Print.printAsync({ html: buildLabelHtml(label, copies) });
    } catch (e) {
      Alert.alert('Print', e?.message || 'Could not open the printer. You can also print from the web courier console.');
    } finally {
      setPrinting(false);
    }
  };

  useEffect(() => {
    if (passedLabel) return;
    apiService.getCourierLabel(id)
      .then((r) => setLabel(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id, passedLabel]);

  if (loading || !label) {
    return <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}><View style={styles.center}><ActivityIndicator color="#0C2D48" /></View></SafeAreaView>;
  }

  const isDelivery = label.deliveryPreference === 'delivery';

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.topbar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><MaterialIcons name="arrow-back" size={26} color="#0C2D48" /></TouchableOpacity>
        <Text style={styles.topbarText}>Shipping Label</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={styles.sheet}>
        <View style={styles.brandRow}>
          <Text style={styles.brand}>PALMTRENT</Text>
          <Text style={[styles.modeTag, isDelivery ? styles.deliverTag : styles.collectTag]}>
            {isDelivery ? 'DELIVER' : 'COLLECT'}
          </Text>
        </View>

        {label.qrImageUrl ? <Image source={{ uri: label.qrImageUrl }} style={styles.qr} resizeMode="contain" /> : null}

        <Text style={styles.reference}>{label.code}</Text>

        <View style={styles.routeBox}>
          <Text style={styles.routeFrom}>{(label.origin || 'ORIGIN').toUpperCase()}</Text>
          <MaterialIcons name="arrow-downward" size={34} color="#0C2D48" />
          <Text style={styles.routeTo}>{(label.destination || 'DESTINATION').toUpperCase()}</Text>
        </View>

        <View style={styles.block}>
          <Text style={styles.blockLabel}>TO</Text>
          <Text style={styles.recipient}>{label.recipient || '—'}</Text>
          <Text style={styles.recipientPhone}>{label.recipientPhone || ''}</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}><Text style={styles.metaNum}>{label.packageCount || 1}</Text><Text style={styles.metaLabel}>ITEMS</Text></View>
          <View style={styles.metaItem}><Text style={styles.metaNum}>{label.totalWeight || 0}kg</Text><Text style={styles.metaLabel}>WEIGHT</Text></View>
          <View style={styles.metaItem}><Text style={styles.metaNum}>{isDelivery ? 'DOOR' : 'DEPOT'}</Text><Text style={styles.metaLabel}>{isDelivery ? 'DELIVERY' : 'COLLECTION'}</Text></View>
        </View>

        <Text style={styles.from}>FROM: {label.sender || '—'}</Text>
        <Text style={styles.footer}>Handle with care · Keep this label attached · {label.trackingUrl}</Text>
      </ScrollView>

      <View style={styles.actions}>
        <View style={styles.copiesRow}>
          <Text style={styles.copiesLabel}>Copies (one per item)</Text>
          <View style={styles.stepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => changeCopies(-1)}><MaterialIcons name="remove" size={22} color="#0C2D48" /></TouchableOpacity>
            <Text style={styles.copiesNum}>{copies}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => changeCopies(1)}><MaterialIcons name="add" size={22} color="#0C2D48" /></TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.printBtn} onPress={print} disabled={printing}>
          {printing ? <ActivityIndicator color="#fff" /> : (
            <>
              <MaterialIcons name="print" size={22} color="#fff" />
              <Text style={styles.printBtnText}>Print {copies} Label{copies > 1 ? 's' : ''}</Text>
            </>
          )}
        </TouchableOpacity>
        <Text style={styles.printHint}>Choose any connected printer in the print dialog, then stick a copy on every item.</Text>

        <View style={styles.zebraRow}>
          <TextInput style={styles.zebraInput} placeholder="Zebra printer IP (raw 9100)" value={zebraIp} onChangeText={setZebraIp} keyboardType="numbers-and-punctuation" autoCapitalize="none" />
          <TouchableOpacity style={styles.zebraBtn} onPress={sendToZebra} disabled={sendingZebra}>
            {sendingZebra ? <ActivityIndicator color="#fff" /> : <Text style={styles.zebraBtnText}>Send to Zebra</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topbar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  topbarText: { fontSize: 16, fontWeight: '800', color: '#0C2D48' },
  sheet: { padding: 20, alignItems: 'center', borderWidth: 3, borderColor: '#0C2D48', margin: 14, borderRadius: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 10 },
  brand: { fontSize: 26, fontWeight: '900', color: '#0C2D48', letterSpacing: 2 },
  modeTag: { fontSize: 20, fontWeight: '900', color: '#fff', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, overflow: 'hidden' },
  collectTag: { backgroundColor: '#0C2D48' },
  deliverTag: { backgroundColor: '#F37021' },
  qr: { width: 240, height: 240, marginVertical: 8 },
  reference: { fontSize: 44, fontWeight: '900', color: '#000', letterSpacing: 2, marginVertical: 6, textAlign: 'center' },
  routeBox: { alignItems: 'center', marginVertical: 14, width: '100%' },
  routeFrom: { fontSize: 26, fontWeight: '900', color: '#334155', textAlign: 'center' },
  routeTo: { fontSize: 30, fontWeight: '900', color: '#0C2D48', textAlign: 'center' },
  block: { width: '100%', borderTopWidth: 3, borderTopColor: '#000', paddingTop: 12, marginTop: 6, alignItems: 'center' },
  blockLabel: { fontSize: 16, fontWeight: '900', color: '#64748b', letterSpacing: 2 },
  recipient: { fontSize: 34, fontWeight: '900', color: '#000', textAlign: 'center', marginTop: 4 },
  recipientPhone: { fontSize: 26, fontWeight: '800', color: '#0C2D48', marginTop: 2 },
  metaRow: { flexDirection: 'row', width: '100%', marginTop: 16, borderTopWidth: 3, borderColor: '#000', paddingTop: 12 },
  metaItem: { flex: 1, alignItems: 'center' },
  metaNum: { fontSize: 28, fontWeight: '900', color: '#000' },
  metaLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', letterSpacing: 1, marginTop: 2 },
  from: { fontSize: 18, fontWeight: '800', color: '#334155', marginTop: 16, alignSelf: 'flex-start' },
  footer: { fontSize: 11, color: '#94a3b8', marginTop: 14, textAlign: 'center' },
  actions: { padding: 16 },
  copiesRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  copiesLabel: { fontSize: 14, fontWeight: '700', color: '#334155' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  stepBtn: { padding: 4 },
  copiesNum: { fontSize: 18, fontWeight: '800', color: '#0f172a', minWidth: 26, textAlign: 'center' },
  printBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0C2D48', minHeight: 52, borderRadius: 14, marginBottom: 10 },
  printBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  printHint: { textAlign: 'center', color: '#64748b', fontWeight: '600' },
  zebraRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  zebraInput: { flex: 1, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, color: '#0f172a' },
  zebraBtn: { backgroundColor: '#334155', borderRadius: 10, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  zebraBtnText: { color: '#fff', fontWeight: '800' }
});

export default CourierLabelScreen;
