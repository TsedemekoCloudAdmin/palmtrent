// src/screens/transporter/DriverDetailsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  Alert,
  Modal,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiService from '../../services/apiService';
import { cleanLabel } from '../../utils/labels';

const DriverDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { driverId } = route.params;

  const [driver, setDriver] = useState(null);
  const [loading, setLoading] = useState(true);
  const [vehicles, setVehicles] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');

  useEffect(() => {
    loadDriverDetails();
    loadAvailableVehicles();
  }, [driverId]);

  const loadDriverDetails = async () => {
    try {
      const response = await apiService.getDriver(driverId);
      if (response.success) {
        setDriver(response.data);
      } else {
        Alert.alert('Error', 'Failed to load driver details');
      }
    } catch (error) {
      console.error('Load driver error:', error);
      Alert.alert('Error', 'Failed to load driver details');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableVehicles = async () => {
    try {
      const response = await apiService.getVehicles('status=available');
      if (response.success) {
        setVehicles(response.data);
      }
    } catch (error) {
      console.error('Load vehicles error:', error);
    }
  };

  const handleInviteToApp = () => {
    if (driver?.user) {
      Alert.alert('App access', 'This driver already has an app login.');
      return;
    }
    Alert.alert(
      'Invite to App',
      `Create a driver login for ${driver?.fullName || 'this driver'} and send their credentials by SMS?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Invite', onPress: inviteToApp }
      ]
    );
  };

  const inviteToApp = async () => {
    try {
      const response = await apiService.inviteDriverToApp(driverId);
      if (response.success) {
        if (response.createdAccount && response.credentials?.temporaryPassword) {
          Alert.alert(
            'Driver invited',
            `Login: ${response.credentials.phone}\nTemporary password: ${response.credentials.temporaryPassword}\n\nThese were also sent to the driver by SMS.`
          );
        } else {
          Alert.alert('Driver invited', response.message || 'The driver can now sign in.');
        }
        loadDriverDetails();
      } else {
        Alert.alert('Error', response.message || 'Failed to invite driver');
      }
    } catch (error) {
      console.error('Invite driver error:', error);
      Alert.alert('Error', 'Failed to invite driver');
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Driver',
      'Are you sure you want to delete this driver? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: deleteDriver
        }
      ]
    );
  };

  const deleteDriver = async () => {
    try {
      const response = await apiService.deleteDriver(driverId);
      if (response.success) {
        Alert.alert('Success', 'Driver deleted successfully', [
          { text: 'OK', onPress: () => navigation.navigate('FleetDashboard') }
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to delete driver');
      }
    } catch (error) {
      console.error('Delete driver error:', error);
      Alert.alert('Error', 'Failed to delete driver');
    }
  };

  const handleAssignVehicle = async () => {
    if (!selectedVehicle) {
      Alert.alert('Error', 'Please select a vehicle');
      return;
    }

    try {
      const response = await apiService.request(`/vehicles/${selectedVehicle}/assign-driver`, {
        method: 'PUT',
        body: JSON.stringify({ driverId })
      });

      if (response.success) {
        Alert.alert('Success', 'Vehicle assigned successfully');
        setShowAssignModal(false);
        setSelectedVehicle('');
        loadDriverDetails();
      } else {
        Alert.alert('Error', response.message || 'Failed to assign vehicle');
      }
    } catch (error) {
      console.error('Assign vehicle error:', error);
      Alert.alert('Error', 'Failed to assign vehicle');
    }
  };

  const handleUnassignVehicle = () => {
    if (!driver.assignedVehicle) return;

    Alert.alert(
      'Unassign Vehicle',
      'Are you sure you want to unassign the vehicle from this driver?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: unassignVehicle
        }
      ]
    );
  };

  const unassignVehicle = async () => {
    try {
      const response = await apiService.request(`/vehicles/${driver.assignedVehicle._id}/assign-driver`, {
        method: 'PUT',
        body: JSON.stringify({ driverId: null })
      });

      if (response.success) {
        Alert.alert('Success', 'Vehicle unassigned successfully');
        loadDriverDetails();
      } else {
        Alert.alert('Error', response.message || 'Failed to unassign vehicle');
      }
    } catch (error) {
      console.error('Unassign vehicle error:', error);
      Alert.alert('Error', 'Failed to unassign vehicle');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return '#16a34a';
      case 'on_duty': return '#0C2D48';
      case 'on_leave': return '#f59e0b';
      case 'suspended': return '#dc2626';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Driver Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text>Loading driver details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!driver) {
    return (
      <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Driver Details</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text>Driver not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Details</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => navigation.navigate('EditDriver', { driverId })}
        >
          <MaterialIcons name="edit" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Driver Header */}
        <View style={styles.driverHeader}>
          <View style={styles.driverBasicInfo}>
            <View style={styles.driverAvatar}>
              <Text style={styles.avatarText}>
                {driver.fullName?.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.driverTextInfo}>
              <Text style={styles.driverName}>{driver.fullName}</Text>
              <Text style={styles.driverPhone}>{driver.phone}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(driver.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(driver.status) }]}>
              {driver.status?.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.assignButton]}
            onPress={() => setShowAssignModal(true)}
          >
            <MaterialIcons name="local-shipping" size={20} color="#0C2D48" />
            <Text style={styles.actionButtonText}>
              {driver.assignedVehicle ? 'Change Vehicle' : 'Assign Vehicle'}
            </Text>
          </TouchableOpacity>

          {driver.assignedVehicle && (
            <TouchableOpacity
              style={[styles.actionButton, styles.unassignButton]}
              onPress={handleUnassignVehicle}
            >
              <MaterialIcons name="remove-circle" size={20} color="#dc2626" />
              <Text style={[styles.actionButtonText, { color: '#dc2626' }]}>
                Unassign Vehicle
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* App Access */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Access</Text>
          {driver.user ? (
            <View style={styles.appAccessRow}>
              <MaterialIcons name="verified-user" size={20} color="#16a34a" />
              <Text style={styles.appAccessText}>This driver has an app login and can manage their own availability.</Text>
            </View>
          ) : (
            <>
              <View style={styles.appAccessRow}>
                <MaterialIcons name="info-outline" size={20} color="#6b7280" />
                <Text style={styles.appAccessText}>No app login yet. Invite them to create a driver account and credentials.</Text>
              </View>
              <TouchableOpacity style={styles.inviteButton} onPress={handleInviteToApp}>
                <MaterialIcons name="person-add-alt" size={20} color="white" />
                <Text style={styles.inviteButtonText}>Invite to App</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Email</Text>
              <Text style={styles.detailValue}>{driver.email || 'N/A'}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Date of Birth</Text>
              <Text style={styles.detailValue}>{driver.dateOfBirth || 'N/A'}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Experience</Text>
              <Text style={styles.detailValue}>{driver.experience || 0} years</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Employment Type</Text>
              <Text style={styles.detailValue}>
                {driver.employmentType?.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
          </View>

          {driver.address && (
            <View style={styles.addressSection}>
              <Text style={styles.detailLabel}>Address</Text>
              <Text style={styles.addressText}>
                {[driver.address.street, driver.address.city, driver.address.state, driver.address.zipCode]
                  .filter(Boolean)
                  .join(', ')}
              </Text>
            </View>
          )}
        </View>

        {/* License Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>License Information</Text>
          
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>License Number</Text>
              <Text style={styles.detailValue}>{driver.licenseNumber}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>License Class</Text>
              <Text style={styles.detailValue}>Class {driver.licenseClass}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>License Expiry</Text>
              <Text style={styles.detailValue}>{driver.licenseExpiry}</Text>
            </View>
          </View>
        </View>

        {/* Specializations */}
        {driver.specialization && driver.specialization.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specializations</Text>
            <View style={styles.specializationsList}>
              {driver.specialization.map((spec, index) => (
                <View key={index} style={styles.specItem}>
                  <Text style={styles.specText}>
                    {spec.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Assigned Vehicle */}
        {driver.assignedVehicle && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned Vehicle</Text>
            <View style={styles.vehicleCard}>
              <Text style={styles.vehicleIcon}>🚗</Text>
              <View style={styles.vehicleInfo}>
                <Text style={styles.vehicleReg}>{driver.assignedVehicle.registrationNumber}</Text>
                <Text style={styles.vehicleDetails}>
                  {[cleanLabel(driver.assignedVehicle.makeName) || cleanLabel(driver.assignedVehicle.make), cleanLabel(driver.assignedVehicle.modelName) || cleanLabel(driver.assignedVehicle.model), driver.assignedVehicle.year].filter(Boolean).join(' • ')}
                </Text>
                <Text style={styles.vehicleCapacity}>
                  Capacity: {driver.assignedVehicle.capacity?.weight?.value} {driver.assignedVehicle.capacity?.weight?.unit}
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.viewVehicleButton}
                onPress={() => navigation.navigate('VehicleDetails', { 
                  vehicleId: driver.assignedVehicle._id 
                })}
              >
                <MaterialIcons name="visibility" size={20} color="#0C2D48" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Emergency Contact */}
        {driver.emergencyContact && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Emergency Contact</Text>
            
            <View style={styles.emergencyContact}>
              <Text style={styles.emergencyName}>{driver.emergencyContact.name}</Text>
              <Text style={styles.emergencyRelationship}>{driver.emergencyContact.relationship}</Text>
              <Text style={styles.emergencyPhone}>{driver.emergencyContact.phone}</Text>
            </View>
          </View>
        )}

        {/* Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Performance</Text>
          
          <View style={styles.performanceGrid}>
            <View style={styles.performanceItem}>
              <Text style={styles.performanceValue}>{driver.performance?.totalTrips || 0}</Text>
              <Text style={styles.performanceLabel}>Total Trips</Text>
            </View>
            
            <View style={styles.performanceItem}>
              <Text style={styles.performanceValue}>{driver.performance?.onTimeDelivery || 0}%</Text>
              <Text style={styles.performanceLabel}>On Time</Text>
            </View>
            
            <View style={styles.performanceItem}>
              <Text style={styles.performanceValue}>{driver.performance?.safeDriving || 0}%</Text>
              <Text style={styles.performanceLabel}>Safe Driving</Text>
            </View>
            
            <View style={styles.performanceItem}>
              <Text style={styles.performanceValue}>{driver.rating?.average || 0}/5</Text>
              <Text style={styles.performanceLabel}>Rating</Text>
            </View>
          </View>
        </View>

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <MaterialIcons name="delete" size={20} color="white" />
          <Text style={styles.deleteButtonText}>Delete Driver</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Assign Vehicle Modal */}
      <Modal
        visible={showAssignModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Vehicle</Text>
            
            <FlatList
              data={vehicles}
              keyExtractor={item => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.vehicleOption,
                    selectedVehicle === item._id && styles.vehicleOptionSelected
                  ]}
                  onPress={() => setSelectedVehicle(item._id)}
                >
                  <View style={styles.vehicleOptionInfo}>
                    <Text style={styles.vehicleOptionReg}>{item.registrationNumber}</Text>
                    <Text style={styles.vehicleOptionDetails}>
                      {[cleanLabel(item.makeName) || cleanLabel(item.make), cleanLabel(item.modelName) || cleanLabel(item.model)].filter(Boolean).join(' ')} • {item.capacity?.weight?.value} {item.capacity?.weight?.unit}
                    </Text>
                  </View>
                  {selectedVehicle === item._id && (
                    <MaterialIcons name="check-circle" size={24} color="#0C2D48" />
                  )}
                </TouchableOpacity>
              )}
              style={styles.vehiclesList}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAssignModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.assignModalButton]}
                onPress={handleAssignVehicle}
                disabled={!selectedVehicle}
              >
                <Text style={styles.assignModalButtonText}>Assign Vehicle</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 20,
    paddingTop: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  editButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  driverBasicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0C2D48',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  driverTextInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  driverPhone: {
    fontSize: 16,
    color: '#6b7280',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'white',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 8,
  },
  assignButton: {
    borderColor: '#0C2D48',
  },
  unassignButton: {
    borderColor: '#dc2626',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0C2D48',
  },
  appAccessRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appAccessText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0C2D48',
    padding: 12,
    borderRadius: 8,
    gap: 8,
    marginTop: 12,
  },
  inviteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  detailItem: {
    width: '48%',
    marginBottom: 12,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  addressSection: {
    marginTop: 12,
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  specializationsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specItem: {
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#0C2D48',
  },
  specText: {
    fontSize: 12,
    color: '#0C2D48',
    fontWeight: '500',
  },
  vehicleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  vehicleIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  vehicleInfo: {
    flex: 1,
  },
  vehicleReg: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  vehicleDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  vehicleCapacity: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  viewVehicleButton: {
    padding: 8,
  },
  emergencyContact: {
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  emergencyName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  emergencyRelationship: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  emergencyPhone: {
    fontSize: 14,
    color: '#374151',
    marginTop: 2,
  },
  performanceGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  performanceItem: {
    alignItems: 'center',
    flex: 1,
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  performanceLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 32,
    gap: 8,
  },
  deleteButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  vehiclesList: {
    maxHeight: 300,
  },
  vehicleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  vehicleOptionSelected: {
    backgroundColor: '#f0f9ff',
  },
  vehicleOptionInfo: {
    flex: 1,
  },
  vehicleOptionReg: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  vehicleOptionDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalButton: {
    flex: 1,
    padding: 16,
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
  assignModalButton: {
    backgroundColor: '#0C2D48',
  },
  assignModalButtonText: {
    color: 'white',
    fontWeight: '600',
  },
});

export default DriverDetailsScreen;