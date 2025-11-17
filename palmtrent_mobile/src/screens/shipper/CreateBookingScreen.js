// screens/CreateBookingScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Switch,
  Image,
  Alert,
  Platform,
  Modal,
  TouchableWithoutFeedback
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../../hook/useAuth';
import * as ImagePicker from 'expo-image-picker';

const CreateBookingScreen = ({ onNavigate, bookingData = {}, updateBookingData }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempDate, setTempDate] = useState('');
  const [tempTime, setTempTime] = useState('');
  const [images, setImages] = useState(bookingData.images || []);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(bookingData.paymentMethod || null);
  
  const [formData, setFormData] = useState({
    cargoType: bookingData.cargoType || '',
    weight: bookingData.weight || '',
    pickupLocation: bookingData.pickupLocation || '',
    deliveryLocation: bookingData.deliveryLocation || '',
    pickupDate: bookingData.pickupDate || '',
    cargoValue: bookingData.cargoValue || '',
    specialInstructions: bookingData.specialInstructions || '',
    insurance: bookingData.insurance || false,
    bookingType: bookingData.bookingType || 'single'
  });

  const [estimatedPrice, setEstimatedPrice] = useState({
    transport: 400,
    platformFee: 48,
    insurance: 45,
    total: 493
  });

  // Payment methods data
  const paymentMethods = [
    {
      id: 'ecocash',
      name: "EcoCash / OneMoney",
      description: "Instant confirmation • 12% fee",
      recommended: true
    },
    {
      id: 'cash_agent',
      name: "Cash via EcoCash Agent",
      description: "Pay at any agent • 12% fee",
      recommended: false
    },
    {
      id: 'cash_pickup',
      name: "Cash on Pickup",
      description: "Driver collects • 15% fee",
      recommended: false
    }
  ];

  // Update form fields
  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle payment method selection
  const handlePaymentMethodSelect = (methodId) => {
    setSelectedPaymentMethod(methodId);
  };

  // Date/Time Modal Functions
  const showDateTimeModal = () => {
    if (formData.pickupDate) {
      const [datePart, timePart] = formData.pickupDate.split(' ');
      setTempDate(datePart || '');
      setTempTime(timePart || '');
    } else {
      const now = new Date();
      setTempDate(now.toISOString().split('T')[0]);
      setTempTime('12:00');
    }
    setShowDateModal(true);
  };

  const handleDateTimeConfirm = () => {
    if (tempDate && tempTime) {
      const formattedDate = `${tempDate} ${tempTime}`;
      updateField('pickupDate', formattedDate);
    }
    setShowDateModal(false);
  };

  const handleDateTimeCancel = () => {
    setShowDateModal(false);
  };

  const formatDisplayDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      const [datePart, timePart] = dateString.split(' ');
      return `${datePart} at ${timePart}`;
    } catch (error) {
      return dateString;
    }
  };

  // Image Picker Functions
  const requestPermissions = async () => {
    if (Platform.OS !== 'web') {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
        Alert.alert('Permission required', 'Sorry, we need camera and gallery permissions to make this work!');
        return false;
      }
    }
    return true;
  };

  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setImages(prev => [...prev, result.assets[0].uri]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const pickImage = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        const newImages = result.assets.map(asset => asset.uri);
        setImages(prev => [...prev, ...newImages]);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to select images. Please try again.');
    }
  };

  const removeImage = (index) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const showImagePickerOptions = () => {
    Alert.alert(
      'Add Photos',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: takePhoto,
        },
        {
          text: 'Choose from Gallery',
          onPress: pickImage,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  // Validation
  const isStep1Valid = formData.cargoType && formData.weight && formData.cargoValue;
  const isStep2Valid = formData.pickupLocation && formData.deliveryLocation && formData.pickupDate;
  const isStep3Valid = selectedPaymentMethod !== null;

  const crossBorderCountries = ['South Africa', 'Botswana', 'Zambia', 'Mozambique', 'Namibia','Zimbabwe'];

const isCrossBorderDestination = (deliveryLocation) => {
  if (!deliveryLocation) return false;
  return crossBorderCountries.some(country => 
    deliveryLocation.toLowerCase().includes(country.toLowerCase())
  );
};

 const handleContinue = () => {
  if (step === 2 && true) {
    // Update booking data first
    updateBookingData({
      ...formData,
      isCrossBorder: true
    });
    onNavigate('cross-border-booking');
  } else if (step === 3 && isStep3Valid) {
    updateBookingData({
      ...formData,
      paymentMethod: selectedPaymentMethod,
      images: images
    });
    onNavigate('booking-review');
  } else if (step < 3) {
    setStep(step + 1);
  }
};

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Book Transport</Text>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressStep, step >= 1 && styles.progressStepActive]} />
            <View style={[styles.progressStep, step >= 2 && styles.progressStepActive]} />
            <View style={[styles.progressStep, step >= 3 && styles.progressStepActive]} />
          </View>
          <Text style={styles.progressText}>Step {step} of 3</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Cargo Details</Text>

              {/* Cargo Type */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>What are you transporting? *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 5 tonnes maize in bags"
                  value={formData.cargoType}
                  onChangeText={(value) => updateField('cargoType', value)}
                />
              </View>

              {/* Weight */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Weight (kg) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 5000"
                  value={formData.weight}
                  onChangeText={(value) => updateField('weight', value)}
                  keyboardType="numeric"
                />
              </View>

              {/* Cargo Value */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Cargo Value (USD) *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., 10000"
                  value={formData.cargoValue}
                  onChangeText={(value) => updateField('cargoValue', value)}
                  keyboardType="numeric"
                />
                <Text style={styles.helperText}>Required for insurance calculation</Text>
              </View>

              {/* Special Instructions */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Special Instructions (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="e.g., Keep dry, covered load, fragile"
                  value={formData.specialInstructions}
                  onChangeText={(value) => updateField('specialInstructions', value)}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              {/* Photo Upload */}
              <View style={styles.photoSection}>
                <Text style={styles.label}>Cargo Photos (Optional)</Text>
                <Text style={styles.helperText}>Help transporters see your cargo</Text>
                
                {/* Selected Images */}
                {images.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
                    {images.map((uri, index) => (
                      <View key={index} style={styles.imageWrapper}>
                        <Image source={{ uri }} style={styles.selectedImage} />
                        <TouchableOpacity 
                          style={styles.removeImageButton}
                          onPress={() => removeImage(index)}
                        >
                          <MaterialIcons name="close" size={16} color="white" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}

                {/* Upload Button */}
                <TouchableOpacity 
                  style={styles.photoUpload} 
                  activeOpacity={0.7}
                  onPress={showImagePickerOptions}
                >
                  <MaterialIcons name="camera-alt" size={48} color="#9ca3af" />
                  <Text style={styles.photoTitle}>Add Photos</Text>
                  <Text style={styles.photoSubtitle}>Take photo or choose from gallery</Text>
                  <Text style={styles.photoButton}>Choose Photos</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Route & Schedule</Text>

              {/* Pickup Location */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Pickup Location *</Text>
                <View style={styles.inputWithIcon}>
                  <MaterialIcons name="location-on" size={20} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.inputWithIconPadding]}
                    placeholder="e.g., Mbare Musika, Harare"
                    value={formData.pickupLocation}
                    onChangeText={(value) => updateField('pickupLocation', value)}
                  />
                </View>
                <TouchableOpacity>
                  <Text style={styles.locationButton}>📍 Use Current Location</Text>
                </TouchableOpacity>
              </View>

              {/* Delivery Location */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Delivery Location *</Text>
                <View style={styles.inputWithIcon}>
                  <MaterialIcons name="location-on" size={20} color="#9ca3af" style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.inputWithIconPadding]}
                    placeholder="e.g., National Foods, Bulawayo"
                    value={formData.deliveryLocation}
                    onChangeText={(value) => updateField('deliveryLocation', value)}
                  />
                </View>
              </View>

              {/* Distance & Route Info */}
              {formData.pickupLocation && formData.deliveryLocation && (
                <View style={styles.routeInfo}>
                  <View style={styles.routeRow}>
                    <Text style={styles.routeLabel}>Distance</Text>
                    <Text style={styles.routeValue}>440 km</Text>
                  </View>
                  <View style={styles.routeRow}>
                    <Text style={styles.routeLabel}>Est. Duration</Text>
                    <Text style={styles.routeDuration}>7-8 hours</Text>
                  </View>
                </View>
              )}

              {/* Pickup Date & Time */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Pickup Date & Time *</Text>
                
                <TouchableOpacity 
                  style={styles.dateInput}
                  onPress={showDateTimeModal}
                >
                  <View style={styles.inputWithIcon}>
                    <MaterialIcons name="calendar-today" size={20} color="#9ca3af" style={styles.inputIcon} />
                    <Text style={[styles.dateInputText, !formData.pickupDate && styles.placeholderText]}>
                      {formData.pickupDate ? formatDisplayDate(formData.pickupDate) : 'Select date and time'}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>

              {/* Recommended Vehicle */}
              <View style={styles.vehicleRecommendation}>
                <Text style={styles.vehicleTitle}>✅ Recommended Vehicle</Text>
                <Text style={styles.vehicleType}>7-tonne truck with tarpaulin</Text>
                <Text style={styles.vehicleSubtitle}>Based on your cargo weight and type</Text>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Review & Payment</Text>

              {/* Booking Summary */}
              <View style={styles.summaryCard}>
                <View style={styles.summarySection}>
                  <Text style={styles.summaryLabel}>CARGO</Text>
                  <Text style={styles.summaryValue}>{formData.cargoType || 'Not specified'}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summarySection}>
                  <Text style={styles.summaryLabel}>ROUTE</Text>
                  <Text style={styles.summaryValue}>
                    {formData.pickupLocation || 'Not specified'} → {formData.deliveryLocation || 'Not specified'}
                  </Text>
                  <Text style={styles.routeDistance}>440 km • 7-8 hours</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summarySection}>
                  <Text style={styles.summaryLabel}>PICKUP</Text>
                  <Text style={styles.summaryValue}>
                    {formData.pickupDate ? formatDisplayDate(formData.pickupDate) : 'Not specified'}
                  </Text>
                </View>
                
                {images.length > 0 && (
                  <>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summarySection}>
                      <Text style={styles.summaryLabel}>PHOTOS</Text>
                      <Text style={styles.summaryValue}>{images.length} photo(s) attached</Text>
                    </View>
                  </>
                )}
              </View>

              {/* Insurance Option */}
              <View style={styles.insuranceCard}>
                <View style={styles.insuranceHeader}>
                  <Switch
                    value={formData.insurance}
                    onValueChange={(value) => updateField('insurance', value)}
                    trackColor={{ false: '#767577', true: '#0C2D48' }}
                    thumbColor={formData.insurance ? '#f5dd4b' : '#f4f3f4'}
                  />
                  <View style={styles.insuranceContent}>
                    <View style={styles.insuranceTitleRow}>
                      <MaterialIcons name="security" size={20} color="#0C2D48" />
                      <Text style={styles.insuranceTitle}>Protect Your Cargo</Text>
                    </View>
                    <Text style={styles.insuranceDescription}>
                      Full replacement coverage if damaged, lost, or stolen
                    </Text>
                    <View style={styles.insuranceDetails}>
                      <Text style={styles.insuranceDetail}>
                        <Text style={styles.detailLabel}>Coverage:</Text> USD ${formData.cargoValue || '0'}
                      </Text>
                      <Text style={styles.insuranceDetail}>
                        <Text style={styles.detailLabel}>Premium:</Text> USD $45 (0.45%)
                      </Text>
                      <Text style={styles.insuranceProvider}>Provider: Zimnat Lion Insurance ⭐⭐⭐⭐⭐</Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Price Breakdown */}
              <View style={styles.priceCard}>
                <Text style={styles.priceTitle}>Price Breakdown</Text>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Transport Fee</Text>
                  <Text style={styles.priceValue}>USD ${estimatedPrice.transport}</Text>
                </View>
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Platform Fee (12%)</Text>
                  <Text style={styles.priceValue}>USD ${estimatedPrice.platformFee}</Text>
                </View>
                {formData.insurance && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Insurance</Text>
                    <Text style={styles.priceValue}>USD ${estimatedPrice.insurance}</Text>
                  </View>
                )}
                <View style={styles.priceTotal}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    USD ${formData.insurance ? estimatedPrice.total : estimatedPrice.total - estimatedPrice.insurance}
                  </Text>
                </View>
              </View>

              {/* Payment Method */}
              <View style={styles.paymentContainer}>
                <Text style={styles.paymentTitle}>Payment Method *</Text>
                <View style={styles.paymentOptions}>
                  {paymentMethods.map((method) => (
                    <PaymentOption
                      key={method.id}
                      name={method.name}
                      description={method.description}
                      recommended={method.recommended}
                      isSelected={selectedPaymentMethod === method.id}
                      onPress={() => handlePaymentMethodSelect(method.id)}
                    />
                  ))}
                </View>
                {selectedPaymentMethod && (
                  <Text style={styles.selectedPaymentText}>
                    Selected: {paymentMethods.find(m => m.id === selectedPaymentMethod)?.name}
                  </Text>
                )}
              </View>
            </View>
          )}
        </View>
        
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Date/Time Selection Modal */}
      <Modal
        visible={showDateModal}
        transparent={true}
        animationType="slide"
        onRequestClose={handleDateTimeCancel}
      >
        <TouchableWithoutFeedback onPress={handleDateTimeCancel}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>Select Pickup Date & Time</Text>
                
                <View style={styles.modalInputContainer}>
                  <Text style={styles.modalLabel}>Date</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="YYYY-MM-DD"
                    value={tempDate}
                    onChangeText={setTempDate}
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={styles.modalHelper}>Format: YYYY-MM-DD (e.g., 2024-01-15)</Text>
                </View>

                <View style={styles.modalInputContainer}>
                  <Text style={styles.modalLabel}>Time</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="HH:MM"
                    value={tempTime}
                    onChangeText={setTempTime}
                    keyboardType="numbers-and-punctuation"
                  />
                  <Text style={styles.modalHelper}>Format: HH:MM (e.g., 14:30 for 2:30 PM)</Text>
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.modalCancelButton]}
                    onPress={handleDateTimeCancel}
                  >
                    <Text style={styles.modalCancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.modalConfirmButton]}
                    onPress={handleDateTimeConfirm}
                  >
                    <Text style={styles.modalConfirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <View style={styles.actionButtons}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => setStep(step - 1)}
              activeOpacity={0.7}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.continueButton,
              ((step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid) || (step === 3 && !isStep3Valid)) && styles.continueButtonDisabled
            ]}
            onPress={handleContinue}
            disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid) || (step === 3 && !isStep3Valid)}
            activeOpacity={0.7}
          >
            <Text style={styles.continueButtonText}>
              {step < 3 ? 'Continue' : 'Proceed to Review'}
            </Text>
            <MaterialIcons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const PaymentOption = ({ name, description, recommended, isSelected, onPress }) => (
  <TouchableOpacity 
    style={[
      styles.paymentOption,
      isSelected && styles.paymentOptionSelected
    ]} 
    activeOpacity={0.7}
    onPress={onPress}
  >
    <View style={styles.radioContainer}>
      <View style={[
        styles.radioOuter,
        isSelected && styles.radioOuterSelected
      ]}>
        {isSelected && <View style={styles.radioInner} />}
      </View>
    </View>
    <View style={styles.paymentInfo}>
      <View style={styles.paymentHeader}>
        <Text style={[
          styles.paymentName,
          isSelected && styles.paymentNameSelected
        ]}>{name}</Text>
        {recommended && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>Recommended</Text>
          </View>
        )}
      </View>
      <Text style={styles.paymentDescription}>{description}</Text>
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
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
    marginBottom: 16,
  },
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    flexDirection: 'row',
    gap: 4,
  },
  progressStep: {
    flex: 1,
    height: 4,
    backgroundColor: '#1e4d7a',
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#60a5fa',
  },
  progressText: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  stepContainer: {
    gap: 20,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
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
  inputWithIcon: {
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 12,
    top: 12,
    zIndex: 1,
  },
  inputWithIconPadding: {
    paddingLeft: 40,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
  },
  photoSection: {
    gap: 12,
  },
  imagesContainer: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  selectedImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#ef4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoUpload: {
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
    backgroundColor: 'white',
  },
  photoTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginTop: 8,
  },
  photoSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  photoButton: {
    fontSize: 14,
    color: '#0C2D48',
    fontWeight: '500',
    marginTop: 12,
  },
  dateInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  dateInputText: {
    padding: 12,
    paddingLeft: 40,
    fontSize: 16,
    color: '#1f2937',
  },
  placeholderText: {
    color: '#9ca3af',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInputContainer: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  modalInput: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    fontSize: 16,
    backgroundColor: 'white',
  },
  modalHelper: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  modalConfirmButton: {
    backgroundColor: '#0C2D48',
  },
  modalConfirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  locationButton: {
    fontSize: 14,
    color: '#0C2D48',
    fontWeight: '500',
  },
  routeInfo: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 16,
  },
  routeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  routeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  routeValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  routeDuration: {
    fontSize: 14,
    color: '#6b7280',
  },
  vehicleRecommendation: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 16,
  },
  vehicleTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  vehicleType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#16a34a',
  },
  vehicleSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  summarySection: {
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  summaryDivider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  routeDistance: {
    fontSize: 14,
    color: '#0C2D48',
    marginTop: 4,
  },
  insuranceCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  insuranceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  insuranceContent: {
    flex: 1,
  },
  insuranceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  insuranceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  insuranceDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  insuranceDetails: {
    backgroundColor: '#dbeafe',
    borderRadius: 6,
    padding: 12,
  },
  insuranceDetail: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  detailLabel: {
    fontWeight: '600',
    color: '#1e40af',
  },
  insuranceProvider: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  priceCard: {
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
  },
  priceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  priceLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  priceValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  priceTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0C2D48',
  },
  paymentContainer: {
    gap: 12,
  },
  paymentTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  paymentOptions: {
    gap: 8,
  },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  paymentOptionSelected: {
    borderColor: '#0C2D48',
    backgroundColor: '#f0f9ff',
  },
  radioContainer: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioOuterSelected: {
    borderColor: '#0C2D48',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0C2D48',
  },
  paymentInfo: {
    flex: 1,
  },
  paymentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  paymentName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1f2937',
  },
  paymentNameSelected: {
    color: '#0C2D48',
    fontWeight: '600',
  },
  recommendedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  recommendedText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
  },
  paymentDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  selectedPaymentText: {
    fontSize: 14,
    color: '#0C2D48',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 8,
  },
  bottomPadding: {
    height: 100,
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  continueButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#0C2D48',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  continueButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default CreateBookingScreen;