import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, SafeAreaView, StatusBar,
  ActivityIndicator, TextInput, RefreshControl
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const FILTERS = [
  { key: 'myday', label: 'My day' },
  { key: '', label: 'All' },
  { key: 'created', label: 'New' },
  { key: 'in_transit', label: 'In transit' },
  { key: 'awaiting_collection', label: 'To collect' },
  { key: 'awaiting_delivery', label: 'To deliver' }
];

const STATUS_LABELS = {
  created: 'Created', loaded: 'Loaded', in_transit: 'In transit', arrived: 'Arrived',
  awaiting_collection: 'Awaiting collection', awaiting_delivery: 'Arranging delivery',
  out_for_delivery: 'Out for delivery', collected: 'Collected', delivered: 'Delivered', cancelled: 'Cancelled'
};

const CourierShipmentsScreen = ({ navigation }) => {
  const [shipments, setShipments] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('myday');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      const params = {};
      if (filter === 'myday') { params.mine = 'true'; params.today = 'true'; }
      else if (filter) params.status = filter;
      if (search.trim()) params.search = search.trim();
      const r = await apiService.getCourierShipments(params);
      setShipments(r.data || []);
      setSummary(filter === 'myday' ? r.summary : null);
    } catch (e) {
      setShipments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, search]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CourierDetail', { id: item._id })}>
      <View style={{ flex: 1 }}>
        <Text style={styles.ref}>{item.reference}</Text>
        <Text style={styles.muted}>{item.originName || '—'} → {item.destinationName || '—'}</Text>
        <Text style={styles.muted}>{item.recipient?.name} · {item.recipient?.phone}</Text>
      </View>
      <View style={styles.badge}><Text style={styles.badgeText}>{STATUS_LABELS[item.status] || item.status}</Text></View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Courier Desk</Text>
        <TouchableOpacity style={styles.scanBtn} onPress={() => navigation.navigate('CourierScan')}>
          <MaterialIcons name="qr-code-scanner" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchRow}>
        <MaterialIcons name="search" size={20} color="#94a3b8" />
        <TextInput style={styles.searchInput} placeholder="Search reference or phone" value={search} onChangeText={setSearch} onSubmitEditing={load} returnKeyType="search" />
      </View>

      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity key={f.key} style={[styles.chip, filter === f.key && styles.chipActive]} onPress={() => setFilter(f.key)}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {summary && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}><Text style={styles.summaryNum}>{summary.count}</Text><Text style={styles.summaryLabel}>Today</Text></View>
          <View style={styles.summaryItem}><Text style={styles.summaryNum}>${Number(summary.totalCollected || 0).toFixed(2)}</Text><Text style={styles.summaryLabel}>Collected</Text></View>
          <View style={styles.summaryItem}><Text style={styles.summaryNum}>${Number(summary.outstanding || 0).toFixed(2)}</Text><Text style={styles.summaryLabel}>Outstanding</Text></View>
        </View>
      )}

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#0C2D48" /></View>
      ) : (
        <FlatList
          data={shipments}
          keyExtractor={(it) => it._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={<Text style={styles.empty}>No shipments yet.</Text>}
        />
      )}

      <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CourierCreate')}>
        <MaterialIcons name="add" size={26} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0C2D48', paddingHorizontal: 16, paddingVertical: 16 },
  headerTitle: { color: '#fff', fontSize: 20, fontWeight: '800' },
  scanBtn: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#F37021', alignItems: 'center', justifyContent: 'center' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', margin: 16, marginBottom: 8, borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, minHeight: 44, color: '#0f172a' },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff' },
  chipActive: { backgroundColor: '#0C2D48', borderColor: '#0C2D48' },
  chipText: { color: '#334155', fontWeight: '700', fontSize: 12 },
  chipTextActive: { color: '#fff' },
  list: { padding: 16, paddingTop: 4 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#eef2f7' },
  ref: { fontSize: 15, fontWeight: '800', color: '#0C2D48' },
  muted: { color: '#64748b', fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: '#dbeafe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginLeft: 8 },
  badgeText: { color: '#1e40af', fontWeight: '800', fontSize: 10 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#64748b', marginTop: 40 },
  fab: { position: 'absolute', right: 20, bottom: 26, width: 58, height: 58, borderRadius: 29, backgroundColor: '#F37021', alignItems: 'center', justifyContent: 'center', elevation: 4 },
  summary: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 8, backgroundColor: '#0C2D48', borderRadius: 14, paddingVertical: 12 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { color: '#fff', fontSize: 18, fontWeight: '800' },
  summaryLabel: { color: '#cbd5e1', fontSize: 11, marginTop: 2 }
});

export default CourierShipmentsScreen;
