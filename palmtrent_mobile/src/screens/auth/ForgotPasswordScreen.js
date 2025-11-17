// src/screens/ForgotPasswordScreen.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet, SafeAreaView } from 'react-native';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>

      <View style={styles.content}>
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>Enter your email to reset your password</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Enter your email"
          keyboardType="email-address"
        />

        <TouchableOpacity style={styles.button}>
          <Text style={styles.buttonText}>Send Reset Link</Text>
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
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: 'white',
    marginBottom: 20,
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

export default ForgotPasswordScreen;