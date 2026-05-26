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
  const [editedProfile, setEditedProfile] = useState({});
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

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchStats()]);
      setLoading(false);
    };
    loadData();
  }, [fetchProfile, fetchStats]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchProfile(), fetchStats()]);
    setRefreshing(false);
  }, [fetchProfile, fetchStats]);

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
