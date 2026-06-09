// src/screens/transporter/EditDriverScreen.js
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
  Alert
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiService from '../../services/apiService';

const EditDriverScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const { driverId } = route.params;

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
    },
    status: 'available'
  });

  const licenseClasses = ['A', 'B', 'C', 'D', 'E', 'EC'];
  const specializations = ['local', 'cross_border', 'hazardous', 'refrigerated', 'heavy_haulage'];
  const employmentTypes = ['full_time', 'part_time', 'contract', 'freelance'];
  const salaryPeriods = ['hourly', 'daily', 'weekly', 'monthly'];

  const statusOptions = [
    { value: 'available', label: 'Available', color: '#16a34a' },
    { value: 'on_duty', label: 'On Duty', color: '#0C2D48' },
    { value: 'on_leave', label: 'On Leave', color: '#f59e0b' },
    { value: 'suspended', label: 'Suspended', color: '#dc2626' },
    { value: 'inactive', label: 'Inactive', color: '#6b7280' }
  ];

  useEffect(() => {
    loadDriverData();
  }, [driverId]);

  const loadDriverData = async () => {
    try {
      const response = await apiService.getDriver(driverId);
      if (response.success) {
        setDriverData(response.data);
      } else {
        Alert.alert('Error', 'Failed to load driver data');
        navigation.goBack();
      }
    } catch (error) {
      console.error('Load driver error:', error);
      Alert.alert('Error', 'Failed to load driver data');
      navigation.goBack();
    }
  };

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
      const response = await apiService.updateDriver(driverId, driverData);
      
      if (response.success) {
        Alert.alert('Success', 'Driver updated successfully', [
          { 
            text: 'OK', 
            onPress: () => navigation.navigate('DriverDetails', { driverId }) 
          }
        ]);
      } else {
        Alert.alert('Error', response.message || 'Failed to update driver');
      }
    } catch (error) {
      console.error('Update driver error:', error);
      Alert.alert('Error', 'Failed to update driver. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    try {
      const response = await apiService.updateDriverStatus(driverId, newStatus);
      if (response.success) {
        updateField('status', newStatus);
        Alert.alert('Success', `Driver status updated to ${newStatus.replace('_', ' ')}`);
      } else {
        Alert.alert('Error', response.message || 'Failed to update status');
      }
    } catch (error) {
      console.error('Update status error:', error);
      Alert.alert('Error', 'Failed to update status');
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
        
        <Text style={styles.headerTitle}>Edit Driver</Text>
        <Text style={styles.headerSubtitle}>Update driver information</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Status Update */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Driver Status</Text>
          <View style={styles.statusGrid}>
            {statusOptions.map((status) => (
              <TouchableOpacity
                key={status.value}
                style={[
                  styles.statusButton,
                  driverData.status === status.value && styles.statusButtonSelected,
                  { borderColor: status.color }
                ]}
                onPress={() => handleStatusUpdate(status.value)}
              >
                <View style={[styles.statusDot, { backgroundColor: status.color }]} />
                <Text style={[
                  styles.statusButtonText,
                  driverData.status === status.value && styles.statusButtonTextSelected
                ]}>
                  {status.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

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
              value={driverData.address?.street}
              onChangeText={(value) => updateField('address.street', value)}
              placeholder="Street Address"
            />
            <View style={styles.row}>
              <TextInput
                style={[styles.input, styles.flex]}
                value={driverData.address?.city}
                onChangeText={(value) => updateField('address.city', value)}
                placeholder="City"
              />
              <TextInput
                style={[styles.input, styles.flex]}
                value={driverData.address?.state}
                onChangeText={(value) => updateField('address.state', value)}
                placeholder="State/Province"
              />
            </View>
            <TextInput
              style={styles.input}
              value={driverData.address?.zipCode}
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
              value={driverData.experience?.toString()}
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
                  driverData.specialization?.includes(spec) && styles.specializationButtonSelected
                ]}
                onPress={() => toggleSpecialization(spec)}
              >
                <Text style={[
                  styles.specializationText,
                  driverData.specialization?.includes(spec) && styles.specializationTextSelected
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
              <Text style={styles.label}>Employment Type</Text>
              <View style={styles.pickerContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {employmentTypes.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.pickerOption,
                        driverData.employmentType === type && styles.pickerOptionSelected
                      ]}
                      onPress={() => updateField('employmentType', type)}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        driverData.employmentType === type && styles.pickerOptionTextSelected
                      ]}>
                        {type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Salary Amount</Text>
              <TextInput
                style={styles.input}
                value={driverData.salary?.amount?.toString()}
                onChangeText={(value) => updateField('salary.amount', value)}
                placeholder="1000"
                keyboardType="numeric"
              />
            </View>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Pay Period</Text>
              <View style={styles.pickerContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {salaryPeriods.map((period) => (
                    <TouchableOpacity
                      key={period}
                      style={[
                        styles.pickerOption,
                        driverData.salary?.period === period && styles.pickerOptionSelected
                      ]}
                      onPress={() => updateField('salary.period', period)}
                    >
                      <Text style={[
                        styles.pickerOptionText,
                        driverData.salary?.period === period && styles.pickerOptionTextSelected
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
              value={driverData.emergencyContact?.name}
              onChangeText={(value) => updateField('emergencyContact.name', value)}
              placeholder="Sarah Moyo"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Relationship</Text>
              <TextInput
                style={styles.input}
                value={driverData.emergencyContact?.relationship}
                onChangeText={(value) => updateField('emergencyContact.relationship', value)}
                placeholder="Spouse"
              />
            </View>
            <View style={[styles.inputGroup, styles.flex]}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={driverData.emergencyContact?.phone}
                onChangeText={(value) => updateField('emergencyContact.phone', value)}
                placeholder="+263 77 987 6543"
                keyboardType="phone-pad"
              />
            </View>
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
              {loading ? 'Updating Driver...' : 'Update Driver'}
            </Text>
          </TouchableOpacity>
        </View>
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

export default EditDriverScreen;