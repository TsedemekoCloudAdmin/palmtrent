// screens/CreateBookingScreen.js
import React, { useState, useEffect } from 'react';
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
  TouchableWithoutFeedback,
  ActivityIndicator
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useAuth from '../../hook/useAuth';
import * as ImagePicker from 'expo-image-picker';
import locationService from '../../services/locationService';
import vehicleService from '../../services/vehicleService';
import apiService from '../../services/apiService';

const CreateBookingScreen = ({ onNavigate, bookingData = {}, updateBookingData }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [showDateModal, setShowDateModal] = useState(false);
  const [tempDate, setTempDate] = useState('');
  const [tempTime, setTempTime] = useState('');
  const [images, setImages] = useState(bookingData.images || []);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState(null);
  const [vehicleRecommendation, setVehicleRecommendation] = useState(null);
  const [locationSearchResults, setLocationSearchResults] = useState({
    pickup: [],
    delivery: []
  });

  // Reference data from API
  const [cargoTypes, setCargoTypes] = useState([]);
  const [insuranceOptions, setInsuranceOptions] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);

  // Selection modals
  const [showCargoTypeModal, setShowCargoTypeModal] = useState(false);
  const [showInsuranceModal, setShowInsuranceModal] = useState(false);
  const [selectedCargoType, setSelectedCargoType] = useState(null);
  const [selectedInsurance, setSelectedInsurance] = useState(null);

  // ADDED: Pricing state
  const [calculatedPricing, setCalculatedPricing] = useState(null);

  const [formData, setFormData] = useState({
    cargoType: bookingData.cargoType || '',
    cargoTypeId: bookingData.cargoTypeId || null,
    weight: bookingData.weight || '',
    pickupLocation: bookingData.pickupLocation || '',
    deliveryLocation: bookingData.deliveryLocation || '',
    pickupDate: bookingData.pickupDate || '',
    cargoValue: bookingData.cargoValue || '',
    specialInstructions: bookingData.specialInstructions || '',
    insurance: bookingData.insurance || false,
    insuranceOption: bookingData.insuranceOption || null,
    bookingType: bookingData.bookingType || 'single'
  });

  // Fetch reference data on mount
  useEffect(() => {
    fetchReferenceData();
  }, []);

  const fetchReferenceData = async () => {
    setDataLoading(true);
    try {
      const [cargoResponse, insuranceResponse] = await Promise.all([
        apiService.request('/reference/cargo-types/grouped'),
        apiService.request('/reference/insurance-options/by-category')
      ]);

      if (cargoResponse.success) {
        setCargoTypes(cargoResponse.data);
      }
      if (insuranceResponse.success) {
        setInsuranceOptions(insuranceResponse.data);
      }
    } catch (error) {
      console.error('Failed to fetch reference data:', error);
    } finally {
      setDataLoading(false);
    }
  };

  // Load vehicle recommendation when cargo details change
  useEffect(() => {
    if (formData.cargoType && formData.weight) {
      loadVehicleRecommendation();
    }
  }, [formData.cargoType, formData.weight]);

  // Calculate route when locations change
  useEffect(() => {
    if (formData.pickupLocation && formData.deliveryLocation) {
      calculateRoute();
    }
  }, [formData.pickupLocation, formData.deliveryLocation]);

  // ADDED: Calculate pricing when all data is available
  useEffect(() => {
    if (routeInfo && vehicleRecommendation && formData.pickupDate) {
      calculatePricing();
    }
  }, [routeInfo, vehicleRecommendation, formData, images]);

  const loadVehicleRecommendation = async () => {
    try {
      const recommendation = await vehicleService.getVehicleRecommendation({
        cargoType: formData.cargoType,
        weight: formData.weight,
        cargoValue: formData.cargoValue
      });
      setVehicleRecommendation(recommendation);
    } catch (error) {
      console.error('Failed to load vehicle recommendation:', error);
    }
  };

  const calculateRoute = async () => {
    try {
      const route = await locationService.calculateRoute(
        formData.pickupLocation,
        formData.deliveryLocation
      );
      setRouteInfo(route);
    } catch (error) {
      console.error('Failed to calculate route:', error);
      setRouteInfo({
        distance: 440,
        duration: '7-8 hours',
        route: `${formData.pickupLocation} → ${formData.deliveryLocation}`
      });
    }
  };

  // ADDED: Calculate pricing function
  const calculatePricing = async () => {
    try {
      const pricingData = {
        route: {
          distance: routeInfo?.distance || 0,
          pickup: { address: formData.pickupLocation },
          delivery: { address: formData.deliveryLocation }
        },
        cargoDetails: {
          type: formData.cargoType,
          weight: parseFloat(formData.weight) || 0,
          value: parseFloat(formData.cargoValue) || 0,
          specialRequirements: formData.specialInstructions ? [formData.specialInstructions] : []
        },
        vehicleType: vehicleRecommendation?.vehicleType,
        insurance: { required: formData.insurance },
        isCrossBorder: isCrossBorderDestination(formData.deliveryLocation),
        paymentMethod: 'digital', // Default for calculation
        bookingType: formData.bookingType || 'single',
        urgency: 'standard' // Default urgency
      };

      const response = await apiService.post('/bookings/calculate-pricing', pricingData);
      
      if (response.success) {
        setCalculatedPricing(response.data);
      }
    } catch (error) {
      console.error('Failed to calculate pricing:', error);
      // Fallback pricing
      setCalculatedPricing({
        breakdown: {
          baseTransportFee: 400,
          platformFee: 48,
          platformFeeRate: 0.12,
          insurance: formData.insurance ? 45 : 0,
          insuranceRate: 0.0045,
          specialCargoFee: 0,
          crossBorderFees: { total: 0 }
        },
        totals: {
          subtotal: formData.insurance ? 493 : 448,
          total: formData.insurance ? 493 : 448
        }
      });
    }
  };

  const handleUseCurrentLocation = async (field) => {
    setLoading(true);
    try {
      const location = await locationService.getCurrentLocation();
      const address = await locationService.reverseGeocode(
        location.latitude,
        location.longitude
      );
      
      updateField(field, address.fullAddress);
      Alert.alert('Location Set', `Your current location has been set to: ${address.fullAddress}`);
    } catch (error) {
      Alert.alert('Location Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLocationSearch = async (query, field) => {
    // Map form field to state key
    const stateKey = field === 'pickupLocation' ? 'pickup' : 'delivery';

    if (query.length < 3) {
      setLocationSearchResults(prev => ({ ...prev, [stateKey]: [] }));
      return;
    }

    try {
      const results = await locationService.searchLocations(query);
      setLocationSearchResults(prev => ({ ...prev, [stateKey]: results }));
    } catch (error) {
      console.error('Location search error:', error);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if ((field === 'pickupLocation' || field === 'deliveryLocation') && value.length >= 3) {
      handleLocationSearch(value, field);
    }
  };

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

  const isStep1Valid = formData.cargoType && formData.weight && formData.cargoValue;
  const isStep2Valid = formData.pickupLocation && formData.deliveryLocation && formData.pickupDate;

  const crossBorderCountries = ['South Africa', 'Botswana', 'Zambia', 'Mozambique', 'Namibia'];

  const isCrossBorderDestination = (deliveryLocation) => {
    if (!deliveryLocation) return false;
    return crossBorderCountries.some(country => 
      deliveryLocation.toLowerCase().includes(country.toLowerCase())
    );
  };

  // UPDATED: Handle continue with proper data mapping
  const handleContinue = () => {
    if (step === 2 && isCrossBorderDestination(formData.deliveryLocation)) {
      // Prepare data for cross-border booking
      const bookingDataForReview = {
        // Basic booking info
        bookingType: formData.bookingType,
        
        // Cargo details (mapped to backend structure)
        cargoType: formData.cargoType,
        weight: parseFloat(formData.weight),
        cargoValue: parseFloat(formData.cargoValue),
        specialInstructions: formData.specialInstructions,
        images: images,
        
        // Route details (mapped to backend structure)
        pickupLocation: formData.pickupLocation,
        deliveryLocation: formData.deliveryLocation,
        pickupDate: formData.pickupDate,
        
        // Additional data
        insurance: formData.insurance,
        isCrossBorder: true,
        
        // Calculated data
        routeInfo: routeInfo,
        vehicleRecommendation: vehicleRecommendation,
        pricing: calculatedPricing
      };

      updateBookingData(bookingDataForReview);
      onNavigate('cross-border-booking');
    } else if (step === 2 && isStep2Valid) {
      // Prepare complete booking data for review
      const bookingDataForReview = {
        // Basic booking info
        bookingType: formData.bookingType || 'single',
        
        // Cargo details (mapped to backend structure)
        cargoType: formData.cargoType,
        weight: parseFloat(formData.weight),
        cargoValue: parseFloat(formData.cargoValue),
        specialInstructions: formData.specialInstructions,
        images: images,
        
        // Route details (mapped to backend structure)
        pickupLocation: formData.pickupLocation,
        deliveryLocation: formData.deliveryLocation,
        pickupDate: formData.pickupDate,
        
        // Insurance and cross-border
        insurance: formData.insurance,
        isCrossBorder: isCrossBorderDestination(formData.deliveryLocation),
        
        // Calculated data
        routeInfo: routeInfo,
        vehicleRecommendation: vehicleRecommendation,
        pricing: calculatedPricing
      };

      console.log("Sending to review screen:", bookingDataForReview);
      updateBookingData(bookingDataForReview);
      onNavigate('booking-review');
    } else if (step < 2) {
      setStep(step + 1);
    }
  };

  const renderLocationSearchResults = (stateKey) => {
    const results = locationSearchResults[stateKey];
    if (!results || results.length === 0) return null;

    // Map state key back to form field
    const formField = stateKey === 'pickup' ? 'pickupLocation' : 'deliveryLocation';

    return (
      <View style={styles.searchResults}>
        <ScrollView
          nestedScrollEnabled={true}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={true}
        >
          {results.slice(0, 5).map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.searchResultItem}
              onPress={() => {
                // Set the value directly (not via updateField) so we don't
                // re-trigger the location search, which would immediately
                // repopulate and reopen this dropdown over the next field.
                setFormData(prev => ({ ...prev, [formField]: item.address }));
                setLocationSearchResults(prev => ({ ...prev, [stateKey]: [] }));
              }}
            >
              <MaterialIcons name="location-on" size={16} color="#6b7280" />
              <Text style={styles.searchResultText} numberOfLines={2}>{item.address}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
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
          </View>
          <Text style={styles.progressText}>Step {step} of 2</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Cargo Details</Text>

              <View style={styles.inputContainer}>
                <Text style={styles.label}>What are you transporting? *</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setShowCargoTypeModal(true)}
                >
                  <Text style={selectedCargoType ? styles.selectInputText : styles.selectInputPlaceholder}>
                    {selectedCargoType?.name || 'Select cargo type...'}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={24} color="#6b7280" />
                </TouchableOpacity>
                {selectedCargoType && (
                  <View style={styles.cargoTypeInfo}>
                    <Text style={styles.cargoTypeCategory}>
                      Category: {selectedCargoType.category}
                    </Text>
                    {selectedCargoType.specialRequirements?.length > 0 && (
                      <Text style={styles.cargoTypeRequirements}>
                        Requirements: {selectedCargoType.specialRequirements.join(', ')}
                      </Text>
                    )}
                  </View>
                )}
              </View>

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

              {/* Insurance Selection */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Insurance Coverage</Text>
                <TouchableOpacity
                  style={styles.selectInput}
                  onPress={() => setShowInsuranceModal(true)}
                >
                  <View style={styles.insuranceSelectContent}>
                    <MaterialIcons
                      name={formData.insurance ? "verified-user" : "security"}
                      size={20}
                      color={formData.insurance ? "#16a34a" : "#6b7280"}
                    />
                    <Text style={selectedInsurance ? styles.selectInputText : styles.selectInputPlaceholder}>
                      {selectedInsurance?.name || (formData.insurance ? 'Insurance Selected' : 'No Insurance (Tap to add)')}
                    </Text>
                  </View>
                  <MaterialIcons name="arrow-drop-down" size={24} color="#6b7280" />
                </TouchableOpacity>
                {selectedInsurance && (
                  <View style={styles.insuranceInfo}>
                    <View style={styles.insuranceInfoRow}>
                      <Text style={styles.insuranceInfoLabel}>Rate:</Text>
                      <Text style={styles.insuranceInfoValue}>
                        {((selectedInsurance.baseRate || selectedInsurance.rate || 0) * 100).toFixed(2)}%
                      </Text>
                    </View>
                    {formData.cargoValue && (
                      <View style={styles.insuranceInfoRow}>
                        <Text style={styles.insuranceInfoLabel}>Est. Premium:</Text>
                        <Text style={styles.insuranceInfoValue}>
                          ${(parseFloat(formData.cargoValue) * (selectedInsurance.baseRate || selectedInsurance.rate || 0)).toFixed(2)}
                        </Text>
                      </View>
                    )}
                    <View style={styles.insuranceInfoRow}>
                      <Text style={styles.insuranceInfoLabel}>Max Premium:</Text>
                      <Text style={styles.insuranceInfoValue}>
                        ${(selectedInsurance.calculation?.maxPremium || selectedInsurance.maxCoverage)?.toLocaleString() || 'N/A'}
                      </Text>
                    </View>
                  </View>
                )}
                <Text style={styles.helperText}>
                  Choose insurance based on cargo type: livestock, dangerous goods, agriculture, etc.
                </Text>
              </View>

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

              <View style={styles.photoSection}>
                <Text style={styles.label}>Cargo Photos (Optional)</Text>
                <Text style={styles.helperText}>Help transporters see your cargo</Text>
                
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

              {/* ADDED: Show estimated pricing in step 1 */}
              {calculatedPricing && (
                <View style={styles.pricePreview}>
                  <Text style={styles.pricePreviewTitle}>Estimated Price</Text>
                  <Text style={styles.pricePreviewAmount}>
                    USD ${calculatedPricing.totals?.total || 0}
                  </Text>
                  <Text style={styles.pricePreviewBreakdown}>
                    Base: ${calculatedPricing.breakdown?.baseTransportFee || 0} • 
                    Platform: ${calculatedPricing.breakdown?.platformFee || 0} • 
                    Insurance: ${calculatedPricing.breakdown?.insurance || 0}
                  </Text>
                </View>
              )}
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>Route & Schedule</Text>

              <View style={[styles.inputContainer, { zIndex: 100 }]}>
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
                {renderLocationSearchResults('pickup')}
                <TouchableOpacity
                  onPress={() => handleUseCurrentLocation('pickupLocation')}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#0C2D48" />
                  ) : (
                    <Text style={styles.locationButton}>Use Current Location</Text>
                  )}
                </TouchableOpacity>
              </View>

              <View style={[styles.inputContainer, { zIndex: 50 }]}>
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
                {renderLocationSearchResults('delivery')}
              </View>

              {routeInfo && (
                <View style={styles.routeInfo}>
                  <View style={styles.routeRow}>
                    <Text style={styles.routeLabel}>Distance</Text>
                    <Text style={styles.routeValue}>{routeInfo.distance} km</Text>
                  </View>
                  <View style={styles.routeRow}>
                    <Text style={styles.routeLabel}>Est. Duration</Text>
                    <Text style={styles.routeDuration}>{routeInfo.duration}</Text>
                  </View>
                </View>
              )}

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

              {vehicleRecommendation && (
                <View style={styles.vehicleRecommendation}>
                  <Text style={styles.vehicleTitle}>✅ Recommended Vehicle</Text>
                  <Text style={styles.vehicleType}>{vehicleRecommendation.displayName}</Text>
                  <Text style={styles.vehicleSubtitle}>{vehicleRecommendation.reason}</Text>
                  {vehicleRecommendation.features && (
                    <Text style={styles.vehicleFeatures}>
                      Features: {vehicleRecommendation.features.join(', ')}
                    </Text>
                  )}
                </View>
              )}

              {/* ADDED: Show final pricing in step 2 */}
              {calculatedPricing && (
                <View style={styles.finalPricePreview}>
                  <Text style={styles.finalPriceTitle}>Final Estimated Price</Text>
                  <Text style={styles.finalPriceAmount}>
                    USD ${calculatedPricing.totals?.total || 0}
                  </Text>
                  <Text style={styles.finalPriceNote}>
                    This includes all fees and {formData.insurance ? 'insurance' : 'no insurance'}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
        
        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Date/Time Modal */}
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

      {/* Cargo Type Selection Modal */}
      <Modal
        visible={showCargoTypeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowCargoTypeModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowCargoTypeModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.selectionModalContent}>
                <View style={styles.selectionModalHeader}>
                  <Text style={styles.modalTitle}>Select Cargo Type</Text>
                  <TouchableOpacity onPress={() => setShowCargoTypeModal(false)}>
                    <MaterialIcons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {dataLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0C2D48" />
                    <Text style={styles.loadingText}>Loading cargo types...</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.selectionList}>
                    {Object.entries(cargoTypes).map(([category, categoryData]) => (
                      <View key={category} style={styles.categorySection}>
                        <Text style={styles.categoryTitle}>
                          {categoryData?.label || category.replace(/_/g, ' ').toUpperCase()}
                        </Text>
                        {(Array.isArray(categoryData) ? categoryData : categoryData?.items || []).map((item) => (
                          <TouchableOpacity
                            key={item._id}
                            style={[
                              styles.selectionItem,
                              selectedCargoType?._id === item._id && styles.selectionItemSelected
                            ]}
                            onPress={() => {
                              setSelectedCargoType(item);
                              updateField('cargoType', item.name);
                              updateField('cargoTypeId', item._id);
                              setShowCargoTypeModal(false);
                            }}
                          >
                            <View style={styles.selectionItemContent}>
                              <Text style={[
                                styles.selectionItemText,
                                selectedCargoType?._id === item._id && styles.selectionItemTextSelected
                              ]}>
                                {item.name}
                              </Text>
                              {item.description && (
                                <Text style={styles.selectionItemDescription}>
                                  {item.description}
                                </Text>
                              )}
                              {item.specialRequirements?.length > 0 && (
                                <View style={styles.requirementTags}>
                                  {item.specialRequirements.map((req, idx) => (
                                    <View key={idx} style={styles.requirementTag}>
                                      <Text style={styles.requirementTagText}>{req}</Text>
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                            {selectedCargoType?._id === item._id && (
                              <MaterialIcons name="check-circle" size={24} color="#0C2D48" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Insurance Selection Modal */}
      <Modal
        visible={showInsuranceModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowInsuranceModal(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowInsuranceModal(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.selectionModalContent}>
                <View style={styles.selectionModalHeader}>
                  <Text style={styles.modalTitle}>Select Insurance Option</Text>
                  <TouchableOpacity onPress={() => setShowInsuranceModal(false)}>
                    <MaterialIcons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                {dataLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#0C2D48" />
                    <Text style={styles.loadingText}>Loading insurance options...</Text>
                  </View>
                ) : (
                  <ScrollView style={styles.selectionList}>
                    {/* No Insurance Option */}
                    <TouchableOpacity
                      style={[
                        styles.selectionItem,
                        !formData.insurance && styles.selectionItemSelected
                      ]}
                      onPress={() => {
                        setSelectedInsurance(null);
                        updateField('insurance', false);
                        updateField('insuranceOption', null);
                        setShowInsuranceModal(false);
                      }}
                    >
                      <View style={styles.selectionItemContent}>
                        <Text style={[
                          styles.selectionItemText,
                          !formData.insurance && styles.selectionItemTextSelected
                        ]}>
                          No Insurance
                        </Text>
                        <Text style={styles.selectionItemDescription}>
                          Proceed without cargo insurance coverage
                        </Text>
                      </View>
                      {!formData.insurance && (
                        <MaterialIcons name="check-circle" size={24} color="#0C2D48" />
                      )}
                    </TouchableOpacity>

                    {Object.entries(insuranceOptions).map(([category, categoryData]) => (
                      <View key={category} style={styles.categorySection}>
                        <Text style={styles.categoryTitle}>
                          {categoryData?.label ||
                           (category === 'dangerous_goods' ? 'DANGEROUS GOODS' :
                           category === 'livestock' ? 'LIVESTOCK' :
                           category === 'agriculture' ? 'AGRICULTURE' :
                           category.replace(/_/g, ' ').toUpperCase())}
                        </Text>
                        {(Array.isArray(categoryData) ? categoryData : categoryData?.options || categoryData?.items || []).map((item) => (
                          <TouchableOpacity
                            key={item._id}
                            style={[
                              styles.selectionItem,
                              selectedInsurance?._id === item._id && styles.selectionItemSelected
                            ]}
                            onPress={() => {
                              setSelectedInsurance(item);
                              updateField('insurance', true);
                              updateField('insuranceOption', item);
                              setShowInsuranceModal(false);
                            }}
                          >
                            <View style={styles.selectionItemContent}>
                              <View style={styles.insuranceItemHeader}>
                                <Text style={[
                                  styles.selectionItemText,
                                  selectedInsurance?._id === item._id && styles.selectionItemTextSelected
                                ]}>
                                  {item.name}
                                </Text>
                                <View style={styles.insuranceRateBadge}>
                                  <Text style={styles.insuranceRateText}>
                                    {((item.baseRate || item.rate || 0) * 100).toFixed(2)}%
                                  </Text>
                                </View>
                              </View>
                              {item.description && (
                                <Text style={styles.selectionItemDescription}>
                                  {item.description}
                                </Text>
                              )}
                              {formData.cargoValue && (
                                <Text style={styles.insuranceEstimate}>
                                  Est. Premium: ${(parseFloat(formData.cargoValue) * (item.baseRate || item.rate || 0)).toFixed(2)}
                                </Text>
                              )}
                              <Text style={styles.insuranceCoverage}>
                                Max Premium: ${(item.calculation?.maxPremium || item.maxCoverage)?.toLocaleString() || 'N/A'}
                              </Text>
                            </View>
                            {selectedInsurance?._id === item._id && (
                              <MaterialIcons name="check-circle" size={24} color="#0C2D48" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </ScrollView>
                )}
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
              ((step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)) && styles.continueButtonDisabled
            ]}
            onPress={handleContinue}
            disabled={(step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid)}
            activeOpacity={0.7}
          >
            <Text style={styles.continueButtonText}>
              {step < 2 ? 'Continue' : 'Review Booking'}
            </Text>
            <MaterialIcons name="arrow-forward" size={20} color="white" />
          </TouchableOpacity>
        </View>
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
    position: 'relative',
    zIndex: 1,
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
  vehicleFeatures: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    fontStyle: 'italic',
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
  searchResults: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    position: 'absolute',
    top: 68,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  searchResultText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },pricePreview: {
    backgroundColor: '#f0f9ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  pricePreviewTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  pricePreviewAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0C2D48',
    marginBottom: 4,
  },
  pricePreviewBreakdown: {
    fontSize: 12,
    color: '#6b7280',
  },
  finalPricePreview: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 8,
    padding: 16,
    marginTop: 16,
  },
  finalPriceTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#166534',
    marginBottom: 4,
  },
  finalPriceAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0C2D48',
    marginBottom: 4,
  },
  finalPriceNote: {
    fontSize: 12,
    color: '#6b7280',
  },
  // Select Input Styles
  selectInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: 'white',
  },
  selectInputText: {
    fontSize: 16,
    color: '#1f2937',
    flex: 1,
  },
  selectInputPlaceholder: {
    fontSize: 16,
    color: '#9ca3af',
    flex: 1,
  },
  // Cargo Type Info
  cargoTypeInfo: {
    backgroundColor: '#f0f9ff',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  cargoTypeCategory: {
    fontSize: 12,
    color: '#1e40af',
    fontWeight: '500',
  },
  cargoTypeRequirements: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  // Insurance Selection Content
  insuranceSelectContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  insuranceInfo: {
    backgroundColor: '#dcfce7',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
  },
  insuranceInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  insuranceInfoLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  insuranceInfoValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#166534',
  },
  // Selection Modal Styles
  selectionModalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    width: '100%',
    maxHeight: '80%',
    maxWidth: 450,
  },
  selectionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  selectionList: {
    maxHeight: 500,
  },
  categorySection: {
    paddingVertical: 8,
  },
  categoryTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6b7280',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f9fafb',
    letterSpacing: 0.5,
  },
  selectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  selectionItemSelected: {
    backgroundColor: '#f0f9ff',
  },
  selectionItemContent: {
    flex: 1,
    marginRight: 12,
  },
  selectionItemText: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '500',
  },
  selectionItemTextSelected: {
    color: '#0C2D48',
    fontWeight: '600',
  },
  selectionItemDescription: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  requirementTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  requirementTag: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  requirementTagText: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: '500',
  },
  // Insurance Modal Styles
  insuranceItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  insuranceRateBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  insuranceRateText: {
    fontSize: 11,
    color: '#1e40af',
    fontWeight: '600',
  },
  insuranceEstimate: {
    fontSize: 13,
    color: '#16a34a',
    fontWeight: '600',
    marginTop: 4,
  },
  insuranceCoverage: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  // Loading Styles
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
  },
});

export default CreateBookingScreen;