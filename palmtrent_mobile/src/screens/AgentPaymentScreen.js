import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Share,
  Clipboard
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../services/apiService';
import socketService from '../services/socketService';
import useAuth from '../hook/useAuth';

const AgentPaymentScreen = ({ route, navigation, onNavigate, bookingData, updateBookingData }) => {
  const { user } = useAuth();
  const routeParams = route?.params || {};
  const bookingId = routeParams.bookingId || bookingData?.bookingId;
  const bookingReference = routeParams.bookingReference || bookingData?.bookingReference;
  const amount = routeParams.amount || bookingData?.amount || bookingData?.pricing?.totals?.total;
  const existingAgentPayment = routeParams.agentPayment || bookingData?.agentPayment;

  const navigateTo = (screen, params = {}) => {
    if (onNavigate) {
      onNavigate(screen, params);
    } else if (navigation) {
      const screenMap = {
        'booking-review': 'BookingReview',
        'booking-confirmation': 'BookingConfirmation',
      };
      navigation.navigate(screenMap[screen] || screen, params);
    }
  };

  const [loading, setLoading] = useState(true);
  const [paymentData, setPaymentData] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [copied, setCopied] = useState(false);
  const [copiedLookupReference, setCopiedLookupReference] = useState(false);

  const pollRef = useRef(null);
  const countdownRef = useRef(null);

  // Handle real-time payment confirmation via socket
  const handleSocketPaymentConfirmed = useCallback((data) => {
    console.log('Socket: Payment confirmed event received:', data);

    // Verify this is for our booking
    if (data.bookingId === bookingId || data.bookingReference === bookingReference) {
      // Stop polling and countdown
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);

      // Show instant success
      handlePaymentSuccess();
    }
  }, [bookingId, bookingReference]);

  useEffect(() => {
    if (existingAgentPayment?.paymentReference) {
      hydrateExistingAgentPayment(existingAgentPayment);
    } else {
      initiateAgentPayment();
    }

    // Subscribe to real-time payment confirmation events
    if (socketService.isConnected && socketService.socket) {
      socketService.socket.on('payment:confirmed', handleSocketPaymentConfirmed);
    }

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);

      // Unsubscribe from socket events
      if (socketService.socket) {
        socketService.socket.off('payment:confirmed', handleSocketPaymentConfirmed);
      }
    };
  }, [handleSocketPaymentConfirmed, existingAgentPayment?.paymentReference]);

  const hydrateExistingAgentPayment = (agentPayment) => {
    setPaymentData(agentPayment);

    const expiresAt = new Date(agentPayment.expiresAt);
    const now = new Date();
    const diff = Math.floor((expiresAt - now) / 1000);
    setCountdown(diff > 0 ? diff : 0);

    if (diff > 0) {
      startCountdown();
      startPolling(agentPayment.paymentReference);
    } else {
      handleExpiry();
    }

    setLoading(false);
  };

  const initiateAgentPayment = async () => {
    setLoading(true);
    try {
      const response = await apiService.post('/payments/initiate-agent', {
        bookingId,
        amount,
        customer: {
          email: user?.email,
          phone: user?.phone || user?.mobile
        }
      });

      if (response.success) {
        setPaymentData(response.data);

        // Calculate countdown from expiresAt
        const expiresAt = new Date(response.data.expiresAt);
        const now = new Date();
        const diff = Math.floor((expiresAt - now) / 1000);
        setCountdown(diff > 0 ? diff : 0);

        // Start countdown
        startCountdown();

        // Start polling for payment confirmation
        startPolling(response.data.paymentReference);
      } else {
        throw new Error(response.message || 'Failed to initiate payment');
      }
    } catch (error) {
      console.error('Agent payment initiation error:', error);
      Alert.alert('Error', error.message || 'Failed to initiate payment', [
        { text: 'Go Back', onPress: () => navigateTo('booking-review') }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const startCountdown = () => {
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          handleExpiry();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startPolling = (reference) => {
    pollRef.current = setInterval(async () => {
      try {
        const statusResponse = await apiService.get(`/payments/status/${reference}`);

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
    }, 10000); // Poll every 10 seconds
  };

  const handlePaymentSuccess = () => {
    Alert.alert(
      'Payment Confirmed!',
      'Your EcoCash Agent payment has been confirmed successfully.',
      [
        {
          text: 'Continue',
          onPress: () => navigateTo('booking-confirmation', {
            bookingId,
            bookingReference,
            paymentMethod: 'cash_agent',
            paymentStatus: 'confirmed'
          })
        }
      ]
    );
  };

  const handlePaymentFailed = (reason) => {
    Alert.alert(
      'Payment Failed',
      `Your payment was ${reason}. Please try again.`,
      [
        { text: 'Try Again', onPress: initiateAgentPayment },
        { text: 'Go Back', onPress: () => navigateTo('booking-review') }
      ]
    );
  };

  const handleExpiry = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    Alert.alert(
      'Payment Expired',
      'This payment reference has expired. Please generate a new one.',
      [
        { text: 'Generate New', onPress: initiateAgentPayment },
        { text: 'Go Back', onPress: () => navigateTo('booking-review') }
      ]
    );
  };

  const checkStatusManually = async () => {
    if (!paymentData?.paymentReference) return;

    setCheckingStatus(true);
    try {
      const statusResponse = await apiService.get(`/payments/status/${paymentData.paymentReference}`);

      if (statusResponse.success) {
        const { status } = statusResponse.data;

        if (status === 'confirmed') {
          handlePaymentSuccess();
        } else if (status === 'failed' || status === 'cancelled') {
          handlePaymentFailed(status);
        } else {
          Alert.alert('Payment Pending', 'Your payment has not been confirmed yet. Please ensure you have completed the payment at an EcoCash Agent.');
        }
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to check payment status');
    } finally {
      setCheckingStatus(false);
    }
  };

  const copyToClipboard = (text) => {
    Clipboard.setString(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyLookupReference = (text) => {
    Clipboard.setString(text);
    setCopiedLookupReference(true);
    setTimeout(() => setCopiedLookupReference(false), 2000);
  };

  const sharePaymentDetails = async () => {
    if (!paymentData) return;

    try {
      await Share.share({
        message: `PalmTrent Payment Details\n\nAgent Code: ${paymentData.agentCode}\nEcoCash Source Reference: ${paymentData.ecocashSourceReference || 'Not required'}\nAmount: USD $${paymentData.amount?.toFixed(2)}\nMerchant: ${paymentData.instructions?.merchantCode}\n\nPay at any EcoCash Agent`
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigateTo('booking-review')} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>EcoCash Agent Payment</Text>
            <Text style={styles.headerSubtitle}>Pay at any EcoCash Agent</Text>
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00A651" />
          <Text style={styles.loadingText}>Generating payment reference...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigateTo('booking-review')} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>EcoCash Agent Payment</Text>
          <Text style={styles.headerSubtitle}>Pay at any EcoCash Agent</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

          {/* Agent Code Card - Most Prominent */}
          <View style={styles.agentCodeCard}>
            <View style={styles.agentCodeHeader}>
              <MaterialIcons name="confirmation-number" size={28} color="#00A651" />
              <Text style={styles.agentCodeLabel}>Your Payment Reference</Text>
            </View>

            <TouchableOpacity
              style={styles.agentCodeContainer}
              onPress={() => copyToClipboard(paymentData?.agentCode)}
              activeOpacity={0.7}
            >
              <Text style={styles.agentCode}>{paymentData?.agentCode}</Text>
              <MaterialIcons
                name={copied ? "check" : "content-copy"}
                size={24}
                color={copied ? "#16a34a" : "#6b7280"}
              />
            </TouchableOpacity>

            {copied && (
              <Text style={styles.copiedText}>Copied to clipboard!</Text>
            )}

            <Text style={styles.agentCodeNote}>
              Quote this code to the EcoCash Agent
            </Text>

            {paymentData?.ecocashSourceReference && (
              <View style={styles.lookupReferenceCard}>
                <Text style={styles.lookupReferenceLabel}>EcoCash Source Reference</Text>
                <TouchableOpacity
                  style={styles.lookupReferenceButton}
                  onPress={() => copyLookupReference(paymentData.ecocashSourceReference)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.lookupReferenceValue}>{paymentData.ecocashSourceReference}</Text>
                  <MaterialIcons
                    name={copiedLookupReference ? "check" : "content-copy"}
                    size={20}
                    color={copiedLookupReference ? "#16a34a" : "#475569"}
                  />
                </TouchableOpacity>
                <Text style={styles.lookupReferenceNote}>
                  Use this UUID if the agent asks for the EcoCash source reference.
                </Text>
              </View>
            )}
          </View>

          {/* Amount Card */}
          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Amount to Pay</Text>
            <Text style={styles.amountValue}>USD ${paymentData?.amount?.toFixed(2)}</Text>
            <View style={styles.merchantRow}>
              <Text style={styles.merchantLabel}>Merchant:</Text>
              <Text style={styles.merchantValue}>{paymentData?.instructions?.merchantCode}</Text>
            </View>
          </View>

          {/* Countdown */}
          <View style={styles.countdownCard}>
            <MaterialIcons name="timer" size={24} color="#dc2626" />
            <View style={styles.countdownContent}>
              <Text style={styles.countdownLabel}>Valid for</Text>
              <Text style={styles.countdownValue}>{formatTime(countdown)}</Text>
            </View>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Text style={styles.instructionsTitle}>
              <MaterialIcons name="info-outline" size={20} color="#1e40af" /> How to Pay
            </Text>

            {paymentData?.instructions?.steps?.map((step, index) => (
              <View key={index} style={styles.stepRow}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ))}

            <View style={styles.noteBox}>
              <MaterialIcons name="warning" size={20} color="#d97706" />
              <Text style={styles.noteText}>{paymentData?.instructions?.note}</Text>
            </View>
          </View>

          {/* Support */}
          <View style={styles.supportCard}>
            <MaterialIcons name="support-agent" size={24} color="#6b7280" />
            <View style={styles.supportContent}>
              <Text style={styles.supportLabel}>Need Help?</Text>
              <Text style={styles.supportPhone}>{paymentData?.instructions?.supportPhone}</Text>
            </View>
          </View>

        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={sharePaymentDetails}
        >
          <MaterialIcons name="share" size={20} color="#0C2D48" />
          <Text style={styles.shareButtonText}>Share</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.checkButton, checkingStatus && styles.checkButtonDisabled]}
          onPress={checkStatusManually}
          disabled={checkingStatus}
        >
          {checkingStatus ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <>
              <MaterialIcons name="refresh" size={20} color="white" />
              <Text style={styles.checkButtonText}>I've Paid - Check Status</Text>
            </>
          )}
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
    paddingBottom: 100,
  },
  // Agent Code Card - Most Prominent
  agentCodeCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: '#22c55e',
    alignItems: 'center',
  },
  agentCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  agentCodeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#166534',
  },
  agentCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'white',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#00A651',
    borderStyle: 'dashed',
  },
  agentCode: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#00A651',
    letterSpacing: 4,
    fontFamily: 'monospace',
  },
  copiedText: {
    fontSize: 14,
    color: '#16a34a',
    marginTop: 8,
    fontWeight: '500',
  },
  agentCodeNote: {
    fontSize: 14,
    color: '#166534',
    marginTop: 12,
    textAlign: 'center',
  },
  lookupReferenceCard: {
    width: '100%',
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  lookupReferenceLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#166534',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  lookupReferenceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#dbeafe',
  },
  lookupReferenceValue: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: '#0C2D48',
    fontFamily: 'monospace',
  },
  lookupReferenceNote: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    color: '#64748b',
  },
  // Amount Card
  amountCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#0C2D48',
    marginBottom: 12,
  },
  merchantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  merchantLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  merchantValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  // Countdown Card
  countdownCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  countdownContent: {
    flex: 1,
  },
  countdownLabel: {
    fontSize: 12,
    color: '#991b1b',
  },
  countdownValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#dc2626',
  },
  // Instructions Card
  instructionsCard: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  noteBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fffbeb',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 18,
  },
  // Support Card
  supportCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  supportContent: {
    flex: 1,
  },
  supportLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  supportPhone: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C2D48',
  },
  // Bottom Actions
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#0C2D48',
    borderRadius: 12,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C2D48',
  },
  checkButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: '#00A651',
    borderRadius: 12,
  },
  checkButtonDisabled: {
    opacity: 0.6,
  },
  checkButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default AgentPaymentScreen;
