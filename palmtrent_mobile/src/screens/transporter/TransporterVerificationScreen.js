import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
  Image,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import apiService from '../../services/apiService';
import useAuth from '../../hook/useAuth';

const STEPS = [
  { id: 1, title: 'Personal Info', icon: 'person' },
  { id: 2, title: 'ID Document', icon: 'badge' },
  { id: 3, title: 'Driver License', icon: 'drive-eta' },
  { id: 4, title: 'Selfie', icon: 'camera-alt' },
  { id: 5, title: 'Review', icon: 'check-circle' }
];

const TransporterVerificationScreen = ({ navigation }) => {
  const { user, token } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    // Personal Info
    fullName: user?.fullName || '',
    idNumber: '',
    dateOfBirth: '',
    address: '',
    city: '',
    province: '',

    // Documents
    idDocument: {
      front: null,
      back: null,
      type: 'national_id' // national_id, passport
    },
    driverLicense: {
      front: null,
      back: null,
      licenseNumber: '',
      expiryDate: '',
      classes: [] // A, B, C, D, etc.
    },

    // Selfie
    selfiePhoto: null,

    // Consent
    consentGiven: false
  });

  const updateFormData = (field, value) => {
    setFormData(prev => {
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        return {
          ...prev,
          [parent]: {
            ...prev[parent],
            [child]: value
          }
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleTakePhoto = async (field) => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200,
      saveToPhotos: false
    };

    try {
      const result = await launchCamera(options);
      if (result.assets && result.assets[0]) {
        updateFormData(field, result.assets[0]);
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('Error', 'Failed to open camera');
    }
  };

  const handleChooseFromGallery = async (field) => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 1200,
      maxHeight: 1200
    };

    try {
      const result = await launchImageLibrary(options);
      if (result.assets && result.assets[0]) {
        updateFormData(field, result.assets[0]);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      Alert.alert('Error', 'Failed to open gallery');
    }
  };

  const showPhotoOptions = (field, title) => {
    Alert.alert(
      title,
      'Choose how to add photo',
      [
        { text: 'Take Photo', onPress: () => handleTakePhoto(field) },
        { text: 'Choose from Gallery', onPress: () => handleChooseFromGallery(field) },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const validateStep = (step) => {
    switch (step) {
      case 1:
        if (!formData.fullName || !formData.idNumber || !formData.address) {
          Alert.alert('Missing Information', 'Please fill in all required fields');
          return false;
        }
        return true;
      case 2:
        if (!formData.idDocument.front) {
          Alert.alert('Missing Document', 'Please upload the front of your ID document');
          return false;
        }
        return true;
      case 3:
        if (!formData.driverLicense.front || !formData.driverLicense.licenseNumber) {
          Alert.alert('Missing Information', 'Please upload your driver license and enter the license number');
          return false;
        }
        return true;
      case 4:
        if (!formData.selfiePhoto) {
          Alert.alert('Missing Photo', 'Please take a selfie for verification');
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    } else {
      navigation.goBack();
    }
  };

  const toggleLicenseClass = (licenseClass) => {
    const currentClasses = formData.driverLicense.classes;
    const newClasses = currentClasses.includes(licenseClass)
      ? currentClasses.filter(c => c !== licenseClass)
      : [...currentClasses, licenseClass];
    updateFormData('driverLicense.classes', newClasses);
  };

  const handleSubmit = async () => {
    if (!formData.consentGiven) {
      Alert.alert('Consent Required', 'Please agree to the terms and conditions');
      return;
    }

    setSubmitting(true);
    try {
      const uploadFormData = new FormData();

      // Personal info
      uploadFormData.append('fullName', formData.fullName);
      uploadFormData.append('idNumber', formData.idNumber);
      uploadFormData.append('dateOfBirth', formData.dateOfBirth);
      uploadFormData.append('address', formData.address);
      uploadFormData.append('city', formData.city);
      uploadFormData.append('province', formData.province);

      // Driver license info
      uploadFormData.append('licenseNumber', formData.driverLicense.licenseNumber);
      uploadFormData.append('licenseExpiry', formData.driverLicense.expiryDate);
      uploadFormData.append('licenseClasses', JSON.stringify(formData.driverLicense.classes));

      // ID Document front
      if (formData.idDocument.front) {
        uploadFormData.append('idFront', {
          uri: Platform.OS === 'android' ? formData.idDocument.front.uri : formData.idDocument.front.uri.replace('file://', ''),
          type: formData.idDocument.front.type || 'image/jpeg',
          name: 'id_front.jpg'
        });
      }

      // ID Document back
      if (formData.idDocument.back) {
        uploadFormData.append('idBack', {
          uri: Platform.OS === 'android' ? formData.idDocument.back.uri : formData.idDocument.back.uri.replace('file://', ''),
          type: formData.idDocument.back.type || 'image/jpeg',
          name: 'id_back.jpg'
        });
      }

      // Driver License front
      if (formData.driverLicense.front) {
        uploadFormData.append('licenseFront', {
          uri: Platform.OS === 'android' ? formData.driverLicense.front.uri : formData.driverLicense.front.uri.replace('file://', ''),
          type: formData.driverLicense.front.type || 'image/jpeg',
          name: 'license_front.jpg'
        });
      }

      // Driver License back
      if (formData.driverLicense.back) {
        uploadFormData.append('licenseBack', {
          uri: Platform.OS === 'android' ? formData.driverLicense.back.uri : formData.driverLicense.back.uri.replace('file://', ''),
          type: formData.driverLicense.back.type || 'image/jpeg',
          name: 'license_back.jpg'
        });
      }

      // Selfie
      if (formData.selfiePhoto) {
        uploadFormData.append('selfie', {
          uri: Platform.OS === 'android' ? formData.selfiePhoto.uri : formData.selfiePhoto.uri.replace('file://', ''),
          type: formData.selfiePhoto.type || 'image/jpeg',
          name: 'selfie.jpg'
        });
      }

      const response = await apiService.uploadRequest('/transporter/verify', uploadFormData);

      if (response.success) {
        Alert.alert(
          'Verification Submitted',
          'Your verification documents have been submitted. We will review them within 24-48 hours.',
          [
            { text: 'OK', onPress: () => navigation.navigate('Home') }
          ]
        );
      } else {
        Alert.alert('Error', response.message || 'Failed to submit verification');
      }
    } catch (error) {
      console.error('Verification submit error:', error);
      Alert.alert('Error', 'Failed to submit verification. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderProgressBar = () => (
    <View style={styles.progressContainer}>
      {STEPS.map((step, index) => (
        <React.Fragment key={step.id}>
          <View style={styles.stepIndicator}>
            <View style={[
              styles.stepCircle,
              currentStep >= step.id && styles.stepCircleActive,
              currentStep === step.id && styles.stepCircleCurrent
            ]}>
              {currentStep > step.id ? (
                <MaterialIcons name="check" size={16} color="white" />
              ) : (
                <MaterialIcons name={step.icon} size={16} color={currentStep >= step.id ? 'white' : '#9ca3af'} />
              )}
            </View>
            <Text style={[
              styles.stepLabel,
              currentStep >= step.id && styles.stepLabelActive
            ]}>
              {step.title}
            </Text>
          </View>
          {index < STEPS.length - 1 && (
            <View style={[
              styles.stepLine,
              currentStep > step.id && styles.stepLineActive
            ]} />
          )}
        </React.Fragment>
      ))}
    </View>
  );

  const renderPhotoUpload = (field, label, photo) => (
    <TouchableOpacity
      style={[styles.photoUploadBox, photo && styles.photoUploadBoxFilled]}
      onPress={() => showPhotoOptions(field, label)}
    >
      {photo ? (
        <View style={styles.photoPreviewContainer}>
          <Image source={{ uri: photo.uri }} style={styles.photoPreview} />
          <View style={styles.photoOverlay}>
            <MaterialIcons name="edit" size={24} color="white" />
            <Text style={styles.photoOverlayText}>Tap to change</Text>
          </View>
        </View>
      ) : (
        <View style={styles.photoPlaceholder}>
          <MaterialIcons name="add-a-photo" size={40} color="#9ca3af" />
          <Text style={styles.photoPlaceholderText}>{label}</Text>
          <Text style={styles.photoHint}>Tap to upload</Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Personal Information</Text>
      <Text style={styles.stepSubtitle}>Please provide your personal details</Text>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Full Name (as on ID) *</Text>
        <TextInput
          style={styles.input}
          value={formData.fullName}
          onChangeText={(value) => updateFormData('fullName', value)}
          placeholder="Enter your full name"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>ID Number *</Text>
        <TextInput
          style={styles.input}
          value={formData.idNumber}
          onChangeText={(value) => updateFormData('idNumber', value)}
          placeholder="Enter your ID number"
          keyboardType="numeric"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Date of Birth</Text>
        <TextInput
          style={styles.input}
          value={formData.dateOfBirth}
          onChangeText={(value) => updateFormData('dateOfBirth', value)}
          placeholder="DD/MM/YYYY"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Residential Address *</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.address}
          onChangeText={(value) => updateFormData('address', value)}
          placeholder="Enter your address"
          multiline
          numberOfLines={2}
        />
      </View>

      <View style={styles.row}>
        <View style={[styles.inputGroup, styles.flex]}>
          <Text style={styles.inputLabel}>City</Text>
          <TextInput
            style={styles.input}
            value={formData.city}
            onChangeText={(value) => updateFormData('city', value)}
            placeholder="City"
          />
        </View>
        <View style={[styles.inputGroup, styles.flex]}>
          <Text style={styles.inputLabel}>Province</Text>
          <TextInput
            style={styles.input}
            value={formData.province}
            onChangeText={(value) => updateFormData('province', value)}
            placeholder="Province"
          />
        </View>
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>ID Document</Text>
      <Text style={styles.stepSubtitle}>Upload a clear photo of your ID document</Text>

      <View style={styles.idTypeSelector}>
        {['national_id', 'passport'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.idTypeButton,
              formData.idDocument.type === type && styles.idTypeButtonActive
            ]}
            onPress={() => updateFormData('idDocument.type', type)}
          >
            <MaterialIcons
              name={type === 'national_id' ? 'badge' : 'flight'}
              size={20}
              color={formData.idDocument.type === type ? 'white' : '#6b7280'}
            />
            <Text style={[
              styles.idTypeText,
              formData.idDocument.type === type && styles.idTypeTextActive
            ]}>
              {type === 'national_id' ? 'National ID' : 'Passport'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.photoRow}>
        {renderPhotoUpload('idDocument.front', 'Front of ID *', formData.idDocument.front)}
        {renderPhotoUpload('idDocument.back', 'Back of ID', formData.idDocument.back)}
      </View>

      <View style={styles.tipBox}>
        <MaterialIcons name="lightbulb" size={20} color="#d97706" />
        <Text style={styles.tipText}>
          Ensure the photo is clear, well-lit, and all text is readable
        </Text>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Driver License</Text>
      <Text style={styles.stepSubtitle}>Upload your valid driver license</Text>

      <View style={styles.photoRow}>
        {renderPhotoUpload('driverLicense.front', 'Front of License *', formData.driverLicense.front)}
        {renderPhotoUpload('driverLicense.back', 'Back of License', formData.driverLicense.back)}
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>License Number *</Text>
        <TextInput
          style={styles.input}
          value={formData.driverLicense.licenseNumber}
          onChangeText={(value) => updateFormData('driverLicense.licenseNumber', value)}
          placeholder="Enter license number"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>Expiry Date</Text>
        <TextInput
          style={styles.input}
          value={formData.driverLicense.expiryDate}
          onChangeText={(value) => updateFormData('driverLicense.expiryDate', value)}
          placeholder="DD/MM/YYYY"
        />
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.inputLabel}>License Classes</Text>
        <View style={styles.licenseClasses}>
          {['A', 'B', 'C', 'D', 'E', 'EC'].map((cls) => (
            <TouchableOpacity
              key={cls}
              style={[
                styles.licenseClassButton,
                formData.driverLicense.classes.includes(cls) && styles.licenseClassButtonActive
              ]}
              onPress={() => toggleLicenseClass(cls)}
            >
              <Text style={[
                styles.licenseClassText,
                formData.driverLicense.classes.includes(cls) && styles.licenseClassTextActive
              ]}>
                {cls}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Selfie Verification</Text>
      <Text style={styles.stepSubtitle}>Take a clear selfie for identity verification</Text>

      <View style={styles.selfieContainer}>
        {formData.selfiePhoto ? (
          <TouchableOpacity
            style={styles.selfiePreviewContainer}
            onPress={() => showPhotoOptions('selfiePhoto', 'Selfie')}
          >
            <Image source={{ uri: formData.selfiePhoto.uri }} style={styles.selfiePreview} />
            <View style={styles.selfieOverlay}>
              <MaterialIcons name="refresh" size={32} color="white" />
              <Text style={styles.selfieOverlayText}>Tap to retake</Text>
            </View>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.selfieButton}
            onPress={() => handleTakePhoto('selfiePhoto')}
          >
            <View style={styles.selfieIconContainer}>
              <MaterialIcons name="person" size={60} color="#d1d5db" />
            </View>
            <MaterialIcons name="camera-alt" size={32} color="#0C2D48" />
            <Text style={styles.selfieButtonText}>Take Selfie</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.instructionsList}>
        <Text style={styles.instructionsTitle}>Tips for a good selfie:</Text>
        <View style={styles.instructionItem}>
          <MaterialIcons name="check-circle" size={16} color="#10b981" />
          <Text style={styles.instructionText}>Face the camera directly</Text>
        </View>
        <View style={styles.instructionItem}>
          <MaterialIcons name="check-circle" size={16} color="#10b981" />
          <Text style={styles.instructionText}>Ensure good lighting</Text>
        </View>
        <View style={styles.instructionItem}>
          <MaterialIcons name="check-circle" size={16} color="#10b981" />
          <Text style={styles.instructionText}>Remove sunglasses and hats</Text>
        </View>
        <View style={styles.instructionItem}>
          <MaterialIcons name="check-circle" size={16} color="#10b981" />
          <Text style={styles.instructionText}>Keep a neutral expression</Text>
        </View>
      </View>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Review & Submit</Text>
      <Text style={styles.stepSubtitle}>Please review your information before submitting</Text>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Personal Information</Text>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Full Name</Text>
          <Text style={styles.reviewValue}>{formData.fullName}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>ID Number</Text>
          <Text style={styles.reviewValue}>{formData.idNumber}</Text>
        </View>
        <View style={styles.reviewItem}>
          <Text style={styles.reviewLabel}>Address</Text>
          <Text style={styles.reviewValue}>{formData.address}, {formData.city}</Text>
        </View>
      </View>

      <View style={styles.reviewSection}>
        <Text style={styles.reviewSectionTitle}>Documents Uploaded</Text>
        <View style={styles.documentChecklist}>
          <View style={styles.checklistItem}>
            <MaterialIcons
              name={formData.idDocument.front ? 'check-circle' : 'radio-button-unchecked'}
              size={20}
              color={formData.idDocument.front ? '#10b981' : '#9ca3af'}
            />
            <Text style={styles.checklistText}>ID Document (Front)</Text>
          </View>
          <View style={styles.checklistItem}>
            <MaterialIcons
              name={formData.idDocument.back ? 'check-circle' : 'radio-button-unchecked'}
              size={20}
              color={formData.idDocument.back ? '#10b981' : '#9ca3af'}
            />
            <Text style={styles.checklistText}>ID Document (Back)</Text>
          </View>
          <View style={styles.checklistItem}>
            <MaterialIcons
              name={formData.driverLicense.front ? 'check-circle' : 'radio-button-unchecked'}
              size={20}
              color={formData.driverLicense.front ? '#10b981' : '#9ca3af'}
            />
            <Text style={styles.checklistText}>Driver License</Text>
          </View>
          <View style={styles.checklistItem}>
            <MaterialIcons
              name={formData.selfiePhoto ? 'check-circle' : 'radio-button-unchecked'}
              size={20}
              color={formData.selfiePhoto ? '#10b981' : '#9ca3af'}
            />
            <Text style={styles.checklistText}>Selfie Photo</Text>
          </View>
        </View>
      </View>

      <View style={styles.consentBox}>
        <TouchableOpacity
          style={styles.consentCheckbox}
          onPress={() => updateFormData('consentGiven', !formData.consentGiven)}
        >
          <MaterialIcons
            name={formData.consentGiven ? 'check-box' : 'check-box-outline-blank'}
            size={24}
            color={formData.consentGiven ? '#0C2D48' : '#9ca3af'}
          />
        </TouchableOpacity>
        <Text style={styles.consentText}>
          I confirm that all information provided is accurate and I consent to the verification of my documents.
          I agree to the Terms of Service and Privacy Policy.
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Transporter Verification</Text>
          <Text style={styles.headerSubtitle}>Step {currentStep} of {STEPS.length}</Text>
        </View>
      </View>

      {/* Progress Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.progressScroll}>
        {renderProgressBar()}
      </ScrollView>

      {/* Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
      </ScrollView>

      {/* Bottom Buttons */}
      <View style={styles.bottomButtons}>
        {currentStep > 1 && (
          <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
            <MaterialIcons name="arrow-back" size={20} color="#374151" />
            <Text style={styles.backBtnText}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[
            styles.nextBtn,
            currentStep === STEPS.length && !formData.consentGiven && styles.nextBtnDisabled
          ]}
          onPress={currentStep === STEPS.length ? handleSubmit : handleNext}
          disabled={submitting || (currentStep === STEPS.length && !formData.consentGiven)}
        >
          {submitting ? (
            <ActivityIndicator color="white" size="small" />
          ) : (
            <>
              <Text style={styles.nextBtnText}>
                {currentStep === STEPS.length ? 'Submit Verification' : 'Continue'}
              </Text>
              {currentStep < STEPS.length && (
                <MaterialIcons name="arrow-forward" size={20} color="white" />
              )}
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
    padding: 20,
    paddingTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 2,
  },
  progressScroll: {
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingHorizontal: 20,
  },
  stepIndicator: {
    alignItems: 'center',
    minWidth: 60,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  stepCircleActive: {
    backgroundColor: '#10b981',
  },
  stepCircleCurrent: {
    backgroundColor: '#0C2D48',
  },
  stepLabel: {
    fontSize: 10,
    color: '#9ca3af',
    textAlign: 'center',
  },
  stepLabelActive: {
    color: '#374151',
    fontWeight: '500',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 4,
  },
  stepLineActive: {
    backgroundColor: '#10b981',
  },
  scrollView: {
    flex: 1,
  },
  stepContent: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
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
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  idTypeSelector: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  idTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    backgroundColor: 'white',
  },
  idTypeButtonActive: {
    borderColor: '#0C2D48',
    backgroundColor: '#0C2D48',
  },
  idTypeText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  idTypeTextActive: {
    color: 'white',
  },
  photoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  photoUploadBox: {
    flex: 1,
    aspectRatio: 1.5,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderStyle: 'dashed',
    overflow: 'hidden',
    backgroundColor: '#f9fafb',
  },
  photoUploadBoxFilled: {
    borderStyle: 'solid',
    borderColor: '#10b981',
  },
  photoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  photoPlaceholderText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 8,
    textAlign: 'center',
  },
  photoHint: {
    fontSize: 11,
    color: '#9ca3af',
    marginTop: 4,
  },
  photoPreviewContainer: {
    flex: 1,
    position: 'relative',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  photoOverlayText: {
    color: 'white',
    fontSize: 12,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3c7',
    padding: 12,
    borderRadius: 8,
  },
  tipText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
  },
  licenseClasses: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  licenseClassButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#e5e7eb',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  licenseClassButtonActive: {
    borderColor: '#0C2D48',
    backgroundColor: '#0C2D48',
  },
  licenseClassText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
  },
  licenseClassTextActive: {
    color: 'white',
  },
  selfieContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  selfieButton: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 3,
    borderColor: '#0C2D48',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  selfieIconContainer: {
    marginBottom: 8,
  },
  selfieButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0C2D48',
    marginTop: 8,
  },
  selfiePreviewContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
  },
  selfiePreview: {
    width: '100%',
    height: '100%',
  },
  selfieOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selfieOverlayText: {
    color: 'white',
    fontSize: 12,
    marginTop: 4,
  },
  instructionsList: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
  },
  instructionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 14,
    color: '#6b7280',
  },
  reviewSection: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  reviewSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  reviewItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reviewLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  reviewValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
    textAlign: 'right',
  },
  documentChecklist: {
    gap: 8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checklistText: {
    fontSize: 14,
    color: '#374151',
  },
  consentBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#f3f4f6',
    padding: 16,
    borderRadius: 12,
  },
  consentCheckbox: {
    paddingTop: 2,
  },
  consentText: {
    flex: 1,
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
  },
  bottomButtons: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    gap: 8,
  },
  backBtnText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  nextBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#0C2D48',
    gap: 8,
  },
  nextBtnDisabled: {
    backgroundColor: '#9ca3af',
  },
  nextBtnText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
});

export default TransporterVerificationScreen;
