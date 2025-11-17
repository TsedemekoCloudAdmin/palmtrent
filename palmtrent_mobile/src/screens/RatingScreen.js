import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  TextInput,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export const RatingScreen = ({ userType, job, onNavigate }) => {
  const [rating, setRating] = useState(0);
  const [categories, setCategories] = useState({
    punctuality: 0,
    professionalism: 0,
    cargoHandling: 0,
    communication: 0,
    vehicleCondition: 0
  });
  const [review, setReview] = useState('');
  const [wouldUseAgain, setWouldUseAgain] = useState(null);

  const isTransporterRating = userType === 'transporter';
  const categoryLabels = isTransporterRating 
    ? {
        loadAccuracy: 'Load Accuracy',
        payment: 'Payment',
        communication: 'Communication',
        loadingAssistance: 'Loading Assistance',
        professionalism: 'Professionalism'
      }
    : {
        punctuality: 'Punctuality',
        professionalism: 'Professionalism',
        cargoHandling: 'Cargo Handling',
        communication: 'Communication',
        vehicleCondition: 'Vehicle Condition'
      };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => onNavigate('delivery-completed')} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate {isTransporterRating ? 'Shipper' : 'Driver'}</Text>
        <Text style={styles.headerSubtitle}>Help others by sharing your experience</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* User Info */}
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.avatarText}>
                {isTransporterRating ? 'J' : 'T'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>
                {isTransporterRating ? 'John Moyo' : 'Trust Ncube'}
              </Text>
              <Text style={styles.userRoute}>
                {job?.route?.from} → {job?.route?.to}
              </Text>
            </View>
          </View>

          {/* Overall Rating */}
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>Overall Experience</Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => setRating(star)}
                  activeOpacity={0.7}
                >
                  <MaterialIcons 
                    name={star <= rating ? "star" : "star-border"} 
                    size={48} 
                    color={star <= rating ? "#fbbf24" : "#d1d5db"} 
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingDescription}>
              {rating === 0 && 'Tap to rate'}
              {rating === 1 && '😞 Poor'}
              {rating === 2 && '😐 Fair'}
              {rating === 3 && '🙂 Good'}
              {rating === 4 && '😊 Very Good'}
              {rating === 5 && '🤩 Excellent'}
            </Text>
          </View>

          {/* Category Ratings */}
          {rating > 0 && (
            <View style={styles.categoriesCard}>
              <Text style={styles.categoriesTitle}>Rate by Category</Text>
              <View style={styles.categoriesContainer}>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <CategoryRating
                    key={key}
                    label={label}
                    rating={categories[key]}
                    onChange={(val) => setCategories({...categories, [key]: val})}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Written Review */}
          {rating > 0 && (
            <View style={styles.reviewCard}>
              <Text style={styles.reviewTitle}>Write a Review (Optional)</Text>
              <TextInput
                style={styles.textInput}
                value={review}
                onChangeText={setReview}
                placeholder="Share details about your experience..."
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{review.length}/500 characters</Text>
            </View>
          )}

          {/* Would Use Again */}
          {rating > 0 && (
            <View style={styles.useAgainCard}>
              <Text style={styles.useAgainTitle}>
                Would you {isTransporterRating ? 'accept jobs from' : 'use'} this {isTransporterRating ? 'shipper' : 'driver'} again?
              </Text>
              <View style={styles.useAgainOptions}>
                <TouchableOpacity
                  style={[styles.useAgainButton, wouldUseAgain === 'yes' && styles.useAgainSelectedYes]}
                  onPress={() => setWouldUseAgain('yes')}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="thumb-up" size={20} color={wouldUseAgain === 'yes' ? 'white' : '#374151'} />
                  <Text style={[styles.useAgainText, wouldUseAgain === 'yes' && styles.useAgainTextSelected]}>Yes</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.useAgainButton, wouldUseAgain === 'maybe' && styles.useAgainSelectedMaybe]}
                  onPress={() => setWouldUseAgain('maybe')}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.useAgainText, wouldUseAgain === 'maybe' && styles.useAgainTextSelected]}>Maybe</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.useAgainButton, wouldUseAgain === 'no' && styles.useAgainSelectedNo]}
                  onPress={() => setWouldUseAgain('no')}
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="thumb-down" size={20} color={wouldUseAgain === 'no' ? 'white' : '#374151'} />
                  <Text style={[styles.useAgainText, wouldUseAgain === 'no' && styles.useAgainTextSelected]}>No</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.button, styles.primaryButton, (rating === 0 || !wouldUseAgain) && styles.buttonDisabled]}
            onPress={() => onNavigate('rating-submitted')}
            disabled={rating === 0 || !wouldUseAgain}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>Submit Rating</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => onNavigate('home')}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Skip for Now</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

// Helper Component
const CategoryRating = ({ label, rating, onChange }) => (
  <View style={styles.categoryRow}>
    <View style={styles.categoryHeader}>
      <Text style={styles.categoryLabel}>{label}</Text>
      <Text style={styles.categoryRating}>
        {rating === 0 ? '-' : `${rating}/5`}
      </Text>
    </View>
    <View style={styles.categoryStars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onChange(star)}
          activeOpacity={0.7}
        >
          <MaterialIcons 
            name={star <= rating ? "star" : "star-border"} 
            size={24} 
            color={star <= rating ? "#fbbf24" : "#d1d5db"} 
          />
        </TouchableOpacity>
      ))}
    </View>
  </View>
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
  backButton: {
    marginBottom: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 64,
    height: 64,
    backgroundColor: '#dbeafe',
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#0C2D48',
    fontSize: 24,
    fontWeight: 'bold',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  userRoute: {
    fontSize: 14,
    color: '#6b7280',
  },
  ratingCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
    alignItems: 'center',
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  ratingDescription: {
    fontSize: 16,
    color: '#6b7280',
  },
  categoriesCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
  },
  categoriesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  categoriesContainer: {
    gap: 20,
  },
  categoryRow: {
    gap: 8,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryLabel: {
    fontSize: 14,
    color: '#374151',
  },
  categoryRating: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  categoryStars: {
    flexDirection: 'row',
    gap: 4,
  },
  reviewCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
  },
  reviewTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'right',
  },
  useAgainCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
  },
  useAgainTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  useAgainOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  useAgainButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
  },
  useAgainSelectedYes: {
    backgroundColor: '#16a34a',
  },
  useAgainSelectedMaybe: {
    backgroundColor: '#f59e0b',
  },
  useAgainSelectedNo: {
    backgroundColor: '#dc2626',
  },
  useAgainText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  useAgainTextSelected: {
    color: 'white',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginVertical: 4,
  },
  primaryButton: {
    backgroundColor: '#0C2D48',
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
  skipButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  skipButtonText: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
});

export default RatingScreen;