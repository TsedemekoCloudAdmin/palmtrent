// screens/MultipleVehiclesBooking.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  TextInput,
  StyleSheet
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const MultipleVehiclesBooking = ({ onNavigate, bookingData, updateBookingData }) => {
  const [vehicles, setVehicles] = useState(
    bookingData.vehicles.length > 0 ? bookingData.vehicles : [
      { id: 1, type: '', weight: '', description: '' }
    ]
  );
  const [coordination, setCoordination] = useState(bookingData.coordination || 'any');

  const vehicleTypes = [
    { value: 'bakkie', label: 'Bakkie (1-2 tonnes)' },
    { value: '3ton', label: '3-Tonne Truck' },
    { value: '5ton', label: '5-Tonne Truck' },
    { value: '7ton', label: '7-Tonne Truck' },
    { value: '10ton', label: '10-Tonne Truck' },
    { value: 'trailer', label: 'Truck Tractor with Trailer' }
  ];

  const addVehicle = () => {
    const newVehicle = {
      id: Date.now(),
      type: '',
      weight: '',
      description: ''
    };
    setVehicles([...vehicles, newVehicle]);
  };

  const removeVehicle = (id) => {
    if (vehicles.length > 1) {
      setVehicles(vehicles.filter(v => v.id !== id));
    }
  };

  const updateVehicle = (id, field, value) => {
    const updatedVehicles = vehicles.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    );
    setVehicles(updatedVehicles);
  };

  const handleContinue = () => {
    updateBookingData({
      vehicles: vehicles,
      coordination: coordination,
      bookingType: 'multiple'
    });
    onNavigate('create-booking');
  };

  const totalDiscount = vehicles.length >= 5 ? 15 : vehicles.length >= 3 ? 10 : 0;
  const baseTotal = vehicles.length * 400;
  const discountAmount = (baseTotal * totalDiscount) / 100;
  const finalTotal = baseTotal - discountAmount;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => onNavigate('booking-start')} 
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Multiple Vehicles</Text>
          <Text style={styles.headerSubtitle}>
            {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} • {totalDiscount}% discount
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Discount Banner */}
          {totalDiscount > 0 && (
            <View style={styles.discountBanner}>
              <MaterialIcons name="trending-up" size={24} color="white" />
              <View style={styles.discountContent}>
                <Text style={styles.discountTitle}>Volume Discount Active!</Text>
                <Text style={styles.discountSubtitle}>Save {totalDiscount}% on all vehicles</Text>
              </View>
            </View>
          )}

          {/* Vehicles List */}
          <View style={styles.vehiclesContainer}>
            {vehicles.map((vehicle, index) => (
              <View key={vehicle.id} style={styles.vehicleCard}>
                <View style={styles.vehicleHeader}>
                  <Text style={styles.vehicleNumber}>Vehicle {index + 1}</Text>
                  {vehicles.length > 1 && (
                    <TouchableOpacity
                      onPress={() => removeVehicle(vehicle.id)}
                      style={styles.removeButton}
                    >
                      <MaterialIcons name="delete" size={20} color="#F37021" />
                    </TouchableOpacity>
                  )}
                </View>

                <View style={styles.vehicleForm}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Vehicle Type *</Text>
                    <View style={styles.selectContainer}>
                      <Text style={[
                        styles.selectText,
                        !vehicle.type && styles.placeholderText
                      ]}>
                        {vehicle.type ? vehicleTypes.find(t => t.value === vehicle.type)?.label : 'Select vehicle type'}
                      </Text>
                      <MaterialIcons name="arrow-drop-down" size={24} color="#6b7280" />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Cargo Weight (kg) *</Text>
                    <TextInput
                      style={styles.input}
                      value={vehicle.weight}
                      onChangeText={(value) => updateVehicle(vehicle.id, 'weight', value)}
                      placeholder="e.g., 5000"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Cargo Description *</Text>
                    <TextInput
                      style={styles.input}
                      value={vehicle.description}
                      onChangeText={(value) => updateVehicle(vehicle.id, 'description', value)}
                      placeholder="e.g., Maize in bags"
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>

          {/* Add Vehicle Button */}
          <TouchableOpacity
            onPress={addVehicle}
            style={styles.addButton}
          >
            <MaterialIcons name="add" size={20} color="#F37021" />
            <Text style={styles.addButtonText}>Add Another Vehicle</Text>
          </TouchableOpacity>

          {/* Coordination Options */}
          <View style={styles.coordinationCard}>
            <Text style={styles.coordinationTitle}>Pickup Coordination</Text>
            
            <View style={styles.coordinationOptions}>
              {[
                { id: 'any', label: 'Any Transporters', description: 'Fastest matching - different drivers OK' },
                { id: 'same_fleet', label: 'Same Fleet Owner', description: 'Better coordination - may take longer' },
                { id: 'coordinated', label: 'Coordinated Pickup', description: 'All vehicles within 30-min window' }
              ].map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.coordinationOption,
                    coordination === option.id && styles.coordinationOptionSelected
                  ]}
                  onPress={() => setCoordination(option.id)}
                >
                  <View style={styles.radioContainer}>
                    <View style={[
                      styles.coordinationRadio,
                      coordination === option.id && styles.coordinationRadioSelected
                    ]}>
                      {coordination === option.id && <View style={styles.coordinationRadioInner} />}
                    </View>
                  </View>
                  <View style={styles.coordinationText}>
                    <Text style={styles.coordinationLabel}>{option.label}</Text>
                    <Text style={styles.coordinationDescription}>{option.description}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Savings Summary */}
          <View style={styles.savingsCard}>
            <View style={styles.savingsRow}>
              <Text style={styles.savingsLabel}>Base Total:</Text>
              <Text style={styles.savingsValue}>${baseTotal}</Text>
            </View>
            {totalDiscount > 0 && (
              <View style={styles.savingsRow}>
                <Text style={[styles.savingsLabel, styles.discountText]}>
                  Volume Discount ({totalDiscount}%):
                </Text>
                <Text style={[styles.savingsValue, styles.discountText]}>
                  -${discountAmount}
                </Text>
              </View>
            )}
            <View style={styles.savingsDivider} />
            <View style={styles.savingsRow}>
              <Text style={styles.finalLabel}>Final Total:</Text>
              <Text style={styles.finalValue}>${finalTotal}</Text>
            </View>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            onPress={handleContinue}
            style={styles.continueButton}
          >
            <Text style={styles.continueButtonText}>Continue to Route Details</Text>
            <MaterialIcons name="arrow-forward" size={20} color="white" />
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
    padding: 16,
    paddingTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    padding: 4,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  discountBanner: {
    flexDirection: 'row',
    backgroundColor: '#F37021',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 12,
  },
  discountContent: {
    flex: 1,
  },
  discountTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  discountSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  vehiclesContainer: {
    gap: 12,
  },
  vehicleCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  vehicleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  vehicleNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  removeButton: {
    padding: 4,
  },
  vehicleForm: {
    gap: 12,
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
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  selectText: {
    fontSize: 16,
    color: '#1f2937',
  },
  placeholderText: {
    color: '#9ca3af',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#0C2D48',
    borderRadius: 12,
    padding: 16,
    backgroundColor: 'white',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#F37021',
  },
  coordinationCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE1C2',
    padding: 16,
  },
  coordinationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
  },
  coordinationOptions: {
    gap: 12,
  },
  coordinationOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderWidth: 2,
    borderColor: '#FFE1C2',
    borderRadius: 8,
  },
  coordinationOptionSelected: {
    borderColor: '#F37021',
    backgroundColor: '#FFE1C2',
  },
  radioContainer: {
    paddingTop: 2,
  },
  coordinationRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  coordinationRadioSelected: {
    borderColor: '#F37021',
  },
  coordinationRadioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F37021',
  },
  coordinationText: {
    flex: 1,
  },
  coordinationLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
    marginBottom: 4,
  },
  coordinationDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  savingsCard: {
    backgroundColor: '#FFE1C2',
    borderWidth: 1,
    borderColor: '#FFE1C2',
    borderRadius: 12,
    padding: 16,
  },
  savingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  savingsLabel: {
    fontSize: 14,
    color: '#374151',
  },
  savingsValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  discountText: {
    color: '#F37021',
    fontWeight: '600',
  },
  savingsDivider: {
    height: 1,
    backgroundColor: '#F37021',
    marginVertical: 8,
  },
  finalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  finalValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0C2D48',
    borderRadius: 12,
    padding: 16,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default MultipleVehiclesBooking;