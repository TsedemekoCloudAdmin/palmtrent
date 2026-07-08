import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Vibration,
  Alert,
  Linking,
  Platform,
  ActivityIndicator
} from 'react-native';
import * as Location from 'expo-location';
import { useNavigation } from '@react-navigation/native';
import apiService from '../../services/apiService';

const EMERGENCY_CONTACTS = {
  police: '+263995',
  ambulance: '+263994',
  fire: '+263993',
  support: '+263771234567'
};

const EMERGENCY_TYPES = [
  { id: 'police', label: 'Police', icon: '🚔' },
  { id: 'medical', label: 'Ambulance', icon: '🚑' },
  { id: 'fire', label: 'Fire Brigade', icon: '🚒' },
  { id: 'vehicle_recovery', label: 'Vehicle Recovery', icon: '🚛' },
  { id: 'roadside_assistance', label: 'Roadside Assist', icon: '🔧' },
  { id: 'accident', label: 'Accident', icon: '🚗' },
  { id: 'hijacking', label: 'Hijacking', icon: '🚨' },
  { id: 'theft', label: 'Theft', icon: '🦹' },
  { id: 'other', label: 'Other', icon: '❗' }
];

const SOSButton = ({
  bookingId,
  shipmentId,
  style,
  size = 'normal', // 'small', 'normal', 'large'
  showLabel = true
}) => {
  const navigation = useNavigation();
  const [showModal, setShowModal] = useState(false);
  const [isTriggering, setIsTriggering] = useState(false);
  const [emergencyActive, setEmergencyActive] = useState(null);
  const [decisionOnly, setDecisionOnly] = useState(false);
  const [selectedType, setSelectedType] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const holdProgress = useRef(new Animated.Value(0)).current;
  const holdTimer = useRef(null);

  // Pulse animation for active emergency
  useEffect(() => {
    if (emergencyActive) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true
          })
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [emergencyActive]);

  useEffect(() => {
    const emergencyId = emergencyActive?.emergencyId || emergencyActive?._id;
    if (!emergencyId) return undefined;

    const pollStatus = async () => {
      try {
        const response = await apiService.request(`/emergency/${emergencyId}`);
        if (response.success && response.data) {
          setEmergencyActive({ ...response.data, emergencyId });
        }
      } catch (error) {
        console.log('SOS status poll error:', error.message);
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 10000);
    return () => clearInterval(interval);
  }, [emergencyActive?.emergencyId, emergencyActive?._id]);

  useEffect(() => {
    if (emergencyActive) return undefined;

    const pollDecisions = async () => {
      try {
        const response = await apiService.getEmergencyDecisions();
        const decision = response.data?.[0];
        if (decision) {
          setDecisionOnly(true);
          setEmergencyActive({ ...decision, emergencyId: decision._id });
        }
      } catch (error) {
        console.log('SOS decision poll error:', error.message);
      }
    };

    pollDecisions();
    const interval = setInterval(pollDecisions, 15000);
    return () => clearInterval(interval);
  }, [emergencyActive]);

  // Get current location
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location services for SOS to work properly.');
        return null;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      // Try to get address
      let address = 'Unknown Location';
      try {
        const [geocode] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });
        if (geocode) {
          address = `${geocode.street || ''} ${geocode.city || ''}, ${geocode.country || ''}`.trim();
        }
      } catch (e) {
        console.log('Geocode error:', e);
      }

      return {
        coordinates: [location.coords.longitude, location.coords.latitude],
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address,
        accuracy: location.coords.accuracy
      };
    } catch (error) {
      console.error('Location error:', error);
      return null;
    }
  };

  // Handle SOS button press
  const handleSOSPress = () => {
    Vibration.vibrate(100);
    setShowModal(true);
  };

  // Handle long press for quick SOS
  const handleLongPressStart = () => {
    Vibration.vibrate([0, 100, 100, 100]);
    Animated.timing(holdProgress, {
      toValue: 1,
      duration: 2000, // 2 second hold
      useNativeDriver: false
    }).start(({ finished }) => {
      if (finished) {
        triggerQuickSOS();
      }
    });
  };

  const handleLongPressEnd = () => {
    holdProgress.stopAnimation();
    holdProgress.setValue(0);
  };

  // Quick SOS (without selecting type)
  const triggerQuickSOS = async () => {
    Vibration.vibrate([0, 200, 100, 200, 100, 200]);
    await triggerSOS('other', 'critical');
  };

  // Trigger SOS with type
  const triggerSOS = async (emergencyType, severity = 'high') => {
    setIsTriggering(true);

    try {
      // Get current location
      const location = await getCurrentLocation();
      setCurrentLocation(location);

      if (!location) {
        Alert.alert(
          'Location Unavailable',
          'Unable to get your location. Do you want to continue without location?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: () => sendSOSRequest(emergencyType, severity, null)
            }
          ]
        );
        setIsTriggering(false);
        return;
      }

      await sendSOSRequest(emergencyType, severity, location);
    } catch (error) {
      console.error('SOS trigger error:', error);
      Alert.alert(
        'SOS Error',
        'Failed to send SOS. Would you like to call emergency services directly?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Call Police', onPress: () => callEmergency('police') },
          { text: 'Call Ambulance', onPress: () => callEmergency('ambulance') }
        ]
      );
      setIsTriggering(false);
    }
  };

  const sendSOSRequest = async (emergencyType, severity, location) => {
    try {
      const response = await apiService.request('/emergency/sos', {
        method: 'POST',
        body: JSON.stringify({
          emergencyType,
          severity,
          location,
          bookingId,
          shipmentId
        })
      });

      if (response.success) {
        setDecisionOnly(false);
        setEmergencyActive(response.data);
        setShowModal(false);
        Vibration.vibrate([0, 500]);

        Alert.alert(
          'SOS Sent',
          'Emergency alert has been sent. Support team has been notified.\n\nStay calm and wait for assistance.',
          [
            { text: 'OK' },
            {
              text: 'Call Support',
              onPress: () => callEmergency('support')
            }
          ]
        );
      }
    } catch (error) {
      throw error;
    } finally {
      setIsTriggering(false);
    }
  };

  // Call emergency services
  const callEmergency = (type) => {
    const number = EMERGENCY_CONTACTS[type];
    if (number) {
      Linking.openURL(`tel:${number}`);
    }
  };

  // Cancel emergency
  const cancelEmergency = async () => {
    if (!emergencyActive) return;

    Alert.alert(
      'Cancel Emergency?',
      'Are you sure you want to cancel this emergency alert?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.request(`/emergency/${emergencyActive.emergencyId}/cancel`, {
                method: 'PUT',
                body: JSON.stringify({ reason: 'User cancelled' })
              });
              setEmergencyActive(null);
            } catch (error) {
              console.error('Cancel error:', error);
            }
          }
        }
      ]
    );
  };

  const openEmergencyPayment = () => {
    const emergencyId = emergencyActive?.emergencyId || emergencyActive?._id;
    if (!emergencyId) return;

    navigation.navigate('MobileMoneyPayment', {
      paymentContext: 'emergency',
      emergencyId,
      emergencyTitle: `${emergencyActive.emergencyType || 'SOS'} assistance`,
      amount: Number(emergencyActive.billing?.amount || 0),
      paymentMethod: 'clicknpay',
      paymentReference: emergencyActive.billing?.paymentReference
    });
  };

  const canPayEmergency = Boolean(
    emergencyActive?.billing?.amount > 0 &&
    ['pending', 'initiated', 'processing', 'failed'].includes(emergencyActive?.billing?.paymentStatus)
  );
  const pendingQuote = (emergencyActive?.response?.responders || []).find(entry =>
    entry.status === 'quote_submitted' && entry.quote?.total
  );

  const approveQuote = async () => {
    const emergencyId = emergencyActive?.emergencyId || emergencyActive?._id;
    const responderId = pendingQuote?.responder || pendingQuote?.user;
    if (!emergencyId || !responderId) return;

    try {
      const response = await apiService.acceptEmergencyQuote(emergencyId, responderId);
      if (!response.success) throw new Error(response.message || 'Unable to approve quote.');
      setDecisionOnly(false);
      setEmergencyActive({ ...response.data, emergencyId });
      Alert.alert('Quote approved', 'The provider can now accept dispatch. You can pay the assistance charge when ready.');
    } catch (error) {
      Alert.alert('Approval failed', error.message || 'Unable to approve quote.');
    }
  };

  const rejectQuote = async () => {
    const emergencyId = emergencyActive?.emergencyId || emergencyActive?._id;
    const responderId = pendingQuote?.responder || pendingQuote?.user;
    if (!emergencyId || !responderId) return;

    try {
      const response = await apiService.rejectEmergencyQuote(emergencyId, responderId, 'Quote rejected from mobile app.');
      if (!response.success) throw new Error(response.message || 'Unable to reject quote.');
      setDecisionOnly(false);
      setEmergencyActive(null);
      Alert.alert('Quote rejected', 'The provider can submit a revised quote if the request is still active.');
    } catch (error) {
      Alert.alert('Rejection failed', error.message || 'Unable to reject quote.');
    }
  };

  // Button sizes
  const buttonSizes = {
    small: { width: 50, height: 50, fontSize: 12 },
    normal: { width: 70, height: 70, fontSize: 16 },
    large: { width: 100, height: 100, fontSize: 20 }
  };

  const buttonSize = buttonSizes[size];

  return (
    <>
      {/* SOS Button */}
      <Animated.View
        style={[
          styles.buttonContainer,
          style,
          emergencyActive && { transform: [{ scale: pulseAnim }] }
        ]}
      >
        <TouchableOpacity
          style={[
            styles.sosButton,
            {
              width: buttonSize.width,
              height: buttonSize.height,
              backgroundColor: emergencyActive ? '#FF3B30' : '#FF4444'
            }
          ]}
          onPress={emergencyActive ? (decisionOnly ? undefined : cancelEmergency) : handleSOSPress}
          onLongPress={handleLongPressStart}
          onPressOut={handleLongPressEnd}
          delayLongPress={300}
          activeOpacity={0.8}
        >
          <Text style={[styles.sosText, { fontSize: buttonSize.fontSize }]}>
            {emergencyActive ? (decisionOnly ? 'QUOTE' : 'ACTIVE') : 'SOS'}
          </Text>
        </TouchableOpacity>
        {showLabel && !emergencyActive && (
          <Text style={styles.helpText}>Hold for 2s</Text>
        )}
        {emergencyActive && (
          <>
            <Text style={styles.activeText}>{decisionOnly ? 'Decision needed' : 'Tap to cancel'}</Text>
            {pendingQuote && (
              <View style={styles.quoteApprovalCard}>
                <Text style={styles.quoteApprovalTitle}>Roadside quote</Text>
                <Text style={styles.quoteApprovalAmount}>USD {Number(pendingQuote.quote?.total || 0).toFixed(2)}</Text>
                <Text style={styles.quoteApprovalMeta}>
                  {pendingQuote.quote?.serviceType?.replace(/_/g, ' ') || 'Roadside assistance'}
                  {pendingQuote.quote?.distanceKm ? ` - ${Number(pendingQuote.quote.distanceKm).toFixed(1)} km` : ''}
                </Text>
                <View style={styles.quoteApprovalActions}>
                  <TouchableOpacity style={styles.rejectQuoteButton} onPress={rejectQuote}>
                    <Text style={styles.rejectQuoteText}>Reject</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.approveQuoteButton} onPress={approveQuote}>
                    <Text style={styles.approveQuoteText}>Approve</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {canPayEmergency && (
              <TouchableOpacity style={styles.payAssistanceButton} onPress={openEmergencyPayment}>
                <Text style={styles.payAssistanceText}>Pay assistance</Text>
              </TouchableOpacity>
            )}
          </>
        )}
      </Animated.View>

      {/* Emergency Type Modal */}
      <Modal
        visible={showModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🚨 EMERGENCY</Text>
            <Text style={styles.modalSubtitle}>Select emergency type</Text>

            <View style={styles.typesGrid}>
              {EMERGENCY_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  style={[
                    styles.typeButton,
                    selectedType === type.id && styles.typeButtonSelected
                  ]}
                  onPress={() => setSelectedType(type.id)}
                  disabled={isTriggering}
                >
                  <Text style={styles.typeIcon}>{type.icon}</Text>
                  <Text style={styles.typeLabel}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {isTriggering ? (
              <View style={styles.triggeringContainer}>
                <ActivityIndicator size="large" color="#FF4444" />
                <Text style={styles.triggeringText}>Sending SOS...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity
                  style={[
                    styles.triggerButton,
                    !selectedType && styles.triggerButtonDisabled
                  ]}
                  onPress={() => selectedType && triggerSOS(selectedType)}
                  disabled={!selectedType}
                >
                  <Text style={styles.triggerButtonText}>
                    SEND EMERGENCY ALERT
                  </Text>
                </TouchableOpacity>

                <View style={styles.directCallContainer}>
                  <Text style={styles.directCallText}>Or call directly:</Text>
                  <View style={styles.callButtons}>
                    <TouchableOpacity
                      style={styles.callButton}
                      onPress={() => callEmergency('police')}
                    >
                      <Text style={styles.callButtonText}>🚔 Police</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.callButton}
                      onPress={() => callEmergency('ambulance')}
                    >
                      <Text style={styles.callButtonText}>🚑 Ambulance</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.callButton}
                      onPress={() => callEmergency('support')}
                    >
                      <Text style={styles.callButtonText}>📞 Support</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowModal(false);
                    setSelectedType(null);
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    alignItems: 'center'
  },
  sosButton: {
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF0000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 3,
    borderColor: '#FFFFFF'
  },
  sosText: {
    color: '#FFFFFF',
    fontWeight: 'bold'
  },
  helpText: {
    fontSize: 10,
    color: '#999',
    marginTop: 4
  },
  activeText: {
    fontSize: 10,
    color: '#FF4444',
    marginTop: 4,
    fontWeight: 'bold'
  },
  payAssistanceButton: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#0C2D48',
    borderWidth: 1,
    borderColor: '#F37021'
  },
  payAssistanceText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  quoteApprovalCard: {
    width: 230,
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F37021',
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4
  },
  quoteApprovalTitle: {
    color: '#0C2D48',
    fontSize: 12,
    fontWeight: '800'
  },
  quoteApprovalAmount: {
    color: '#0C2D48',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 2
  },
  quoteApprovalMeta: {
    color: '#475569',
    fontSize: 11,
    marginTop: 2,
    textTransform: 'capitalize'
  },
  quoteApprovalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 9
  },
  rejectQuoteButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    justifyContent: 'center'
  },
  rejectQuoteText: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '800'
  },
  approveQuoteButton: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    backgroundColor: '#F37021',
    alignItems: 'center',
    justifyContent: 'center'
  },
  approveQuoteText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20
  },
  modalTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#FF4444',
    marginBottom: 8
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20
  },
  typeButton: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent'
  },
  typeButtonSelected: {
    borderColor: '#FF4444',
    backgroundColor: '#FFEBEE'
  },
  typeIcon: {
    fontSize: 32,
    marginBottom: 4
  },
  typeLabel: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500'
  },
  triggeringContainer: {
    alignItems: 'center',
    padding: 20
  },
  triggeringText: {
    marginTop: 16,
    fontSize: 16,
    color: '#FF4444',
    fontWeight: 'bold'
  },
  triggerButton: {
    backgroundColor: '#FF4444',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16
  },
  triggerButtonDisabled: {
    backgroundColor: '#CCCCCC'
  },
  triggerButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  directCallContainer: {
    marginBottom: 16
  },
  directCallText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10
  },
  callButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  callButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: '500'
  },
  cancelButton: {
    paddingVertical: 12
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 16,
    textAlign: 'center'
  }
});

export default SOSButton;
