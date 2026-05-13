import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../../hook/useAuth';
import apiService from '../../services/apiService';

export const DeliveryChecklistScreen = ({ navigation, route, onNavigate }) => {
  const { user } = useAuth();
  const job = route.params?.job;
  const shipmentId = route.params?.shipmentId;
  const [checklist, setChecklist] = useState({
    arrived: false,
    inspected: false,
    photos: [],
    recipientVerified: false,
    signature: false,
    cashCollected: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigateTo = (screen, params = {}) => {
    if (onNavigate && typeof onNavigate === 'function') {
      onNavigate(screen, params);
    } else if (navigation) {
      navigation.navigate(screen, params);
    } else {
      console.warn('No navigation available');
    }
  };

  const isCashOnDelivery = job?.payment === 'cash_delivery' || job?.payment?.method === 'cash_on_delivery';
  const cargoDetails = job?.cargoDetails || {};
  const expectedRecipient = job?.route?.delivery?.contactPerson || job?.receiver?.name || 'Recipient';
  const expectedRecipientPhone = job?.route?.delivery?.contactPhone || job?.receiver?.phone || '';
  const expectedCargo = cargoDetails.description ||
    `${cargoDetails.quantity ? `${cargoDetails.quantity} ` : ''}${cargoDetails.type || 'cargo'}${cargoDetails.weight ? ` (${cargoDetails.weight} kg)` : ''}`;
  const paymentTotal = job?.pricing?.totals?.total || job?.pricing?.total || job?.totalAmount || job?.amount || 0;
  const platformFee = job?.pricing?.totals?.platformCommission || job?.pricing?.breakdown?.platformCommission || 0;

  const handleCompleteDelivery = async () => {
    if (!checklist.signature || (isCashOnDelivery && !checklist.cashCollected)) return;

    // Use shipmentId from params or job data
    const currentShipmentId = shipmentId || job?.shipmentId || job?._id;

    if (!currentShipmentId) {
      Alert.alert('Error', 'Shipment ID not found. Please try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the confirm-delivery API endpoint
      const response = await apiService.post(`/transporter/shipments/${currentShipmentId}/confirm-delivery`, {
        photos: checklist.photos,
        notes: `Cargo delivered and inspected. ${checklist.photos.length} photos taken. Recipient verified.`,
        signature: checklist.signature,
        receiverName: expectedRecipient,
        receiverPhone: expectedRecipientPhone
      });

      if (response.success) {
        Alert.alert(
          'Delivery Confirmed',
          'Delivery has been completed successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigateTo('DeliveryCompleted', {
                job,
                shipmentId: currentShipmentId
              })
            }
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to confirm delivery');
      }
    } catch (error) {
      console.error('Confirm delivery error:', error);
      Alert.alert('Error', error.message || 'Failed to confirm delivery. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
     
      {/* Header - Updated to match HomeScreen pattern */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigateTo('Home')}
          >
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Delivery Checklist</Text>
            <Text style={styles.jobId}>Job ID: {job?.id || job?.bookingReference || shipmentId || 'Unavailable'}</Text>
          </View>
        </View>
      </View>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Step 1: Arrived */}
          <ChecklistCard
            number="1"
            title="Check In at Destination"
            completed={checklist.arrived}
          >
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={() => setChecklist({...checklist, arrived: true})}
              activeOpacity={0.7}
            >
              <MaterialIcons name="location-on" size={20} color="white" />
              <Text style={styles.buttonText}>I've Arrived at Delivery Location</Text>
            </TouchableOpacity>
            {checklist.arrived && (
              <View style={styles.successMessage}>
                <MaterialIcons name="check-circle" size={16} color="#166534" />
                <Text style={styles.successText}>Arrived at 05:45 PM (15 mins early!)</Text>
              </View>
            )}
          </ChecklistCard>
          {/* Step 2: Verify Recipient */}
          <ChecklistCard
            number="2"
            title="Verify Recipient"
            completed={checklist.recipientVerified}
            locked={!checklist.arrived}
          >
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Expected Recipient:</Text>
              <Text style={styles.infoValue}>{expectedRecipient}</Text>
              <Text style={styles.infoSubtext}>{expectedRecipientPhone || 'Phone not provided'}</Text>
            </View>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, !checklist.arrived && styles.buttonDisabled]}
              onPress={() => setChecklist({...checklist, recipientVerified: true})}
              disabled={!checklist.arrived}
              activeOpacity={0.7}
            >
              <MaterialIcons name="verified" size={20} color="white" />
              <Text style={styles.buttonText}>Recipient Verified</Text>
            </TouchableOpacity>
          </ChecklistCard>
          {/* Step 3: Offload & Inspect */}
          <ChecklistCard
            number="3"
            title="Offload & Inspect Cargo"
            completed={checklist.inspected}
            locked={!checklist.recipientVerified}
          >
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Expected:</Text>
                <Text style={styles.detailValue}>{expectedCargo}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Offloading:</Text>
                <Text style={styles.detailValue}>Recipient team</Text>
              </View>
            </View>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton, !checklist.recipientVerified && styles.buttonDisabled]}
              onPress={() => setChecklist({...checklist, inspected: true})}
              disabled={!checklist.recipientVerified}
              activeOpacity={0.7}
            >
              <MaterialIcons name="inventory" size={20} color="white" />
              <Text style={styles.buttonText}>Cargo Offloaded & Inspected</Text>
            </TouchableOpacity>
          </ChecklistCard>
          {/* Step 4: Delivery Photos */}
          <ChecklistCard
            number="4"
            title="Take Delivery Photos"
            completed={checklist.photos.length >= 3}
            locked={!checklist.inspected}
          >
            <Text style={styles.helperText}>Document delivered condition (min 3 photos)</Text>
            <View style={styles.photosGrid}>
              {[1, 2, 3, 4].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.photoButton, !checklist.inspected && styles.photoButtonDisabled]}
                  onPress={() => {
                    if (checklist.photos.length < 4) {
                      setChecklist({...checklist, photos: [...checklist.photos, `delivery${n}`]});
                    }
                  }}
                  disabled={!checklist.inspected}
                  activeOpacity={0.7}
                >
                  {checklist.photos[n-1] ? (
                    <>
                      <MaterialIcons name="check-circle" size={24} color="#16a34a" />
                      <Text style={styles.photoButtonText}>Photo {n}</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="camera-alt" size={24} color="#9ca3af" />
                      <Text style={styles.photoButtonText}>Take</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ChecklistCard>
          {/* Step 5: Cash Collection (if applicable) */}
          {isCashOnDelivery && (
            <ChecklistCard
              number="5"
              title="Collect Payment"
              completed={checklist.cashCollected}
              locked={checklist.photos.length < 3}
            >
              <View style={styles.paymentCard}>
                <Text style={styles.paymentTitle}>💰 Collect from recipient:</Text>
                <Text style={styles.paymentAmount}>USD ${paymentTotal.toFixed(2)}</Text>
                <Text style={styles.paymentBreakdown}>
                  Includes platform charges and any selected insurance.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.button, styles.successButton, checklist.photos.length < 3 && styles.buttonDisabled]}
                onPress={() => setChecklist({...checklist, cashCollected: true})}
                disabled={checklist.photos.length < 3}
                activeOpacity={0.7}
              >
                <MaterialIcons name="attach-money" size={20} color="white" />
                <Text style={styles.buttonText}>Payment Collected</Text>
              </TouchableOpacity>
            </ChecklistCard>
          )}
          {/* Step 6: Recipient Signature */}
          <ChecklistCard
            number={isCashOnDelivery ? "6" : "5"}
            title="Get Recipient Signature"
            completed={checklist.signature}
            locked={(isCashOnDelivery && !checklist.cashCollected) || (!isCashOnDelivery && checklist.photos.length < 3)}
          >
            <TouchableOpacity
              style={[styles.button, styles.purpleButton,
                ((isCashOnDelivery && !checklist.cashCollected) || (!isCashOnDelivery && checklist.photos.length < 3)) && styles.buttonDisabled
              ]}
              onPress={() => setChecklist({...checklist, signature: true})}
              disabled={(isCashOnDelivery && !checklist.cashCollected) || (!isCashOnDelivery && checklist.photos.length < 3)}
              activeOpacity={0.7}
            >
              <MaterialIcons name="edit" size={20} color="white" />
              <Text style={styles.buttonText}>Capture Signature</Text>
            </TouchableOpacity>
            {checklist.signature && (
              <View style={styles.successMessage}>
                <MaterialIcons name="check-circle" size={16} color="#166534" />
                <Text style={styles.successText}>Signed by {expectedRecipient}</Text>
              </View>
            )}
          </ChecklistCard>
          {/* Remit Platform Fee (for cash jobs) */}
          {isCashOnDelivery && checklist.cashCollected && (
            <View style={styles.warningCard}>
              <Text style={styles.warningTitle}>⚠️ IMPORTANT: Pay Platform Fee Now</Text>
              <Text style={styles.warningText}>
                You must remit USD ${platformFee.toFixed(2)} platform fee before completing delivery
              </Text>
              <TouchableOpacity
                style={[styles.button, styles.dangerButton]}
                onPress={() => navigateTo('remit-commission')}
                activeOpacity={0.7}
              >
                <Text style={styles.buttonText}>Pay Platform Fee (${platformFee.toFixed(2)})</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Complete Delivery */}
          <TouchableOpacity
            style={[styles.button, styles.successButton,
              (!checklist.signature || (isCashOnDelivery && !checklist.cashCollected) || isSubmitting) && styles.buttonDisabled
            ]}
            onPress={handleCompleteDelivery}
            disabled={!checklist.signature || (isCashOnDelivery && !checklist.cashCollected) || isSubmitting}
            activeOpacity={0.7}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <MaterialIcons name="check-circle" size={20} color="white" />
                <Text style={styles.buttonText}>Complete Delivery</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper Component
const ChecklistCard = ({ number, title, completed, locked, children }) => (
  <View style={[
    styles.card,
    completed ? styles.cardCompleted : locked ? styles.cardLocked : styles.cardDefault
  ]}>
    <View style={styles.cardHeader}>
      <View style={[styles.stepNumber, completed && styles.stepNumberCompleted]}>
        <Text style={styles.stepNumberText}>{completed ? '✓' : number}</Text>
      </View>
      <Text style={styles.cardTitle}>{title}</Text>
      {locked && <MaterialIcons name="lock" size={16} color="#6b7280" />}
    </View>
    {children}
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  // Updated Header Styles to match HomeScreen
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  jobId: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ratingText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  tripsText: {
    color: 'white',
    fontSize: 14,
    opacity: 0.75,
  },
  userTypeBadge: {
    color: 'white',
    fontSize: 12,
    backgroundColor: '#F37021',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginLeft: 8,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardDefault: {
    borderColor: '#e5e7eb',
  },
  cardCompleted: {
    borderColor: '#16a34a',
  },
  cardLocked: {
    borderColor: '#e5e7eb',
    opacity: 0.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberCompleted: {
    backgroundColor: '#16a34a',
  },
  stepNumberText: {
    color: '#374151',
    fontWeight: 'bold',
    fontSize: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 4,
  },
  primaryButton: {
    backgroundColor: '#0C2D48',
  },
  successButton: {
    backgroundColor: '#16a34a',
  },
  dangerButton: {
    backgroundColor: '#dc2626',
  },
  purpleButton: {
    backgroundColor: '#7c3aed',
  },
  buttonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.5,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#dbeafe',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e40af',
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 16,
    color: '#1f2937',
  },
  infoSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
  paymentCard: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#f59e0b',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#92400e',
    marginBottom: 4,
  },
  paymentAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#92400e',
  },
  paymentBreakdown: {
    fontSize: 12,
    color: '#92400e',
    marginTop: 4,
  },
  warningCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#dc2626',
    borderRadius: 12,
    padding: 16,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#991b1b',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#991b1b',
    marginBottom: 12,
  },
  successMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  successText: {
    color: '#166534',
    fontSize: 14,
  },
  detailsContainer: {
    gap: 8,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  photosGrid: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  photoButton: {
    flex: 1,
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  photoButtonDisabled: {
    opacity: 0.5,
  },
  photoButtonText: {
    fontSize: 12,
    color: '#6b7280',
  },
  helperText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
});

export default DeliveryChecklistScreen;
