import React, { useState } from 'react';
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
  Switch
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import apiService from '../../services/apiService';

const AddVehicleScreen = () => {
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
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
        unit: 'kg'
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
    
    description: ''
  });

  const categories = [
    { value: 'bakkie', label: 'Bakkie / Van', icon: '🚐', description: 'Light delivery vehicles' },
    { value: 'truck', label: 'Truck', icon: '🚚', description: 'Standard cargo trucks' },
    { value: 'tractor', label: 'Truck Tractor', icon: '🚛', description: 'With or without trailer' }
  ];

  const bakkieTypes = [
    { value: 'single_cab', label: 'Single Cab Bakkie', capacity: '1-1.5 tonnes' },
    { value: 'double_cab', label: 'Double Cab Bakkie', capacity: '1-2 tonnes' },
    { value: 'panel_van', label: 'Panel Van', capacity: '1-2 tonnes' },
    { value: 'delivery_van', label: 'Delivery Van', capacity: '2-3 tonnes' }
  ];

  const truckTypes = [
    { value: '3ton', label: '3-Tonne Truck', capacity: '3 tonnes' },
    { value: '5ton', label: '5-Tonne Truck', capacity: '5 tonnes' },
    { value: '7ton', label: '7-Tonne Truck', capacity: '7 tonnes' },
    { value: '10ton', label: '10-Tonne Truck', capacity: '10 tonnes' },
    { value: '15ton', label: '15-Tonne Truck', capacity: '15 tonnes' }
  ];

  const trailerTypes = [
    { value: 'flatbed', label: 'Flatbed Trailer', description: 'Open platform, versatile' },
    { value: 'enclosed', label: 'Enclosed Trailer', description: 'Covered box trailer' },
    { value: 'refrigerated', label: 'Refrigerated Trailer', description: 'Temperature controlled' },
    { value: 'tanker', label: 'Tanker Trailer', description: 'Liquid transport' },
    { value: 'tipper', label: 'Tipper Trailer', description: 'Hydraulic tipping' },
    { value: 'lowbed', label: 'Lowbed Trailer', description: 'Heavy equipment' },
    { value: 'livestock', label: 'Livestock Trailer', description: 'Animal transport' },
    { value: 'car_carrier', label: 'Car Carrier', description: 'Vehicle transport' }
  ];

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

  const updateField = (path, value) => {
    setVehicleData(prev => {
      const keys = path.split('.');
      const lastKey = keys.pop();
      const lastObj = keys.reduce((obj, key) => obj[key] || {}, prev);
      lastObj[lastKey] = value;
      return { ...prev };
    });
  };

  const toggleFeature = (feature) => {
    setVehicleData(prev => ({
      ...prev,
      specialFeatures: prev.specialFeatures.includes(feature)
        ? prev.specialFeatures.filter(f => f !== feature)
        : [...prev.specialFeatures, feature]
    }));
  };

  const handleCategorySelect = (category) => {
    updateField('category', category);
    setStep(2);
  };

  const handleTypeSelect = (type) => {
    updateField('subType', type);
    
    // Set default capacity based on type
    if (vehicleData.category === 'tractor' && vehicleData.hasTrailer) {
      updateField('capacity.weight.value', '15');
    } else {
      const capacityMap = {
        'single_cab': '1.5', 'double_cab': '2', 'panel_van': '2', 'delivery_van': '3',
        '3ton': '3', '5ton': '5', '7ton': '7', '10ton': '10', '15ton': '15'
      };
      updateField('capacity.weight.value', capacityMap[type] || '');
    }
    
    setStep(4);
  };

  const validateStep = (step) => {
    switch (step) {
      case 4:
        return vehicleData.registrationNumber && vehicleData.make && vehicleData.model && 
               vehicleData.year && vehicleData.capacity.weight.value;
      default:
        return true;
    }
  };

   const handleSubmit = async () => {
    if (!validateStep(4)) {
      Alert.alert('Validation Error', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.createVehicle(vehicleData);
      
      if (response.success) {
        Alert.alert('Success', 'Vehicle added successfully', [
          { text: 'OK', onPress: () => navigation.navigate('FleetDashboard') }
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to add vehicle');
      }
    } catch (error) {
      console.error('Add vehicle error:', error);
      Alert.alert('Error', 'Failed to add vehicle. Please try again.');
    } finally {
      setLoading(false);
    }
  };



  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Vehicle Category</Text>
      <View style={styles.optionsGrid}>
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.value}
            style={styles.optionCard}
            onPress={() => handleCategorySelect(cat.value)}
          >
            <Text style={styles.optionIcon}>{cat.icon}</Text>
            <Text style={styles.optionTitle}>{cat.label}</Text>
            <Text style={styles.optionDescription}>{cat.description}</Text>
            <MaterialIcons name="chevron-right" size={20} color="#6b7280" />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>
        {vehicleData.category === 'tractor' ? 'Truck Tractor Setup' : 
         vehicleData.category === 'bakkie' ? 'Bakkie/Van Type' : 'Truck Type'}
      </Text>

      {vehicleData.category === 'tractor' ? (
        <View style={styles.optionsGrid}>
          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => {
              updateField('hasTrailer', true);
              setStep(3);
            }}
          >
            <Text style={styles.optionIcon}>🚛</Text>
            <Text style={styles.optionTitle}>With Trailer</Text>
            <Text style={styles.optionDescription}>Truck tractor with trailer attached</Text>
            <MaterialIcons name="chevron-right" size={20} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.optionCard}
            onPress={() => {
              updateField('hasTrailer', false);
              setStep(4);
            }}
          >
            <Text style={styles.optionIcon}>🚜</Text>
            <Text style={styles.optionTitle}>Tractor Only</Text>
            <Text style={styles.optionDescription}>Can rent/borrow trailer when needed</Text>
            <MaterialIcons name="chevron-right" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.optionsGrid}>
          {(vehicleData.category === 'bakkie' ? bakkieTypes : truckTypes).map((type) => (
            <TouchableOpacity
              key={type.value}
              style={styles.optionCard}
              onPress={() => handleTypeSelect(type.value)}
            >
              <Text style={styles.optionTitle}>{type.label}</Text>
              <Text style={styles.optionDescription}>Capacity: {type.capacity}</Text>
              <MaterialIcons name="chevron-right" size={20} color="#6b7280" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderStep3 = () => (
    <ScrollView style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Trailer Type</Text>
      <View style={styles.optionsGrid}>
        {trailerTypes.map((trailer) => (
          <TouchableOpacity
            key={trailer.value}
            style={styles.optionCard}
            onPress={() => {
              updateField('trailerType', trailer.value);
              setStep(4);
            }}
          >
            <Text style={styles.optionTitle}>{trailer.label}</Text>
            <Text style={styles.optionDescription}>{trailer.description}</Text>
            <MaterialIcons name="chevron-right" size={20} color="#6b7280" />
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderStep4 = () => (
    <ScrollView style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Vehicle Details</Text>

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
            <TextInput
              style={styles.input}
              value={vehicleData.make}
              onChangeText={(value) => updateField('make', value)}
              placeholder="Toyota"
            />
          </View>
          <View style={[styles.inputGroup, styles.flex]}>
            <Text style={styles.label}>Model *</Text>
            <TextInput
              style={styles.input}
              value={vehicleData.model}
              onChangeText={(value) => updateField('model', value)}
              placeholder="Hilux"
            />
          </View>
        </View>

        {/* Year and Capacity */}
        <View style={styles.row}>
          <View style={[styles.inputGroup, styles.flex]}>
            <Text style={styles.label}>Year *</Text>
            <TextInput
              style={styles.input}
              value={vehicleData.year}
              onChangeText={(value) => updateField('year', value)}
              placeholder="2020"
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputGroup, styles.flex]}>
            <Text style={styles.label}>Capacity (tonnes) *</Text>
            <TextInput
              style={styles.input}
              value={vehicleData.capacity.weight.value}
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

        {/* Special Features */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Special Features</Text>
          <View style={styles.featuresGrid}>
            {specialFeatures.map((feature) => (
              <TouchableOpacity
                key={feature}
                style={[
                  styles.featureButton,
                  vehicleData.specialFeatures.includes(feature) && styles.featureButtonSelected
                ]}
                onPress={() => toggleFeature(feature)}
              >
                <Text style={[
                  styles.featureText,
                  vehicleData.specialFeatures.includes(feature) && styles.featureTextSelected
                ]}>
                  {vehicleData.specialFeatures.includes(feature) ? '✓ ' : ''}{feature}
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
              value={vehicleData.pricing.availableForRental}
              onValueChange={(value) => updateField('pricing.availableForRental', value)}
              trackColor={{ false: '#767577', true: '#0C2D48' }}
              thumbColor={vehicleData.pricing.availableForRental ? '#F37021' : '#f4f3f4'}
            />
          </View>
        </View>

        {vehicleData.pricing.availableForRental && (
          <>
            <Text style={styles.sectionTitle}>Rental Pricing</Text>
            
            <View style={styles.row}>
              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Daily Rate ($)</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleData.pricing.dailyRate}
                  onChangeText={(value) => updateField('pricing.dailyRate', value)}
                  placeholder="80"
                  keyboardType="numeric"
                />
              </View>
              <View style={[styles.inputGroup, styles.flex]}>
                <Text style={styles.label}>Weekly Rate ($)</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleData.pricing.weeklyRate}
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
                value={vehicleData.pricing.monthlyRate}
                onChangeText={(value) => updateField('pricing.monthlyRate', value)}
                placeholder="1800"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Security Deposit ($)</Text>
              <TextInput
                style={styles.input}
                value={vehicleData.pricing.deposit}
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

      <TouchableOpacity
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={loading}
      >
        <Text style={styles.submitButtonText}>
          {loading ? 'Adding Vehicle...' : 'Add Vehicle'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => step > 1 ? setStep(step - 1) : navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        
        <View>
          <Text style={styles.headerTitle}>Add Vehicle</Text>
          <Text style={styles.headerSubtitle}>Step {step} of 4</Text>
        </View>

        <View style={styles.progressBar}>
          {[1, 2, 3, 4].map(s => (
            <View
              key={s}
              style={[
                styles.progressStep,
                s <= step && styles.progressStepActive
              ]}
            />
          ))}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
      </View>
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
    marginBottom: 16,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 4,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: '#1e4d7a',
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#60a5fa',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
    padding: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
  },
  optionsGrid: {
    gap: 12,
    paddingBottom: 20, // Add padding to ensure content doesn't get cut off
  },
  optionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  optionDescription: {
    fontSize: 14,
    color: '#6b7280',
    flex: 2,
  },
  form: {
    gap: 16,
    paddingBottom: 20, // Add padding for the submit button
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 8,
    marginBottom: 12,
  },
  submitButton: {
    backgroundColor: '#0C2D48',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40, // Extra margin for better scrolling
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

export default AddVehicleScreen;