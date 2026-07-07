// src/screens/transporter/EditVehicleScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  TextInput,
  Alert,
  Switch,
  Modal,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiService from '../../services/apiService';

const isObjectId = (value) => /^[0-9a-f]{24}$/i.test(String(value || ''));
const getRecordId = (record) => String(record?._id || record?.id || record?.value || '');
const getRecordLabel = (record) => record?.name || record?.label || record?.displayName || '';
const referenceKey = (item, prefix) => getRecordId(item) || `${prefix}-${getRecordLabel(item) || Math.random()}`;

const referenceFromVehicleValue = (value, name) => {
  if (value && typeof value === 'object') {
    return {
      ...value,
      _id: getRecordId(value) || undefined,
      name: getRecordLabel(value) || name || ''
    };
  }

  if (!value && !name) return null;
  return {
    _id: isObjectId(value) ? value : undefined,
    name: name || String(value || '')
  };
};

const EditVehicleScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { vehicleId } = route.params;

  const [loading, setLoading] = useState(false);
  const [vehicleMakes, setVehicleMakes] = useState([]);
  const [vehicleModels, setVehicleModels] = useState([]);
  const [showMakeModal, setShowMakeModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [selectedMake, setSelectedMake] = useState(null);
  const [selectedModel, setSelectedModel] = useState(null);
  const [vehicleData, setVehicleData] = useState({
    // Basic Information
    category: '',
    subType: '',
    hasTrailer: null,
    trailerType: '',
    trailerOwned: null,
    
    // Vehicle Details
    registrationNumber: '',
    make: '',
    model: '',
    year: '',
    color: '',
    
    // Capacity
    capacity: {
      weight: {
        value: '',
        unit: 'tonnes'
      }
    },
    
    // Specifications
    specifications: {
      engineType: 'diesel',
      transmission: 'manual',
      fuelCapacity: '',
      mileage: ''
    },
    
    // Features
    features: {
      gps: false,
      refrigeration: false,
      liftGate: false,
      loadingRamp: false,
      airRide: false,
      tarpaulin: false,
      secureStorage: false
    },
    specialFeatures: [],
    
    // Rental Settings
    pricing: {
      availableForRental: false,
      dailyRate: '',
      weeklyRate: '',
      monthlyRate: '',
      deposit: '',
      minimumRentalPeriod: {
        value: '1',
        unit: 'days'
      }
    },
    
    // Operating Areas
    operatingAreas: [],
    
    description: '',
    status: 'available'
  });

  const specialFeatures = [
    'Tarpaulin Cover',
    'Hydraulic Tailgate',
    'Side Loading',
    'GPS Tracking',
    'Refrigeration',
    'Securing Straps',
    'Pallet Jack',
    'Temperature Monitoring'
  ];

  const statusOptions = [
    { value: 'available', label: 'Available', color: '#16a34a' },
    { value: 'in_use', label: 'In Use / Rented', color: '#0C2D48' },
    { value: 'maintenance', label: 'Maintenance', color: '#dc2626' },
    { value: 'inactive', label: 'Inactive', color: '#6b7280' }
  ];

  useEffect(() => {
    loadVehicleData();
    loadVehicleMakes();
  }, [vehicleId]);

  useEffect(() => {
    if (selectedMake && isObjectId(selectedMake._id)) {
      fetchModelsForMake(selectedMake._id);
    } else {
      setVehicleModels([]);
    }
  }, [selectedMake?._id]);

  const loadVehicleData = async () => {
    try {
      const response = await apiService.getVehicle(vehicleId);
      if (response.success) {
        const record = response.data || {};
        setVehicleData(prev => ({
          ...prev,
          ...record,
          capacity: {
            ...prev.capacity,
            ...(record.capacity || {}),
            weight: {
              ...prev.capacity?.weight,
              ...(record.capacity?.weight || {}),
              unit: record.capacity?.weight?.unit || 'tonnes'
            }
          },
          specifications: {
            ...prev.specifications,
            ...(record.specifications || {})
          },
          features: {
            ...prev.features,
            ...(record.features || {})
          },
          pricing: {
            ...prev.pricing,
            ...(record.pricing || record.rentalSettings || {})
          },
          specialFeatures: record.specialFeatures || []
        }));
        setSelectedMake(referenceFromVehicleValue(record.make, record.makeName));
        setSelectedModel(referenceFromVehicleValue(record.model, record.modelName));
      } else {
        Alert.alert('Error', 'Failed to load vehicle data');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Load vehicle error:', error);
      Alert.alert('Error', 'Failed to load vehicle data');
      navigation.goBack();
    }
  };

  const loadVehicleMakes = async () => {
    try {
      const response = await apiService.request('/reference/vehicle-makes');
      setVehicleMakes(response.data || []);
    } catch (error) {
      console.error('Load vehicle makes error:', error);
      setVehicleMakes([]);
    }
  };

  const fetchModelsForMake = async (makeId) => {
    try {
      const response = await apiService.request(`/reference/vehicle-makes/${makeId}/models`);
      setVehicleModels(response.data || []);
    } catch (error) {
      console.error('Load vehicle models error:', error);
      setVehicleModels([]);
    }
  };

  const updateField = (path, value) => {
    setVehicleData(prev => {
      const keys = path.split('.');
      const lastKey = keys.pop();
      const next = { ...prev };
      const lastObj = keys.reduce((obj, key) => {
        obj[key] = { ...(obj[key] || {}) };
        return obj[key];
      }, next);
      lastObj[lastKey] = value;
      return next;
    });
  };

  const selectMake = (make) => {
    setSelectedMake(make);
    setSelectedModel(null);
    updateField('make', isObjectId(make?._id) ? make._id : make?.name || '');
    updateField('makeName', make?.name || '');
    updateField('model', '');
    updateField('modelName', '');
    setShowMakeModal(false);
  };

  const selectModel = (model) => {
    setSelectedModel(model);
    updateField('model', isObjectId(model?._id) ? model._id : model?.name || '');
    updateField('modelName', model?.name || '');
    setShowModelModal(false);
  };

  const toggleFeature = (feature) => {
    setVehicleData(prev => ({
      ...prev,
      specialFeatures: prev.specialFeatures.includes(feature)
        ? prev.specialFeatures.filter(f => f !== feature)
        : [...prev.specialFeatures, feature]
    }));
  };

  const validateForm = () => {
    const required = ['registrationNumber', 'year', 'capacity.weight.value'];
    for (let field of required) {
      const value = field.split('.').reduce((obj, key) => obj?.[key], vehicleData);
      if (!value) {
        return `Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase().replace('registration number', 'registration number').replace('weight value', 'capacity')}`;
      }
    }
    if (!selectedMake && !vehicleData.make) return 'Please select a make';
    if (!selectedModel && !vehicleData.model) return 'Please select a model';
    return null;
  };

  const handleSubmit = async () => {
    const error = validateForm();
    if (error) {
      Alert.alert('Validation Error', error);
      return;
    }

    setLoading(true);
    try {
      const payload = {
        ...vehicleData,
        make: selectedMake ? (isObjectId(selectedMake._id) ? selectedMake._id : selectedMake.name) : vehicleData.make,
        makeName: selectedMake?.name || vehicleData.makeName || '',
        model: selectedModel ? (isObjectId(selectedModel._id) ? selectedModel._id : selectedModel.name) : vehicleData.model,
        modelName: selectedModel?.name || vehicleData.modelName || '',
        year: Number(vehicleData.year) || vehicleData.year,
        capacity: {
          ...(vehicleData.capacity || {}),
          weight: {
            ...(vehicleData.capacity?.weight || {}),
            value: Number(vehicleData.capacity?.weight?.value) || 0,
            unit: 'tonnes'
          }
        }
      };
      const response = await apiService.updateVehicle(vehicleId, payload);
      
      if (response.success) {
        Alert.alert('Vehicle saved', response.message || 'Vehicle updated successfully', [
          { 
            text: 'OK', 
            onPress: () => navigation.navigate('VehicleDetails', { vehicleId }) 
          }
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to update vehicle');
      }
    } catch (error) {
      console.error('Update vehicle error:', error);
      Alert.alert('Error', error.message || 'Failed to update vehicle. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      const response = await apiService.updateVehicleStatus(vehicleId, newStatus);
      if (response.success) {
        updateField('status', newStatus);
        Alert.alert('Success', `Vehicle status updated to ${newStatus.replace('_', ' ')}`);
      } else {
        Alert.alert('Error', response.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Update status error:', error);
      Alert.alert('Error', 'Failed to update status');
    }
  };

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Edit Vehicle</Text>
        <Text style={styles.headerSubtitle}>Update vehicle information</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Status Update */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Status</Text>
          <View style={styles.statusGrid}>
            {statusOptions.map((status) => (
              <TouchableOpacity
                key={status.value}
                style={[
                  styles.statusButton,
                  vehicleData.status === status.value && styles.statusButtonSelected,
                  { borderColor: status.color }
                ]}
                onPress={() => handleStatusUpdate(status.value)}
              >
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[
                  styles.statusButtonText,
                  vehicleData.status === status.value && styles.statusButtonTextSelected
                ]}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Vehicle Details */}
        <Text style={styles.sectionTitle}>Vehicle Information</Text>

        <View style={styles.form}>
          {/* Registration Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Registration Number *</Text>
            <TextInput
              style={styles.input}
              value={vehicleData.registrationNumber}
              onChangeText={(value) => updateField('registrationNumber', value)}
              placeholder="ABC 1234"
            />
          </View>

          {/* Make and Model */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Make *</Text>
              <TouchableOpacity style={styles.selectInput} onPress={() => setShowMakeModal(true)}>
                <Text style={selectedMake ? styles.selectInputText : styles.selectInputPlaceholder}>
                  {selectedMake?.name || vehicleData.makeName || 'Select make'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Model *</Text>
              <TouchableOpacity
                style={[styles.selectInput, !selectedMake && styles.selectInputDisabled]}
                onPress={() => selectedMake && setShowModelModal(true)}
                disabled={!selectedMake}
              >
                <Text style={selectedModel ? styles.selectInputText : styles.selectInputPlaceholder}>
                  {selectedModel?.name || vehicleData.modelName || (selectedMake ? 'Select model' : 'Select make first')}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Year and Capacity */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Year *</Text>
              <TextInput
                style={styles.input}
                value={vehicleData.year?.toString()}
                onChangeText={(value) => updateField('year', value)}
                placeholder="2020"
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Capacity (tonnes) *</Text>
              <TextInput
                style={styles.input}
                value={vehicleData.capacity?.weight?.value?.toString()}
                onChangeText={(value) => updateField('capacity.weight.value', value)}
                placeholder="7"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Color */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Color</Text>
            <TextInput
              style={styles.input}
              value={vehicleData.color}
              onChangeText={(value) => updateField('color', value)}
              placeholder="White"
            />
          </View>

          {/* Specifications */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Engine Type</Text>
            <View style={styles.pickerContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['diesel', 'petrol', 'electric', 'hybrid'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerOption,
                      vehicleData.specifications?.engineType === type && styles.pickerOptionSelected
                    ]}
                    onPress={() => updateField('specifications.engineType', type)}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      vehicleData.specifications?.engineType === type && styles.pickerOptionTextSelected
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Transmission</Text>
            <View style={styles.pickerContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {['manual', 'automatic'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.pickerOption,
                      vehicleData.specifications?.transmission === type && styles.pickerOptionSelected
                    ]}
                    onPress={() => updateField('specifications.transmission', type)}
                  >
                    <Text style={[
                      styles.pickerOptionText,
                      vehicleData.specifications?.transmission === type && styles.pickerOptionTextSelected
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {/* Fuel Capacity and Mileage */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Fuel Capacity (L)</Text>
              <TextInput
                style={styles.input}
                value={vehicleData.specifications?.fuelCapacity?.toString()}
                onChangeText={(value) => updateField('specifications.fuelCapacity', value)}
                placeholder="80"
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Mileage (km)</Text>
              <TextInput
                style={styles.input}
                value={vehicleData.specifications?.mileage?.toString()}
                onChangeText={(value) => updateField('specifications.mileage', value)}
                placeholder="150000"
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* Special Features */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Special Features</Text>
            <View style={styles.featuresGrid}>
              {specialFeatures.map((feature) => (
                <TouchableOpacity
                  key={feature}
                  style={[
                    styles.featureButton,
                    vehicleData.specialFeatures?.includes(feature) && styles.featureButtonSelected
                  ]}
                  onPress={() => toggleFeature(feature)}
                >
                  <Text style={[
                    styles.featureText,
                    vehicleData.specialFeatures?.includes(feature) && styles.featureTextSelected
                  ]}>
                    {vehicleData.specialFeatures?.includes(feature) ? '✓ ' : ''}{feature}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Rental Availability */}
          <View style={styles.inputGroup}>
            <View style={styles.switchContainer}>
              <Text style={styles.label}>Make Available for Rental</Text>
              <Switch
                value={vehicleData.pricing?.availableForRental}
                onValueChange={(value) => updateField('pricing.availableForRental', value)}
                trackColor={{ false: '#767577', true: '#0C2D48' }}
                thumbColor={vehicleData.pricing?.availableForRental ? '#F37021' : '#f4f3f4'}
              />
            </View>
          </View>

          {vehicleData.pricing?.availableForRental && (
            <>
              <Text style={styles.subSectionTitle}>Rental Pricing</Text>
              
              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.flex]}>
                  <Text style={styles.label}>Daily Rate ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={vehicleData.pricing?.dailyRate?.toString()}
                    onChangeText={(value) => updateField('pricing.dailyRate', value)}
                    placeholder="80"
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputGroup, styles.flex]}>
                  <Text style={styles.label}>Weekly Rate ($)</Text>
                  <TextInput
                    style={styles.input}
                    value={vehicleData.pricing?.weeklyRate?.toString()}
                    onChangeText={(value) => updateField('pricing.weeklyRate', value)}
                    placeholder="500"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Monthly Rate ($)</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleData.pricing?.monthlyRate?.toString()}
                  onChangeText={(value) => updateField('pricing.monthlyRate', value)}
                  placeholder="1800"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Security Deposit ($)</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleData.pricing?.deposit?.toString()}
                  onChangeText={(value) => updateField('pricing.deposit', value)}
                  placeholder="200"
                  keyboardType="numeric"
                />
              </View>
            </>
          )}

          {/* Description */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={vehicleData.description}
              onChangeText={(value) => updateField('description', value)}
              placeholder="Additional details about the vehicle..."
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => navigation.goBack()}
            disabled={loading}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.actionButton, styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Updating Vehicle...' : 'Update Vehicle'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal visible={showMakeModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowMakeModal(false)}>
        <SafeAreaView edges={['top','left','right','bottom']} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Vehicle Make</Text>
            <TouchableOpacity onPress={() => setShowMakeModal(false)}>
              <MaterialIcons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={vehicleMakes}
            keyExtractor={(item) => referenceKey(item, 'make')}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, selectedMake?._id === item._id && styles.modalItemSelected]}
                onPress={() => selectMake(item)}
              >
                <Text style={styles.modalItemText}>{item.name}</Text>
                {!!item.country && <Text style={styles.modalItemSubtext}>{item.country}</Text>}
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyModalText}>No vehicle makes available. Seed vehicle reference data from the admin portal.</Text>}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={showModelModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModelModal(false)}>
        <SafeAreaView edges={['top','left','right','bottom']} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Model</Text>
            <TouchableOpacity onPress={() => setShowModelModal(false)}>
              <MaterialIcons name="close" size={24} color="#374151" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={vehicleModels}
            keyExtractor={(item) => referenceKey(item, 'model')}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.modalItem, selectedModel?._id === item._id && styles.modalItemSelected]}
                onPress={() => selectModel(item)}
              >
                <Text style={styles.modalItemText}>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={styles.emptyModalText}>No models are available for {selectedMake?.name || 'this make'}.</Text>}
          />
        </SafeAreaView>
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
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
    marginLeft: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.8,
  },
  content: {
    flex: 1,
    padding: 20,
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
    marginTop: 8,
    marginBottom: 16,
  },
  subSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 8,
    marginBottom: 12,
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  statusButtonSelected: {
    backgroundColor: '#f0f9ff',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusButtonText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  statusButtonTextSelected: {
    color: '#0C2D48',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  selectInput: {
    minHeight: 48,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectInputDisabled: {
    backgroundColor: '#f3f4f6',
    opacity: 0.75,
  },
  selectInputText: {
    flex: 1,
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  selectInputPlaceholder: {
    flex: 1,
    color: '#6b7280',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  modalHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
  },
  modalItem: {
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eef2f7',
  },
  modalItemSelected: {
    backgroundColor: '#e8f4fb',
  },
  modalItemText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  modalItemSubtext: {
    marginTop: 2,
    fontSize: 13,
    color: '#6b7280',
  },
  emptyModalText: {
    padding: 20,
    color: '#6b7280',
    fontSize: 15,
    lineHeight: 22,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  pickerContainer: {
    marginTop: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    marginRight: 8,
  },
  pickerOptionSelected: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  pickerOptionTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  featureButtonSelected: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  featureText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  featureTextSelected: {
    color: 'white',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
    marginBottom: 40,
  },
  actionButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#0C2D48',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default EditVehicleScreen;
