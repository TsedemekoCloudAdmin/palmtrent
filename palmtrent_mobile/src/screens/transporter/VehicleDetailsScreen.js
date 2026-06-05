// src/screens/transporter/VehicleDetailsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  Image,
  Modal,
  FlatList
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiService from '../../services/apiService';

const VehicleDetailsScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { vehicleId } = route.params;

  const [vehicle, setVehicle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [drivers, setDrivers] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedDriver, setSelectedDriver] = useState('');

  const getRecordLabel = (value, fallback = 'N/A') => {
    if (!value) return fallback;
    if (typeof value === 'object') return value.name || value.label || fallback;
    return String(value);
  };

  useEffect(() => {
    loadVehicleDetails();
    loadAvailableDrivers();
  }, [vehicleId]);

  const loadVehicleDetails = async () => {
    try {
      const response = await apiService.getVehicle(vehicleId);
      if (response.success) {
        const record = response.data || {};
        setVehicle({
          ...record,
          make: record.makeName || getRecordLabel(record.make),
          model: record.modelName || getRecordLabel(record.model),
          vehicleType: record.vehicleTypeName || getRecordLabel(record.vehicleType, record.vehicleType)
        });
      } else {
        Alert.alert('Error', 'Failed to load vehicle details');
      }
    } catch (error) {
      console.error('Load vehicle error:', error);
      Alert.alert('Error', 'Failed to load vehicle details');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableDrivers = async () => {
    try {
      const [managedResponse, marketplaceResponse] = await Promise.all([
        apiService.getDrivers('status=available'),
        apiService.searchMarketplaceDrivers({ availableOnly: 'true' })
      ]);

      const managedDrivers = (managedResponse.data || []).map(driver => ({
        ...driver,
        driverSource: 'managed'
      }));
      const marketplaceDrivers = (marketplaceResponse.data || []).map(driver => ({
        ...driver,
        driverSource: 'marketplace'
      }));

      const uniqueDrivers = new Map();
      [...managedDrivers, ...marketplaceDrivers].forEach(driver => {
        if (driver?._id) uniqueDrivers.set(driver._id, driver);
      });
      setDrivers(Array.from(uniqueDrivers.values()));
    } catch (error) {
      console.error('Load drivers error:', error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Vehicle',
      'Are you sure you want to delete this vehicle? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: deleteVehicle
        }
      ]
    );
  };

  const deleteVehicle = async () => {
    try {
      const response = await apiService.deleteVehicle(vehicleId);
      if (response.success) {
        Alert.alert('Success', 'Vehicle deleted successfully', [
          { text: 'OK', onPress: () => navigation.navigate('FleetDashboard') }
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to delete vehicle');
      }
    } catch (error) {
      console.error('Delete vehicle error:', error);
      Alert.alert('Error', 'Failed to delete vehicle');
    }
  };

  const handleAssignDriver = async () => {
    if (!selectedDriver) {
      Alert.alert('Error', 'Please select a driver');
      return;
    }

    try {
      const response = await apiService.assignDriverToVehicle(vehicleId, selectedDriver);

      if (response.success) {
        Alert.alert('Success', 'Driver assigned successfully');
        setShowAssignModal(false);
        setSelectedDriver('');
        loadVehicleDetails();
      } else {
        Alert.alert('Error', response.message || 'Failed to assign driver');
      }
    } catch (error) {
      console.error('Assign driver error:', error);
      Alert.alert('Error', 'Failed to assign driver');
    }
  };

  const handleUnassignDriver = () => {
    Alert.alert(
      'Unassign Driver',
      'Are you sure you want to unassign the driver from this vehicle?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unassign',
          style: 'destructive',
          onPress: unassignDriver
        }
      ]
    );
  };

  const unassignDriver = async () => {
    try {
      const response = await apiService.unassignDriverFromVehicle(vehicleId);

      if (response.success) {
        Alert.alert('Success', 'Driver unassigned successfully');
        loadVehicleDetails();
      } else {
        Alert.alert('Error', response.message || 'Failed to unassign driver');
      }
    } catch (error) {
      console.error('Unassign driver error:', error);
      Alert.alert('Error', 'Failed to unassign driver');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return '#16a34a';
      case 'on_duty': return '#0C2D48';
      case 'maintenance': return '#dc2626';
      case 'rented': return '#7c3aed';
      default: return '#6b7280';
    }
  };

  const getCategoryIcon = (category) => {
    switch (category) {
      case 'bakkie': return '🚐';
      case 'truck': return '🚚';
      case 'tractor': return '🚛';
      default: return '🚗';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vehicle Details</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Text>Loading vehicle details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vehicle Details</Text>
        </View>
        <View style={styles.errorContainer}>
          <Text>Vehicle not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Vehicle Details</Text>
        <TouchableOpacity 
          style={styles.editButton}
          onPress={() => navigation.navigate('EditVehicle', { vehicleId })}
        >
          <MaterialIcons name="edit" size={20} color="white" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Vehicle Header */}
        <View style={styles.vehicleHeader}>
          <View style={styles.vehicleBasicInfo}>
            <Text style={styles.vehicleIcon}>{getCategoryIcon(vehicle.category)}</Text>
            <View style={styles.vehicleTextInfo}>
              <Text style={styles.registrationNumber}>{vehicle.registrationNumber}</Text>
              <Text style={styles.vehicleMakeModel}>{vehicle.make} {vehicle.model} • {vehicle.year}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(vehicle.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(vehicle.status) }]}>
              {vehicle.status?.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.assignButton]}
            onPress={() => setShowAssignModal(true)}
          >
            <MaterialIcons name="person-add" size={20} color="#0C2D48" />
            <Text style={styles.actionButtonText}>
              {vehicle.assignedDriver ? 'Change Driver' : 'Assign Driver'}
            </Text>
          </TouchableOpacity>

          {vehicle.assignedDriver && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.unassignButton]}
              onPress={handleUnassignDriver}
            >
              <MaterialIcons name="person-remove" size={20} color="#dc2626" />
              <Text style={[styles.actionButtonText, { color: '#dc2626' }]}>
                Unassign Driver
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Vehicle Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Category</Text>
              <Text style={styles.detailValue}>
                {vehicle.category?.charAt(0).toUpperCase() + vehicle.category?.slice(1)}
              </Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Type</Text>
              <Text style={styles.detailValue}>
                {vehicle.subType?.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Color</Text>
              <Text style={styles.detailValue}>{vehicle.color || 'N/A'}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Capacity</Text>
              <Text style={styles.detailValue}>
                {vehicle.capacity?.weight?.value} {vehicle.capacity?.weight?.unit}
              </Text>
            </View>
          </View>
        </View>

        {/* Specifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Specifications</Text>
          
          <View style={styles.detailGrid}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Engine Type</Text>
              <Text style={styles.detailValue}>{vehicle.specifications?.engineType}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Transmission</Text>
              <Text style={styles.detailValue}>{vehicle.specifications?.transmission}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Fuel Capacity</Text>
              <Text style={styles.detailValue}>{vehicle.specifications?.fuelCapacity || 'N/A'}</Text>
            </View>
            
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Mileage</Text>
              <Text style={styles.detailValue}>{vehicle.specifications?.mileage || 'N/A'}</Text>
            </View>
          </View>
        </View>

        {/* Assigned Driver */}
        {vehicle.assignedDriver && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assigned Driver</Text>
            <View style={styles.driverCard}>
              <View style={styles.driverAvatar}>
                <Text style={styles.avatarText}>
                  {vehicle.assignedDriver.fullName?.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{vehicle.assignedDriver.fullName}</Text>
                <Text style={styles.driverPhone}>{vehicle.assignedDriver.phone}</Text>
                <Text style={styles.driverLicense}>
                  License: {vehicle.assignedDriver.licenseNumber} (Class {vehicle.assignedDriver.licenseClass})
                </Text>
              </View>
              <TouchableOpacity 
                style={styles.viewDriverButton}
                onPress={() => navigation.navigate('DriverDetails', { 
                  driverId: vehicle.assignedDriver._id 
                })}
              >
                <MaterialIcons name="visibility" size={20} color="#0C2D48" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Rental Information */}
        {vehicle.pricing?.availableForRental && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rental Information</Text>
            
            <View style={styles.rentalGrid}>
              <View style={styles.rentalItem}>
                <Text style={styles.rentalLabel}>Daily Rate</Text>
                <Text style={styles.rentalValue}>${vehicle.pricing.dailyRate}</Text>
              </View>
              
              <View style={styles.rentalItem}>
                <Text style={styles.rentalLabel}>Weekly Rate</Text>
                <Text style={styles.rentalValue}>${vehicle.pricing.weeklyRate}</Text>
              </View>
              
              <View style={styles.rentalItem}>
                <Text style={styles.rentalLabel}>Monthly Rate</Text>
                <Text style={styles.rentalValue}>${vehicle.pricing.monthlyRate}</Text>
              </View>
              
              <View style={styles.rentalItem}>
                <Text style={styles.rentalLabel}>Deposit</Text>
                <Text style={styles.rentalValue}>${vehicle.pricing.deposit}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Special Features */}
        {vehicle.specialFeatures && vehicle.specialFeatures.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Special Features</Text>
            <View style={styles.featuresList}>
              {vehicle.specialFeatures.map((feature, index) => (
                <View key={index} style={styles.featureItem}>
                  <MaterialIcons name="check-circle" size={16} color="#16a34a" />
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Description */}
        {vehicle.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.descriptionText}>{vehicle.description}</Text>
          </View>
        )}

        {/* Delete Button */}
        <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
          <MaterialIcons name="delete" size={20} color="white" />
          <Text style={styles.deleteButtonText}>Delete Vehicle</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Assign Driver Modal */}
      <Modal
        visible={showAssignModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assign Driver</Text>
            <TouchableOpacity
              style={styles.marketplaceLink}
              onPress={() => {
                setShowAssignModal(false);
                navigation.navigate('DriverMarketplace', { vehicleId });
              }}
            >
              <MaterialIcons name="person-search" size={18} color="#0C2D48" />
              <Text style={styles.marketplaceLinkText}>Search driver marketplace</Text>
            </TouchableOpacity>
            
            <FlatList
              data={drivers}
              keyExtractor={item => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.driverOption,
                    selectedDriver === item._id && styles.driverOptionSelected
                  ]}
                  onPress={() => setSelectedDriver(item._id)}
                >
                  <View style={styles.driverOptionInfo}>
                    <Text style={styles.driverOptionName}>{item.fullName}</Text>
                    <Text style={styles.driverOptionDetails}>
                      {item.licenseNumber || 'License pending'} - Class {item.licenseClass || 'N/A'}
                    </Text>
                    <View style={[
                      styles.sourceBadge,
                      item.driverSource === 'marketplace' && styles.marketplaceBadge
                    ]}>
                      <Text style={[
                        styles.sourceBadgeText,
                        item.driverSource === 'marketplace' && styles.marketplaceBadgeText
                      ]}>
                        {item.driverSource === 'marketplace' ? 'Marketplace' : 'Managed'}
                      </Text>
                    </View>
                  </View>
                  {selectedDriver === item._id && (
                    <MaterialIcons name="check-circle" size={24} color="#0C2D48" />
                  )}
                </TouchableOpacity>
              )}
              style={styles.driversList}
              ListEmptyComponent={
                <View style={styles.emptyDrivers}>
                  <MaterialIcons name="person-search" size={34} color="#94a3b8" />
                  <Text style={styles.emptyDriversText}>No available drivers found.</Text>
                </View>
              }
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
                onPress={handleAssignDriver}
                disabled={!selectedDriver}
              >
                <Text style={styles.assignModalButtonText}>Assign Driver</Text>
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
  vehicleHeader: {
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
  vehicleBasicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  vehicleIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  vehicleTextInfo: {
    flex: 1,
  },
  registrationNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  vehicleMakeModel: {
    fontSize: 14,
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
  driverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0C2D48',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  driverPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
  },
  driverLicense: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  viewDriverButton: {
    padding: 8,
  },
  rentalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  rentalItem: {
    width: '48%',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  rentalLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  rentalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
  },
  descriptionText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
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
  marketplaceLink: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  marketplaceLinkText: {
    color: '#0C2D48',
    fontSize: 14,
    fontWeight: '700',
  },
  driversList: {
    maxHeight: 300,
  },
  driverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  driverOptionSelected: {
    backgroundColor: '#f0f9ff',
  },
  driverOptionInfo: {
    flex: 1,
  },
  driverOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  driverOptionDetails: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    marginTop: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#e0f2fe',
  },
  marketplaceBadge: {
    backgroundColor: '#fff7ed',
  },
  sourceBadgeText: {
    color: '#075985',
    fontSize: 11,
    fontWeight: '800',
  },
  marketplaceBadgeText: {
    color: '#9a3412',
  },
  emptyDrivers: {
    alignItems: 'center',
    paddingVertical: 26,
  },
  emptyDriversText: {
    color: '#64748b',
    marginTop: 8,
    fontSize: 14,
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

export default VehicleDetailsScreen;
