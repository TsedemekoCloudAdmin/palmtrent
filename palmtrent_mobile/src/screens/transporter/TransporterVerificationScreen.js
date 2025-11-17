// src/screens/TransporterVerificationScreen.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';

const TransporterVerificationScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Transporter Verification</Text>
        <Text style={styles.subtitle}>Complete your transporter profile verification</Text>

        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('Home')}
        >
          <Text style={styles.buttonText}>Complete Verification</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  backButton: {
    padding: 24,
    paddingBottom: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6b7280',
  },
  content: {
    padding: 24,
    paddingTop: 0,
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
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default TransporterVerificationScreen;