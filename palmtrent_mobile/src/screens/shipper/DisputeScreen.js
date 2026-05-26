import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useNavigation, useRoute } from '@react-navigation/native';
import apiService from '../../services/apiService';

export const DisputeScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const bookingId = route.params?.bookingId;
  const booking = route.params?.booking;

  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [desiredOutcome, setDesiredOutcome] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [bookingDetails, setBookingDetails] = useState(booking || null);

  const categories = [
    { value: 'payment_issue', label: 'Payment issue' },
    { value: 'cargo_damage', label: 'Cargo damage' },
    { value: 'late_delivery', label: 'Late delivery' },
    { value: 'service_quality', label: 'Service quality' },
    { value: 'unprofessional_conduct', label: 'Unprofessional conduct' },
    { value: 'cargo_missing', label: 'Cargo missing/lost' },
    { value: 'wrong_delivery', label: 'Wrong delivery' },
    { value: 'other', label: 'Other' }
  ];

  const outcomes = [
    { value: 'full_refund', label: 'Full refund' },
    { value: 'partial_refund', label: 'Partial refund' },
    { value: 'compensation', label: 'Compensation for damages' },
    { value: 'service_redo', label: 'Service to be redone' },
    { value: 'apology', label: 'Formal apology' },
    { value: 'other', label: 'Other resolution' }
  ];

  useEffect(() => {
    if (bookingId && !bookingDetails) {
      fetchBookingDetails();
    }
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    setLoading(true);
    try {
      const response = await apiService.get(`/bookings/${bookingId}`);
      if (response.success) {
        setBookingDetails(response.data);
      }
    } catch (error) {
      console.error('Error fetching booking:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddEvidence = () => {
    Alert.alert(
      'Add Evidence',
      'Choose how to add evidence',
      [
        {
          text: 'Take Photo',
          onPress: handleTakePhoto
        },
        {
          text: 'Choose from Gallery',
          onPress: handleChooseFromGallery
        },
        {
          text: 'Cancel',
          style: 'cancel'
        }
      ]
    );
  };

  const handleTakePhoto = async () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200
    };

    try {
      const result = await launchCamera(options);
      if (result.assets && result.assets[0]) {
        setEvidence(prev => [...prev, result.assets[0]]);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const handleChooseFromGallery = async () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
      selectionLimit: 3 - evidence.length
    };

    try {
      const result = await launchImageLibrary(options);
      if (result.assets) {
        setEvidence(prev => [...prev, ...result.assets].slice(0, 3));
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery');
    }
  };

  const removeEvidence = (index) => {
    setEvidence(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!category || !description || !desiredOutcome) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    if (description.length < 20) {
      Alert.alert('Description Too Short', 'Please provide more details about the issue');
      return;
    }

    setSubmitting(true);
    try {
      // Create form data for multipart upload
      const formData = new FormData();
      formData.append('bookingId', bookingId);
      formData.append('category', category);
      formData.append('description', description);
      formData.append('desiredOutcome', desiredOutcome);

      // Add evidence files
      evidence.forEach((file, index) => {
        formData.append('evidence', {
          uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
          type: file.type || 'image/jpeg',
          name: file.fileName || `evidence_${index}.jpg`
        });
      });

      const response = await apiService.submitDispute(formData);

      if (response.success) {
        Alert.alert(
          'Dispute Submitted',
          'Your dispute has been submitted successfully. We will review it within 24 hours.',
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('History')
            }
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to submit dispute');
      }
    } catch (error) {
      console.error('Submit dispute error:', error);
      Alert.alert('Error', 'Failed to submit dispute. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#dc2626" />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#dc2626" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report an Issue</Text>
        <Text style={styles.headerSubtitle}>We'll help resolve this</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Job Info */}
          <View style={styles.jobCard}>
            <Text style={styles.jobLabel}>BOOKING REFERENCE</Text>
            <Text style={styles.jobId}>
              {bookingDetails?.bookingReference || bookingId?.slice(-8).toUpperCase() || 'N/A'}
            </Text>
            {bookingDetails && (
              <Text style={styles.jobRoute}>
                {bookingDetails.pickupLocation?.address?.split(',')[0] || 'Pickup'} → {bookingDetails.deliveryLocation?.address?.split(',')[0] || 'Delivery'}
              </Text>
            )}
            {bookingDetails?.transporter && (
              <Text style={styles.transporterInfo}>
                Transporter: {bookingDetails.transporter.name || 'Assigned'}
              </Text>
            )}
          </View>

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What's the issue? *</Text>
            <View style={styles.categoriesContainer}>
              {categories.map((cat) => (
                <TouchableOpacity
                  key={cat.value}
                  style={[
                    styles.categoryButton,
                    category === cat.value && styles.categoryButtonSelected
                  ]}
                  onPress={() => setCategory(cat.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.categoryText,
                    category === cat.value && styles.categoryTextSelected
                  ]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Describe the issue *</Text>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Please provide as much detail as possible about what happened, when it happened, and any relevant context..."
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/500 characters</Text>
          </View>

          {/* Evidence Upload */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upload Evidence (Optional)</Text>
            <View style={styles.evidenceGrid}>
              {evidence.map((file, index) => (
                <View key={index} style={styles.evidenceItem}>
                  <Image source={{ uri: file.uri }} style={styles.evidenceImage} />
                  <TouchableOpacity
                    style={styles.removeEvidenceBtn}
                    onPress={() => removeEvidence(index)}
                  >
                    <MaterialIcons name="close" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
              {evidence.length < 3 && (
                <TouchableOpacity
                  style={styles.evidenceButton}
                  onPress={handleAddEvidence}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="add-a-photo" size={32} color="#9ca3af" />
                  <Text style={styles.evidenceButtonText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>
            <Text style={styles.helperText}>
              Upload photos, screenshots, or documents as evidence (max 3)
            </Text>
          </View>

          {/* Desired Outcome */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What outcome do you want? *</Text>
            <View style={styles.outcomesContainer}>
              {outcomes.map((outcome) => (
                <TouchableOpacity
                  key={outcome.value}
                  style={[
                    styles.outcomeButton,
                    desiredOutcome === outcome.value && styles.outcomeButtonSelected
                  ]}
                  onPress={() => setDesiredOutcome(outcome.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.outcomeText,
                    desiredOutcome === outcome.value && styles.outcomeTextSelected
                  ]}>
                    {outcome.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Info Box */}
          <View style={styles.infoCard}>
            <MaterialIcons name="info" size={24} color="#1e40af" />
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>What happens next?</Text>
              <View style={styles.infoList}>
                <Text style={styles.infoItem}>1. We'll review your dispute within 24 hours</Text>
                <Text style={styles.infoItem}>2. Both parties will be contacted</Text>
                <Text style={styles.infoItem}>3. Mediation call scheduled if needed (48-72 hours)</Text>
                <Text style={styles.infoItem}>4. Resolution target: 5-7 business days</Text>
              </View>
            </View>
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[
              styles.button,
              styles.dangerButton,
              (!category || !description || !desiredOutcome || submitting) && styles.buttonDisabled
            ]}
            onPress={handleSubmit}
            disabled={!category || !description || !desiredOutcome || submitting}
            activeOpacity={0.7}
          >
            {submitting ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <>
                <MaterialIcons name="send" size={20} color="white" />
                <Text style={styles.buttonText}>Submit Dispute</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Cancel Link */}
          <TouchableOpacity
            style={styles.cancelLink}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelLinkText}>Cancel and go back</Text>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  header: {
    backgroundColor: '#dc2626',
    padding: 24,
    paddingTop: 40,
  },
  backButton: {
    marginBottom: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
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
    paddingBottom: 40,
  },
  jobCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  jobLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  jobId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  jobRoute: {
    fontSize: 14,
    color: '#6b7280',
  },
  transporterInfo: {
    fontSize: 13,
    color: '#374151',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 20,
    backgroundColor: 'white',
  },
  categoryButtonSelected: {
    borderColor: '#dc2626',
    backgroundColor: '#fef2f2',
  },
  categoryText: {
    fontSize: 14,
    color: '#374151',
  },
  categoryTextSelected: {
    color: '#dc2626',
    fontWeight: '600',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 120,
    textAlignVertical: 'top',
    backgroundColor: 'white',
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'right',
  },
  evidenceGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  evidenceItem: {
    width: 100,
    height: 100,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  evidenceImage: {
    width: '100%',
    height: '100%',
  },
  removeEvidenceBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  evidenceButton: {
    width: 100,
    height: 100,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  evidenceButtonText: {
    fontSize: 12,
    color: '#6b7280',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  outcomesContainer: {
    gap: 8,
  },
  outcomeButton: {
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
  },
  outcomeButtonSelected: {
    borderColor: '#0C2D48',
    backgroundColor: '#f0f9ff',
  },
  outcomeText: {
    fontSize: 16,
    color: '#374151',
  },
  outcomeTextSelected: {
    color: '#0C2D48',
    fontWeight: '600',
  },
  infoCard: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    gap: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 8,
  },
  infoList: {
    gap: 4,
  },
  infoItem: {
    fontSize: 14,
    color: '#374151',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginVertical: 4,
    gap: 8,
  },
  dangerButton: {
    backgroundColor: '#dc2626',
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
  cancelLink: {
    alignItems: 'center',
    padding: 12,
  },
  cancelLinkText: {
    color: '#6b7280',
    fontSize: 14,
  },
});

export default DisputeScreen;
