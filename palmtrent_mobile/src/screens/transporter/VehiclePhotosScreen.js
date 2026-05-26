import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Dimensions
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { width } = Dimensions.get('window');

const VehiclePhotosScreen = ({ navigation, onNavigate }) => {
  const [photos, setPhotos] = useState({
    front: null,
    back: null,
    leftSide: null,
    rightSide: null,
    interior: null,
    cargoArea: null
  });

  const requiredPhotos = [
    { key: 'front', label: 'Front View', required: true },
    { key: 'back', label: 'Back View', required: true },
    { key: 'leftSide', label: 'Left Side', required: true },
    { key: 'rightSide', label: 'Right Side', required: true },
    { key: 'interior', label: 'Interior/Dashboard', required: false },
    { key: 'cargoArea', label: 'Cargo Area', required: true }
  ];

  const completedCount = Object.values(photos).filter(p => p !== null).length;
  const requiredCount = requiredPhotos.filter(p => p.required).length;

  const navigateTo = (screen, params = {}) => {
    if (onNavigate) {
      onNavigate(screen, params);
    } else if (navigation) {
      navigation.navigate(screen, params);
    }
  };

  const handleTakePhoto = (photoKey) => {
    setPhotos(prev => ({
      ...prev,
      [photoKey]: `photo_${photoKey}_${Date.now()}`
    }));
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
        <View>
          <Text style={styles.headerTitle}>Vehicle Photos</Text>
          <Text style={styles.headerSubtitle}>
            {completedCount}/{requiredCount} required photos taken
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Photo Guidelines */}
        <View style={styles.section}>
          <View style={styles.guidelinesCard}>
            <Text style={styles.guidelinesTitle}>Photo Guidelines</Text>
            <View style={styles.guidelinesList}>
              <GuidelineItem text="Take photos in good lighting" />
              <GuidelineItem text="Capture entire vehicle in frame" />
              <GuidelineItem text="License plate must be visible" />
              <GuidelineItem text="Photos should be clear and recent" />
            </View>
          </View>
        </View>

        {/* Photo Grid */}
        <View style={styles.section}>
          <View style={styles.photosGrid}>
            {requiredPhotos.map((photo) => (
              <VehiclePhotoCard
                key={photo.key}
                photo={photo}
                taken={!!photos[photo.key]}
                onTake={() => handleTakePhoto(photo.key)}
              />
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              completedCount < requiredCount && styles.submitButtonDisabled
            ]}
            onPress={() => navigateTo('TransporterVerification', { submittedPhotos: photos })}
            disabled={completedCount < requiredCount}
          >
            <Text style={styles.submitButtonText}>
              Submit Photos ({completedCount}/{requiredCount})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Reduced bottom padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper Components
const GuidelineItem = ({ text }) => (
  <View style={styles.guidelineItem}>
    <MaterialIcons name="check" size={16} color="#1e40af" />
    <Text style={styles.guidelineText}>{text}</Text>
  </View>
);

const VehiclePhotoCard = ({ photo, taken, onTake }) => (
  <TouchableOpacity
    style={[
      styles.photoCard,
      taken ? styles.photoCardTaken : styles.photoCardEmpty
    ]}
    onPress={onTake}
  >
    {taken ? (
      <>
        <MaterialIcons name="check-circle" size={48} color="#16a34a" />
        <Text style={styles.photoLabelTaken}>{photo.label}</Text>
        <Text style={styles.photoStatusTaken}>✓ Taken</Text>
      </>
    ) : (
      <>
        <MaterialIcons name="photo-camera" size={48} color="#6b7280" />
        <Text style={styles.photoLabel}>{photo.label}</Text>
        {photo.required && (
          <Text style={styles.photoRequired}>* Required</Text>
        )}
      </>
    )}
  </TouchableOpacity>
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
  },
  headerSubtitle: {
    color: 'white',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 4,
  },
  section: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  guidelinesCard: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#93c5fd',
    borderRadius: 12,
    padding: 16,
  },
  guidelinesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e3a8a',
    marginBottom: 8,
  },
  guidelinesList: {
    gap: 4,
  },
  guidelineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  guidelineText: {
    fontSize: 14,
    color: '#1e40af',
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  photoCard: {
    width: (width - 44) / 2,
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  photoCardEmpty: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    backgroundColor: 'white',
  },
  photoCardTaken: {
    backgroundColor: '#dcfce7',
    borderWidth: 2,
    borderColor: '#16a34a',
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginTop: 8,
    textAlign: 'center',
  },
  photoLabelTaken: {
    fontSize: 14,
    fontWeight: '500',
    color: '#166534',
    marginTop: 8,
    textAlign: 'center',
  },
  photoRequired: {
    fontSize: 12,
    color: '#dc2626',
    marginTop: 4,
  },
  photoStatusTaken: {
    fontSize: 12,
    color: '#16a34a',
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: '#0C2D48',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 20,
  },
});

export default VehiclePhotosScreen;
