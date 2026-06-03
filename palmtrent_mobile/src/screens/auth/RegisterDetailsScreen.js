// src/screens/RegisterDetailsScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import useAuth from '../../hook/useAuth';
import { POST_REGISTRATION_SUBSCRIPTION_KEY } from '../SubscriptionOnboardingScreen';

const RegisterDetailsScreen = ({ navigation, route }) => {
  const { signUp, isLoading } = useAuth();
  const userType = route.params?.userType || 'shipper';
  const phone = route.params?.phone || '';
  
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone,
    password: '',
    confirmPassword: '',
    agreeTerms: false
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [touchedFields, setTouchedFields] = useState({});
  const [submitted, setSubmitted] = useState(false);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouchedFields(prev => ({ ...prev, [field]: true }));
  };

  const getValidationErrors = () => {
    const errors = {};

    if (formData.fullName.trim().length < 2) {
      errors.fullName = 'Enter your full name, at least 2 characters.';
    }
    if (!/^\S+@\S+\.\S{2,}$/.test(formData.email.trim())) {
      errors.email = 'Enter a valid email address.';
    }
    if (!/^\d{9}$/.test(formData.phone)) {
      errors.phone = 'Enter a valid 9-digit Zimbabwean phone number after +263.';
    }
    if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters long.';
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(formData.password)) {
      errors.password = 'Password must include uppercase, lowercase, and a number.';
    }
    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Confirm your password.';
    } else if (formData.confirmPassword !== formData.password) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    if (!formData.agreeTerms) {
      errors.agreeTerms = 'Accept the Terms of Service and Privacy Policy to continue.';
    }

    return errors;
  };

  const validationErrors = getValidationErrors();
  const showError = (field) => (submitted || touchedFields[field]) && validationErrors[field];

  const ErrorText = ({ field }) => {
    const message = showError(field);
    if (!message) return null;
    return <Text style={styles.errorText}>{message}</Text>;
  };

  const handleCreateAccount = async () => {
    setSubmitted(true);
    const errors = getValidationErrors();
    const firstError = Object.values(errors)[0];
    if (firstError) {
      Alert.alert('Check your details', firstError);
      return;
    }

    try {
      const userData = {
        fullName: formData.fullName.trim(),
        email: formData.email.toLowerCase(),
        phone: `+263${formData.phone}`,
        password: formData.password,
        userType: userType
      };

      await AsyncStorage.setItem(POST_REGISTRATION_SUBSCRIPTION_KEY, 'true');
      await signUp(userData);
    } catch (error) {
      await AsyncStorage.removeItem(POST_REGISTRATION_SUBSCRIPTION_KEY);
      Alert.alert('Error', error.message || 'Failed to create account. Please try again.');
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
          <Text style={styles.title}>Complete your profile</Text>
          <Text style={styles.subtitle}>Tell us a bit about yourself</Text>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.fullName}
                onChangeText={(value) => updateField('fullName', value)}
                placeholder="John Moyo"
                editable={!isLoading}
                autoCapitalize="words"
                onBlur={() => setTouchedFields(prev => ({ ...prev, fullName: true }))}
              />
              <ErrorText field="fullName" />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email Address *</Text>
              <TextInput
                style={styles.input}
                value={formData.email}
                onChangeText={(value) => updateField('email', value)}
                placeholder="john@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isLoading}
                onBlur={() => setTouchedFields(prev => ({ ...prev, email: true }))}
              />
              <ErrorText field="email" />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Phone Number *</Text>
              <View style={styles.phoneRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>+263</Text>
                </View>
                <TextInput
                  style={styles.phoneInput}
                  value={formData.phone}
                  onChangeText={(value) => updateField('phone', value.replace(/\D/g, '').slice(0, 9))}
                  placeholder="771234567"
                  keyboardType="phone-pad"
                  maxLength={9}
                  editable={!isLoading}
                  onBlur={() => setTouchedFields(prev => ({ ...prev, phone: true }))}
                />
              </View>
              <ErrorText field="phone" />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={formData.password}
                  onChangeText={(value) => updateField('password', value)}
                  placeholder="Minimum 8 characters"
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  autoComplete="new-password"
                  onBlur={() => setTouchedFields(prev => ({ ...prev, password: true }))}
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
              <ErrorText field="password" />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Confirm Password *</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  value={formData.confirmPassword}
                  onChangeText={(value) => updateField('confirmPassword', value)}
                  placeholder="Re-enter password"
                  secureTextEntry={!showConfirmPassword}
                  editable={!isLoading}
                  autoComplete="new-password"
                  onBlur={() => setTouchedFields(prev => ({ ...prev, confirmPassword: true }))}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  disabled={isLoading}
                >
                  <Icon
                    name={showConfirmPassword ? "visibility-off" : "visibility"}
                    size={20}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>
              <ErrorText field="confirmPassword" />
            </View>

            <TouchableOpacity
              style={styles.termsContainer}
              onPress={() => updateField('agreeTerms', !formData.agreeTerms)}
              disabled={isLoading}
            >
              <View style={styles.checkboxContainer}>
                <View style={[
                  styles.checkbox,
                  formData.agreeTerms && styles.checkboxChecked
                ]}>
                  {formData.agreeTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </View>
              <Text style={styles.termsText}>
                I agree to Palmtrent's <Text style={styles.link}>Terms of Service</Text> and <Text style={styles.link}>Privacy Policy</Text>
              </Text>
            </TouchableOpacity>
            <ErrorText field="agreeTerms" />

            <TouchableOpacity
              style={[styles.button, isLoading && styles.buttonDisabled]}
              onPress={handleCreateAccount}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.buttonText}>Create Account</Text>
              )}
            </TouchableOpacity>
          </View>
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
  input: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: 'white',
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
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    gap: 12,
  },
  checkboxContainer: {
    marginTop: 2,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#0C2D48',
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#0C2D48',
  },
  checkmark: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  link: {
    color: '#0C2D48',
    fontWeight: '500',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
    lineHeight: 18,
  },
  button: {
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default RegisterDetailsScreen;
