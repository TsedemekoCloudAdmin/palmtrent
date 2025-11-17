// src/screens/LoginScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  Alert
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../../hook/useAuth';

const LoginScreen = ({ navigation }) => {
  const { signIn, isLoading } = useAuth(); // Using the hook
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!phone || !password) {
      Alert.alert('Error', 'Please enter both phone and password');
      return;
    }

    // Mock user data - replace with actual authentication
    const userData = {
      id: Math.random().toString(36).substring(7),
      phone: phone,
      userType: 'shipper', // This would come from your backend
      fullName: 'Existing User', // This would come from your backend
      email: 'user@example.com', // This would come from your backend
    };

    try {
      await signIn(userData);
      // Navigation will happen automatically due to auth state change
    } catch (error) {
      Alert.alert('Error', 'Failed to sign in. Please check your credentials.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
          disabled={isLoading}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to continue</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>+263</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="77 123 4567"
                  keyboardType="phone-pad"
                  maxLength={9}
                  editable={!isLoading}
                />
              </View>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  <Icon 
                    name={showPassword ? "visibility-off" : "visibility"} 
                    size={20} 
                    color="#6b7280" 
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity 
              onPress={() => navigation.navigate('ForgotPassword')}
              disabled={isLoading}
            >
              <Text style={styles.forgotPassword}>Forgot Password?</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleSignIn}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>
                Don't have an account?{' '}
                <Text 
                  style={styles.signupLink} 
                  onPress={() => !isLoading && navigation.navigate('UserType')}
                >
                  Sign Up
                </Text>
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Your existing styles remain the same...
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
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
  header: {
    marginBottom: 32,
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
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 12,
  },
  countryCode: {
    width: 80,
    padding: 12,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  phoneInput: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: 'white',
  },
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    padding: 12,
    paddingRight: 50,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: 'white',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  forgotPassword: {
    fontSize: 14,
    color: '#0C2D48',
    fontWeight: '500',
    textAlign: 'right',
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
  signupContainer: {
    alignItems: 'center',
    paddingTop: 16,
  },
  signupText: {
    fontSize: 14,
    color: '#6b7280',
  },
  signupLink: {
    color: '#0C2D48',
    fontWeight: '500',
  },
});

export default LoginScreen;