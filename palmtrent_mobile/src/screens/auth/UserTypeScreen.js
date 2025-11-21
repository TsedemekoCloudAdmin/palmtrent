// src/screens/UserTypeScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView
} from 'react-native';

const UserTypeScreen = ({ navigation }) => {
  const [selectedType, setSelectedType] = useState(null);

  const handleContinue = () => {
    if (!selectedType) return;
    
    navigation.navigate('PhoneVerify', { 
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
        <TouchableOpacity
          style={[
            styles.simpleCard,
            selectedType === 'shipper' && styles.simpleCardSelected
          ]}
          onPress={() => setSelectedType('shipper')}
        >
          <Text style={styles.simpleCardText}>Book Transport</Text>
          <Text style={styles.simpleCardSubtext}>I need to transport goods</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.simpleCard,
            selectedType === 'transporter' && styles.simpleCardSelected
          ]}
          onPress={() => setSelectedType('transporter')}
        >
          <Text style={styles.simpleCardText}>Offer Transport Services</Text>
          <Text style={styles.simpleCardSubtext}>I own a truck/vehicle</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.simpleCard,
            selectedType === 'trailer_owner' && styles.simpleCardSelected
          ]}
          onPress={() => setSelectedType('trailer_owner')}
        >
          <Text style={styles.simpleCardText}>Rent Out Trailers</Text>
          <Text style={styles.simpleCardSubtext}>I own trailers for rental</Text>
        </TouchableOpacity>
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