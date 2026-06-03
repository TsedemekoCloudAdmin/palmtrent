import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Linking
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../services/apiService';
import useAuth from '../hook/useAuth';

const normalizeLocalPhone = (phone = '') => {
  const value = String(phone).replace(/\s|-/g, '');
  if (value.startsWith('+263')) return `0${value.slice(4)}`;
  if (value.startsWith('263')) return `0${value.slice(3)}`;
  return value;
};

const MobileMoneyPaymentScreen = ({ route, navigation, onNavigate, bookingData, updateBookingData, onExit }) => {
  const { user } = useAuth();
  // Support both navigation patterns:
  // 1. From AppNavigator: route.params contains the data
  // 2. From BookingFlowManager: bookingData prop contains the data
  const routeParams = route?.params || {};
  const bookingId = routeParams.bookingId || bookingData?.bookingId;
  const bookingReference = routeParams.bookingReference || bookingData?.bookingReference;
  const paymentContext = routeParams.paymentContext || bookingData?.paymentContext || 'booking';
  const subscriptionId = routeParams.subscriptionId || bookingData?.subscriptionId;
  const subscriptionName = routeParams.subscriptionName || bookingData?.subscriptionName || 'Subscription';
  const amount = routeParams.amount || bookingData?.amount || bookingData?.pricing?.totals?.total;
  const amountValue = Number(amount || 0);
  const paymentMethod = routeParams.paymentMethod || bookingData?.paymentMethod || 'ecocash';
  const existingPaymentReference = routeParams.paymentReference || bookingData?.paymentReference;

  const navigateTo = (screen, params = {}) => {
    if (onNavigate) {
      onNavigate(screen, params);
    } else if (navigation) {
      const screenMap = {
        'booking-review': 'BookingReview',
        'booking-confirmation': 'BookingConfirmation',
        'main-tabs': 'MainTabs',
      };
      navigation.navigate(screenMap[screen] || screen, params);
    }
  };

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle, initiated, polling, success, failed
  const [phoneNumber, setPhoneNumber] = useState(normalizeLocalPhone(user?.phone));
  const [email, setEmail] = useState(user?.email || '');
  const [instructions, setInstructions] = useState('');
  const [pollUrl, setPollUrl] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [countdown, setCountdown] = useState(300); // 5 minutes

  const countdownRef = useRef(null);
  const pollRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const isEcoCash = paymentMethod === 'ecocash';
  const isOneMoney = paymentMethod === 'onemoney';

  const providerConfig = {
    ecocash: {
      name: 'EcoCash',
      color: '#00A651',
      prefixes: ['077', '078'],
      placeholder: '0771234567',
      icon: 'phone-android'
    },
    onemoney: {
      name: 'OneMoney',
      color: '#E31E24',
      prefixes: ['071'],
      placeholder: '0712345678',
      icon: 'phone-android'
    }
  };

  const provider = providerConfig[paymentMethod] || providerConfig.ecocash;
  const backTarget = paymentContext === 'subscription' ? 'main-tabs' : 'booking-review';

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (!email && user?.email) {
      setEmail(user.email);
    }
    if (!phoneNumber && user?.phone) {
      setPhoneNumber(normalizeLocalPhone(user.phone));
    }
  }, [email, phoneNumber, user?.email, user?.phone]);

  useEffect(() => {
    if (paymentStatus === 'polling') {
      // Start pulse animation
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [paymentStatus]);

  const validatePhoneNumber = () => {
    if (!phoneNumber.trim()) {
      return { valid: false, error: 'Phone number is required' };
    }

    const cleaned = phoneNumber.replace(/[\s-]/g, '');
    const isValidPrefix = provider.prefixes.some(prefix => cleaned.startsWith(prefix));

    if (!isValidPrefix) {
      return {
        valid: false,
        error: `${provider.name} numbers must start with ${provider.prefixes.join(' or ')}`
      };
    }

    if (cleaned.length !== 10) {
      return { valid: false, error: 'Phone number must be 10 digits' };
    }

    return { valid: true };
  };

  const validateForm = () => {
    const phoneValidation = validatePhoneNumber();
    if (!phoneValidation.valid) {
      Alert.alert('Validation Error', phoneValidation.error);
      return false;
    }

    if (!email.trim() || !email.match(/^\S+@\S+\.\S+$/)) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleInitiatePayment = async () => {
    if (!validateForm()) return;

    if (paymentContext === 'subscription' && !subscriptionId && !existingPaymentReference) {
      Alert.alert('Subscription Missing', 'We could not find the subscription to pay for. Please select the plan again.');
      return;
    }

    setProcessing(true);
    setPaymentStatus('initiated');

    try {
      let ref = existingPaymentReference;

      if (!ref) {
        const customer = {
          email: email.trim(),
          phone: phoneNumber.trim()
        };
        const createResponse = paymentContext === 'subscription'
          ? await apiService.createSubscriptionPayment(subscriptionId, paymentMethod, customer)
          : await apiService.post('/payments/create', {
              bookingId,
              amount,
              paymentMethod,
              customer
            });

        if (!createResponse.success) {
          throw new Error(createResponse.message || 'Failed to create payment');
        }

        if (paymentContext === 'subscription' && createResponse.data?.paymentRequired === false) {
          Alert.alert('Subscription Ready', createResponse.message || 'This subscription does not require payment.', [
            { text: 'Continue', onPress: () => navigateTo('main-tabs') }
          ]);
          setProcessing(false);
          setPaymentStatus('idle');
          return;
        }

        ref = createResponse.data.paymentReference;
      }

      setPaymentReference(ref);

      // Initiate ClicknPay hosted checkout for mobile money.
      const initiateResponse = await apiService.post('/payments/initiate', {
        paymentReference: ref,
        customer: {
          email: email.trim(),
          phone: phoneNumber.trim()
        }
      });

      if (!initiateResponse.success) {
        throw new Error(initiateResponse.message || 'Failed to initiate payment');
      }

      const { redirectUrl, pollUrl: url, instructions: inst } = initiateResponse.data;
      setPollUrl(url);
      setInstructions(inst || getDefaultInstructions());

      if (redirectUrl) {
        await Linking.openURL(redirectUrl);
      }

      setPaymentStatus('polling');

      // Start countdown
      startCountdown();

      // Start polling
      startPolling(ref);

    } catch (error) {
      console.error('Payment initiation error:', error);
      setPaymentStatus('failed');
      Alert.alert('Payment Failed', error.message || 'Failed to initiate payment');
      setProcessing(false);
    }
  };

  const getDefaultInstructions = () => {
    return `Complete the ${provider.name} checkout in ClicknPay, then keep this screen open while confirmation is verified.`;
  };

  const startCountdown = () => {
    setCountdown(300);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startPolling = (ref) => {
    pollRef.current = setInterval(async () => {
      try {
        const statusResponse = await apiService.get(`/payments/status/${ref}`);

        if (statusResponse.success) {
          const { status } = statusResponse.data;

          if (status === 'confirmed') {
            clearInterval(pollRef.current);
            clearInterval(countdownRef.current);
            handlePaymentSuccess();
          } else if (status === 'failed' || status === 'cancelled') {
            clearInterval(pollRef.current);
            clearInterval(countdownRef.current);
            handlePaymentFailed(status);
          }
        }
      } catch (error) {
        console.error('Polling error:', error);
      }
    }, 5000);
  };

  const handlePaymentSuccess = () => {
    setPaymentStatus('success');
    setProcessing(false);

    // Navigate to confirmation after delay
    setTimeout(() => {
      if (paymentContext === 'subscription') {
        Alert.alert(
          'Subscription Paid',
          'Your subscription payment is confirmed. Your account access still depends on document verification where required.',
          [{ text: 'Continue', onPress: () => navigateTo('main-tabs') }]
        );
        return;
      }

      navigateTo('booking-confirmation', {
        bookingId,
        bookingReference,
        paymentMethod,
        paymentStatus: 'confirmed'
      });
    }, 2500);
  };

  const handlePaymentFailed = (reason) => {
    setPaymentStatus('failed');
    setProcessing(false);
    Alert.alert(
      'Payment Failed',
      `Your payment was ${reason}. Please try again.`,
      [{ text: 'OK' }]
    );
  };

  const handleTimeout = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPaymentStatus('failed');
    setProcessing(false);
    Alert.alert(
      'Payment Timeout',
      'The payment session has expired. Please try again.',
      [{ text: 'OK' }]
    );
  };

  const handleCancel = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    if (pollRef.current) clearInterval(pollRef.current);
    setPaymentStatus('idle');
    setProcessing(false);
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderPollingState = () => (
    <View style={styles.pollingContainer}>
      <Animated.View style={[styles.pollingIcon, { transform: [{ scale: pulseAnim }] }]}>
        <MaterialIcons name="phone-android" size={60} color={provider.color} />
      </Animated.View>

      <Text style={styles.pollingTitle}>Waiting for {provider.name} Payment</Text>

      <View style={styles.countdownContainer}>
        <MaterialIcons name="timer" size={24} color="#6b7280" />
        <Text style={styles.countdownText}>{formatTime(countdown)}</Text>
      </View>

      <View style={styles.instructionsCard}>
        <MaterialIcons name="info-outline" size={24} color={provider.color} />
        <Text style={styles.instructionsText}>{instructions}</Text>
      </View>

      <View style={styles.stepsContainer}>
        <Text style={styles.stepsTitle}>Follow these steps:</Text>
        <View style={styles.step}>
          <View style={[styles.stepNumber, { backgroundColor: provider.color }]}>
            <Text style={styles.stepNumberText}>1</Text>
          </View>
          <Text style={styles.stepText}>Complete the ClicknPay checkout request</Text>
        </View>
        <View style={styles.step}>
          <View style={[styles.stepNumber, { backgroundColor: provider.color }]}>
            <Text style={styles.stepNumberText}>2</Text>
          </View>
          <Text style={styles.stepText}>Approve any {provider.name} provider prompt</Text>
        </View>
        <View style={styles.step}>
          <View style={[styles.stepNumber, { backgroundColor: provider.color }]}>
            <Text style={styles.stepNumberText}>3</Text>
          </View>
          <Text style={styles.stepText}>Keep this screen open for confirmation</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
        <Text style={styles.cancelButtonText}>Cancel Payment</Text>
      </TouchableOpacity>
    </View>
  );

  const renderSuccessState = () => (
    <View style={styles.successContainer}>
      <View style={[styles.successIcon, { backgroundColor: provider.color + '20' }]}>
        <MaterialIcons name="check-circle" size={80} color={provider.color} />
      </View>
      <Text style={styles.successTitle}>Payment Successful!</Text>
      <Text style={styles.successText}>
        Your {provider.name} payment of USD ${amountValue.toFixed(2)} has been confirmed.
      </Text>
      <Text style={styles.successSubtext}>
        {paymentContext === 'subscription'
          ? 'Returning to your dashboard...'
          : 'Redirecting to booking confirmation...'}
      </Text>
      <ActivityIndicator size="small" color={provider.color} style={{ marginTop: 20 }} />
    </View>
  );

  const renderPaymentForm = () => (
    <KeyboardAvoidingView
      style={styles.keyboardAvoid}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

          {/* Provider Badge */}
          <View style={[styles.providerBadge, { backgroundColor: provider.color + '15' }]}>
            <MaterialIcons name={provider.icon} size={32} color={provider.color} />
            <View>
              <Text style={[styles.providerName, { color: provider.color }]}>{provider.name}</Text>
              <Text style={styles.providerSubtext}>Mobile Money Payment</Text>
            </View>
          </View>

          {/* Payment Summary */}
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Payment Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>
                {paymentContext === 'subscription' ? 'Subscription' : 'Booking Reference'}
              </Text>
              <Text style={styles.summaryValue}>
                {paymentContext === 'subscription' ? subscriptionName : bookingReference}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Amount to Pay</Text>
              <Text style={[styles.amount, { color: provider.color }]}>
                USD ${amountValue.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Phone Number Input */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Your {provider.name} Number</Text>
            <View style={styles.phoneInputContainer}>
              <View style={styles.countryCode}>
                <Text style={styles.countryCodeText}>+263</Text>
              </View>
              <TextInput
                style={styles.phoneInput}
                placeholder={provider.placeholder}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                maxLength={10}
                editable={!processing}
              />
            </View>
            <Text style={styles.helperText}>
              Enter the phone number registered with {provider.name}
            </Text>
          </View>

          {/* Email Input */}
          <View style={styles.inputSection}>
            <Text style={styles.sectionTitle}>Email for Receipt</Text>
            <TextInput
              style={styles.textInput}
              placeholder="your@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!processing}
            />
          </View>

          {/* Security Note */}
          <View style={styles.securityNote}>
            <MaterialIcons name="lock" size={20} color="#059669" />
            <Text style={styles.securityText}>
              Your payment is secured via ClicknPay. We never store your PIN.
            </Text>
          </View>

        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.backButtonBottom}
          onPress={() => navigateTo(backTarget)}
          disabled={processing}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.payButton, { backgroundColor: provider.color }, processing && styles.payButtonDisabled]}
          onPress={handleInitiatePayment}
          disabled={processing}
        >
          {processing ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <MaterialIcons name="phone-android" size={20} color="white" />
              <Text style={styles.payButtonText}>
                Pay with {provider.name}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (paymentStatus === 'polling') {
              Alert.alert(
                'Cancel Payment?',
                'Are you sure you want to cancel this payment?',
                [
                  { text: 'No', style: 'cancel' },
                  { text: 'Yes', onPress: () => {
                    handleCancel();
                    navigateTo(backTarget);
                  }}
                ]
              );
            } else {
              navigateTo(backTarget);
            }
          }}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {paymentContext === 'subscription' ? 'Subscription Payment' : `${provider.name} Payment`}
          </Text>
          <Text style={styles.headerSubtitle}>
            {paymentContext === 'subscription' ? 'Pay to activate your subscription' : 'Secure mobile money payment'}
          </Text>
        </View>
      </View>

      {paymentStatus === 'success' && renderSuccessState()}
      {paymentStatus === 'polling' && renderPollingState()}
      {(paymentStatus === 'idle' || paymentStatus === 'initiated' || paymentStatus === 'failed') && renderPaymentForm()}
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
    paddingTop: 12,
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
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  providerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
  },
  providerName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  providerSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 4,
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  inputSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  countryCode: {
    backgroundColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  countryCodeText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    letterSpacing: 1,
    color: '#1f2937',
  },
  textInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
  },
  securityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
  },
  securityText: {
    flex: 1,
    fontSize: 13,
    color: '#059669',
  },
  bottomActions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  backButtonBottom: {
    flex: 1,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  payButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 12,
    paddingVertical: 16,
  },
  payButtonDisabled: {
    opacity: 0.6,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  // Polling State Styles
  pollingContainer: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pollingIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  pollingTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  countdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  countdownText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  instructionsCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#f0f9ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    width: '100%',
  },
  instructionsText: {
    flex: 1,
    fontSize: 15,
    color: '#1e40af',
    lineHeight: 22,
  },
  stepsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
  stepText: {
    flex: 1,
    fontSize: 15,
    color: '#4b5563',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 2,
    borderColor: '#dc2626',
    borderRadius: 8,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#dc2626',
  },
  // Success State Styles
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  successIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#059669',
    marginBottom: 12,
  },
  successText: {
    fontSize: 16,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  successSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
});

export default MobileMoneyPaymentScreen;
