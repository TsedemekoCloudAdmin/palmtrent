import React, { useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet, StatusBar,
  ActivityIndicator, RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const STATUS_LABELS = {
  created: 'Created', loaded: 'Loaded', in_transit: 'In transit', arrived: 'Arrived',
  awaiting_collection: 'Awaiting collection', awaiting_delivery: 'Arranging delivery',
  out_for_delivery: 'Out for delivery', collected: 'Collected', delivered: 'Delivered', cancelled: 'Cancelled'
};

const MyCourierScreen = ({ navigation }) => {
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiService.getMyCourierShipments();
      setShipments(r.data || []);
    } catch (e) {
      setShipments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => navigation.navigate('CourierDetail', { id: item._id })}>
      <View style={styles.iconWrap}><MaterialIcons name="local-shipping" size={20} color="#0C2D48" /></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.ref}>{item.reference}</Text>
        <Text style={styles.muted}>{item.originName || '—'} → {item.destinationName || '—'}</Text>
      </View>
      <View style={styles.badge}><Text style={styles.badgeText}>{STATUS_LABELS[item.status] || item.status}</Text></View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}><MaterialIcons name="arrow-back" size={24} color="#fff" /></TouchableOpacity>
        <Text style={styles.headerTitle}>My Courier Shipments</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#0C2D48" /></View>
      ) : (
        <FlatList
          data={shipments}
          keyExtractor={(it) => it._id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          ListEmptyComponent={(
            <View style={styles.emptyWrap}>
              <MaterialIcons name="inbox" size={40} color="#cbd5e1" />
              <Text style={styles.empty}>Goods you send by bus through a PalmTrent agent will appear here, plus any shipments shared with you.</Text>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0C2D48', paddingHorizontal: 16, paddingVertical: 14 },
  headerTitle: { color: '#fff', fontSize: 18, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, borderWidth: 1, borderColor: '#eef2f7' },
  iconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eff6ff', alignItems: 'center', justifyContent: 'center' },
  ref: { fontSize: 15, fontWeight: '800', color: '#0C2D48' },
  muted: { color: '#64748b', fontSize: 12, marginTop: 2 },
  badge: { backgroundColor: '#dbeafe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: '#1e40af', fontWeight: '800', fontSize: 10 },
  emptyWrap: { alignItems: 'center', marginTop: 50, paddingHorizontal: 30, gap: 10 },
  empty: { textAlign: 'center', color: '#64748b', lineHeight: 20 }
});

export default MyCourierScreen;
