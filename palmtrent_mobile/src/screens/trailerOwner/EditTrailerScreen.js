import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  Switch,
  Modal,
  FlatList
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const EditTrailerScreen = ({ navigation, route }) => {
  const { trailer, onSave } = route.params || {};
  
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    type: 'Flatbed',
    capacity: '',
    licensePlate: '',
    vin: '',
    make: '',
    model: '',
    year: '',
    condition: 'Excellent',
    features: [],
    dailyRate: '',
    weeklyRate: '',
    monthlyRate: '',
    status: 'available',
    location: '',
    currentRental: null,
    maintenanceHistory: []
  });

  const [loading, setLoading] = useState(true);
  const [isModified, setIsModified] = useState(false);
  const [showFeatureModal, setShowFeatureModal] = useState(false);
  const [newFeature, setNewFeature] = useState('');

  // Common trailer types and conditions
  const trailerTypes = ['Flatbed', 'Refrigerated', 'Tanker', 'Dry Van', 'Lowboy', 'Step Deck', 'Double Drop'];
  const conditions = ['Excellent', 'Good', 'Fair', 'Needs Maintenance'];
  const statusOptions = ['available', 'rented', 'maintenance'];
  
  // Common features
  const commonFeatures = [
    'GPS Tracking',
    'ABS Brakes',
    'Tarpaulin Cover',
    'Refrigeration Unit',
    'Lift Gate',
    'Side Doors',
    'Temperature Control',
    'Alarm System',
    'Camera System',
    'Weight Sensors'
  ];

  useEffect(() => {
    if (trailer) {
      setFormData({
        id: trailer.id || '',
        name: trailer.name || '',
        type: trailer.type || 'Flatbed',
        capacity: trailer.capacity || '',
        licensePlate: trailer.licensePlate || '',
        vin: trailer.vin || '',
        make: trailer.make || '',
        model: trailer.model || '',
        year: trailer.year || '',
        condition: trailer.condition || 'Excellent',
        features: trailer.features || [],
        dailyRate: trailer.dailyRate?.toString() || '',
        weeklyRate: trailer.weeklyRate?.toString() || '',
        monthlyRate: trailer.monthlyRate?.toString() || '',
        status: trailer.status || 'available',
        location: trailer.location || '',
        currentRental: trailer.currentRental || null,
        maintenanceHistory: trailer.maintenanceHistory || []
      });
    }
    setLoading(false);
  }, [trailer]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setIsModified(true);
  };

  const handleFeatureToggle = (feature) => {
    setFormData(prev => {
      const currentFeatures = [...prev.features];
      const featureIndex = currentFeatures.indexOf(feature);
      
      if (featureIndex > -1) {
        // Remove feature
        currentFeatures.splice(featureIndex, 1);
      } else {
        // Add feature
        currentFeatures.push(feature);
      }
      
      return {
        ...prev,
        features: currentFeatures
      };
    });
    setIsModified(true);
  };

  const addCustomFeature = () => {
    if (newFeature.trim() && !formData.features.includes(newFeature.trim())) {
      setFormData(prev => ({
        ...prev,
        features: [...prev.features, newFeature.trim()]
      }));
      setNewFeature('');
      setIsModified(true);
    }
  };

  const removeFeature = (featureToRemove) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.filter(feature => feature !== featureToRemove)
    }));
    setIsModified(true);
  };

  const handleSave = () => {
    // Basic validation
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Please enter a trailer name');
      return;
    }

    if (!formData.licensePlate.trim()) {
      Alert.alert('Validation Error', 'Please enter a license plate');
      return;
    }

    if (!formData.vin.trim()) {
      Alert.alert('Validation Error', 'Please enter a VIN');
      return;
    }

    // Convert rates to numbers
    const updatedData = {
      ...formData,
      dailyRate: parseFloat(formData.dailyRate) || 0,
      weeklyRate: parseFloat(formData.weeklyRate) || 0,
      monthlyRate: parseFloat(formData.monthlyRate) || 0,
    };

    // Pass the updated data back
    if (onSave) {
      onSave(updatedData);
    }

    // Also pass via navigation params
    navigation.navigate({
      name: 'TrailerDetail',
      params: { trailer: updatedData },
      merge: true
    });

    Alert.alert('Success', 'Trailer details updated successfully');
    setIsModified(false);
  };

  const handleCancel = () => {
    if (isModified) {
      Alert.alert(
        'Unsaved Changes',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Stay', style: 'cancel' },
          { text: 'Discard', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return '#16a34a';
      case 'rented': return '#F37021';
      case 'maintenance': return '#dc2626';
      default: return '#6b7280';
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleCancel}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Trailer</Text>
        <TouchableOpacity 
          style={[styles.saveButton, !isModified && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!isModified}
        >
          <Text style={styles.saveButtonText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          
          {/* Basic Information */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Trailer Name *</Text>
              <TextInput
                style={styles.textInput}
                value={formData.name}
                onChangeText={(value) => handleInputChange('name', value)}
                placeholder="Enter trailer name"
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Type</Text>
                <View style={styles.pickerContainer}>
                  {trailerTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.pickerOption,
                        formData.type === type && styles.pickerOptionSelected
                      ]}
                      onPress={() => handleInputChange('type', type)}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        formData.type === type && styles.pickerOptionTextSelected
                      ]}>
                        {type}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Capacity</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.capacity}
                  onChangeText={(value) => handleInputChange('capacity', value)}
                  placeholder="e.g., 10 tonnes"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>License Plate *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.licensePlate}
                  onChangeText={(value) => handleInputChange('licensePlate', value)}
                  placeholder="e.g., ABC1234"
                  autoCapitalize="characters"
                />
              </View>

              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>VIN *</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.vin}
                  onChangeText={(value) => handleInputChange('vin', value)}
                  placeholder="Enter VIN"
                  autoCapitalize="characters"
                />
              </View>
            </View>
          </View>

          {/* Specifications */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Specifications</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Make</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.make}
                  onChangeText={(value) => handleInputChange('make', value)}
                  placeholder="e.g., Mercedes"
                />
              </View>

              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Model</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.model}
                  onChangeText={(value) => handleInputChange('model', value)}
                  placeholder="e.g., Actros"
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Year</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.year}
                  onChangeText={(value) => handleInputChange('year', value)}
                  placeholder="e.g., 2022"
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Condition</Text>
                <View style={styles.pickerContainer}>
                  {conditions.map((condition) => (
                    <TouchableOpacity
                      key={condition}
                      style={[
                        styles.pickerOption,
                        formData.condition === condition && styles.pickerOptionSelected
                      ]}
                      onPress={() => handleInputChange('condition', condition)}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        formData.condition === condition && styles.pickerOptionTextSelected
                      ]}>
                        {condition}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Location</Text>
              <TextInput
                style={styles.textInput}
                value={formData.location}
                onChangeText={(value) => handleInputChange('location', value)}
                placeholder="e.g., Bulawayo"
              />
            </View>
          </View>

          {/* Rental Rates */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Rental Rates (USD)</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Daily Rate</Text>
                <View style={styles.rateInputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={[styles.textInput, styles.rateInput]}
                    value={formData.dailyRate}
                    onChangeText={(value) => handleInputChange('dailyRate', value)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Weekly Rate</Text>
                <View style={styles.rateInputContainer}>
                  <Text style={styles.currencySymbol}>$</Text>
                  <TextInput
                    style={[styles.textInput, styles.rateInput]}
                    value={formData.weeklyRate}
                    onChangeText={(value) => handleInputChange('weeklyRate', value)}
                    placeholder="0"
                    keyboardType="numeric"
                  />
                </View>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Monthly Rate</Text>
              <View style={styles.rateInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={[styles.textInput, styles.rateInput]}
                  value={formData.monthlyRate}
                  onChangeText={(value) => handleInputChange('monthlyRate', value)}
                  placeholder="0"
                  keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {/* Features */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Features & Equipment</Text>
              <TouchableOpacity 
                style={styles.addButton}
                onPress={() => setShowFeatureModal(true)}
              >
                <MaterialIcons name="add" size={20} color="#0C2D48" />
                <Text style={styles.addButtonText}>Add Feature</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.featuresGrid}>
              {formData.features.map((feature, index) => (
                <View key={index} style={styles.featureTag}>
                  <Text style={styles.featureTagText}>{feature}</Text>
                  <TouchableOpacity 
                    onPress={() => removeFeature(feature)}
                    style={styles.removeFeatureButton}
                  >
                    <MaterialIcons name="close" size={16} color="#dc2626" />
                  </TouchableOpacity>
                </View>
              ))}
              {formData.features.length === 0 && (
                <Text style={styles.noFeaturesText}>No features added</Text>
              )}
            </View>
          </View>

          {/* Status */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Status</Text>
            <View style={styles.statusOptions}>
              {statusOptions.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[
                    styles.statusOption,
                    formData.status === status && { borderColor: getStatusColor(status) }
                  ]}
                  onPress={() => handleInputChange('status', status)}
                >
                  <View style={styles.statusOptionContent}>
                    <MaterialIcons 
                      name={
                        status === 'available' ? 'check-circle' :
                        status === 'rented' ? 'local-shipping' : 'build'
                      } 
                      size={20} 
                      color={getStatusColor(status)} 
                    />
                    <Text style={styles.statusOptionText}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Text>
                  </View>
                  {formData.status === status && (
                    <MaterialIcons name="check" size={20} color={getStatusColor(status)} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>

      {/* Features Modal */}
      <Modal
        visible={showFeatureModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add Features</Text>
            <TouchableOpacity 
              onPress={() => setShowFeatureModal(false)}
              style={styles.closeButton}
            >
              <MaterialIcons name="close" size={24} color="#1f2937" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {/* Custom Feature Input */}
            <View style={styles.customFeatureInput}>
              <TextInput
                style={[styles.textInput, styles.flex]}
                value={newFeature}
                onChangeText={setNewFeature}
                placeholder="Enter custom feature"
              />
              <TouchableOpacity 
                style={[styles.addCustomButton, !newFeature.trim() && styles.addCustomButtonDisabled]}
                onPress={addCustomFeature}
                disabled={!newFeature.trim()}
              >
                <Text style={styles.addCustomButtonText}>Add</Text>
              </TouchableOpacity>
            </View>

            {/* Common Features */}
            <Text style={styles.commonFeaturesTitle}>Common Features</Text>
            <FlatList
              data={commonFeatures}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.commonFeatureItem}
                  onPress={() => handleFeatureToggle(item)}
                >
                  <MaterialIcons 
                    name={formData.features.includes(item) ? "check-box" : "check-box-outline-blank"} 
                    size={24} 
                    color={formData.features.includes(item) ? "#0C2D48" : "#6b7280"} 
                  />
                  <Text style={styles.commonFeatureText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
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
    padding: 16,
    paddingTop: 45,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  saveButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
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
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: 'white',
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
  rateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginRight: 8,
  },
  rateInput: {
    flex: 1,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f9ff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#0C2D48',
  },
  addButtonText: {
    color: '#0C2D48',
    fontSize: 14,
    fontWeight: '500',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    gap: 6,
  },
  featureTagText: {
    fontSize: 14,
    color: '#374151',
  },
  removeFeatureButton: {
    padding: 2,
  },
  noFeaturesText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  statusOptions: {
    gap: 8,
  },
  statusOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  statusOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  bottomPadding: {
    height: 20,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  closeButton: {
    padding: 4,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  customFeatureInput: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  addCustomButton: {
    backgroundColor: '#0C2D48',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 6,
    justifyContent: 'center',
  },
  addCustomButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  addCustomButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  commonFeaturesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  commonFeatureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  commonFeatureText: {
    fontSize: 16,
    color: '#374151',
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default EditTrailerScreen;