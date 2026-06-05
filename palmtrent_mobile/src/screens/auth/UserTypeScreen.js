// src/screens/UserTypeScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView
} from 'react-native';

const PHONE_VERIFICATION_DISABLED = process.env.EXPO_PUBLIC_DISABLE_PHONE_VERIFICATION === 'true';

const UserTypeScreen = ({ navigation }) => {
  const [selectedType, setSelectedType] = useState(null);
  const accountTypes = [
    {
      value: 'shipper',
      title: 'Book Transport',
      description: 'Request transport, compare matched transporters, pay, and track goods.'
    },
    {
      value: 'transporter',
      title: 'Offer Transport Services',
      description: 'Accept shipment jobs, manage your fleet, and rent out your vehicles when available.'
    },
    {
      value: 'rental_owner',
      title: 'Rent Out Vehicles',
      description: 'Manage small cars, bakkies, vans, trailers, trucks, staff users, and rental bookings.'
    },
    {
      value: 'trailer_owner',
      title: 'Rent Out Trailers',
      description: 'Manage trailers, tractor units, trucks, full rigs, handovers, and rental requests.'
    },
    {
      value: 'driver',
      title: 'Find Driving Work',
      description: 'Create a driver profile, pay the annual driver subscription, and set when you are available.'
    },
    {
      value: 'roadside_provider',
      title: 'Provide Roadside Help',
      description: 'Register as a tow operator or mechanic, stay available, and receive nearby SOS requests.'
    }
  ];

  const handleContinue = () => {
    if (!selectedType) return;
    
    navigation.navigate(PHONE_VERIFICATION_DISABLED ? 'RegisterDetails' : 'PhoneVerify', {
      userType: selectedType
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.title}>I want to...</Text>
        <Text style={styles.subtitle}>Choose how you'll use Palmtrent</Text>
      </View>

      <View style={styles.cardsContainer}>
        {accountTypes.map((type) => (
          <TouchableOpacity
            key={type.value}
            style={[
              styles.simpleCard,
              selectedType === type.value && styles.simpleCardSelected
            ]}
            onPress={() => setSelectedType(type.value)}
          >
            <Text style={styles.simpleCardText}>{type.title}</Text>
            <Text style={styles.simpleCardSubtext}>{type.description}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {selectedType && (
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  cardsContainer: {
    paddingHorizontal: 24,
  },
  simpleCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    marginBottom: 12,
  },
  simpleCardSelected: {
    backgroundColor: '#dbeafe',
    borderColor: '#0C2D48',
  },
  simpleCardText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  simpleCardSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  footer: {
    padding: 24,
    paddingTop: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  continueButton: {
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default UserTypeScreen;
