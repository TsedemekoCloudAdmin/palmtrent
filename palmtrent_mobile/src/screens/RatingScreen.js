import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import apiService from '../services/apiService';
import useAuth from '../hook/useAuth';

export const RatingScreen = ({ route, navigation, onNavigate }) => {
  // Get user info from auth hook
  const { user } = useAuth();

  // Extract params from route (React Navigation) or use direct props
  const params = route?.params || {};
  const bookingId = params.bookingId || params.booking?._id || params.job?.bookingId || params.job?._id;
  const booking = params.booking || params.job;
  const userType = params.userType || user?.userType || 'shipper';
  const [rating, setRating] = useState(0);
  const [categories, setCategories] = useState({});
  const [review, setReview] = useState('');
  const [wouldUseAgain, setWouldUseAgain] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingEligibility, setCheckingEligibility] = useState(true);
  const [canRate, setCanRate] = useState(true);
  const [canRateReason, setCanRateReason] = useState('');
  const [error, setError] = useState(null);
  const [selectedTags, setSelectedTags] = useState([]);

  const isTransporterRating = userType === 'transporter';

  // Category configuration based on who is rating
  const categoryConfig = isTransporterRating
    ? {
        // Transporter rating shipper
        communication: { label: 'Communication', key: 'communication' },
        accuracy: { label: 'Load Accuracy', key: 'accuracy' },
        accessibility: { label: 'Pickup/Delivery Access', key: 'accessibility' },
        payment: { label: 'Payment', key: 'payment' },
        cooperation: { label: 'Cooperation', key: 'cooperation' },
      }
    : {
        // Shipper rating transporter
        communication: { label: 'Communication', key: 'communication' },
        timeliness: { label: 'Punctuality', key: 'timeliness' },
        cargoHandling: { label: 'Cargo Handling', key: 'cargoHandling' },
        professionalism: { label: 'Professionalism', key: 'professionalism' },
        vehicleCondition: { label: 'Vehicle Condition', key: 'vehicleCondition' },
      };

  // Available tags based on user type
  const availableTags = isTransporterRating
    ? {
        positive: ['professional', 'great_communication', 'helpful', 'efficient'],
        negative: ['poor_communication', 'unprofessional', 'unreliable'],
      }
    : {
        positive: ['on_time', 'professional', 'great_communication', 'careful_handling', 'clean_vehicle', 'friendly', 'reliable'],
        negative: ['late', 'poor_communication', 'damaged_cargo', 'unprofessional', 'dirty_vehicle', 'rude', 'unreliable'],
      };

  // Check if user can rate this booking
  useEffect(() => {
    const checkRatingEligibility = async () => {
      if (!bookingId) {
        setCheckingEligibility(false);
        return;
      }

      try {
        const response = await apiService.checkCanRate(bookingId);
        if (response.success) {
          setCanRate(response.data.canRate);
          setCanRateReason(response.data.reason || '');
        }
      } catch (err) {
        console.error('Error checking rating eligibility:', err);
        // Allow rating attempt even if check fails
        setCanRate(true);
      } finally {
        setCheckingEligibility(false);
      }
    };

    checkRatingEligibility();
  }, [bookingId]);

  // Initialize categories with 0 values
  useEffect(() => {
    const initialCategories = {};
    Object.keys(categoryConfig).forEach((key) => {
      initialCategories[key] = 0;
    });
    setCategories(initialCategories);
  }, [userType]);

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmitRating = async () => {
    if (!bookingId) {
      Alert.alert('Error', 'Booking information is missing');
      return;
    }

    if (rating === 0) {
      Alert.alert('Error', 'Please provide an overall rating');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Prepare rating data matching backend schema
      const ratingData = {
        overallRating: rating,
        categories: categories,
        review: {
          text: review.trim(),
          isPublic: true,
        },
        tags: selectedTags,
        wouldUseAgain,
      };

      const response = await apiService.submitRating(bookingId, ratingData);

      if (response.success) {
        Alert.alert(
          'Thank You!',
          'Your rating has been submitted successfully.',
          [
            {
              text: 'OK',
              onPress: () => {
                if (navigation) {
                  navigation.navigate('MainTabs', { screen: 'Home' });
                } else if (onNavigate) {
                  onNavigate('home');
                }
              },
            },
          ]
        );
      } else {
        throw new Error(response.message || 'Failed to submit rating');
      }
    } catch (err) {
      console.error('Error submitting rating:', err);
      setError(err.message || 'Failed to submit rating. Please try again.');
      Alert.alert('Error', err.message || 'Failed to submit rating. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    if (navigation) {
      navigation.navigate('MainTabs', { screen: 'Home' });
    } else if (onNavigate) {
      onNavigate('home');
    }
  };

  const handleBack = () => {
    if (navigation) {
      navigation.goBack();
    } else if (onNavigate) {
      onNavigate('delivery-completed');
    }
  };

  // Get user info from booking
  const getUserInfo = () => {
    if (booking) {
      if (isTransporterRating) {
        // Transporter rating the shipper
        return {
          name: booking.user?.name || booking.shipper?.name || 'Shipper',
          initial: (booking.user?.name || booking.shipper?.name || 'S')[0].toUpperCase(),
        };
      } else {
        // Shipper rating the transporter
        return {
          name: booking.transporter?.name || booking.driver?.name || 'Driver',
          initial: (booking.transporter?.name || booking.driver?.name || 'D')[0].toUpperCase(),
        };
      }
    }
    return {
      name: isTransporterRating ? 'Shipper' : 'Driver',
      initial: isTransporterRating ? 'S' : 'D',
    };
  };

  const userInfo = getUserInfo();

  // Loading state while checking eligibility
  if (checkingEligibility) {
    return (
      <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0C2D48" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Cannot rate state
  if (!canRate) {
    return (
      <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rate {isTransporterRating ? 'Shipper' : 'Driver'}</Text>
        </View>
        <View style={styles.cannotRateContainer}>
          <MaterialIcons name="info-outline" size={64} color="#6b7280" />
          <Text style={styles.cannotRateTitle}>Cannot Rate</Text>
          <Text style={styles.cannotRateText}>{canRateReason}</Text>
          <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={handleSkip}>
            <Text style={styles.buttonText}>Go Home</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top','left','right','bottom']} style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0C2D48" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Rate {isTransporterRating ? 'Shipper' : 'Driver'}</Text>
        <Text style={styles.headerSubtitle}>Help others by sharing your experience</Text>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {/* Error Message */}
          {error && (
            <View style={styles.errorCard}>
              <MaterialIcons name="error-outline" size={20} color="#dc2626" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* User Info */}
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Text style={styles.avatarText}>{userInfo.initial}</Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userInfo.name}</Text>
              <Text style={styles.userRoute}>
                {booking?.route?.pickup?.city || booking?.route?.from || 'Origin'} →{' '}
                {booking?.route?.delivery?.city || booking?.route?.to || 'Destination'}
              </Text>
            </View>
          </View>

          {/* Overall Rating */}
          <View style={styles.ratingCard}>
            <Text style={styles.ratingTitle}>Overall Experience</Text>
            <View style={styles.starsContainer}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setRating(star)} activeOpacity={0.7}>
                  <MaterialIcons
                    name={star <= rating ? 'star' : 'star-border'}
                    size={48}
                    color={star <= rating ? '#fbbf24' : '#d1d5db'}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingDescription}>
              {rating === 0 && 'Tap to rate'}
              {rating === 1 && 'Poor'}
              {rating === 2 && 'Fair'}
              {rating === 3 && 'Good'}
              {rating === 4 && 'Very Good'}
              {rating === 5 && 'Excellent'}
            </Text>
          </View>

          {/* Category Ratings */}
          {rating > 0 && (
            <View style={styles.categoriesCard}>
              <Text style={styles.categoriesTitle}>Rate by Category</Text>
              <View style={styles.categoriesContainer}>
                {Object.entries(categoryConfig).map(([key, config]) => (
                  <CategoryRating
                    key={key}
                    label={config.label}
                    rating={categories[key] || 0}
                    onChange={(val) => setCategories({ ...categories, [key]: val })}
                  />
                ))}
              </View>
            </View>
          )}

          {/* Tags Selection */}
          {rating > 0 && (
            <View style={styles.tagsCard}>
              <Text style={styles.tagsTitle}>Quick Tags (Optional)</Text>
              <Text style={styles.tagsSubtitle}>Select tags that describe your experience</Text>

              {rating >= 3 && (
                <View style={styles.tagSection}>
                  <Text style={styles.tagSectionLabel}>Positive</Text>
                  <View style={styles.tagsContainer}>
                    {availableTags.positive.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.tag, selectedTags.includes(tag) && styles.tagSelected]}
                        onPress={() => toggleTag(tag)}
                      >
                        <Text
                          style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextSelected]}
                        >
                          {tag.replace(/_/g, ' ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {rating <= 3 && (
                <View style={styles.tagSection}>
                  <Text style={styles.tagSectionLabel}>Areas for Improvement</Text>
                  <View style={styles.tagsContainer}>
                    {availableTags.negative.map((tag) => (
                      <TouchableOpacity
                        key={tag}
                        style={[styles.tag, styles.tagNegative, selectedTags.includes(tag) && styles.tagNegativeSelected]}
                        onPress={() => toggleTag(tag)}
                      >
                        <Text
                          style={[styles.tagText, selectedTags.includes(tag) && styles.tagTextSelected]}
                        >
                          {tag.replace(/_/g, ' ')}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
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
                maxLength={500}
              />
              <Text style={styles.charCount}>{review.length}/500 characters</Text>
            </View>
          )}

          {/* Would Use Again */}
          {rating > 0 && (
            <View style={styles.useAgainCard}>
              <Text style={styles.useAgainTitle}>
                Would you {isTransporterRating ? 'accept jobs from' : 'use'} this{' '}
                {isTransporterRating ? 'shipper' : 'driver'} again?
              </Text>
              <View style={styles.useAgainOptions}>
                <TouchableOpacity
                  style={[styles.useAgainButton, wouldUseAgain === 'yes' && styles.useAgainSelectedYes]}
                  onPress={() => setWouldUseAgain('yes')}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="thumb-up"
                    size={20}
                    color={wouldUseAgain === 'yes' ? 'white' : '#374151'}
                  />
                  <Text
                    style={[styles.useAgainText, wouldUseAgain === 'yes' && styles.useAgainTextSelected]}
                  >
                    Yes
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.useAgainButton, wouldUseAgain === 'maybe' && styles.useAgainSelectedMaybe]}
                  onPress={() => setWouldUseAgain('maybe')}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[styles.useAgainText, wouldUseAgain === 'maybe' && styles.useAgainTextSelected]}
                  >
                    Maybe
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.useAgainButton, wouldUseAgain === 'no' && styles.useAgainSelectedNo]}
                  onPress={() => setWouldUseAgain('no')}
                  activeOpacity={0.7}
                >
                  <MaterialIcons
                    name="thumb-down"
                    size={20}
                    color={wouldUseAgain === 'no' ? 'white' : '#374151'}
                  />
                  <Text
                    style={[styles.useAgainText, wouldUseAgain === 'no' && styles.useAgainTextSelected]}
                  >
                    No
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[
              styles.button,
              styles.primaryButton,
              (rating === 0 || !wouldUseAgain || loading) && styles.buttonDisabled,
            ]}
            onPress={handleSubmitRating}
            disabled={rating === 0 || !wouldUseAgain || loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.buttonText}>Submit Rating</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
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
      <Text style={styles.categoryRating}>{rating === 0 ? '-' : `${rating}/5`}</Text>
    </View>
    <View style={styles.categoryStars}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.7}>
          <MaterialIcons
            name={star <= rating ? 'star' : 'star-border'}
            size={24}
            color={star <= rating ? '#fbbf24' : '#d1d5db'}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  cannotRateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cannotRateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  cannotRateText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
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
  errorCard: {
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 14,
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
  tagsCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 24,
  },
  tagsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  tagsSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },
  tagSection: {
    marginBottom: 16,
  },
  tagSectionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  tagSelected: {
    backgroundColor: '#0C2D48',
    borderColor: '#0C2D48',
  },
  tagNegative: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  tagNegativeSelected: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  tagText: {
    fontSize: 12,
    color: '#374151',
    textTransform: 'capitalize',
  },
  tagTextSelected: {
    color: 'white',
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
