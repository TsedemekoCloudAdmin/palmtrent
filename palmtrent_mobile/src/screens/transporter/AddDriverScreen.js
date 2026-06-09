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
  Alert
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import apiService from '../../services/apiService';

const AddDriverScreen = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [driverData, setDriverData] = useState({
    fullName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: ''
    },
    licenseNumber: '',
    licenseClass: '',
    licenseExpiry: '',
    experience: '',
    specialization: [],
    employmentType: 'full_time',
    salary: {
      amount: '',
      period: 'monthly'
    },
    emergencyContact: {
      name: '',
      relationship: '',
      phone: ''
    }
  });

  const licenseClasses = ['A', 'B', 'C', 'D', 'E', 'EC'];
  const specializations = ['local', 'cross_border', 'hazardous', 'refrigerated', 'heavy_haulage'];

  const updateField = (path, value) => {
    setDriverData(prev => {
      const keys = path.split('.');
      const lastKey = keys.pop();
      const lastObj = keys.reduce((obj, key) => obj[key] || {}, prev);
      lastObj[lastKey] = value;
      return { ...prev };
    });
  };

  const toggleSpecialization = (spec) => {
    setDriverData(prev => ({
      ...prev,
      specialization: prev.specialization.includes(spec)
        ? prev.specialization.filter(s => s !== spec)
        : [...prev.specialization, spec]
    }));
  };

  const validateForm = () => {
    const required = ['fullName', 'phone', 'licenseNumber', 'licenseClass', 'licenseExpiry'];
    for (let field of required) {
      if (!driverData[field]) {
        return `Please fill in ${field.replace(/([A-Z])/g, ' $1').toLowerCase()}`;
      }
    }
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
      const response = await apiService.createDriver(driverData);
      
      if (response.success) {
        Alert.alert('Success', 'Driver added successfully', [
          { text: 'OK', onPress: () => navigation.navigate('FleetDashboard') }
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to add driver');
      }
    } catch (error) {
      console.error('Add driver error:', error);
      Alert.alert('Error', 'Failed to add driver. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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
        
        <Text style={styles.headerTitle}>Add Driver</Text>
        <Text style={styles.headerSubtitle}>Register a new driver</Text>
      </View>

      <ScrollView style={styles.content}>
        <Text style={styles.sectionTitle}>Personal Information</Text>

        <View style={styles.form}>
          {/* Full Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={driverData.fullName}
              onChangeText={(value) => updateField('fullName', value)}
              placeholder="John Moyo"
            />
          </View>

          {/* Phone and Email */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                value={driverData.phone}
                onChangeText={(value) => updateField('phone', value)}
                placeholder="+263 77 123 4567"
                keyboardType="phone-pad"
              />
            </View>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                value={driverData.email}
                onChangeText={(value) => updateField('email', value)}
                placeholder="john@example.com"
                keyboardType="email-address"
              />
            </View>
          </View>

          {/* Date of Birth */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Date of Birth</Text>
            <TextInput
              style={styles.input}
              value={driverData.dateOfBirth}
              onChangeText={(value) => updateField('dateOfBirth', value)}
              placeholder="YYYY-MM-DD"
            />
          </View>

          {/* Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={styles.input}
              value={driverData.address.street}
              onChangeText={(value) => updateField('address.street', value)}
              placeholder="Street Address"
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex]}
                value={driverData.address.city}
                onChangeText={(value) => updateField('address.city', value)}
                placeholder="City"
              />
              <TextInput
                style={[styles.input, styles.flex]}
                value={driverData.address.state}
                onChangeText={(value) => updateField('address.state', value)}
                placeholder="State/Province"
              />
            </View>
            <TextInput
              style={styles.input}
              value={driverData.address.zipCode}
              onChangeText={(value) => updateField('address.zipCode', value)}
              placeholder="ZIP/Postal Code"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>License Information</Text>

        <View style={styles.form}>
          {/* License Details */}
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>License Number *</Text>
              <TextInput
                style={styles.input}
                value={driverData.licenseNumber}
                onChangeText={(value) => updateField('licenseNumber', value)}
                placeholder="DL123456789"
              />
            </View>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>License Class *</Text>
              <View style={styles.pickerContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {licenseClasses.map((licenseClass) => (
                    <TouchableOpacity
                      key={licenseClass}
                      style={[
                        styles.pickerOption,
                        driverData.licenseClass === licenseClass && styles.pickerOptionSelected
                      ]}
                      onPress={() => updateField('licenseClass', licenseClass)}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        driverData.licenseClass === licenseClass && styles.pickerOptionTextSelected
                      ]}>
                        Class {licenseClass}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>License Expiry *</Text>
            <TextInput
              style={styles.input}
              value={driverData.licenseExpiry}
              onChangeText={(value) => updateField('licenseExpiry', value)}
              placeholder="YYYY-MM-DD"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Driving Experience (years)</Text>
            <TextInput
              style={styles.input}
              value={driverData.experience}
              onChangeText={(value) => updateField('experience', value)}
              placeholder="5"
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>Specialization</Text>

        <View style={styles.form}>
          <View style={styles.specializationGrid}>
            {specializations.map((spec) => (
              <TouchableOpacity
                key={spec}
                style={[
                  styles.specializationButton,
                  driverData.specialization.includes(spec) && styles.specializationButtonSelected
                ]}
                onPress={() => toggleSpecialization(spec)}
              >
                <Text style={[
                  styles.specializationText,
                  driverData.specialization.includes(spec) && styles.specializationTextSelected
                ]}>
                  {spec.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Text style={styles.sectionTitle}>Employment Details</Text>

        <View style={styles.form}>
          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Salary Amount</Text>
              <TextInput
                style={styles.input}
                value={driverData.salary.amount}
                onChangeText={(value) => updateField('salary.amount', value)}
                placeholder="1000"
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Pay Period</Text>
              <View style={styles.pickerContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {['hourly', 'daily', 'weekly', 'monthly'].map((period) => (
                    <TouchableOpacity
                      key={period}
                      style={[
                        styles.pickerOption,
                        driverData.salary.period === period && styles.pickerOptionSelected
                      ]}
                      onPress={() => updateField('salary.period', period)}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        driverData.salary.period === period && styles.pickerOptionTextSelected
                      ]}>
                        {period.charAt(0).toUpperCase() + period.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Emergency Contact</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contact Name</Text>
            <TextInput
              style={styles.input}
              value={driverData.emergencyContact.name}
              onChangeText={(value) => updateField('emergencyContact.name', value)}
              placeholder="Sarah Moyo"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Relationship</Text>
              <TextInput
                style={styles.input}
                value={driverData.emergencyContact.relationship}
                onChangeText={(value) => updateField('emergencyContact.relationship', value)}
                placeholder="Spouse"
              />
            </View>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={driverData.emergencyContact.phone}
                onChangeText={(value) => updateField('emergencyContact.phone', value)}
                placeholder="+263 77 987 6543"
                keyboardType="phone-pad"
              />
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? 'Adding Driver...' : 'Add Driver'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 12,
  },
  form: {
    gap: 16,
    marginBottom: 8,
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
  specializationGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  specializationButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
  },
  specializationButtonSelected: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  specializationText: {
    fontSize: 14,
    color: '#374151',
  },
  specializationTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#0C2D48',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
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

export default AddDriverScreen;