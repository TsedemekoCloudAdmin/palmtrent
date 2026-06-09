import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const emptyForm = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  role: 'agent',
};

// Mirrors the backend role→permission mapping in trailerOwnersController.
const ROLE_OPTIONS = [
  { value: 'manager', label: 'Manager', hint: 'Full access: rentals, fleet, drivers and staff.' },
  { value: 'agent', label: 'Agent', hint: 'Operate rentals (approve, pickup, return). Cannot edit fleet or staff.' },
  { value: 'viewer', label: 'Viewer', hint: 'Read-only access to rentals and fleet.' },
];

const RentalStaffScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const loadStaff = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);
      else setLoading(true);
      const response = await apiService.getRentalStaff();
      setStaff(response.data || []);
    } catch (error) {
      Alert.alert('Rental staff', error.message || 'Unable to load staff users.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const closeModal = () => {
    setModalVisible(false);
    setForm(emptyForm);
  };

  const createStaff = async () => {
    if (!form.fullName.trim() || !form.email.trim() || !form.phone.trim() || !form.password.trim()) {
      Alert.alert('Missing details', 'Full name, email, phone, and password are required.');
      return;
    }

    setSaving(true);
    try {
      const response = await apiService.createRentalStaff({
        ...form,
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
      });
      if (!response.success) {
        throw new Error(response.message || 'Unable to add staff user.');
      }
      closeModal();
      loadStaff(true);
      Alert.alert('Staff added', 'The staff user can now assist with rentals and fleet work.');
    } catch (error) {
      Alert.alert('Create failed', error.message || 'Unable to add staff user.');
    } finally {
      setSaving(false);
    }
  };

  const renderStaff = ({ item }) => (
    <View style={styles.staffCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.fullName?.charAt(0)?.toUpperCase() || 'S'}</Text>
      </View>
      <View style={styles.staffInfo}>
        <Text style={styles.staffName}>{item.fullName}</Text>
        <Text style={styles.staffMeta}>{item.email}</Text>
        <Text style={styles.staffMeta}>{item.phone}</Text>
      </View>
      <View style={styles.roleBadge}>
        <Text style={styles.roleText}>{item.rentalStaffRole || 'agent'}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Rental Staff</Text>
          <Text style={styles.headerText}>Add agents who help clients with your rentals and fleet.</Text>
        </View>
        <TouchableOpacity style={styles.headerAction} onPress={() => setModalVisible(true)}>
          <MaterialIcons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F37021" />
        </View>
      ) : (
        <FlatList
          data={staff}
          renderItem={renderStaff}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadStaff(true)} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="groups" size={58} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>No staff users yet</Text>
              <Text style={styles.emptyText}>Add your first rental assistant to support walk-in clients.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={() => setModalVisible(true)}>
                <MaterialIcons name="person-add" size={19} color="white" />
                <Text style={styles.primaryButtonText}>Add Staff</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={closeModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Staff User</Text>
              <TouchableOpacity onPress={closeModal} style={styles.closeButton}>
                <MaterialIcons name="close" size={22} color="#334155" />
              </TouchableOpacity>
            </View>
            <Field label="Full Name" value={form.fullName} onChangeText={(value) => updateField('fullName', value)} placeholder="Staff member name" />
            <Field label="Email" value={form.email} onChangeText={(value) => updateField('email', value)} placeholder="name@example.com" keyboardType="email-address" autoCapitalize="none" />
            <Field label="Phone" value={form.phone} onChangeText={(value) => updateField('phone', value)} placeholder="+263..." keyboardType="phone-pad" />
            <Field label="Temporary Password" value={form.password} onChangeText={(value) => updateField('password', value)} placeholder="Minimum 6 characters" secureTextEntry />

            <View style={styles.field}>
              <Text style={styles.label}>Role</Text>
              <View style={styles.roleRow}>
                {ROLE_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.rolePill, form.role === option.value && styles.rolePillActive]}
                    onPress={() => updateField('role', option.value)}
                  >
                    <Text style={[styles.rolePillText, form.role === option.value && styles.rolePillTextActive]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.roleHint}>
                {ROLE_OPTIONS.find((option) => option.value === form.role)?.hint}
              </Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={closeModal} disabled={saving}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, saving && styles.disabledButton]} onPress={createStaff} disabled={saving}>
                {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveButtonText}>Save Staff</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  header: { backgroundColor: '#0C2D48', paddingHorizontal: 18, paddingTop: 46, paddingBottom: 22, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  backButton: { padding: 4 },
  headerContent: { flex: 1 },
  headerTitle: { color: 'white', fontSize: 23, fontWeight: '800' },
  headerText: { color: '#dbeafe', fontSize: 14, marginTop: 4 },
  headerAction: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#F37021', alignItems: 'center', justifyContent: 'center' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16, paddingBottom: 28 },
  staffCard: { backgroundColor: 'white', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 },
  avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#0C2D48', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: 'white', fontWeight: '800', fontSize: 18 },
  staffInfo: { flex: 1 },
  staffName: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  staffMeta: { color: '#64748b', fontSize: 13, marginTop: 2 },
  roleBadge: { backgroundColor: '#fff7ed', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  roleText: { color: '#9a3412', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  emptyState: { alignItems: 'center', paddingVertical: 70, paddingHorizontal: 18 },
  emptyTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginTop: 12 },
  emptyText: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 6, marginBottom: 16 },
  primaryButton: { minHeight: 46, borderRadius: 14, backgroundColor: '#F37021', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  primaryButtonText: { color: 'white', fontWeight: '800' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.56)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 24 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  modalTitle: { color: '#0f172a', fontSize: 20, fontWeight: '800' },
  closeButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: 12 },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, color: '#0f172a', fontSize: 15 },
  roleRow: { flexDirection: 'row', gap: 8 },
  rolePill: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  rolePillActive: { backgroundColor: '#0C2D48', borderColor: '#0C2D48' },
  rolePillText: { color: '#334155', fontWeight: '800', fontSize: 13 },
  rolePillTextActive: { color: 'white' },
  roleHint: { color: '#64748b', fontSize: 12, marginTop: 6, lineHeight: 17 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  secondaryButton: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' },
  secondaryButtonText: { color: '#334155', fontWeight: '800' },
  saveButton: { flex: 1, minHeight: 48, borderRadius: 14, backgroundColor: '#F37021', alignItems: 'center', justifyContent: 'center' },
  saveButtonText: { color: 'white', fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
});

export default RentalStaffScreen;
