import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Image,
  Alert,
  RefreshControl,
  Switch,
  ActivityIndicator,
  TextInput,
  Modal
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../hook/useAuth';
import apiService from '../services/apiService';

const ProfileScreen = ({ navigation }) => {
  const { user, logout, updateUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [stats, setStats] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [editedProfile, setEditedProfile] = useState({});
  const [plans, setPlans] = useState([]);
  const [subscription, setSubscription] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [passwords, setPasswords] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const response = await apiService.getCurrentUser();
      if (response.success) {
        setProfileData(response.data);
        setEditedProfile({
          fullName: response.data.fullName || '',
          email: response.data.email || '',
          phone: response.data.phone || '',
          companyName: response.data.companyName || '',
          address: response.data.address || {}
        });
      }
    } catch (error) {
      console.error('Fetch profile error:', error);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      let endpoint = '/transporter/dashboard-stats';
      if (user?.userType === 'shipper') {
        endpoint = '/shipper/dashboard-stats';
      } else if (user?.userType === 'trailer_owner') {
        endpoint = '/trailer-owner/dashboard-stats';
      } else if (user?.userType === 'corporate') {
        endpoint = '/corporate/dashboard-stats';
      }

      const response = await apiService.get(endpoint);
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Fetch stats error:', error);
    }
  }, [user?.userType]);

  const fetchSubscriptionData = useCallback(async () => {
    try {
      const audience = user?.userType || profileData?.userType;
      const [plansResponse, subscriptionResponse] = await Promise.all([
        apiService.getPublicPlans(audience),
        apiService.getMySubscription()
      ]);
      setPlans(plansResponse.data || []);
      setSubscription(subscriptionResponse.data || null);
    } catch (error) {
      console.error('Fetch subscription error:', error);
    }
  }, [profileData?.userType, user?.userType]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchStats(), fetchSubscriptionData()]);
      setLoading(false);
    };
    loadData();
  }, [fetchProfile, fetchStats, fetchSubscriptionData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchStats(), fetchSubscriptionData()]);
    setRefreshing(false);
  }, [fetchProfile, fetchStats, fetchSubscriptionData]);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const response = await apiService.updateProfile(editedProfile);
      if (response.success) {
        setProfileData(response.data);
        if (updateUser) {
          updateUser(response.data);
        }
        setEditMode(false);
        Alert.alert('Success', 'Profile updated successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to update profile');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwords.newPassword !== passwords.confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }
    if (passwords.newPassword.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setSaving(true);
    try {
      const response = await apiService.post('/auth/change-password', {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword
      });

      if (response.success) {
        setShowPasswordModal(false);
        setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
        Alert.alert('Success', 'Password changed successfully');
      } else {
        Alert.alert('Error', response.message || 'Failed to change password');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            if (logout) {
              await logout();
            } else {
              await apiService.logout();
            }
          }
        }
      ]
    );
  };

  const updatePreference = async (key, value) => {
    try {
      const newPreferences = {
        ...profileData?.preferences,
        notifications: {
          ...profileData?.preferences?.notifications,
          [key]: value
        }
      };

      const response = await apiService.updateProfile({ preferences: newPreferences });
      if (response.success) {
        setProfileData(prev => ({
          ...prev,
          preferences: newPreferences
        }));
        if (updateUser) {
          updateUser({ preferences: newPreferences });
        }
      }
    } catch (error) {
      console.error('Update preference error:', error);
    }
  };

  const selectSubscriptionPlan = async (plan) => {
    setSubscriptionLoading(true);
    try {
      const response = await apiService.createMySubscription(plan);
      if (response.success) {
        setSubscription(response.data);
        setShowSubscriptionModal(false);
        Alert.alert('Subscription Updated', response.message || 'Your subscription has been updated.');
      }
    } catch (error) {
      Alert.alert('Subscription Error', error.message || 'Unable to select subscription plan.');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  const formatPlanPrice = (plan) => {
    const price = Number(plan?.price || 0);
    const currency = plan?.currency || 'USD';
    if (price <= 0) return 'Included';
    return `${currency} ${price.toLocaleString()} / ${plan.billingCycle || 'month'}`;
  };

  const getSubscriptionStatus = () => {
    if (!subscription) return 'No active subscription';
    const planName = subscription.plan?.name || 'Selected plan';
    const status = subscription.status || 'active';
    const paymentStatus = subscription.payment?.status || 'pending';
    return `${planName} - ${status} - payment ${paymentStatus}`;
  };

  const getUserTypeLabel = (type) => {
    const labels = {
      shipper: 'Shipper',
      transporter: 'Transporter',
      trailer_owner: 'Trailer Owner',
      corporate: 'Corporate'
    };
    return labels[type] || type;
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => setEditMode(!editMode)}
        >
          <MaterialIcons
            name={editMode ? "close" : "edit"}
            size={24}
            color="white"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {profileData?.avatar ? (
              <Image source={{ uri: profileData.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {getInitials(profileData?.fullName)}
                </Text>
              </View>
            )}
            <View style={styles.verifiedBadge}>
              <MaterialIcons
                name={profileData?.isVerified ? "verified" : "pending"}
                size={20}
                color={profileData?.isVerified ? "#16a34a" : "#f59e0b"}
              />
            </View>
          </View>

          {editMode ? (
            <View style={styles.editForm}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={editedProfile.fullName}
                  onChangeText={(text) => setEditedProfile(prev => ({ ...prev, fullName: text }))}
                  placeholder="Enter full name"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Company Name</Text>
                <TextInput
                  style={styles.input}
                  value={editedProfile.companyName}
                  onChangeText={(text) => setEditedProfile(prev => ({ ...prev, companyName: text }))}
                  placeholder="Enter company name (optional)"
                />
              </View>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>City</Text>
                <TextInput
                  style={styles.input}
                  value={editedProfile.address?.city || ''}
                  onChangeText={(text) => setEditedProfile(prev => ({
                    ...prev,
                    address: { ...prev.address, city: text }
                  }))}
                  placeholder="Enter city"
                />
              </View>
              <TouchableOpacity
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.profileName}>{profileData?.fullName}</Text>
              {profileData?.companyName && (
                <Text style={styles.companyName}>{profileData.companyName}</Text>
              )}
              <View style={styles.userTypeBadge}>
                <Text style={styles.userTypeText}>
                  {getUserTypeLabel(profileData?.userType)}
                </Text>
              </View>
            </>
          )}
        </View>

        {/* Stats Card */}
        {stats && !editMode && (
          <View style={styles.statsCard}>
            <Text style={styles.sectionTitle}>Your Stats</Text>
            <View style={styles.statsGrid}>
              {user?.userType === 'transporter' ? (
                <>
                  <StatItem
                    label="Active Jobs"
                    value={stats.activeJobs || 0}
                    icon="local-shipping"
                    color="#0C2D48"
                  />
                  <StatItem
                    label="Total Trips"
                    value={stats.totalTrips || 0}
                    icon="route"
                    color="#16a34a"
                  />
                  <StatItem
                    label="Earnings"
                    value={`$${stats.earnings || 0}`}
                    icon="attach-money"
                    color="#f59e0b"
                  />
                  <StatItem
                    label="Rating"
                    value={stats.rating?.toFixed(1) || '0.0'}
                    icon="star"
                    color="#F37021"
                  />
                </>
              ) : user?.userType === 'shipper' ? (
                <>
                  <StatItem
                    label="Active Bookings"
                    value={stats.activeBookings || 0}
                    icon="local-shipping"
                    color="#0C2D48"
                  />
                  <StatItem
                    label="Completed"
                    value={stats.completedBookings || 0}
                    icon="check-circle"
                    color="#16a34a"
                  />
                  <StatItem
                    label="Total Spent"
                    value={`$${stats.totalSpent || 0}`}
                    icon="attach-money"
                    color="#f59e0b"
                  />
                  <StatItem
                    label="Avg Rating Given"
                    value={stats.avgRatingGiven?.toFixed(1) || '0.0'}
                    icon="star"
                    color="#F37021"
                  />
                </>
              ) : (
                <>
                  <StatItem
                    label="Total Items"
                    value={stats.totalItems || stats.totalTrailers || 0}
                    icon="inventory"
                    color="#0C2D48"
                  />
                  <StatItem
                    label="Active Rentals"
                    value={stats.activeRentals || 0}
                    icon="event-available"
                    color="#16a34a"
                  />
                  <StatItem
                    label="Earnings"
                    value={`$${stats.earnings || 0}`}
                    icon="attach-money"
                    color="#f59e0b"
                  />
                  <StatItem
                    label="Rating"
                    value={stats.rating?.toFixed(1) || '0.0'}
                    icon="star"
                    color="#F37021"
                  />
                </>
              )}
            </View>
          </View>
        )}

        {/* Subscription */}
        {!editMode && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Subscription</Text>
              <TouchableOpacity
                style={styles.smallPrimaryButton}
                onPress={() => setShowSubscriptionModal(true)}
              >
                <Text style={styles.smallPrimaryButtonText}>
                  {subscription ? 'Change' : 'Select'}
                </Text>
              </TouchableOpacity>
            </View>
            <View style={styles.subscriptionCard}>
              <View style={styles.subscriptionIcon}>
                <MaterialIcons name="workspace-premium" size={22} color="#F37021" />
              </View>
              <View style={styles.subscriptionContent}>
                <Text style={styles.subscriptionTitle}>
                  {subscription?.plan?.name || 'Choose a subscription'}
                </Text>
                <Text style={styles.subscriptionMeta}>{getSubscriptionStatus()}</Text>
                {subscription?.nextBillingAt && (
                  <Text style={styles.subscriptionMeta}>
                    Next billing: {new Date(subscription.nextBillingAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Contact Info */}
        {!editMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.infoList}>
              <InfoItem
                icon="email"
                label="Email"
                value={profileData?.email}
                verified={profileData?.isVerified}
              />
              <InfoItem
                icon="phone"
                label="Phone"
                value={profileData?.phone}
                verified={profileData?.isPhoneVerified}
              />
              {profileData?.address?.city && (
                <InfoItem
                  icon="location-on"
                  label="Location"
                  value={`${profileData.address.city}${profileData.address.state ? ', ' + profileData.address.state : ''}`}
                />
              )}
            </View>
          </View>
        )}

        {/* Notification Preferences */}
        {!editMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notification Preferences</Text>
            <View style={styles.preferencesList}>
              <PreferenceItem
                icon="notifications"
                label="Push Notifications"
                value={profileData?.preferences?.notifications?.push ?? true}
                onToggle={(value) => updatePreference('push', value)}
              />
              <PreferenceItem
                icon="email"
                label="Email Notifications"
                value={profileData?.preferences?.notifications?.email ?? true}
                onToggle={(value) => updatePreference('email', value)}
              />
              <PreferenceItem
                icon="sms"
                label="SMS Notifications"
                value={profileData?.preferences?.notifications?.sms ?? true}
                onToggle={(value) => updatePreference('sms', value)}
              />
            </View>
          </View>
        )}

        {/* Account Actions */}
        {!editMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.actionsList}>
              <ActionItem
                icon="lock"
                label="Change Password"
                onPress={() => setShowPasswordModal(true)}
              />
              <ActionItem
                icon="history"
                label="Activity History"
                onPress={() => navigation.navigate('ActivityHistory')}
              />
              <ActionItem
                icon="help"
                label="Help & Support"
                onPress={() => navigation.navigate('Support')}
              />
              <ActionItem
                icon="description"
                label="Terms & Conditions"
                onPress={() => navigation.navigate('Terms')}
              />
              <ActionItem
                icon="privacy-tip"
                label="Privacy Policy"
                onPress={() => navigation.navigate('Privacy')}
              />
            </View>
          </View>
        )}

        {/* Logout Button */}
        {!editMode && (
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <MaterialIcons name="logout" size={20} color="#dc2626" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        )}

        {/* App Version */}
        {!editMode && (
          <Text style={styles.versionText}>Palmtrent v1.0.0</Text>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Password</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Current Password</Text>
              <TextInput
                style={styles.input}
                value={passwords.currentPassword}
                onChangeText={(text) => setPasswords(prev => ({ ...prev, currentPassword: text }))}
                placeholder="Enter current password"
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>New Password</Text>
              <TextInput
                style={styles.input}
                value={passwords.newPassword}
                onChangeText={(text) => setPasswords(prev => ({ ...prev, newPassword: text }))}
                placeholder="Enter new password"
                secureTextEntry
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Confirm New Password</Text>
              <TextInput
                style={styles.input}
                value={passwords.confirmPassword}
                onChangeText={(text) => setPasswords(prev => ({ ...prev, confirmPassword: text }))}
                placeholder="Confirm new password"
                secureTextEntry
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowPasswordModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleChangePassword}
                disabled={saving}
              >
                <Text style={styles.confirmButtonText}>
                  {saving ? 'Changing...' : 'Change Password'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Subscription Modal */}
      <Modal
        visible={showSubscriptionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSubscriptionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, styles.subscriptionModalContent]}>
            <Text style={styles.modalTitle}>Select Subscription</Text>
            <ScrollView style={styles.planList} showsVerticalScrollIndicator={false}>
              {plans.map((plan) => {
                const selected = (subscription?.plan?._id || subscription?.plan?.id) === (plan.id || plan._id);
                return (
                  <TouchableOpacity
                    key={plan.id || plan._id || plan.code}
                    style={[styles.mobilePlanCard, selected && styles.mobilePlanCardSelected]}
                    onPress={() => selectSubscriptionPlan(plan)}
                    disabled={subscriptionLoading}
                  >
                    <View style={styles.mobilePlanHeader}>
                      <View>
                        <Text style={styles.mobilePlanTitle}>{plan.name}</Text>
                        <Text style={styles.mobilePlanPrice}>{formatPlanPrice(plan)}</Text>
                      </View>
                      {selected && <MaterialIcons name="check-circle" size={24} color="#16a34a" />}
                    </View>
                    {!!plan.description && <Text style={styles.mobilePlanDescription}>{plan.description}</Text>}
                    {(plan.features || []).slice(0, 5).map((feature, index) => (
                      <View key={`${plan.code}-${index}`} style={styles.mobilePlanFeature}>
                        <MaterialIcons name="check" size={16} color="#F37021" />
                        <Text style={styles.mobilePlanFeatureText}>{feature}</Text>
                      </View>
                    ))}
                  </TouchableOpacity>
                );
              })}
              {!plans.length && (
                <Text style={styles.emptyPlanText}>No active plans are available for this account type.</Text>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowSubscriptionModal(false)}
                disabled={subscriptionLoading}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// Stat Item Component
const StatItem = ({ label, value, icon, color }) => (
  <View style={styles.statItem}>
    <MaterialIcons name={icon} size={24} color={color} />
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

// Info Item Component
const InfoItem = ({ icon, label, value, verified }) => (
  <View style={styles.infoItem}>
    <MaterialIcons name={icon} size={20} color="#6b7280" />
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueRow}>
        <Text style={styles.infoValue}>{value || 'Not set'}</Text>
        {verified !== undefined && (
          <MaterialIcons
            name={verified ? "verified" : "pending"}
            size={14}
            color={verified ? "#16a34a" : "#f59e0b"}
            style={styles.verifiedIcon}
          />
        )}
      </View>
    </View>
  </View>
);

// Preference Item Component
const PreferenceItem = ({ icon, label, value, onToggle }) => (
  <View style={styles.preferenceItem}>
    <View style={styles.preferenceLeft}>
      <MaterialIcons name={icon} size={20} color="#6b7280" />
      <Text style={styles.preferenceLabel}>{label}</Text>
    </View>
    <Switch
      value={value}
      onValueChange={onToggle}
      trackColor={{ false: '#d1d5db', true: '#0C2D48' }}
      thumbColor={value ? '#F37021' : '#f4f3f4'}
    />
  </View>
);

// Action Item Component
const ActionItem = ({ icon, label, onPress }) => (
  <TouchableOpacity style={styles.actionItem} onPress={onPress}>
    <View style={styles.actionLeft}>
      <MaterialIcons name={icon} size={20} color="#6b7280" />
      <Text style={styles.actionLabel}>{label}</Text>
    </View>
    <MaterialIcons name="chevron-right" size={20} color="#9ca3af" />
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  editButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  profileCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: -20,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#0C2D48',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 4,
  },
  profileName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  companyName: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  userTypeBadge: {
    backgroundColor: '#0C2D48',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  userTypeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  editForm: {
    width: '100%',
    gap: 16,
  },
  inputGroup: {
    gap: 8,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#0C2D48',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statsCard: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  smallPrimaryButton: {
    backgroundColor: '#0C2D48',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  smallPrimaryButtonText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '700',
  },
  subscriptionCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
  },
  subscriptionIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscriptionContent: {
    flex: 1,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  subscriptionMeta: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoList: {
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  infoValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  verifiedIcon: {
    marginLeft: 6,
  },
  preferencesList: {
    gap: 12,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  preferenceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  preferenceLabel: {
    fontSize: 16,
    color: '#374151',
  },
  actionsList: {
    gap: 8,
  },
  actionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionLabel: {
    fontSize: 16,
    color: '#374151',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 24,
  },
  bottomPadding: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  subscriptionModalContent: {
    maxHeight: '82%',
  },
  planList: {
    maxHeight: 520,
  },
  mobilePlanCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    marginBottom: 12,
  },
  mobilePlanCardSelected: {
    borderColor: '#16a34a',
    backgroundColor: '#f0fdf4',
  },
  mobilePlanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  mobilePlanTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1f2937',
  },
  mobilePlanPrice: {
    fontSize: 14,
    color: '#0C2D48',
    fontWeight: '700',
    marginTop: 3,
  },
  mobilePlanDescription: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 10,
  },
  mobilePlanFeature: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: 6,
  },
  mobilePlanFeatureText: {
    flex: 1,
    fontSize: 13,
    color: '#374151',
    lineHeight: 18,
  },
  emptyPlanText: {
    textAlign: 'center',
    color: '#6b7280',
    fontSize: 14,
    paddingVertical: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
  },
  cancelButtonText: {
    color: '#374151',
    fontWeight: '600',
  },
  confirmButton: {
    backgroundColor: '#0C2D48',
  },
  confirmButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default ProfileScreen;
