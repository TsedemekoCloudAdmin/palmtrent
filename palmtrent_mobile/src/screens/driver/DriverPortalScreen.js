import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const parseCsv = (value) => String(value || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean);

const DriverPortalScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [form, setForm] = useState({
    headline: '',
    bio: '',
    licenseNumber: '',
    licenseClass: '',
    licenseExpiry: '',
    experience: '',
    preferredLocations: '',
    expectedRate: '',
    period: 'daily',
  });
  const [availability, setAvailability] = useState({
    visible: true,
    lookingForWork: true,
    isAvailable: true,
  });

  const loadData = useCallback(async (showRefreshing = false) => {
    try {
      if (showRefreshing) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [profileResponse, subscriptionResponse] = await Promise.all([
        apiService.getMyDriverProfile(),
        apiService.getMySubscription()
      ]);

      const record = profileResponse.data || {};
      setProfile(record);
      setSubscription(subscriptionResponse.data || null);
      setForm({
        headline: record.marketplace?.headline || '',
        bio: record.marketplace?.bio || '',
        licenseNumber: record.licenseNumber || '',
        licenseClass: record.licenseClass || '',
        licenseExpiry: record.licenseExpiry ? String(record.licenseExpiry).slice(0, 10) : '',
        experience: record.experience !== undefined ? String(record.experience) : '',
        preferredLocations: (record.marketplace?.preferredLocations || []).join(', '),
        expectedRate: record.marketplace?.expectedRate?.amount !== undefined ? String(record.marketplace.expectedRate.amount) : '',
        period: record.marketplace?.expectedRate?.period || 'daily',
      });
      setAvailability({
        visible: record.marketplace?.visible !== false,
        lookingForWork: record.marketplace?.lookingForWork !== false,
        isAvailable: record.status !== 'on_duty' && record.status !== 'on_leave',
      });
    } catch (error) {
      Alert.alert('Driver profile', error.message || 'Unable to load your driver profile.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        licenseNumber: form.licenseNumber.trim(),
        licenseClass: form.licenseClass.trim(),
        licenseExpiry: form.licenseExpiry.trim() || undefined,
        experience: Number(form.experience || 0),
        marketplace: {
          headline: form.headline.trim(),
          bio: form.bio.trim(),
          preferredLocations: parseCsv(form.preferredLocations),
          expectedRate: {
            amount: Number(form.expectedRate || 0),
            currency: 'USD',
            period: form.period || 'daily',
          },
        },
      };
      const response = await apiService.updateMyDriverProfile(payload);
      if (!response.success) {
        throw new Error(response.message || 'Unable to save driver profile.');
      }
      Alert.alert('Saved', 'Your driver profile was updated.');
      loadData(true);
    } catch (error) {
      Alert.alert('Save failed', error.message || 'Unable to save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const saveAvailability = async (nextAvailability = availability) => {
    setAvailability(nextAvailability);
    try {
      await apiService.updateMyDriverAvailability(nextAvailability);
      loadData(true);
    } catch (error) {
      Alert.alert('Availability', error.message || 'Unable to update availability.');
      loadData(true);
    }
  };

  const paySubscription = () => {
    if (!subscription) {
      navigation.navigate('SubscriptionOnboarding');
      return;
    }

    navigation.navigate('MobileMoneyPayment', {
      paymentContext: 'subscription',
      subscriptionId: subscription._id || subscription.id,
      subscriptionName: subscription.plan?.name || 'Driver subscription',
      amount: Number(subscription.amount || subscription.plan?.price || 0),
      paymentMethod: 'clicknpay',
      paymentReference: subscription.payment?.reference
    });
  };

  const subscriptionPaid = subscription?.payment?.status === 'paid' || subscription?.status === 'active';
  const subscriptionPending = subscription && !subscriptionPaid;

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#F37021" />
          <Text style={styles.loadingText}>Loading driver workspace...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      <KeyboardAvoidingView style={styles.keyboardAvoid} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <MaterialIcons name="badge" size={30} color="#F37021" />
            </View>
            <Text style={styles.headerTitle}>Driver Workspace</Text>
            <Text style={styles.headerText}>Manage your profile, availability, and subscription for driver work.</Text>
          </View>

          <View style={[styles.card, subscriptionPaid ? styles.goodCard : styles.warningCard]}>
            <View style={styles.cardHeader}>
              <MaterialIcons name={subscriptionPaid ? 'verified' : 'workspace-premium'} size={22} color={subscriptionPaid ? '#16a34a' : '#F37021'} />
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Subscription</Text>
                <Text style={styles.mutedText}>
                  {subscriptionPaid ? 'Active' : subscriptionPending ? 'Payment pending' : 'Driver annual plan required'}
                </Text>
              </View>
            </View>
            {!subscriptionPaid && (
              <TouchableOpacity style={styles.primaryButton} onPress={paySubscription}>
                <MaterialIcons name="payments" size={20} color="white" />
                <Text style={styles.primaryButtonText}>{subscriptionPending ? 'Continue Payment' : 'Choose Driver Plan'}</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <ToggleRow
              icon="visibility"
              label="Show me in driver marketplace"
              value={availability.visible}
              onValueChange={(value) => saveAvailability({ ...availability, visible: value })}
            />
            <ToggleRow
              icon="work"
              label="Looking for work"
              value={availability.lookingForWork}
              onValueChange={(value) => saveAvailability({ ...availability, lookingForWork: value })}
            />
            <ToggleRow
              icon="event-available"
              label="Available now"
              value={availability.isAvailable}
              onValueChange={(value) => saveAvailability({ ...availability, isAvailable: value })}
            />
            {(availability.visible || availability.lookingForWork) && !subscriptionPaid && (
              <Text style={styles.noticeText}>
                You will only appear in the driver marketplace once your annual subscription is paid.
              </Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Profile</Text>
            <Field label="Headline" value={form.headline} onChangeText={(value) => updateField('headline', value)} placeholder="Experienced cross-border driver" />
            <Field label="Bio" value={form.bio} onChangeText={(value) => updateField('bio', value)} placeholder="Short summary of your experience" multiline />
            <View style={styles.row}>
              <Field label="License Number" value={form.licenseNumber} onChangeText={(value) => updateField('licenseNumber', value)} placeholder="DL12345" style={styles.halfField} />
              <Field label="Class" value={form.licenseClass} onChangeText={(value) => updateField('licenseClass', value)} placeholder="Class 2" style={styles.halfField} />
            </View>
            <View style={styles.row}>
              <Field label="Expiry" value={form.licenseExpiry} onChangeText={(value) => updateField('licenseExpiry', value)} placeholder="YYYY-MM-DD" style={styles.halfField} />
              <Field label="Experience" value={form.experience} onChangeText={(value) => updateField('experience', value)} placeholder="5" keyboardType="numeric" style={styles.halfField} />
            </View>
            <Field label="Preferred Locations" value={form.preferredLocations} onChangeText={(value) => updateField('preferredLocations', value)} placeholder="Harare, Bulawayo, Mutare" />
            <View style={styles.row}>
              <Field label="Expected Rate" value={form.expectedRate} onChangeText={(value) => updateField('expectedRate', value)} placeholder="30" keyboardType="numeric" style={styles.halfField} />
              <Field label="Rate Period" value={form.period} onChangeText={(value) => updateField('period', value)} placeholder="daily" style={styles.halfField} />
            </View>
            <TouchableOpacity style={[styles.primaryButton, saving && styles.disabledButton]} onPress={saveProfile} disabled={saving}>
              {saving ? <ActivityIndicator color="white" /> : <MaterialIcons name="save" size={20} color="white" />}
              <Text style={styles.primaryButtonText}>Save Driver Profile</Text>
            </TouchableOpacity>
          </View>

          {profile?.assignedVehicle && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Assigned Vehicle</Text>
              <Text style={styles.vehicleText}>{profile.assignedVehicle.registrationNumber || 'Assigned vehicle'}</Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Field = ({ label, style, multiline = false, ...props }) => (
  <View style={[styles.field, style]}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.multilineInput]}
      placeholderTextColor="#94a3b8"
      multiline={multiline}
      {...props}
    />
  </View>
);

const ToggleRow = ({ icon, label, value, onValueChange }) => (
  <View style={styles.toggleRow}>
    <View style={styles.toggleLabel}>
      <MaterialIcons name={icon} size={21} color="#0C2D48" />
      <Text style={styles.toggleText}>{label}</Text>
    </View>
    <Switch value={value} onValueChange={onValueChange} trackColor={{ false: '#cbd5e1', true: '#bfdbfe' }} thumbColor={value ? '#0C2D48' : '#f8fafc'} />
  </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  keyboardAvoid: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 34 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { marginTop: 12, color: '#475569', fontSize: 15 },
  header: { backgroundColor: '#0C2D48', borderRadius: 22, padding: 20, marginBottom: 16 },
  headerIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  headerTitle: { color: 'white', fontSize: 25, fontWeight: '800' },
  headerText: { color: '#dbeafe', fontSize: 14, lineHeight: 20, marginTop: 6 },
  card: { backgroundColor: 'white', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14 },
  goodCard: { backgroundColor: '#f0fdf4', borderColor: '#bbf7d0' },
  warningCard: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 },
  cardHeaderText: { flex: 1 },
  cardTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800' },
  mutedText: { color: '#64748b', fontSize: 13, marginTop: 2 },
  sectionTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800', marginBottom: 12 },
  primaryButton: { minHeight: 48, borderRadius: 14, backgroundColor: '#F37021', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 },
  primaryButtonText: { color: 'white', fontSize: 15, fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
  toggleRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  toggleLabel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingRight: 10 },
  toggleText: { flex: 1, color: '#334155', fontSize: 15, fontWeight: '600' },
  noticeText: { marginTop: 12, color: '#9a3412', backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa', borderRadius: 12, padding: 12, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 10 },
  halfField: { flex: 1 },
  field: { marginBottom: 12 },
  label: { color: '#334155', fontSize: 13, fontWeight: '700', marginBottom: 6 },
  input: { minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', paddingHorizontal: 12, color: '#0f172a', fontSize: 15 },
  multilineInput: { minHeight: 92, paddingTop: 12, textAlignVertical: 'top' },
  vehicleText: { color: '#334155', fontSize: 15, fontWeight: '700' },
});

export default DriverPortalScreen;
