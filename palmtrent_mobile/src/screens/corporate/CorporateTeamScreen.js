import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  RefreshControl
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const ROLES = ['admin', 'manager', 'viewer'];

const emptyForm = { fullName: '', email: '', phone: '', role: 'manager' };

const CorporateTeamScreen = ({ navigation }) => {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const loadTeam = useCallback(async () => {
    try {
      setError('');
      const response = await apiService.getCorporateUsers();
      setMembers(response.data || []);
    } catch (err) {
      setError(err.message || 'Unable to load your team.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  const onRefresh = () => {
    setRefreshing(true);
    loadTeam();
  };

  const submitInvite = async () => {
    if (!form.email.trim()) {
      Alert.alert('Team', 'An email address is required.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await apiService.inviteCorporateUser({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: form.role
      });
      setShowInvite(false);
      setForm(emptyForm);
      await loadTeam();
      const creds = response?.data?.credentials;
      if (creds) {
        Alert.alert('Team member created',
          `Login: ${creds.email}\nTemporary password: ${creds.temporaryPassword}\n\n(Also sent by SMS. They must change it on first login.)`);
      } else {
        Alert.alert('Team', 'Team member added to your corporate account.');
      }
    } catch (err) {
      Alert.alert('Team', err.message || 'Could not add team member.');
    } finally {
      setSubmitting(false);
    }
  };

  const changeRole = (member) => {
    const userId = member.user?._id || member.user;
    const current = member.role || 'manager';
    const next = ROLES[(ROLES.indexOf(current) + 1) % ROLES.length];
    Alert.alert('Change role', `Set ${member.user?.fullName || 'this member'} to "${next}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          try {
            await apiService.updateCorporateUser(userId, { role: next });
            await loadTeam();
          } catch (err) {
            Alert.alert('Team', err.message || 'Could not update role.');
          }
        }
      }
    ]);
  };

  const removeMember = (member) => {
    const userId = member.user?._id || member.user;
    Alert.alert('Remove member', `Remove ${member.user?.fullName || 'this member'} from the corporate account?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiService.removeCorporateUser(userId);
            await loadTeam();
          } catch (err) {
            Alert.alert('Team', err.message || 'Could not remove member.');
          }
        }
      }
    ]);
  };

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Team Members</Text>
        <TouchableOpacity onPress={() => setShowInvite(true)} style={styles.addButton}>
          <MaterialIcons name="person-add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color="#0C2D48" />
          <Text style={styles.muted}>Loading team...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {members.length === 0 && !error ? (
            <Text style={styles.muted}>No team members yet. Tap the icon above to add one.</Text>
          ) : null}

          {members.map((member, index) => {
            const u = member.user || {};
            return (
              <View key={u._id || index} style={styles.card}>
                <View style={styles.cardMain}>
                  <Text style={styles.name}>{u.fullName || u.email || 'Team member'}</Text>
                  {u.email ? <Text style={styles.detail}>{u.email}</Text> : null}
                  {u.phone ? <Text style={styles.detail}>{u.phone}</Text> : null}
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{member.role || 'manager'}</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => changeRole(member)}>
                    <MaterialIcons name="swap-horiz" size={20} color="#0C2D48" />
                    <Text style={styles.actionText}>Role</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => removeMember(member)}>
                    <MaterialIcons name="person-remove" size={20} color="#dc2626" />
                    <Text style={[styles.actionText, { color: '#dc2626' }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={showInvite} transparent animationType="slide" onRequestClose={() => setShowInvite(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Add Team Member</Text>
            <Text style={styles.sheetHint}>
              For a new person, provide their name, email and phone — we create a login and SMS them a temporary password.
            </Text>
            <TextInput style={styles.input} placeholder="Full name" value={form.fullName} onChangeText={(v) => setForm((p) => ({ ...p, fullName: v }))} />
            <TextInput style={styles.input} placeholder="Email address" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => setForm((p) => ({ ...p, email: v }))} />
            <TextInput style={styles.input} placeholder="Phone (+263...)" keyboardType="phone-pad" value={form.phone} onChangeText={(v) => setForm((p) => ({ ...p, phone: v }))} />
            <Text style={styles.label}>Role</Text>
            <View style={styles.roleRow}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.rolePill, form.role === r && styles.rolePillActive]}
                  onPress={() => setForm((p) => ({ ...p, role: r }))}
                >
                  <Text style={[styles.rolePillText, form.role === r && styles.rolePillTextActive]}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.sheetActions}>
              <TouchableOpacity style={[styles.sheetBtn, styles.cancelBtn]} onPress={() => setShowInvite(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetBtn, styles.saveBtn]} onPress={submitInvite} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Add Member</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#0C2D48', paddingHorizontal: 16, paddingVertical: 14 },
  backButton: { padding: 4 },
  headerTitle: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '800', marginLeft: 8 },
  addButton: { padding: 4 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  content: { padding: 16, gap: 12 },
  muted: { color: '#6b7280', textAlign: 'center', marginTop: 12 },
  error: { color: '#dc2626', marginBottom: 8 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', borderWidth: 1, borderColor: '#eef2f7' },
  cardMain: { flex: 1 },
  name: { fontSize: 15, fontWeight: '800', color: '#0f172a' },
  detail: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  roleBadge: { alignSelf: 'flex-start', marginTop: 8, backgroundColor: '#fff7ed', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  roleText: { color: '#9a3412', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  cardActions: { justifyContent: 'center', gap: 12 },
  actionBtn: { alignItems: 'center' },
  actionText: { fontSize: 11, color: '#0C2D48', fontWeight: '700', marginTop: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  sheetHint: { fontSize: 12, color: '#6b7280', marginTop: 6, marginBottom: 12 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', paddingHorizontal: 12, marginBottom: 10, color: '#0f172a' },
  label: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 6 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  rolePill: { flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center' },
  rolePillActive: { backgroundColor: '#0C2D48', borderColor: '#0C2D48' },
  rolePillText: { color: '#374151', fontWeight: '700', textTransform: 'capitalize' },
  rolePillTextActive: { color: '#fff' },
  sheetActions: { flexDirection: 'row', gap: 12 },
  sheetBtn: { flex: 1, minHeight: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelBtn: { backgroundColor: '#f3f4f6' },
  cancelText: { color: '#374151', fontWeight: '700' },
  saveBtn: { backgroundColor: '#0C2D48' },
  saveText: { color: '#fff', fontWeight: '700' }
});

export default CorporateTeamScreen;
