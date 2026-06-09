import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Switch,
  Alert,
  Image
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as ImagePicker from 'expo-image-picker';
import useAuth from '../../hook/useAuth';
import apiService from '../../services/apiService';

const TrailerOwnerRegistrationScreen = ({ navigation }) => {
  const { user } = useAuth();

  // Check if user info already exists to skip step 1
  const hasUserInfo = user?.fullName && user?.email && user?.phone;

  const [step, setStep] = useState(hasUserInfo ? 2 : 1);
  const [ownerType, setOwnerType] = useState('individual'); // 'individual' or 'company'
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    // Owner Information - pre-populate from user data if available
    ownerName: user?.fullName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    idNumber: user?.idNumber || '',
    address: user?.address || '',

    // Company Information (if applicable)
    companyName: user?.companyName || '',
    registrationNumber: '',
    taxNumber: '',
    
    // Trailer Information
    trailerType: '',
    make: '',
    model: '',
    year: '',
    capacity: '',
    condition: '',
    features: [],
    licensePlate: '',
    vin: '',
    
    // Rental Terms
    dailyRate: '',
    weeklyRate: '',
    monthlyRate: '',
    minRentalPeriod: '1',
    availability: 'available',
    deliveryOption: false,
    deliveryRadius: '',
    
    // Payment & Insurance
    bankName: '',
    accountNumber: '',
    accountName: '',
    insuranceProvider: '',
    policyNumber: '',
    insuranceExpiry: '',
    hasInsurance: true
  });

  const trailerTypes = [
    'Flatbed',
    'Enclosed',
    'Refrigerated',
    'Lowboy',
    'Dump',
    'Tanker',
    'Car Carrier',
    'Other'
  ];

  const trailerFeatures = [
    'Tarpaulin Cover',
    'Lift Gate',
    'Air Ride',
    'GPS Tracking',
    'Side Loading',
    'Rear Loading',
    'Winch',
    'Tie-down Points',
    'Lighting',
    'ABS Brakes'
  ];

  const navigateTo = (screen) => {
    if (navigation) {
      navigation.navigate(screen);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleFeature = (feature) => {
    const currentFeatures = [...formData.features];
    if (currentFeatures.includes(feature)) {
      updateField('features', currentFeatures.filter(f => f !== feature));
    } else {
      updateField('features', [...currentFeatures, feature]);
    }
  };

  // Image Picker Functions
  const requestPermissions = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Sorry, we need camera roll permissions to upload trailer photos!');
      return false;
    }
    return true;
  };

  const pickImages = async () => {
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

  const showImagePickerOptions = () => {
    Alert.alert(
      'Add Trailer Photos',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: takePhoto,
        },
        {
          text: 'Choose from Gallery',
          onPress: pickImages,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ]
    );
  };

  // Validation functions for each step
  const isStep1Valid = () => {
    if (ownerType === 'individual') {
      return formData.ownerName && formData.email && formData.phone && formData.idNumber;
    } else {
      return formData.companyName && formData.registrationNumber && formData.taxNumber && formData.ownerName;
    }
  };

  const isStep2Valid = () => {
    return formData.trailerType && formData.make && formData.model && formData.year && 
           formData.capacity && formData.condition && formData.licensePlate;
  };

  const isStep3Valid = () => {
    return formData.dailyRate && formData.minRentalPeriod;
  };

  const isStep4Valid = () => {
    return formData.bankName && formData.accountNumber && formData.accountName;
  };

  const handleSubmit = async () => {
    const submissionData = {
      assetType: 'trailer',
      assetName: `${formData.make} ${formData.model}`.trim(),
      registrationNumber: formData.licensePlate,
      year: Number(formData.year),
      // Send the selected type so the backend can resolve/persist it.
      trailerType: formData.trailerType,
      capacity: {
        weight: {
          // The field is entered in tonnes; store in kg for platform consistency.
          value: Number(formData.capacity) * 1000,
          unit: 'kg'
        }
      },
      features: {
        refrigeration: formData.trailerType === 'Refrigerated',
        liftGate: formData.features.includes('Lift Gate'),
        tarpaulin: formData.features.includes('Tarpaulin Cover'),
        sideLoader: formData.features.includes('Side Loading'),
        gps: formData.features.includes('GPS Tracking'),
        lighting: formData.features.includes('Lighting'),
        tieDowns: formData.features.includes('Tie-down Points')
      },
      insurance: {
        provider: formData.insuranceProvider,
        policyNumber: formData.policyNumber,
        expiryDate: formData.insuranceExpiry
      },
      documents: {
        registration: {
          number: formData.registrationNumber || formData.licensePlate
        }
      },
      status: formData.availability,
      rentalSettings: {
        availableForRental: true,
        dailyRate: Number(formData.dailyRate),
        weeklyRate: Number(formData.weeklyRate || 0),
        monthlyRate: Number(formData.monthlyRate || 0),
        minimumRentalPeriod: {
          value: Number(formData.minRentalPeriod),
          unit: 'days'
        },
        deliveryAvailable: formData.deliveryOption,
        deliveryFee: Number(formData.deliveryRadius || 0)
      },
      images: images.map((uri, index) => ({
        url: uri,
        caption: index === 0 ? 'Primary trailer photo' : 'Trailer photo',
        isPrimary: index === 0
      })),
      description: `${formData.condition} ${formData.trailerType} trailer listed by ${ownerType === 'company' ? formData.companyName : formData.ownerName}`.trim()
    };

    setSubmitting(true);
    try {
      const response = await apiService.createTrailer(submissionData);
      Alert.alert(
        'Trailer Saved',
        response.message || 'Your trailer has been added to your fleet and is available for rental management.',
        [{ text: 'OK', onPress: () => navigateTo('TrailerList') }]
      );
    } catch (error) {
      Alert.alert('Unable to list trailer', error.message || 'Please check the details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color="white" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>List Your Trailer</Text>
        <Text style={styles.headerSubtitle}>Step {step} of 4</Text>
        
        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          {[1, 2, 3, 4].map(s => (
            <View 
              key={s}
              style={[
                styles.progressStep,
                s <= step ? styles.progressStepActive : styles.progressStepInactive
              ]} 
            />
          ))}
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {step === 1 && (
            <>
              <Text style={styles.stepTitle}>Owner Information</Text>
              
              {/* Owner Type Selection */}
              <View style={styles.ownerTypeContainer}>
                <Text style={styles.sectionLabel}>I am registering as:</Text>
                <View style={styles.ownerTypeButtons}>
                  <TouchableOpacity
                    style={[
                      styles.ownerTypeButton,
                      ownerType === 'individual' && styles.ownerTypeButtonActive
                    ]}
                    onPress={() => setOwnerType('individual')}
                  >
                    <MaterialIcons 
                      name="person" 
                      size={24} 
                      color={ownerType === 'individual' ? '#0C2D48' : '#6b7280'} 
                    />
                    <Text style={[
                      styles.ownerTypeText,
                      ownerType === 'individual' && styles.ownerTypeTextActive
                    ]}>
                      Individual
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[
                      styles.ownerTypeButton,
                      ownerType === 'company' && styles.ownerTypeButtonActive
                    ]}
                    onPress={() => setOwnerType('company')}
                  >
                    <MaterialIcons 
                      name="business" 
                      size={24} 
                      color={ownerType === 'company' ? '#0C2D48' : '#6b7280'} 
                    />
                    <Text style={[
                      styles.ownerTypeText,
                      ownerType === 'company' && styles.ownerTypeTextActive
                    ]}>
                      Company
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Dynamic Form based on Owner Type */}
              {ownerType === 'individual' ? (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Full Name *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="John Moyo"
                      value={formData.ownerName}
                      onChangeText={(value) => updateField('ownerName', value)}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Email Address *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="john@example.com"
                      value={formData.email}
                      onChangeText={(value) => updateField('email', value)}
                      keyboardType="email-address"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Phone Number *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="+263 77 123 4567"
                      value={formData.phone}
                      onChangeText={(value) => updateField('phone', value)}
                      keyboardType="phone-pad"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>National ID Number *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="63-1234567X-XX"
                      value={formData.idNumber}
                      onChangeText={(value) => updateField('idNumber', value)}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Physical Address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="123 Main St, Harare"
                      value={formData.address}
                      onChangeText={(value) => updateField('address', value)}
                    />
                  </View>
                </>
              ) : (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Company Name *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="ABC Trailers Ltd"
                      value={formData.companyName}
                      onChangeText={(value) => updateField('companyName', value)}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Registration Number *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="123456/78"
                      value={formData.registrationNumber}
                      onChangeText={(value) => updateField('registrationNumber', value)}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Tax Number *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="ZIMRA Tax Number"
                      value={formData.taxNumber}
                      onChangeText={(value) => updateField('taxNumber', value)}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Contact Person *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="John Moyo"
                      value={formData.ownerName}
                      onChangeText={(value) => updateField('ownerName', value)}
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Email Address *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="john@abctrailers.co.zw"
                      value={formData.email}
                      onChangeText={(value) => updateField('email', value)}
                      keyboardType="email-address"
                    />
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>Phone Number *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="+263 77 123 4567"
                      value={formData.phone}
                      onChangeText={(value) => updateField('phone', value)}
                      keyboardType="phone-pad"
                    />
                  </View>
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.stepTitle}>Trailer Details</Text>

              {/* Trailer Photos */}
              <View style={styles.photoSection}>
                <Text style={styles.label}>Trailer Photos *</Text>
                <Text style={styles.helperText}>Show different angles of your trailer</Text>
                
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

              {/* Trailer Type */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Trailer Type *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typeScroll}>
                  <View style={styles.typeOptions}>
                    {trailerTypes.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeOption,
                          formData.trailerType === type && styles.typeOptionSelected
                        ]}
                        onPress={() => updateField('trailerType', type)}
                      >
                        <Text style={[
                          styles.typeOptionText,
                          formData.trailerType === type && styles.typeOptionTextSelected
                        ]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {/* Basic Information */}
              <View style={styles.row}>
                <View style={[styles.inputContainer, styles.halfInput]}>
                  <Text style={styles.label}>Make *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Mercedes"
                    value={formData.make}
                    onChangeText={(value) => updateField('make', value)}
                  />
                </View>
                <View style={[styles.inputContainer, styles.halfInput]}>
                  <Text style={styles.label}>Model *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., Actros"
                    value={formData.model}
                    onChangeText={(value) => updateField('model', value)}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputContainer, styles.halfInput]}>
                  <Text style={styles.label}>Year *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 2022"
                    value={formData.year}
                    onChangeText={(value) => updateField('year', value)}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputContainer, styles.halfInput]}>
                  <Text style={styles.label}>Capacity (tonnes) *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 10"
                    value={formData.capacity}
                    onChangeText={(value) => updateField('capacity', value)}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* License and VIN */}
              <View style={styles.row}>
                <View style={[styles.inputContainer, styles.halfInput]}>
                  <Text style={styles.label}>License Plate *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., ABC1234"
                    value={formData.licensePlate}
                    onChangeText={(value) => updateField('licensePlate', value)}
                  />
                </View>
                <View style={[styles.inputContainer, styles.halfInput]}>
                  <Text style={styles.label}>VIN Number</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Vehicle Identification Number"
                    value={formData.vin}
                    onChangeText={(value) => updateField('vin', value)}
                  />
                </View>
              </View>

              {/* Condition */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Condition *</Text>
                <View style={styles.conditionOptions}>
                  {['Excellent', 'Good', 'Fair', 'Needs Repair'].map((condition) => (
                    <TouchableOpacity
                      key={condition}
                      style={[
                        styles.conditionOption,
                        formData.condition === condition && styles.conditionOptionSelected
                      ]}
                      onPress={() => updateField('condition', condition)}
                    >
                      <Text style={[
                        styles.conditionOptionText,
                        formData.condition === condition && styles.conditionOptionTextSelected
                      ]}>
                        {condition}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Features */}
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Features & Equipment</Text>
                <View style={styles.featuresGrid}>
                  {trailerFeatures.map((feature) => (
                    <TouchableOpacity
                      key={feature}
                      style={[
                        styles.featureOption,
                        formData.features.includes(feature) && styles.featureOptionSelected
                      ]}
                      onPress={() => toggleFeature(feature)}
                    >
                      <Text style={[
                        styles.featureOptionText,
                        formData.features.includes(feature) && styles.featureOptionTextSelected
                      ]}>
                        {feature}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.stepTitle}>Rental Terms</Text>

              {/* Rental Rates */}
              <View style={styles.ratesCard}>
                <Text style={styles.cardTitle}>Set Your Rates (USD)</Text>
                
                <View style={styles.rateInputContainer}>
                  <View style={styles.rateInput}>
                    <Text style={styles.rateLabel}>Daily Rate *</Text>
                    <View style={styles.currencyInput}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.rateTextInput}
                        placeholder="80"
                        value={formData.dailyRate}
                        onChangeText={(value) => updateField('dailyRate', value)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.rateInput}>
                    <Text style={styles.rateLabel}>Weekly Rate</Text>
                    <View style={styles.currencyInput}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.rateTextInput}
                        placeholder="500"
                        value={formData.weeklyRate}
                        onChangeText={(value) => updateField('weeklyRate', value)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <View style={styles.rateInput}>
                    <Text style={styles.rateLabel}>Monthly Rate</Text>
                    <View style={styles.currencyInput}>
                      <Text style={styles.currencySymbol}>$</Text>
                      <TextInput
                        style={styles.rateTextInput}
                        placeholder="1800"
                        value={formData.monthlyRate}
                        onChangeText={(value) => updateField('monthlyRate', value)}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                </View>
              </View>

              {/* Rental Settings */}
              <View style={styles.settingsCard}>
                <Text style={styles.cardTitle}>Rental Settings</Text>
                
                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Minimum Rental Period (days) *</Text>
                  <TextInput
                    style={styles.smallInput}
                    placeholder="1"
                    value={formData.minRentalPeriod}
                    onChangeText={(value) => updateField('minRentalPeriod', value)}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.settingRow}>
                  <Text style={styles.settingLabel}>Availability</Text>
                  <View style={styles.availabilityOptions}>
                    {['available', 'unavailable'].map((status) => (
                      <TouchableOpacity
                        key={status}
                        style={[
                          styles.availabilityOption,
                          formData.availability === status && styles.availabilityOptionSelected
                        ]}
                        onPress={() => updateField('availability', status)}
                      >
                        <Text style={[
                          styles.availabilityOptionText,
                          formData.availability === status && styles.availabilityOptionTextSelected
                        ]}>
                          {status === 'available' ? 'Available' : 'Not Available'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.settingRow}>
                  <View style={styles.switchContainer}>
                    <Text style={styles.settingLabel}>Offer Delivery Service</Text>
                    <Switch
                      value={formData.deliveryOption}
                      onValueChange={(value) => updateField('deliveryOption', value)}
                      trackColor={{ false: '#767577', true: '#0C2D48' }}
                      thumbColor={formData.deliveryOption ? '#F37021' : '#f4f3f4'}
                    />
                  </View>
                </View>

                {formData.deliveryOption && (
                  <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Delivery Radius (km)</Text>
                    <TextInput
                      style={styles.smallInput}
                      placeholder="50"
                      value={formData.deliveryRadius}
                      onChangeText={(value) => updateField('deliveryRadius', value)}
                      keyboardType="numeric"
                    />
                  </View>
                )}
              </View>

              {/* Commission Info */}
              <View style={styles.infoBanner}>
                <MaterialIcons name="info" size={20} color="#F37021" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoTitle}>Platform Commission</Text>
                  <Text style={styles.infoText}>
                    15% platform fee on all rentals. Payments are processed securely and paid out within 24 hours after rental completion.
                  </Text>
                </View>
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <Text style={styles.stepTitle}>Payment & Insurance</Text>

              {/* Bank Details */}
              <View style={styles.paymentCard}>
                <Text style={styles.cardTitle}>Bank Account Details *</Text>
                
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Bank Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., CBZ Bank"
                    value={formData.bankName}
                    onChangeText={(value) => updateField('bankName', value)}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Account Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., 12345678901"
                    value={formData.accountNumber}
                    onChangeText={(value) => updateField('accountNumber', value)}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Account Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., John Moyo"
                    value={formData.accountName}
                    onChangeText={(value) => updateField('accountName', value)}
                  />
                </View>
              </View>

              {/* Insurance Information */}
              <View style={styles.insuranceCard}>
                <View style={styles.insuranceHeader}>
                  <Switch
                    value={formData.hasInsurance}
                    onValueChange={(value) => updateField('hasInsurance', value)}
                    trackColor={{ false: '#767577', true: '#0C2D48' }}
                    thumbColor={formData.hasInsurance ? '#F37021' : '#f4f3f4'}
                  />
                  <View style={styles.insuranceContent}>
                    <Text style={styles.insuranceTitle}>Trailer Insurance</Text>
                    <Text style={styles.insuranceSubtitle}>
                      Do you have current insurance coverage for this trailer?
                    </Text>
                  </View>
                </View>

                {formData.hasInsurance && (
                  <View style={styles.insuranceDetails}>
                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Insurance Provider</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g., Old Mutual"
                        value={formData.insuranceProvider}
                        onChangeText={(value) => updateField('insuranceProvider', value)}
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Policy Number</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Policy number"
                        value={formData.policyNumber}
                        onChangeText={(value) => updateField('policyNumber', value)}
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <Text style={styles.label}>Expiry Date</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="YYYY-MM-DD"
                        value={formData.insuranceExpiry}
                        onChangeText={(value) => updateField('insuranceExpiry', value)}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Terms and Conditions */}
              <View style={styles.termsCard}>
                <Text style={styles.termsTitle}>Terms & Conditions</Text>
                <Text style={styles.termsText}>
                  By submitting this registration, you agree to our Rental Agreement, which includes:
                  {"\n\n"}• Maintaining your trailer in safe working condition
                  {"\n"}• Responding to rental requests within 2 hours
                  {"\n"}• Providing accurate trailer information
                  {"\n"}• Paying 15% platform commission on all rentals
                  {"\n"}• Complying with all Zimbabwe transport regulations
                  {"\n\n"}Your trailer will be verified before being listed on the platform.
                </Text>
              </View>
            </>
          )}

          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={styles.bottomActions}>
        <View style={styles.actionButtons}>
          {step > 1 && (
            <TouchableOpacity
              style={styles.backButtonAction}
              onPress={() => setStep(step - 1)}
            >
              <Text style={styles.backButtonActionText}>Back</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.continueButton,
              (step === 1 && !isStep1Valid()) || 
              (step === 2 && !isStep2Valid()) || 
              (step === 3 && !isStep3Valid()) || 
              (step === 4 && (!isStep4Valid() || submitting))
                ? styles.continueButtonDisabled : null
            ]}
            onPress={() => {
              if (step < 4) {
                setStep(step + 1);
              } else {
                handleSubmit();
              }
            }}
            disabled={
              (step === 1 && !isStep1Valid()) || 
              (step === 2 && !isStep2Valid()) || 
              (step === 3 && !isStep3Valid()) || 
              (step === 4 && (!isStep4Valid() || submitting))
            }
          >
            <Text style={styles.continueButtonText}>
              {submitting ? 'Submitting...' : step < 4 ? 'Continue' : 'Submit Registration'}
            </Text>
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
    paddingTop: 45,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  backButtonText: {
    color: 'white',
    fontSize: 16,
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
    marginBottom: 16,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  progressStep: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  progressStepActive: {
    backgroundColor: '#60a5fa',
  },
  progressStepInactive: {
    backgroundColor: '#1e4d7a',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  ownerTypeContainer: {
    marginBottom: 24,
    marginTop:5,
  },
  ownerTypeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  ownerTypeButton: {
    flex: 1,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 8,
  },
  ownerTypeButtonActive: {
    borderColor: '#0C2D48',
    backgroundColor: '#f0f9ff',
  },
  ownerTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  ownerTypeTextActive: {
    color: '#0C2D48',
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  smallInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    width: 80,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  // Photo Upload Styles
  photoSection: {
    marginBottom: 24,
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 12,
  },
  imagesContainer: {
    flexDirection: 'row',
    marginBottom: 12,
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
  // Trailer Type Styles
  typeScroll: {
    marginHorizontal: -16,
  },
  typeOptions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
  },
  typeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
  },
  typeOptionSelected: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  typeOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  typeOptionTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
  // Condition Styles
  conditionOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
  },
  conditionOptionSelected: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  conditionOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  conditionOptionTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
  // Features Grid
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  featureOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
  },
  featureOptionSelected: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  featureOptionText: {
    fontSize: 12,
    color: '#374151',
  },
  featureOptionTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
  // Card Styles
  ratesCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  settingsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  paymentCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  insuranceCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 16,
  },
  termsCard: {
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  termsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  termsText: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  // Rate Input Styles
  rateInputContainer: {
    gap: 16,
  },
  rateInput: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rateLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  currencyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    width: 120,
  },
  currencySymbol: {
    fontSize: 16,
    color: '#6b7280',
    marginRight: 4,
  },
  rateTextInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 16,
    color: '#1f2937',
  },
  // Setting Rows
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flex: 1,
  },
  // Availability Options
  availabilityOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  availabilityOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
  },
  availabilityOptionSelected: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  availabilityOptionText: {
    fontSize: 12,
    color: '#374151',
  },
  availabilityOptionTextSelected: {
    color: 'white',
    fontWeight: '500',
  },
  // Info Banner
  infoBanner: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 8,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#374151',
    lineHeight: 16,
  },
  // Insurance Styles
  insuranceHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  insuranceContent: {
    flex: 1,
  },
  insuranceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  insuranceSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  insuranceDetails: {
    marginTop: 16,
    gap: 12,
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
  backButtonAction: {
    flex: 1,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonActionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  continueButton: {
    flex: 1,
    paddingVertical: 16,
    backgroundColor: '#0C2D48',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});

export default TrailerOwnerRegistrationScreen;
