// src/screens/PhoneVerifyScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView
} from 'react-native';

const PhoneVerifyScreen = ({ navigation, route }) => {  // Use navigation prop
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState('phone');
  const [timer, setTimer] = useState(59);

  // Get userType from route params if needed
  const userType = route.params?.userType;

  useEffect(() => {
    let interval;
    if (step === 'code' && timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [step, timer]);

  const handlePhoneSubmit = () => {
    setStep('code');
  };

  const handleCodeChange = (index, value) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newCode = [...code];
      newCode[index] = value;
      setCode(newCode);
    }
  };

  const isCodeComplete = code.every(digit => digit !== '');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>

        {step === 'phone' ? (
          <View style={styles.content}>
            <Text style={styles.title}>Enter your phone number</Text>
            <Text style={styles.subtitle}>We'll send you a verification code via SMS</Text>

            <View style={styles.phoneInputContainer}>
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
                />
              </View>
              <Text style={styles.helperText}>
                We'll never share your phone number with anyone else
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.button, phone.length < 9 && styles.buttonDisabled]}
              onPress={handlePhoneSubmit}
              disabled={phone.length < 9}
            >
              <Text style={styles.buttonText}>Send Verification Code</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.content}>
            <Text style={styles.title}>Enter verification code</Text>
            <Text style={styles.subtitle}>
              We sent a code to +263 {phone}
            </Text>

            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <TextInput
                  key={index}
                  style={styles.codeInput}
                  value={digit}
                  onChangeText={(value) => handleCodeChange(index, value)}
                  keyboardType="number-pad"
                  maxLength={1}
                  textAlign="center"
                />
              ))}
            </View>

           <TouchableOpacity
              style={[styles.button, !isCodeComplete && styles.buttonDisabled]}
              onPress={() => navigation.navigate('RegisterDetails', { 
              userType: userType,
              phone: phone // Pass the phone number to the next screen
            })}
            disabled={!isCodeComplete}>
            <Text style={styles.buttonText}>Verify & Continue</Text>
          </TouchableOpacity>

            <View style={styles.resendContainer}>
              <Text style={styles.resendText}>Didn't receive code?</Text>
              {timer > 0 ? (
                <Text style={styles.timerText}>Resend in {timer}s</Text>
              ) : (
                <TouchableOpacity>
                  <Text style={styles.resendButton}>Resend Code</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
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
  phoneInputContainer: {
    marginBottom: 32,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
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
  helperText: {
    fontSize: 12,
    color: '#6b7280',
  },
  codeContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 32,
    justifyContent: 'space-between',
  },
  codeInput: {
    flex: 1,
    height: 56,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    fontSize: 20,
    fontWeight: 'bold',
    backgroundColor: 'white',
  },
  button: {
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendContainer: {
    alignItems: 'center',
  },
  resendText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  timerText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  resendButton: {
    fontSize: 14,
    color: '#0C2D48',
    fontWeight: '500',
  },
});

export default PhoneVerifyScreen;