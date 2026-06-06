// Shown when the signed-in account was provisioned with a temporary password
// (user.mustChangePassword === true). The user cannot reach the rest of the app
// until they set a new password. The backend enforces this too.
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import apiService from '../services/apiService';
import useAuth from '../hook/useAuth';

const ForceChangePasswordScreen = () => {
  const { updateUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Change password', 'Enter your temporary password and a new password.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Change password', 'Your new password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Change password', 'New password and confirmation do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      Alert.alert('Change password', 'Choose a password different from the temporary one.');
      return;
    }

    setSaving(true);
    try {
      const response = await apiService.changePassword(currentPassword, newPassword);
      if (response.success) {
        updateUser({ mustChangePassword: false });
        Alert.alert('Password updated', 'Your password was changed. Welcome to PalmTrent.');
      } else {
        Alert.alert('Change password', response.message || 'Could not change your password.');
      }
    } catch (error) {
      Alert.alert('Change password', error.message || 'Could not change your password.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <MaterialIcons name="lock-reset" size={34} color="#F37021" />
          </View>
          <Text style={styles.title}>Set a new password</Text>
          <Text style={styles.subtitle}>
            Your account was created with a temporary password. Please set your own password to continue.
          </Text>

          <Field label="Temporary password" value={currentPassword} onChangeText={setCurrentPassword} placeholder="From your SMS" />
          <Field label="New password" value={newPassword} onChangeText={setNewPassword} placeholder="At least 8 characters" />
          <Field label="Confirm new password" value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Re-enter new password" />

          <TouchableOpacity style={[styles.primaryButton, saving && styles.disabled]} onPress={submit} disabled={saving}>
            {saving ? <ActivityIndicator color="white" /> : <MaterialIcons name="check" size={20} color="white" />}
            <Text style={styles.primaryButtonText}>Update Password</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.logoutButton} onPress={logout}>
            <Text style={styles.logoutText}>Sign out</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Field = ({ label, ...props }) => (
  <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={styles.input}
      secureTextEntry
      autoCapitalize="none"
      placeholderTextColor="#94a3b8"
      {...props}
    />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  flex: { flex: 1 },
  content: { padding: 24, paddingTop: 48 },
  iconWrap: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', borderWidth: 1, borderColor: '#fed7aa', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#0f172a', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 20, marginTop: 8, marginBottom: 24 },
  field: { marginBottom: 14 },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', paddingHorizontal: 12, color: '#0f172a', fontSize: 15 },
  primaryButton: { minHeight: 50, borderRadius: 14, backgroundColor: '#F37021', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  primaryButtonText: { color: 'white', fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.65 },
  logoutButton: { marginTop: 18, alignItems: 'center' },
  logoutText: { color: '#64748b', fontSize: 14, fontWeight: '700' },
});

export default ForceChangePasswordScreen;
