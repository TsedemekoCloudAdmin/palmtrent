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
  Dimensions,
  ActivityIndicator
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../../services/apiService';

const PickupChecklistScreen = ({ navigation, route }) => {
  const { job, shipmentId } = route.params || {};
  const [checklist, setChecklist] = useState({
    arrived: false,
    inspected: false,
    photos: [],
    signature: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const jobData = job || {};
  const cargoDetails = jobData.cargoDetails || {};
  const cargoLabel = cargoDetails.description ||
    `${cargoDetails.weight || jobData.weight || 0} kg ${cargoDetails.type || jobData.cargoType || 'cargo'}`;
  const quantityLabel = cargoDetails.quantity
    ? `Count: ${cargoDetails.quantity}`
    : 'Count: verify against booking details';
  const conditionLabel = cargoDetails.condition || cargoDetails.handlingInstructions
    ? `Condition: ${cargoDetails.condition || cargoDetails.handlingInstructions}`
    : 'Condition: record visible damage before loading';

  const handleCompletePickup = async () => {
    if (!checklist.signature) return;

    // Use shipmentId from params or jobData
    const currentShipmentId = shipmentId || jobData.shipmentId || jobData._id;

    if (!currentShipmentId) {
      Alert.alert('Error', 'Shipment ID not found. Please try again.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Call the confirm-pickup API endpoint
      const response = await apiService.post(`/transporter/shipments/${currentShipmentId}/confirm-pickup`, {
        photos: checklist.photos,
        notes: `Goods inspected and match description. ${checklist.photos.length} photos taken.`,
        signature: checklist.signature
      });

      if (response.success) {
        Alert.alert(
          'Pickup Confirmed',
          'Cargo has been picked up successfully. Starting journey.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('ActiveDeliveries', {
                job: jobData,
                bookingId: jobData.bookingReference || jobData.id,
                shipmentId: currentShipmentId
              })
            }
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to confirm pickup');
      }
    } catch (error) {
      console.error('Confirm pickup error:', error);
      Alert.alert('Error', error.message || 'Failed to confirm pickup. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const takePhoto = () => {
    if (checklist.photos.length < 4) {
      setChecklist({
        ...checklist,
        photos: [...checklist.photos, `photo${checklist.photos.length + 1}`]
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Pickup Checklist</Text>
        <Text style={styles.jobId}>{jobData.id}</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Step 1: Check In */}
        <View style={styles.section}>
          <ChecklistCard
            number="1"
            title="Check In"
            completed={checklist.arrived}
          >
            <TouchableOpacity
              style={[styles.actionButton, checklist.arrived && styles.actionButtonCompleted]}
              onPress={() => setChecklist({...checklist, arrived: true})}
              disabled={checklist.arrived}
            >
              <MaterialIcons name="location-on" size={20} color="white" />
              <Text style={styles.actionButtonText}>I've Arrived at Pickup Location</Text>
            </TouchableOpacity>
            {checklist.arrived && (
              <View style={styles.completedStatus}>
                <MaterialIcons name="check-circle" size={16} color="#16a34a" />
                <Text style={styles.completedText}>Checked in at 06:02 AM • Mbare Musika, Harare</Text>
              </View>
            )}
          </ChecklistCard>
        </View>

        {/* Step 2: Inspect Goods */}
        <View style={styles.section}>
          <ChecklistCard
            number="2"
            title="Inspect Goods"
            completed={checklist.inspected}
            locked={!checklist.arrived}
          >
            <View style={styles.inspectionList}>
              <InspectionItem label={`Match description: ${cargoLabel}`} />
              <InspectionItem label={quantityLabel} />
              <InspectionItem label={conditionLabel} />
            </View>
            <TouchableOpacity
              style={[styles.actionButton, checklist.inspected && styles.actionButtonCompleted, !checklist.arrived && styles.actionButtonDisabled]}
              onPress={() => setChecklist({...checklist, inspected: true})}
              disabled={!checklist.arrived || checklist.inspected}
            >
              <MaterialIcons name="check-circle" size={20} color="white" />
              <Text style={styles.actionButtonText}>Goods Match Description</Text>
            </TouchableOpacity>
          </ChecklistCard>
        </View>

        {/* Step 3: Take Photos */}
        <View style={styles.section}>
          <ChecklistCard
            number="3"
            title="Take Photos"
            completed={checklist.photos.length >= 3}
            locked={!checklist.inspected}
          >
            <Text style={styles.photoInstruction}>Minimum 3 photos required</Text>
            <View style={styles.photosGrid}>
              {[1, 2, 3, 4].map((n) => (
                <TouchableOpacity
                  key={n}
                  style={[styles.photoButton, checklist.photos[n-1] && styles.photoButtonCompleted]}
                  onPress={takePhoto}
                  disabled={!checklist.inspected || checklist.photos[n-1]}
                >
                  {checklist.photos[n-1] ? (
                    <>
                      <MaterialIcons name="check-circle" size={24} color="#16a34a" />
                      <Text style={styles.photoButtonTextCompleted}>Photo {n}</Text>
                    </>
                  ) : (
                    <>
                      <MaterialIcons name="camera-alt" size={24} color="#9ca3af" />
                      <Text style={styles.photoButtonText}>Take Photo</Text>
                    </>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </ChecklistCard>
        </View>

        {/* Step 4: Get Signature */}
        <View style={styles.section}>
          <ChecklistCard
            number="4"
            title="Shipper Signature"
            completed={checklist.signature}
            locked={checklist.photos.length < 3}
          >
            <TouchableOpacity
              style={[styles.actionButton, styles.signatureButton, checklist.signature && styles.actionButtonCompleted, checklist.photos.length < 3 && styles.actionButtonDisabled]}
              onPress={() => setChecklist({...checklist, signature: true})}
              disabled={checklist.photos.length < 3 || checklist.signature}
            >
              <MaterialIcons name="edit" size={20} color="white" />
              <Text style={styles.actionButtonText}>Get Shipper Signature</Text>
            </TouchableOpacity>
            {checklist.signature && (
              <View style={styles.completedStatus}>
                <MaterialIcons name="check-circle" size={16} color="#16a34a" />
                <Text style={styles.completedText}>Signature captured</Text>
              </View>
            )}
          </ChecklistCard>
        </View>

        {/* Complete Pickup Button */}
        <View style={styles.section}>
          <TouchableOpacity
            style={[styles.completeButton, (!checklist.signature || isSubmitting) && styles.completeButtonDisabled]}
            onPress={handleCompletePickup}
            disabled={!checklist.signature || isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={styles.completeButtonText}>Complete Pickup & Start Journey</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Checklist Card Component
const ChecklistCard = ({ number, title, completed, locked, children }) => (
  <View style={[styles.checklistCard, completed && styles.checklistCardCompleted, locked && styles.checklistCardLocked]}>
    <View style={styles.checklistHeader}>
      <View style={[styles.stepNumber, completed && styles.stepNumberCompleted]}>
        <Text style={[styles.stepNumberText, completed && styles.stepNumberTextCompleted]}>
          {completed ? '✓' : number}
        </Text>
      </View>
      <Text style={styles.checklistTitle}>{title}</Text>
      {locked && (
        <View style={styles.lockedBadge}>
          <MaterialIcons name="lock" size={12} color="#6b7280" />
          <Text style={styles.lockedText}>Complete previous steps</Text>
        </View>
      )}
    </View>
    {children}
  </View>
);

// Inspection Item Component
const InspectionItem = ({ label }) => (
  <View style={styles.inspectionItem}>
    <MaterialIcons name="check" size={16} color="#9ca3af" />
    <Text style={styles.inspectionLabel}>{label}</Text>
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
  header: {
    backgroundColor: '#0C2D48',
    padding: 24,
    paddingTop: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
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
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  checklistCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
  },
  checklistCardCompleted: {
    borderColor: '#16a34a',
  },
  checklistCardLocked: {
    opacity: 0.5,
  },
  checklistHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberCompleted: {
    backgroundColor: '#16a34a',
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#6b7280',
  },
  stepNumberTextCompleted: {
    color: 'white',
  },
  checklistTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  lockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockedText: {
    fontSize: 12,
    color: '#6b7280',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0C2D48',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonCompleted: {
    backgroundColor: '#16a34a',
  },
  actionButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  signatureButton: {
    backgroundColor: '#7c3aed',
  },
  completedStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    gap: 6,
  },
  completedText: {
    fontSize: 12,
    color: '#166534',
  },
  inspectionList: {
    gap: 8,
    marginBottom: 12,
  },
  inspectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  inspectionLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  photoInstruction: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  photoButton: {
  width: (Dimensions.get('window').width - 64) / 4,
  aspectRatio: 1,
  borderWidth: 2,
  borderColor: '#e5e7eb',
  borderStyle: 'dashed',
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
},
  photoButtonCompleted: {
    borderColor: '#16a34a',
    borderStyle: 'solid',
    backgroundColor: '#f0fdf4',
  },
  photoButtonText: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  photoButtonTextCompleted: {
    fontSize: 12,
    color: '#16a34a',
    marginTop: 4,
    fontWeight: '500',
  },
  completeButton: {
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  bottomPadding: {
    height: 20,
  },
});

export default PickupChecklistScreen;
