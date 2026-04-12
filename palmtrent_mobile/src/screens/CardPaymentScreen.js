import React, { useState, useEffect } from 'react';
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
  Linking
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../services/apiService';
import WebView from 'react-native-webview'; // For handling redirects

const CardPaymentScreen = ({ route, navigation, onNavigate, bookingData, updateBookingData, onExit }) => {
  // Support both navigation patterns:
  // 1. From AppNavigator: route.params contains the data
  // 2. From BookingFlowManager: bookingData prop contains the data
  const routeParams = route?.params || {};
  const bookingId = routeParams.bookingId || bookingData?.bookingId;
  const bookingReference = routeParams.bookingReference || bookingData?.bookingReference;
  const amount = routeParams.amount || bookingData?.amount || bookingData?.pricing?.totals?.total;
  const paymentMethod = routeParams.paymentMethod || bookingData?.paymentMethod || 'bank_transfer';

  const navigateTo = (screen, params = {}) => {
    if (onNavigate) {
      onNavigate(screen, params);
    } else if (navigation) {
      // Map screen names to actual navigator screen names
      const screenMap = {
        'booking-review': 'BookingReview',
        'booking-confirmation': 'BookingConfirmation',
      };
      navigation.navigate(screenMap[screen] || screen, params);
    }
  };

  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [showWebView, setShowWebView] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState('');
  
  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');

  const isEcocash = paymentMethod === 'ecocash';

  useEffect(() => {
    initializePayment();
  }, []);

  const initializePayment = async () => {
    try {
      setLoading(true);
      console.log('Initializing payment for booking:', bookingId);
    } catch (error) {
      console.error('Payment initialization error:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    if (isEcocash) {
      if (!phoneNumber.trim()) {
        Alert.alert('Validation Error', 'Please enter your EcoCash phone number');
        return false;
      }
      if (!phoneNumber.match(/^(07[3-8]|077)\d{7}$/)) {
        Alert.alert('Validation Error', 'Please enter a valid EcoCash phone number (e.g., 0771234567)');
        return false;
      }
    }
    
    if (!email.trim() || !email.match(/^\S+@\S+\.\S+$/)) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handlePayment = async () => {
    if (!validateForm()) return;

    setProcessing(true);

    try {
      const customerData = {
        email: email.trim(),
        phone: isEcocash ? phoneNumber.trim() : undefined
      };

      console.log('Creating payment for booking:', bookingId);

      // Step 1: Create payment record first
      const createResponse = await apiService.post('/payments/create', {
        bookingId,
        amount,
        paymentMethod: isEcocash ? 'ecocash' : 'card',
        customer: customerData
      });

      if (!createResponse.success) {
        throw new Error(createResponse.message || 'Failed to create payment');
      }

      const { paymentReference: newPaymentReference } = createResponse.data;
      console.log('Payment created with reference:', newPaymentReference);

      // Step 2: Initiate Paynow payment with the payment reference
      const initiateResponse = await apiService.post('/payments/initiate-paynow', {
        paymentReference: newPaymentReference,
        customer: customerData
      });

      if (!initiateResponse.success) {
        throw new Error(initiateResponse.message || 'Failed to initiate payment');
      }

      const {
        paymentId,
        redirectUrl,
        pollUrl,
        instructions,
        paymentReference
      } = initiateResponse.data;

      // Store payment reference for status polling
      global.paymentPollingReference = paymentReference;

      if (redirectUrl) {
        // For web-based payments, show WebView or open browser
        if (isEcocash) {
          // For EcoCash, show instructions and then redirect
          Alert.alert(
            'EcoCash Payment',
            instructions || 'You will be redirected to complete your EcoCash payment.',
            [
              {
                text: 'Continue',
                onPress: () => {
                  setRedirectUrl(redirectUrl);
                  setShowWebView(true);
                }
              }
            ]
          );
        } else {
          // For card payments, directly show WebView
          setRedirectUrl(redirectUrl);
          setShowWebView(true);
        }
      } else if (isEcocash && instructions) {
        // For USSD-based EcoCash, show instructions and start polling
        Alert.alert(
          'EcoCash USSD Instructions',
          instructions,
          [
            {
              text: 'I have completed payment',
              onPress: () => pollPaymentStatus(paymentReference)
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => setProcessing(false)
            }
          ]
        );
      } else {
        // Start polling immediately using paymentReference
        pollPaymentStatus(paymentReference);
      }

    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Payment Failed', error.message || 'Payment processing failed. Please try again.');
      setProcessing(false);
    }
  };

  const pollPaymentStatus = async (reference) => {
    try {
      let attempts = 0;
      const maxAttempts = 36; // 3 minutes at 5-second intervals

      const poll = async () => {
        attempts++;

        const statusResponse = await apiService.get(`/payments/status/${reference}`);
        
        if (statusResponse.success) {
          const { status, paid } = statusResponse.data;

          if (paid || status === 'paid' || status === 'confirmed') {
            await handlePaymentSuccess(reference);
          } else if (status === 'failed' || status === 'cancelled') {
            throw new Error(`Payment was ${status}`);
          } else if (attempts < maxAttempts) {
            // Continue polling
            setTimeout(poll, 5000);
          } else {
            throw new Error('Payment timeout. Please check your transaction history.');
          }
        } else {
          throw new Error('Failed to check payment status');
        }
      };

      await poll();

    } catch (error) {
      console.error('Polling error:', error);
      Alert.alert('Payment Status', error.message || 'Failed to verify payment status.');
      setProcessing(false);
    }
  };

  const handlePaymentSuccess = async (reference) => {
    try {
      setPaymentStatus('success');

      // Confirm payment with backend
      const confirmResponse = await apiService.post(`/bookings/${bookingId}/confirm-payment`, {
        paymentReference: reference,
        paymentMethod: isEcocash ? 'ecocash' : 'bank_transfer'
      });

      if (!confirmResponse.success) {
        console.warn('Payment confirmation warning:', confirmResponse.message);
      }

      // Navigate to success screen after a brief delay
      setTimeout(() => {
        navigateTo('booking-confirmation', {
          bookingId,
          bookingReference,
          paymentMethod: isEcocash ? 'ecocash' : 'bank_transfer',
          paymentStatus: 'confirmed'
        });
      }, 2000);

    } catch (error) {
      console.error('Payment success handling error:', error);
      // Even if confirmation fails, we still show success since payment was received
      setTimeout(() => {
        navigateTo('booking-confirmation', {
          bookingId,
          bookingReference,
          paymentMethod: isEcocash ? 'ecocash' : 'bank_transfer',
          paymentStatus: 'confirmed'
        });
      }, 2000);
    }
  };

  const handleWebViewNavigation = (navState) => {
    const { url } = navState;
    console.log('WebView navigating to:', url);
    
    // Check if we're being redirected back to our app (payment completion)
    if (url.includes(process.env.PAYNOW_RETURN_URL) || url.includes('payment-complete')) {
      setShowWebView(false);

      // Start polling for payment status
      if (global.paymentPollingReference) {
        pollPaymentStatus(global.paymentPollingReference);
      }
    }
  };

  if (showWebView) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.webViewHeader}>
          <TouchableOpacity 
            onPress={() => {
              setShowWebView(false);
              setProcessing(false);
            }} 
            style={styles.backButton}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.webViewTitle}>Complete Payment</Text>
        </View>
        <WebView
          source={{ uri: redirectUrl }}
          onNavigationStateChange={handleWebViewNavigation}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#0C2D48" />
              <Text style={styles.loadingText}>Loading payment page...</Text>
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Initializing payment...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (paymentStatus === 'success') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.successContainer}>
          <MaterialIcons name="check-circle" size={80} color="#059669" />
          <Text style={styles.successTitle}>Payment Successful!</Text>
          <Text style={styles.successText}>
            Your payment has been processed successfully. Redirecting to confirmation...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigateTo('booking-review')}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>
            {isEcocash ? 'EcoCash Payment' : 'Card/EFT Payment'}
          </Text>
          <Text style={styles.headerSubtitle}>Secure payment via Paynow</Text>
        </View>
      </View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            
            {/* Payment Summary */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Payment Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Booking Reference</Text>
                <Text style={styles.summaryValue}>{bookingReference}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Amount to Pay</Text>
                <Text style={styles.amount}>USD ${amount?.toFixed(2) || '0.00'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Payment Method</Text>
                <Text style={styles.summaryValue}>
                  {isEcocash ? 'EcoCash' : 'Card/EFT'} • Paynow
                </Text>
              </View>
            </View>

            {/* Customer Information */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer Information</Text>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Email Address *</Text>
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

              {isEcocash && (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>EcoCash Phone Number *</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="0771234567"
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    keyboardType="phone-pad"
                    editable={!processing}
                  />
                  <Text style={styles.helperText}>
                    Enter your EcoCash registered phone number
                  </Text>
                </View>
              )}
            </View>

            {/* Payment Process Info */}
            <View style={styles.infoCard}>
              <MaterialIcons name="info" size={24} color="#0C2D48" />
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>
                  {isEcocash ? 'How EcoCash Payment Works' : 'How Card Payment Works'}
                </Text>
                <Text style={styles.infoDescription}>
                  {isEcocash 
                    ? 'You will be redirected to confirm your EcoCash payment. Please have your mobile phone ready for USSD prompts.'
                    : 'You will be redirected to a secure payment page to enter your card details. We accept Visa, MasterCard, and local bank cards.'
                  }
                </Text>
              </View>
            </View>

          </View>
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.backButtonBottom}
            onPress={() => navigateTo('booking-review')}
            disabled={processing}
          >
            <Text style={styles.backButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.payButton, processing && styles.payButtonDisabled]}
            onPress={handlePayment}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Text style={styles.payButtonText}>
                  Pay USD ${amount?.toFixed(2) || '0.00'}
                </Text>
                <MaterialIcons name="lock" size={20} color="white" />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

// ... styles remain mostly the same as previous implementation, with minor additions for WebView
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  webViewHeader: {
    backgroundColor: '#0C2D48',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  webViewTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  // ... include all other styles from previous implementation
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C2D48',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 14,
    color: '#0C2D48',
    lineHeight: 20,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    backgroundColor: '#0C2D48',
    padding: 16,
    paddingTop: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
    gap: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#059669',
  },
  successText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
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
  amount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  securityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    padding: 16,
  },
  securityText: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginBottom: 4,
  },
  securityDescription: {
    fontSize: 14,
    color: '#059669',
    lineHeight: 20,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
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
    fontStyle: 'italic',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  gatewayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  gatewayText: {
    fontSize: 12,
    color: '#6b7280',
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
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 16,
  },
  payButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default CardPaymentScreen;